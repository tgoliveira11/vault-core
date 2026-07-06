import { MAX_DURESS_PASSWORD_LENGTH } from "./constants.js";

/**
 * Constant-time check: does `password` contain `sequence` as a contiguous substring?
 * Empty sequence never matches. Inputs exceeding {@link MAX_DURESS_PASSWORD_LENGTH} are rejected.
 */
export function containsDuressSequence(password: string, sequence: string): boolean {
  if (!sequence || sequence.length === 0) return false;
  if (password.length > MAX_DURESS_PASSWORD_LENGTH) return false;
  if (sequence.length > MAX_DURESS_PASSWORD_LENGTH) return false;
  if (sequence.length > password.length) return false;

  const passwordChars = [...password];
  const sequenceChars = [...sequence];
  const seqLen = sequenceChars.length;
  const maxStart = passwordChars.length - seqLen;

  let found = 0;
  for (let start = 0; start <= maxStart; start++) {
    let matchAtStart = 1;
    for (let offset = 0; offset < seqLen; offset++) {
      const equal = passwordChars[start + offset] === sequenceChars[offset] ? 1 : 0;
      matchAtStart &= equal;
    }
    found |= matchAtStart;
  }

  return found === 1;
}
