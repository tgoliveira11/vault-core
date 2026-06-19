// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lockVaultSession, unlockVaultSession } from "../../browser.js";
import { createUserVaultKey } from "../../index.js";
import { useVaultUnlocked } from "./use-vault-unlocked.js";

describe("useVaultUnlocked", () => {
  it("tracks browser vault session unlock state", async () => {
    lockVaultSession();
    const { result } = renderHook(() => useVaultUnlocked());
    expect(result.current).toBe(false);

    const key = await createUserVaultKey();
    await act(async () => {
      unlockVaultSession(key);
    });
    expect(result.current).toBe(true);

    await act(async () => {
      lockVaultSession();
    });
    expect(result.current).toBe(false);
  });
});
