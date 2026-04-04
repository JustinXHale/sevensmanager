import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppChromeProvider } from '@/context/AppChromeContext';
import { initPersistence } from '@/repos/db';
import './index.css';

void initPersistence().then(() => {
  registerSW({ immediate: true });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppChromeProvider>
          <App />
        </AppChromeProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});
