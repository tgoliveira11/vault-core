import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value) {
  const match = VERSION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Release version must use exact stable SemVer (x.y.z), received '${value}'`);
  }
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function bumpVersion(currentVersion, bump) {
  const [major, minor, patch] = parseVersion(currentVersion);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unsupported release bump '${bump}'`);
}

export function extractUnreleased(changelog) {
  const heading = "## [Unreleased]";
  const start = changelog.indexOf(heading);
  if (start === -1) throw new Error("CHANGELOG.md must contain an Unreleased section");
  const contentStart = start + heading.length;
  const nextHeading = changelog.indexOf("\n## [", contentStart);
  if (nextHeading === -1) {
    throw new Error("CHANGELOG.md must contain at least one dated release after Unreleased");
  }
  return changelog.slice(contentStart, nextHeading).trim();
}

function sectionHasEntries(unreleased, heading) {
  const marker = `### ${heading}`;
  const start = unreleased.indexOf(marker);
  if (start === -1) return false;
  const contentStart = start + marker.length;
  const nextSection = unreleased.indexOf("\n### ", contentStart);
  const section = unreleased.slice(
    contentStart,
    nextSection === -1 ? unreleased.length : nextSection
  );
  return section.split("\n").some((line) => /^-\s+\S/.test(line.trim()));
}

export function inferReleaseBump(currentVersion, unreleased) {
  if (!unreleased.trim()) throw new Error("Unreleased changelog section has no changes");
  if (/\*\*Breaking:\*\*/i.test(unreleased)) {
    return parseVersion(currentVersion)[0] === 0 ? "minor" : "major";
  }
  if (sectionHasEntries(unreleased, "Added")) return "minor";
  return "patch";
}

export function resolveReleaseVersion(currentVersion, releaseSpec, unreleased) {
  const normalizedSpec = releaseSpec.trim().toLowerCase();
  if (!normalizedSpec || normalizedSpec === "auto") {
    return bumpVersion(currentVersion, inferReleaseBump(currentVersion, unreleased));
  }
  if (["major", "minor", "patch"].includes(normalizedSpec)) {
    return bumpVersion(currentVersion, normalizedSpec);
  }
  parseVersion(normalizedSpec);
  if (compareVersions(normalizedSpec, currentVersion) <= 0) {
    throw new Error(
      `Explicit release version ${normalizedSpec} must be greater than current ${currentVersion}`
    );
  }
  return normalizedSpec;
}

export function releaseChangelog(changelog, version, date) {
  if (new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\]`, "m").test(changelog)) {
    throw new Error(`CHANGELOG.md already contains release ${version}`);
  }
  const unreleased = extractUnreleased(changelog);
  if (!unreleased) throw new Error("Unreleased changelog section has no changes");
  const heading = "## [Unreleased]";
  const start = changelog.indexOf(heading);
  const nextHeading = changelog.indexOf("\n## [", start + heading.length);
  return `${changelog.slice(0, start)}${heading}\n\n## [${version}] - ${date}\n\n${unreleased}\n${changelog.slice(nextHeading)}`;
}

export function prepareRelease({ root, releaseSpec = "", date = new Date().toISOString().slice(0, 10) }) {
  const packagePath = path.join(root, "package.json");
  const lockPath = path.join(root, "package-lock.json");
  const changelogPath = path.join(root, "CHANGELOG.md");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const packageLock = JSON.parse(readFileSync(lockPath, "utf8"));
  const changelog = readFileSync(changelogPath, "utf8");
  const unreleased = extractUnreleased(changelog);

  if (!unreleased) {
    if (releaseSpec && !["", "auto", packageJson.version].includes(releaseSpec.toLowerCase())) {
      throw new Error("Cannot choose a new version because Unreleased has no changes");
    }
    return { version: packageJson.version, changed: false, recovery: true };
  }

  const version = resolveReleaseVersion(packageJson.version, releaseSpec, unreleased);
  packageJson.version = version;
  packageLock.version = version;
  if (!packageLock.packages?.[""]) {
    throw new Error("package-lock.json is missing the root package entry");
  }
  packageLock.packages[""].version = version;

  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  writeFileSync(changelogPath, releaseChangelog(changelog, version, date));
  return { version, changed: true, recovery: false };
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isMainModule()) {
  try {
    const result = prepareRelease({
      root: process.cwd(),
      releaseSpec: process.env.RELEASE_SPEC ?? "",
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `changed=${result.changed}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `recovery=${result.recovery}\n`);
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
