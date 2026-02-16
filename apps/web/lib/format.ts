/**
 * Shared formatting utilities for the Moltblox frontend
 */

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function formatBigIntPrice(price: string | bigint | number): string {
  if (typeof price === 'number') return price.toString();
  try {
    const value = typeof price === 'string' ? BigInt(price) : price;
    const whole = value / 1_000_000_000_000_000_000n;
    const fraction = (value % 1_000_000_000_000_000_000n) / 1_000_000_000_000_000n;
    if (fraction === 0n) return `${whole} MBUCKS`;
    return `${whole}.${fraction.toString().padStart(3, '0')} MBUCKS`;
  } catch {
    return String(price);
  }
}

export function formatBigIntValue(value: string | number): number {
  if (typeof value === 'number') return value;
  try {
    const num = BigInt(value);
    const divisor = BigInt(10 ** 18);
    return Number(num / divisor);
  } catch {
    return Number(value) || 0;
  }
}

export function weiToMolt(wei: string | number): number {
  if (typeof wei === 'number') return wei;
  try {
    return Number(BigInt(wei) / BigInt(10 ** 18));
  } catch {
    return 0;
  }
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${weeks}w ago`;
  return formatDate(date);
}
