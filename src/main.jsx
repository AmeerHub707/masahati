import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// تهيئة i18next يجب أن تسبق تحميل أي مكوّن يستدعي useTranslation،
// فلا تُصدَر واجهة بمسافات ترجمة فارغة قبل جهوزية الموارد.
import './i18n';
import App from './App.jsx';
import './fonts.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
