import { describe, expect, it } from "vitest";
import { evaluateReleaseIntent } from "../../scripts/changelog-preflight.mjs";

const changelogWithNotes = `# Changelog

## [Unreleased]

### Added

- Example feature.

## [0.3.0] - 2026-06-29

### Added

- Shipped.
`;

const changelogEmptyUnreleased = `# Changelog

## [Unreleased]

## [0.3.0] - 2026-06-29

### Added

- Shipped.
`;

describe("evaluateReleaseIntent", () => {
  it("selects new-release when Unreleased has entries", () => {
    expect(
      evaluateReleaseIntent({
        changelog: changelogWithNotes,
        packageVersion: "0.3.0",
        releaseSpec: "",
      })
    ).toEqual({
      mode: "new-release",
      version: null,
      hasUnreleased: true,
    });
  });

  it("selects recovery when Unreleased is empty", () => {
    expect(
      evaluateReleaseIntent({
        changelog: changelogEmptyUnreleased,
        packageVersion: "0.3.0",
        releaseSpec: "",
      })
    ).toEqual({
      mode: "recovery",
      version: "0.3.0",
      hasUnreleased: false,
    });
  });

  it("rejects bump keywords when Unreleased is empty", () => {
    expect(() =>
      evaluateReleaseIntent({
        changelog: changelogEmptyUnreleased,
        packageVersion: "0.3.0",
        releaseSpec: "patch",
      })
    ).toThrow(/Unreleased.*empty/i);
  });

  it("rejects explicit new versions when Unreleased is empty", () => {
    expect(() =>
      evaluateReleaseIntent({
        changelog: changelogEmptyUnreleased,
        packageVersion: "0.3.0",
        releaseSpec: "0.4.0",
      })
    ).toThrow(/recovery mode/i);
  });

  it("allows matching current version spec during recovery", () => {
    expect(
      evaluateReleaseIntent({
        changelog: changelogEmptyUnreleased,
        packageVersion: "0.3.0",
        releaseSpec: "0.3.0",
      })
    ).toEqual({
      mode: "recovery",
      version: "0.3.0",
      hasUnreleased: false,
    });
  });
});
