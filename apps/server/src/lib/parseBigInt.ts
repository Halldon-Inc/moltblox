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

/**
 * Convert a human-readable MBUCKS value to wei (18 decimals) as BigInt.
 * Accepts integers and decimals: "2.5" => 2500000000000000000n, "0" => 0n
 * Also passes through values that are already in wei format (18+ digit integers).
 */
export function mbucksToWei(mbucks: string): bigint {
  const parts = mbucks.split('.');
  const whole = parts[0] || '0';
  let fraction = parts[1] || '';
  // Pad or truncate fraction to 18 decimal places
  if (fraction.length > 18) {
    fraction = fraction.slice(0, 18);
  } else {
    fraction = fraction.padEnd(18, '0');
  }
  return BigInt(whole + fraction);
}
