import { vaultEmergencyServerMetadataSchema } from "@tgoliveira/vault-core";
import type { z } from "zod";

const STORAGE_KEY = "vault-core-demo:emergency-metadata";

export type DemoEmergencyMetadata = z.infer<typeof vaultEmergencyServerMetadataSchema>;

const DEFAULT_METADATA: DemoEmergencyMetadata = {
  emergencyModeActive: false,
  decoyConfigured: false,
  duressSequence: null,
  emergencyExitEmailRequired: false,
};

export function loadDemoEmergencyMetadata(): DemoEmergencyMetadata {
  if (typeof window === "undefined") return DEFAULT_METADATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_METADATA;
  try {
    return vaultEmergencyServerMetadataSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_METADATA;
  }
}

export function saveDemoEmergencyMetadata(metadata: DemoEmergencyMetadata): void {
  const parsed = vaultEmergencyServerMetadataSchema.parse(metadata);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export function clearDemoEmergencyMetadata(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function setDemoEmergencyModeActive(active: boolean): void {
  const current = loadDemoEmergencyMetadata();
  saveDemoEmergencyMetadata({
    ...current,
    emergencyModeActive: active,
    emergencyModeEnteredAt: active ? new Date().toISOString() : null,
  });
}

export function getDemoServerStatusSnapshot(configured: boolean, hasPasskey: boolean) {
  const meta = loadDemoEmergencyMetadata();
  return {
    configured,
    hasPasskeyPrfEnvelope: hasPasskey,
    emergencyModeActive: meta.emergencyModeActive,
    decoyConfigured: meta.decoyConfigured,
  };
}
