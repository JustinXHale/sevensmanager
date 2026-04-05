import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

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
