import { vaultSetupWithDecoySchema } from "@tgoliveira/vault-core";
import type { z } from "zod";

const STORAGE_KEY = "vault-core-demo:record";

export type StoredVaultRecord = z.infer<typeof vaultSetupWithDecoySchema>;

export function isVaultConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) != null;
}

export function loadVaultRecord(): StoredVaultRecord | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return vaultSetupWithDecoySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveVaultRecord(record: StoredVaultRecord): void {
  const parsed = vaultSetupWithDecoySchema.parse(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export function clearVaultRecord(): void {
  localStorage.removeItem(STORAGE_KEY);
}
