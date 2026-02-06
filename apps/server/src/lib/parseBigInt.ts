/**
 * Safely parse a string into a positive BigInt value.
 * Throws a descriptive error if parsing fails or the value is not positive.
 */
export function parseBigInt(value: string, fieldName: string): bigint {
  let result: bigint;
  try {
    result = BigInt(value);
  } catch {
    throw new ParseBigIntError(`Invalid ${fieldName}: value must be a valid integer`);
  }

  if (result <= 0n) {
    throw new ParseBigIntError(`Invalid ${fieldName}: value must be positive`);
  }

  return result;
}

/**
 * Like parseBigInt but allows zero values (>= 0).
 * Useful for fields like entry fees where zero is valid.
 */
export function parseBigIntNonNegative(value: string, fieldName: string): bigint {
  let result: bigint;
  try {
    result = BigInt(value);
  } catch {
    throw new ParseBigIntError(`Invalid ${fieldName}: value must be a valid integer`);
  }

  if (result < 0n) {
    throw new ParseBigIntError(`Invalid ${fieldName}: value must not be negative`);
  }

  return result;
}

export class ParseBigIntError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseBigIntError';
  }
}
