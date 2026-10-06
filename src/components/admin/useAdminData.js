/**
 * خطّاف موحّد لجلب بيانات لوحة المشرف من الخادم.
 *
 * قاعدة التشغيل: **لا بيانات وهمية إطلاقاً**. كل رقم في اللوحة يأتي من
 * `/api/admin`، وما لم يصل بعد فهو «جارٍ التحميل»، وإلا فخطأ معروض بنصّه
 * وزر إعادة محاولة. لا موضع في الكود لرقم مُختلَق.
 *
 *   لا توكن ⇒ لا طلب شبكة إطلاقاً (يفتح اللوحة فارغة بدل انتظار 25 ثانية
 *   على Render cold start، ويقول للمستخدم بوضوح أن الجلسة محلية).
 *   توكن + نجاح ⇒ data من الخادم.
 *   توكن + فشل ⇒ data يبقى null، وerror carries رسالة الخادم العربية.
 *
 * البوابة على **الجلب** لا على العرض، وهي بوابة مزدوجة:
 *   1) `live` أثناء التصيير — يمنع إطلاق الأثر أصلاً بلا توكن.
 *   2) إعادة فحص داخل الأثر نفسه — لأن `live` لقطة: بين التصيير وتشغيل
 *      الأثر قد تُمسح الجلسة (401 من تبويب مجاور، أو خروج من نافذة أخرى)،
 *      فإرسال طلب حينها كان يُنتج 401 لا صلة له بالمستخدم. الفحص الثاني يوقف
 *      الطلب قبل أن يُرسَل، فيظهر «لا توجد جلسة خادم» بدل خطأ 401.
 *
 * `pollMs` = تحديث تلقائي دوري (بالميلي ثانية) متى كانت اللوحة مفتوحة:
 *   - المؤقّت يُعاد جدولته **بعد** انتهاء كل طلب، فلا تتراكم الطلبات إن كان
 *     الخادم بطيئاً، ويبقى الفاصل بين بدايةِ طلب وانتهاءه دقيقاً.
 *   - التحديث الخلفي **هادئ**: لا يضبط `pending`، فلا يرتجف الجدول ولا يقول
 *     الشريط «جارٍ التحميل» كل 30 ثانية أمام المستخدم.
 *   - فشله لا يمسح المعروض: البيانات القديمة تبقى، لأن خطأً عابراً في
 *     التحديث الدوري لا يجوز أن يحوّل لوحة عامرة إلى شاشة خطأ فارغة.
 *   - يتوقفWhileالتبويب مخفيّ، ويُستأنف فور ظهوره (حدث `visibilitychange`)،
 *     فنبضٌ في خلفية المتصفح لا يفيد أحداً ويستهلك منفذ الخادم.
 *
 * لماذا `initialData` بدل fallback؟ كان الخطّاف يقبل بيانات تجريبية ثابتة
 * فيُصدِر أرقاماً لا مصدر لها على كل شاشة. الآن الحالة تبدأ null، وهي
 * القيمة الوحيدة التي تعني «لم يصل شيء بعد».
 *
 * ملاحظة على البنية: التحديثات كلها داخل وعود (لا استدعاء setState متزامن في
 * جسم الأثر) لأن React Compiler يمنع التحديث المباشر داخل useEffect فهو يسبّب
 * تصييرات متتالية. كما نُخزّن الـ fetcher في مرجع يُحدَّث داخل أثر منفصل حتى لا
 * يُعاد الجلب لمجرّد أن المكوّن أعاد إنشاء الدالة — وهو ما كان سيحلقة لا تنتهي.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAdminTokenLive, onSessionExpired } from '../../lib/adminApi';

/**
 * @param {Function} fetcher  دالة تعيد وعداً بالبيانات (تُستدعى فقط عند وجود توكن حيّ)
 * @param {Array} deps        تبعيات إعادة الجلب (فلاتر البحث/الصفحة…)
 * @param {Object} options    { enabled, transform, initialData, pollMs }
 */
export default function useAdminData(fetcher, deps = [], options = {}) {
  const { enabled = true, transform, initialData = null, pollMs = 0 } = options;

  // مصدر البيانات محسوب لا مخزَّن: تغيّر التوكن (تسجيل دخول/خروج) ينعكس فوراً.
  const live = isAdminTokenLive();

  const [state, setState] = useState({ data: initialData, error: null, pending: false });
  const [nonce, setNonce] = useState(0);
  // عنوان جلستنا: يُقرأ من الذاكرة لا من `live` كي لا يعيد الجلب بلا داعٍ كل
  // تصيير. `nonce` وحده هو سبب إعادة الجلب الصريحة.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  // وقت آخر وصول، **نصٌّ جاهز** لا تاريخ: التحويل إلى نص يتم لحظة وصول الردّ
  // لا أثناء التصيير (‎Date‎ دالة غير نقية وReact Compiler يمنع استدعائها هناك).
  const [updatedLabel, setUpdatedLabel] = useState('');

  const stampNow = () =>
    new Date().toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  // تحديث المراجع في أثر مستقل: الكتابة أثناء التصيير ممنوعة، والقراءة داخل
  // أثر الجلب آمنة. الترتيب هنا يضمن تحديث المرجع قبل قراءةه.
  const fetcherRef = useRef(fetcher);
  const transformRef = useRef(transform);
  useEffect(() => {
    fetcherRef.current = fetcher;
    transformRef.current = transform;
  });

  // 401 حقيقي ⇒ الجلسة انتهت. نُعيد الضبط فوراً بدل انتظار تصيير يكتشف
  // `isAdminLoggedIn() === false`: لو جاء 401 من إجراء في معالج حدث (لا
  // تصيير خلفه) لبقي المستخدم أمام لوحة لا تُجلب فيها بيانات.
  useEffect(() => onSessionExpired(() => setSessionEpoch((n) => n + 1)), []);

  // تغيّر التوكن في نافذة أخرى (دخول أو خروج هناك) لا يمرّ عبر حدثنا، ولا عبر
  // تصيير: `localStorage` لا يُنبّه كود هذه النافذة أصلاً. النتيجة أن اللوحة
  // تبقى «حيّة» وتُطلق طلبات بتوكن محذوف (401) أو تبقى «بلا جلسة» بعد دخول
  // من التبويب المجاور. حدث `storage` هو الإشارة القياسية، فنستمع له.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return undefined;
    const onStorage = (event) => {
      // حدث فارغ (dispatch اصطناعي) يعني «تغيّر غير محدّد»: نتعامل معه كتغيّر.
      if (!event || !event.key || String(event.key).startsWith('masahati_admin')) {
        setSessionEpoch((n) => n + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!enabled || !live) return undefined;

    // الفحص الثاني: `live` لقطة من تصيير سابق. بلا توكن الآن ⇒ لا نُرسل.
    if (!isAdminTokenLive()) return undefined;

    let alive = true;
    let timer = null;

    // `silent` = تحديث خلفي دوري: يحدّث البيانات دون أن يُظهر حالة انتظار.
    const run = (silent) => {
      Promise.resolve()
        .then(() => fetcherRef.current())
        .then((result) => {
          if (!alive) return;
          const next = transformRef.current ? transformRef.current(result) : result;
          setUpdatedLabel(stampNow());
          setState({ data: next === undefined ? null : next, error: null, pending: false });
        })
        .catch((err) => {
          if (!alive) return;
          // فشل خلفي: نُبقي ما هو معروض ولا نفسد لوحة عامرة بسبب تعثّر عابر.
          // أمّا الجلب الأول فلا بدّ من إظهار الفشل، لأن `data` ما زال null.
          setState((cur) => (silent && cur.data !== null
            ? cur
            : {
              data: cur.data,
              error: err?.message || 'تعذّر جلب البيانات من الخادم.',
              pending: false,
            }));
        })
        .finally(() => {
          if (!alive || !pollMs) return;
          timer = setTimeout(() => run(true), pollMs);
        });
    };

    run(false);

    // نبضة في تبويب مخفيّ لا تفيد المستخدم: نوقفها ونستأنف فور ظهوره،
    // فيبقى الفاصل بين نبضاتٍ مرئية محسوباً.
    let onVisible = null;
    if (pollMs && typeof document !== 'undefined' && document.addEventListener) {
      onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        if (!isAdminTokenLive()) return;
        clearTimeout(timer);
        timer = null;
        run(true);
      };
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      alive = false;
      clearTimeout(timer);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, live, nonce, sessionEpoch, pollMs, ...deps]);

  /** إعادة الجلب — تُستدعى من معالج الحدث (زر إعادة المحاولة)، لا من الأثر. */
  const reload = useCallback(() => {
    setState((cur) => ({ ...cur, pending: true, error: null }));
    setNonce((n) => n + 1);
  }, []);

  /**
   * تعديل محلي (تحديث متفائل بعد إجراء). يقبل دالة أو قيمة، كالـ setState العادي.
   */
  const setData = useCallback((updater) => {
    setState((cur) => ({
      ...cur,
      data: typeof updater === 'function' ? updater(cur.data) : updater,
    }));
  }, []);

  // data يبقى null حتى يصل أول رد ⇒ كل شاشة تعرض حالة تحميل، ولا تُعاد
  // التصيير بأرقام. loading ينطفئ فور الخطأ حتى لا تبقى اللوحة «جاري
  // التحميل» للأبد، وبلا توكن لا طلب شبكة ولا انتظار.
  const data = state.data;
  const loading = live ? state.pending || (state.data === null && !state.error) : false;
  const error = live ? state.error : null;

  return { data, setData, loading, error, live, reload, updatedLabel, pollMs };
}
