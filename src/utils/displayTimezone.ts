/** Persisted IANA zone for formatting match kickoffs in lists (default Central). */
export const DISPLAY_TIMEZONE_STORAGE_KEY = 'sevensmanager.displayTimezone';

export const DEFAULT_DISPLAY_TIMEZONE = 'America/Chicago';

export const DISPLAY_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'America/Phoenix', label: 'Arizona (US)' },
  { value: 'UTC', label: 'UTC' },
];

export function isValidIanaTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getStoredDisplayTimeZone(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_DISPLAY_TIMEZONE;
  const raw = localStorage.getItem(DISPLAY_TIMEZONE_STORAGE_KEY)?.trim();
  if (!raw) return DEFAULT_DISPLAY_TIMEZONE;
  if (!isValidIanaTimeZone(raw)) return DEFAULT_DISPLAY_TIMEZONE;
  return raw;
}

export function setStoredDisplayTimeZone(zone: string): void {
  if (typeof localStorage === 'undefined') return;
  if (!isValidIanaTimeZone(zone)) return;
  localStorage.setItem(DISPLAY_TIMEZONE_STORAGE_KEY, zone);
}

/**
 * Formats an ISO kickoff string in the given IANA zone (date + short time).
 */
export function formatMatchKickoffInZone(iso: string | undefined, timeZone: string): string {
  if (!iso?.trim()) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.trim();
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(t));
}
