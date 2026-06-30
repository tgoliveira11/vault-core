import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractUnreleased } from "./prepare-release.mjs";

/**
 * Determines whether a publish run is a new release or recovery, and rejects
 * operator requests for a new version when [Unreleased] is empty.
 */
export function evaluateReleaseIntent({
  changelog,
  packageVersion,
  releaseSpec = "",
}) {
  const unreleased = extractUnreleased(changelog);
  const hasUnreleased = Boolean(unreleased.trim());
  const normalizedSpec = releaseSpec.trim().toLowerCase();
  const isAuto = !normalizedSpec || normalizedSpec === "auto";
  const isBumpKeyword = ["major", "minor", "patch"].includes(normalizedSpec);
  const matchesCurrentVersion = normalizedSpec === packageVersion.toLowerCase();
  const requestsNewVersion =
    !isAuto && !matchesCurrentVersion && (isBumpKeyword || normalizedSpec.includes("."));

  if (!hasUnreleased) {
    if (requestsNewVersion) {
      throw new Error(
        [
          "Cannot create a new release: CHANGELOG [Unreleased] is empty.",
          `Current package version is ${packageVersion}.`,
          "Leave the workflow version input blank to enter recovery mode",
          "(complete missing npm publish, git tag, or GitHub Release without bumping).",
        ].join(" ")
      );
    }
    return {
      mode: "recovery",
      version: packageVersion,
      hasUnreleased: false,
    };
  }

  return {
    mode: "new-release",
    version: null,
    hasUnreleased: true,
  };
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isMainModule()) {
  try {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    const result = evaluateReleaseIntent({
      changelog,
      packageVersion: packageJson.version,
      releaseSpec: process.env.RELEASE_SPEC ?? "",
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
