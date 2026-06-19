export function serializeVaultPayload(payload: unknown): string {
  return JSON.stringify(payload);
}

export function parseVaultPayload<T>(json: string): T {
  return JSON.parse(json) as T;
}
