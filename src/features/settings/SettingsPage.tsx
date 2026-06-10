import { useEffect, useState } from 'react';
import { useAppChrome } from '@/context/AppChromeContext';
import { LiteMaaSClientError, testLiteMaaSConnection } from '@/services/litemaasClient';
import {
  clearStoredLiteMaaSSettings,
  DEFAULT_LITEMAAS_MODEL,
  DEFAULT_LITEMAAS_SETTINGS,
  getStoredLiteMaaSSettings,
  isLiteMaaSConfigured,
  setStoredLiteMaaSSettings,
  type LiteMaaSSettings,
} from '@/utils/litemaasSettings';
import { normalizeLiteLLMBaseUrl } from '@/utils/litellmUrl';

export function SettingsPage() {
  const { setTeamHeader } = useAppChrome();
  const [settings, setSettings] = useState<LiteMaaSSettings>(() => getStoredLiteMaaSSettings());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setTeamHeader({ backTo: '/', title: 'Settings' });
    return () => setTeamHeader(null);
  }, [setTeamHeader]);

  const onSave = () => {
    setStoredLiteMaaSSettings(settings);
    setSaved(true);
    setTestResult(null);
    setTestError(null);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const onClear = () => {
    clearStoredLiteMaaSSettings();
    setSettings({ ...DEFAULT_LITEMAAS_SETTINGS });
    setTestResult(null);
    setTestError(null);
  };

  const onTest = async () => {
    const draft = {
      apiKey: settings.apiKey.trim(),
      baseUrl: normalizeLiteLLMBaseUrl(settings.baseUrl),
      model: settings.model.trim() || DEFAULT_LITEMAAS_MODEL,
    };
    if (!isLiteMaaSConfigured(draft)) {
      setTestError('Enter API key and base URL first.');
      setTestResult(null);
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const reply = await testLiteMaaSConnection(draft);
      setTestResult(`Connected. Model replied: ${reply.slice(0, 80)}`);
    } catch (e) {
      setTestResult(null);
      setTestError(
        e instanceof LiteMaaSClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Connection test failed.',
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-page">
      <h1 className="sr-only">Settings</h1>

      <section className="card settings-section">
        <h2 className="settings-section-title">LiteMaaS / LiteLLM</h2>
        <p className="muted settings-section-lead">
          Connect your LiteMaaS subscription to generate AI coaching insights on match and team stats.
          Credentials are stored only in this browser.
        </p>

        <label className="settings-field">
          <span className="settings-field-label">LiteLLM base URL</span>
          <input
            type="url"
            className="settings-input"
            placeholder="https://litellm-your-namespace.apps.cluster.example.com"
            value={settings.baseUrl}
            onChange={(e) => setSettings((s) => ({ ...s, baseUrl: e.target.value }))}
            autoComplete="off"
          />
          <span className="settings-field-hint muted">
            Your LiteMaaS LiteLLM route — no trailing slash.
          </span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">API key</span>
          <div className="settings-input-wrap">
            <input
              type={showApiKey ? 'text' : 'password'}
              className="settings-input settings-input--with-toggle"
              placeholder="sk-…"
              value={settings.apiKey}
              onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="settings-input-toggle"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              aria-pressed={showApiKey}
              onClick={() => setShowApiKey((v) => !v)}
            >
              {showApiKey ? (
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.03 10.03 0 0 0 3.3-4.38 1.5 1.5 0 0 0 0-1.4A10.04 10.04 0 0 0 9.5 3C6.23 3 3.58 4.77 1.28 7.22a1.5 1.5 0 0 0-.01 1.56Zm4.03 4.03 1.27 1.27a2.5 2.5 0 0 0 3.37 3.37l1.27 1.27a4 4 0 0 1-5.91-5.91Zm5.37 2.19a4 4 0 0 1-5.08-5.08l1.5 1.5a2.5 2.5 0 0 0 3.58 3.58l.01.01Z" clipRule="evenodd" />
                  <path d="m12.77 11.23 1.27 1.27a10.03 10.03 0 0 0 3.3-4.38 1.5 1.5 0 0 0 0-1.4A10.04 10.04 0 0 0 9.5 6c-1.1 0-2.14.2-3.08.55l1.48 1.48a4 4 0 0 1 4.77 4.77l.01.01Z" />
                  <path d="M2.22 12.28a10.04 10.04 0 0 0 9.5 3c2.2 0 4.2-.7 5.77-1.9l1.43 1.43a.75.75 0 0 0 1.06-1.06L3.28 2.22a.75.75 0 0 0-1.06 1.06l1.745 1.745a10.03 10.03 0 0 0-3.3 4.38 1.5 1.5 0 0 0 .01 1.56Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 3c-2.7 0-5.22 1.23-6.72 3.22a1.5 1.5 0 0 0 0 1.56C4.78 9.77 7.3 11 10 11s5.22-1.23 6.72-3.22a1.5 1.5 0 0 0 0-1.56C15.22 4.23 12.7 3 10 3Zm0 7.5a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5Z" />
                </svg>
              )}
            </button>
          </div>
          <span className="settings-field-hint muted">
            From your LiteMaaS subscription. Paste once — used for Generate insights on stats pages.
          </span>
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <input
            type="text"
            className="settings-input"
            placeholder={DEFAULT_LITEMAAS_MODEL}
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            autoComplete="off"
          />
          <span className="settings-field-hint muted">
            Exact model name from LiteMaaS (default: {DEFAULT_LITEMAAS_MODEL}).
          </span>
        </label>

        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={onSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={testing}
            onClick={() => void onTest()}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear
          </button>
        </div>

        <p className="settings-field-hint muted">
          On localhost, Test connection uses a built-in proxy to avoid browser CORS blocks. Deployed sites need CORS enabled on your LiteLLM route.
        </p>

        {testResult ? <p className="settings-feedback settings-feedback--ok">{testResult}</p> : null}
        {testError ? <p className="settings-feedback settings-feedback--err" role="alert">{testError}</p> : null}
      </section>
    </div>
  );
}
