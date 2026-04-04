/** Team logo uploads: stored as data URLs in IndexedDB. */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const LOGO_FIELD_REQUIREMENTS = 'JPEG, PNG, or SVG. Max 5 MB.';

export type LogoPreflightResult = { ok: true } | { ok: false; message: string };

const EXT = /\.(jpe?g|png|svg)$/i;

function mimeAllowed(file: File): boolean {
  const t = file.type.trim().toLowerCase();
  return (
    t === 'image/jpeg' ||
    t === 'image/png' ||
    t === 'image/svg+xml' ||
    t === 'image/svg'
  );
}

export function preflightImageFileForLogo(file: File): LogoPreflightResult {
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, message: 'Max file size is 5 MB.' };
  }
  const extOk = EXT.test(file.name);
  if (!extOk && !mimeAllowed(file)) {
    return { ok: false, message: 'Use JPEG, PNG, or SVG.' };
  }
  if (file.type === '' && !extOk) {
    return { ok: false, message: 'Use JPEG, PNG, or SVG.' };
  }
  return { ok: true };
}

/** Reads file as a data URL after validation (no re-encoding). */
export async function readLogoFileAsDataUrl(file: File): Promise<string> {
  const pre = preflightImageFileForLogo(file);
  if (!pre.ok) {
    throw new Error(pre.message);
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s !== 'string') {
        reject(new Error('Could not read file.'));
        return;
      }
      resolve(s);
    };
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}
