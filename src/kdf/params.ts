export const DEFAULT_ARGON2ID_PARAMS = {
  memory: 65536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

export type Argon2idParams = typeof DEFAULT_ARGON2ID_PARAMS;
