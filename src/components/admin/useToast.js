import { useEffect, useState } from 'react';

// خطّاف إشعار عائم: حالة + إخفاء تلقائي. { toast, announce, dismiss }
// وحدة مستقلة عمداً: تصدير خطّاف من ملف مكوّنات يخالف قاعدة react-refresh ويُعطّل التحديث الساخن.
export function useToast(timeout = 2600) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), timeout);
    return () => clearTimeout(t);
  }, [toast, timeout]);

  return { toast, announce: setToast, dismiss: () => setToast(null) };
}
