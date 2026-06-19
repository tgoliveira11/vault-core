export const DEFAULT_ARGON2ID_PARAMS = {
  memory: 65536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

export const ARGON2ID_LIMITS = {
  memory: { min: 8192, max: 262144 },
  iterations: { min: 1, max: 10 },
  parallelism: { min: 1, max: 4 },
  saltLength: { min: 16, max: 64 },
} as const;

export type Argon2idParams = typeof DEFAULT_ARGON2ID_PARAMS;

export function assertSafeArgon2idParams(params: {
  memory: number;
  iterations: number;
  parallelism: number;
}): void {
  assertIntegerInRange("memory", params.memory, ARGON2ID_LIMITS.memory);
  assertIntegerInRange("iterations", params.iterations, ARGON2ID_LIMITS.iterations);
  assertIntegerInRange("parallelism", params.parallelism, ARGON2ID_LIMITS.parallelism);
}

export function assertSafeArgon2idSalt(salt: Uint8Array): void {
  if (
    salt.byteLength < ARGON2ID_LIMITS.saltLength.min ||
    salt.byteLength > ARGON2ID_LIMITS.saltLength.max
  ) {
    throw new Error(
      `Argon2id salt length must be between ${ARGON2ID_LIMITS.saltLength.min} and ${ARGON2ID_LIMITS.saltLength.max} bytes`
    );
  }
}

function assertIntegerInRange(
  name: string,
  value: number,
  range: { min: number; max: number }
): void {
  if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
    throw new Error(
      `Argon2id ${name} must be an integer between ${range.min} and ${range.max}`
    );
  }
}
