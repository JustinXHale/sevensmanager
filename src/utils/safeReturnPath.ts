/** Only allow in-app paths; ignore open redirects. */
export function safeReturnPath(raw: string | null): string | undefined {
  if (!raw) return undefined;
  let s: string;
  try {
    s = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  if (!s.startsWith('/') || s.startsWith('//')) return undefined;
  if (s.includes('://') || s.includes('\\')) return undefined;
  return s;
}
