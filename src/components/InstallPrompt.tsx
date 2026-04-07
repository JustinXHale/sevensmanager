import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_DISPLAY_NAME } from '@/config/appMeta';

const STORAGE_CHROME = 'pwa-install-chrome-dismissed-at';
const STORAGE_IOS = 'pwa-install-ios-dismissed-at';
const DISMISS_MS = 1000 * 60 * 60 * 24 * 30;

/** Survives React Strict Mode remounts so we keep the one `beforeinstallprompt` per page load. */
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

function isDismissed(key: string): boolean {
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const t = Number.parseInt(raw, 10);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < DISMISS_MS;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [showIosHint, setShowIosHint] = useState(false);
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (isStandalone()) return;
    if (isDismissed(STORAGE_CHROME)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferred(globalDeferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    if (globalDeferredPrompt) {
      setDeferred(globalDeferredPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isIOS()) return;
    if (isDismissed(STORAGE_IOS)) return;
    setShowIosHint(true);
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      globalDeferredPrompt = null;
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const dismissChrome = useCallback(() => {
    localStorage.setItem(STORAGE_CHROME, String(Date.now()));
    globalDeferredPrompt = null;
    setDeferred(null);
  }, []);

  const dismissIos = useCallback(() => {
    localStorage.setItem(STORAGE_IOS, String(Date.now()));
    setShowIosHint(false);
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    globalDeferredPrompt = null;
    setDeferred(null);
  }, [deferred]);

  if (isStandalone()) {
    return null;
  }

  const bottomStyle =
    needRefresh !== true
      ? undefined
      : ({ bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' } as const);

  if (deferred) {
    return (
      <div
        className="install-toast"
        style={bottomStyle}
        role="region"
        aria-live="polite"
        aria-label={`Install ${APP_DISPLAY_NAME}`}
      >
        <span className="install-toast-text">Install {APP_DISPLAY_NAME} for a full-screen app and offline access.</span>
        <div className="install-toast-actions">
          <button type="button" className="install-toast-btn install-toast-btn--secondary" onClick={dismissChrome}>
            Not now
          </button>
          <button type="button" className="install-toast-btn" onClick={() => void onInstallClick()}>
            Install
          </button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div
        className="install-toast install-toast--ios"
        style={bottomStyle}
        role="region"
        aria-live="polite"
        aria-label="Add to Home Screen"
      >
        <span className="install-toast-text">
          For a full-screen app: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </span>
        <button type="button" className="install-toast-btn install-toast-btn--single" onClick={dismissIos}>
          OK
        </button>
      </div>
    );
  }

  return null;
}
