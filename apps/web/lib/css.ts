/**
 * CSS sanitization helpers to prevent injection via style attributes.
 */

export function safeCssBackground(value: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^https?:\/\//.test(value)) return `url(${encodeURI(value)})`;
  return '#1a1a2e';
}

export function safeCssValue(value: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^https?:\/\//.test(value)) return `url(${encodeURI(value)})`;
  return '#1a2e33';
}
