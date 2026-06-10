/** LiteMaaS / LiteLLM connection settings (stored locally in the browser). */
export const LITEMAAS_SETTINGS_STORAGE_KEY = 'sevensmanager.litemaasSettings';

export const DEFAULT_LITEMAAS_MODEL = 'Qwen3.6-35B-A3B';

export type LiteMaaSSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export const DEFAULT_LITEMAAS_SETTINGS: LiteMaaSSettings = {
  apiKey: '',
  baseUrl: '',
  model: DEFAULT_LITEMAAS_MODEL,
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function isLiteMaaSConfigured(settings: LiteMaaSSettings): boolean {
  return settings.apiKey.trim().length > 0 && normalizeBaseUrl(settings.baseUrl).length > 0;
}

export function getStoredLiteMaaSSettings(): LiteMaaSSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_LITEMAAS_SETTINGS };
  try {
    const raw = localStorage.getItem(LITEMAAS_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LITEMAAS_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<LiteMaaSSettings>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl: typeof parsed.baseUrl === 'string' ? normalizeBaseUrl(parsed.baseUrl) : '',
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : DEFAULT_LITEMAAS_MODEL,
    };
  } catch {
    return { ...DEFAULT_LITEMAAS_SETTINGS };
  }
}

export function setStoredLiteMaaSSettings(settings: LiteMaaSSettings): void {
  if (typeof localStorage === 'undefined') return;
  const normalized: LiteMaaSSettings = {
    apiKey: settings.apiKey.trim(),
    baseUrl: normalizeBaseUrl(settings.baseUrl),
    model: settings.model.trim() || DEFAULT_LITEMAAS_MODEL,
  };
  localStorage.setItem(LITEMAAS_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearStoredLiteMaaSSettings(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LITEMAAS_SETTINGS_STORAGE_KEY);
}
