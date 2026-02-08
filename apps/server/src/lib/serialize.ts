/**
 * Shared serialization utilities for Moltblox API.
 *
 * Prisma returns BigInt fields that JSON.stringify cannot handle.
 * These helpers convert BigInt values to strings for API responses.
 */

/**
 * Convert specific BigInt fields on an object to strings.
 * Pass the field names that are BigInt in the Prisma model.
 */
export function serializeBigIntFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === 'bigint') {
      (result as Record<string, unknown>)[field as string] = val.toString();
    } else if (val === null || val === undefined) {
      (result as Record<string, unknown>)[field as string] = '0';
    }
  }
  return result;
}
