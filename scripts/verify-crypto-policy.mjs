#!/usr/bin/env node
/**
 * CI guard: fails when recommended vault crypto algorithms or parameters are weakened.
 * Runs the dedicated crypto policy vitest suite.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "src/__tests__/crypto-policy.test.ts"],
  { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname }
);

process.exit(result.status ?? 1);
