#!/usr/bin/env node
/**
 * CI guard: public package entry points must not export session-key setters.
 * Run after build with --dist to also scan emitted .d.ts files.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_SYMBOLS = ["setSessionVaultKey"];

const SOURCE_ENTRIES = [
  "src/index.ts",
  "src/browser.ts",
  "src/react/index.ts",
];

const DIST_ENTRIES = [
  "dist/index.d.ts",
  "dist/browser.d.ts",
  "dist/react/index.d.ts",
];

const FORBIDDEN_PATTERNS = FORBIDDEN_SYMBOLS.flatMap((symbol) => [
  new RegExp(`\\bexport\\s*\\{[^}]*\\b${symbol}\\b`, "m"),
  new RegExp(`\\bexport\\s+(async\\s+)?function\\s+${symbol}\\b`, "m"),
  new RegExp(`\\bexport\\s*\\{\\s*${symbol}\\s*\\}`, "m"),
  new RegExp(`\\bexport\\s*\\*\\s*from\\s*['"].*memory-session`, "m"),
]);

function inspectFile(relativePath) {
  const absolutePath = join(ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    return [`Missing expected entry file: ${relativePath}`];
  }

  const content = readFileSync(absolutePath, "utf8");
  const violations = [];

  for (const symbol of FORBIDDEN_SYMBOLS) {
    if (content.includes(symbol)) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${relativePath}: must not publicly export "${symbol}"`);
          break;
        }
      }
    }
  }

  return violations;
}

function main() {
  const checkDist = process.argv.includes("--dist");
  const targets = checkDist ? DIST_ENTRIES : SOURCE_ENTRIES;
  const violations = targets.flatMap((file) => inspectFile(file));

  if (violations.length > 0) {
    console.error("Public export guard failed:\n");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    console.error(
      "\nSession UVK must enter memory only via unlockVaultSession() on the browser entry."
    );
    process.exit(1);
  }

  console.log(
    `Public export guard passed (${checkDist ? "dist" : "source"}: ${targets.join(", ")})`
  );
}

main();
