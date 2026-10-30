import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './fonts';
import './index.css';

import { IS_ARTIFACT } from './lib/host';

// Service workers don't run inside a hosted Artifact; data persistence there uses the account store.
if (!IS_ARTIFACT) registerSW({ immediate: true });

// Ask the browser not to evict this app's saved data (IndexedDB) under storage pressure.
void navigator.storage?.persist?.().catch(() => undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
