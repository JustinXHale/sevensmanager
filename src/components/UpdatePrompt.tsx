import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

export function UpdatePrompt() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="alert">
      <span className="update-toast-text">A new version is available.</span>
      <button
        type="button"
        className="update-toast-btn"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
    </div>
  );
}
