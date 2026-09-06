// useGoogleAuth: خطّاف لإعداد Google Identity Services (GIS) في صفحة المصادقة.
// يحمّل سكربت GIS مرة واحدة فقط، يهيّئه بـ client_id، ويعرض زر "المتابعة عبر Google"
// في الحاوية المعطاة، ثم يمرر الـ credential (id_token) إلى onSuccess.
// يُنظّف (cancel) عند إزالة المكوّن لتجنّب تسرّب جلسة أو ظهور One Tap متأخر.

import { useCallback, useEffect, useRef, useState } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiLoadPromise = null;

function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gsiLoadPromise) {
    gsiLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        gsiLoadPromise = null;
        reject(new Error('تعذر تحميل Google Identity Services.'));
      };
      document.head.appendChild(script);
    });
  }
  return gsiLoadPromise;
}

/**
 * @param {object} options
 * @param {string} options.clientId - VITE_GOOGLE_CLIENT_ID
 * @param {(credential: string) => void|Promise} options.onSuccess
 * @param {(err: unknown) => void} [options.onError]
 */
export default function useGoogleAuth({ clientId, onSuccess, onError }) {
  const [isReady, setIsReady] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!clientId) return;
    let mounted = true;

    loadGsiScript()
      .then((google) => {
        if (!mounted || !google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            const credential = response?.credential;
            if (!credential) return;
            onSuccessRef.current?.(credential);
          },
        });
        setIsReady(true);
      })
      .catch((err) => {
        if (mounted) onErrorRef.current?.(err);
      });

    return () => {
      mounted = false;
      window.google?.accounts?.id?.cancel();
    };
  }, [clientId]);

  // يعرض الزر الرسمي داخل الحاوية المعطاة (صفحة تمرّر ref من <div>).
  const renderButton = useCallback(
    (container) => {
      if (!isReady || !container || !window.google?.accounts?.id) return;
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: container.clientWidth || 320,
        locale: 'ar',
      });
    },
    [isReady]
  );

  return { isReady, renderButton };
}