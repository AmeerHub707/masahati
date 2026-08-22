// useSafeInput: خطّاف لحقن القيم فى حقول الإدخال بشكل آمن.
// يُعقّم القيمة عند كل تغيير عبر sanitizeText (يزيل أي وسوم/كود HTML خبيث)،
// ويُطبّق حداً أقصى للطول إن وُجد — فيمنع تخزين/إرسال محتوى خطير من لصق <script>.
//
// الاستخدام:
//   const name = useSafeInput('', { maxLength: 80 });
//   <input {...name.bind} />
//   أو: <input value={name.value} onChange={name.onChange} />

import { useCallback, useState } from 'react';
import { sanitizeText } from '../utils/sanitize';

export default function useSafeInput(initial = '', options = {}) {
  const { maxLength, trim = false } = options;

  const [value, setValueRaw] = useState(() => sanitizeText(initial));

  // يضبط القيمة مع تعقيمها (يُستخدم برمجياً أو من مصدر خارجى).
  const setValue = useCallback(
    (next) => {
      if (next == null) {
        setValueRaw('');
        return;
      }
      let cleaned = sanitizeText(next);
      if (trim) cleaned = cleaned.trim();
      if (typeof maxLength === 'number') {
        cleaned = cleaned.slice(0, maxLength);
      }
      setValueRaw(cleaned);
    },
    [maxLength, trim]
  );

  // مُعالج onChange جاهز للربط بحقل <input>/<textarea>.
  const onChange = useCallback(
    (e) => {
      setValue(e?.target?.value ?? e);
    },
    [setValue]
  );

  return {
    value,
    setValue,
    onChange,
    // ربط مباشر: <input {...bind} />
    bind: { value, onChange },
  };
}
