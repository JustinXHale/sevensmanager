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

export function SettingsPage() {
  const { setTeamHeader } = useAppChrome();
  const [settings, setSettings] = useState<LiteMaaSSettings>(() => getStoredLiteMaaSSettings());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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
      baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
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
          <input
            type="password"
            className="settings-input"
            placeholder="sk-…"
            value={settings.apiKey}
            onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
            autoComplete="off"
          />
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

        {testResult ? <p className="settings-feedback settings-feedback--ok">{testResult}</p> : null}
        {testError ? <p className="settings-feedback settings-feedback--err" role="alert">{testError}</p> : null}
      </section>
    </div>
  );
}
