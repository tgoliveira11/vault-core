import { describe, expect, it } from "vitest";
import { containsDuressSequence } from "../../emergency/contains-duress-sequence.js";
import { MAX_DURESS_PASSWORD_LENGTH } from "../../emergency/constants.js";

describe("containsDuressSequence", () => {
  it("returns true when sequence appears as contiguous substring", () => {
    expect(containsDuressSequence("my911password", "911")).toBe(true);
    expect(containsDuressSequence("911", "911")).toBe(true);
  });

  it("returns false when sequence is empty", () => {
    expect(containsDuressSequence("anything", "")).toBe(false);
  });

  it("returns false when sequence is not a substring", () => {
    expect(containsDuressSequence("normal-password", "911")).toBe(false);
    expect(containsDuressSequence("91x1", "911")).toBe(false);
  });

  it("rejects passwords exceeding max length", () => {
    const long = "a".repeat(MAX_DURESS_PASSWORD_LENGTH + 1);
    expect(containsDuressSequence(long, "a")).toBe(false);
  });

  it("rejects sequences exceeding max length", () => {
    const longSeq = "a".repeat(MAX_DURESS_PASSWORD_LENGTH + 1);
    expect(containsDuressSequence("short", longSeq)).toBe(false);
  });

  it("returns false when sequence longer than password", () => {
    expect(containsDuressSequence("ab", "abcd")).toBe(false);
  });

  it("scans all positions without short-circuit", () => {
    expect(containsDuressSequence("xxxxx911", "911")).toBe(true);
    expect(containsDuressSequence("no-match-here", "911")).toBe(false);
  });
});
