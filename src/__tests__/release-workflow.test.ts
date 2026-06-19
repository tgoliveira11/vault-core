import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// @ts-expect-error The release helper is an intentionally uncompiled Node.js module.
import {
  bumpVersion,
  extractUnreleased,
  inferReleaseBump,
  prepareRelease,
  releaseChangelog,
  resolveReleaseVersion,
} from "../../scripts/prepare-release.mjs";

const changelog = `# Changelog

## [Unreleased]

### Added

- New public feature.

### Changed

- **Breaking:** Changed a public signature.

## [0.1.1] - 2026-06-18

- Initial release.
`;

describe("release preparation", () => {
  it("infers SemVer bumps from changelog intent", () => {
    const unreleased = extractUnreleased(changelog);
    expect(inferReleaseBump("0.1.1", unreleased)).toBe("minor");
    expect(inferReleaseBump("1.2.3", unreleased)).toBe("major");
    expect(inferReleaseBump("1.2.3", "### Added\n\n- Feature")).toBe("minor");
    expect(inferReleaseBump("1.2.3", "### Fixed\n\n- Fix")).toBe("patch");
  });

  it("supports explicit bump names and exact versions", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
    expect(resolveReleaseVersion("0.1.1", "0.5.0", "changes")).toBe("0.5.0");
    expect(() => resolveReleaseVersion("0.1.1", "0.1.1", "changes")).toThrow(/greater/);
    expect(() => resolveReleaseVersion("0.1.1", "latest", "changes")).toThrow(/SemVer/);
  });

  it("moves Unreleased entries into a dated release", () => {
    const released = releaseChangelog(changelog, "0.2.0", "2026-06-19");
    expect(released).toContain("## [Unreleased]\n\n## [0.2.0] - 2026-06-19");
    expect(released).toContain("## [0.1.1] - 2026-06-18");
    expect(extractUnreleased(released)).toBe("");
  });

  it("updates package metadata consistently and supports interrupted-release recovery", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vault-core-release-"));
    try {
      writeFileSync(
        path.join(root, "package.json"),
        `${JSON.stringify({ name: "vault-core", version: "0.1.1" }, null, 2)}\n`
      );
      writeFileSync(
        path.join(root, "package-lock.json"),
        `${JSON.stringify({ version: "0.1.1", packages: { "": { version: "0.1.1" } } }, null, 2)}\n`
      );
      writeFileSync(path.join(root, "CHANGELOG.md"), changelog);

      expect(
        prepareRelease({ root, releaseSpec: "", date: "2026-06-19" })
      ).toEqual({ version: "0.2.0", changed: true, recovery: false });
      expect(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version).toBe(
        "0.2.0"
      );
      expect(
        JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8")).packages[""]
          .version
      ).toBe("0.2.0");

      expect(prepareRelease({ root, releaseSpec: "" })).toEqual({
        version: "0.2.0",
        changed: false,
        recovery: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
