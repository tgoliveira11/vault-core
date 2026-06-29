export function readStringEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: string
): string {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  return raw.trim();
}

export function readBoolEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: boolean
): boolean {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  throw new Error(`${key} must be a boolean (true/false)`);
}

export function readIntEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: number,
  bounds?: { min?: number; max?: number }
): number {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  if (bounds?.min != null && value < bounds.min) {
    throw new Error(`${key} must be >= ${bounds.min}`);
  }
  if (bounds?.max != null && value > bounds.max) {
    throw new Error(`${key} must be <= ${bounds.max}`);
  }
  return value;
}

export function readEnumEnv<T extends string>(
  env: Record<string, string | undefined>,
  key: string,
  allowed: readonly T[],
  defaultValue: T
): T {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim() as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return normalized;
}
