// إدارة علم «الوضع التجريبي» لكل الوحدات التي تسقط إلى مخزن محلي عند فشل
// الواجهة الخلفية (spaces / owner / requests / notifications / ads).
//
// المشكلة التي يحلها هذا الملف: كان العلم قيمة '1' دائمة في localStorage. أول فشل
// يثبّته، ثم لا تُستدعى الواجهة مجدداً طوال عمر متصفح المستخدم. فلو نُفِّذت اليوم
// نقطة مفقودة في الباك إند (مثل GET /api/spaces) لبقي كل مستخدم في الوضع
// التجريبي يقرأ بيانات مُختلقة، حتى يُمسح localStorage يدوياً.
//
// الآن يُخزَّن وقت الدخول في الوضع التجريبي، وتنتهي صلاحيته بعد TTL، فتُعاد
// محاولة الاتصال الحقيقي تلقائياً ودون تدخّل المستخدم. الصيغة القديمة '1' بلا
// طابع زمني تُعامَل كمنتهية الصلاحية، فتُمسح عند أول زيارة بعد التحديث.

const DEMO_TTL_MS = 60 * 1000;

/**
 * ينشئ مُدار علم تجريبي لمفتاح تخزين محدّد.
 * @param {string} flagKey مفتاح localStorage
 * @param {{ttlMs?:number}} [opts] مدة الصلاحية
 * @returns {{isOn:()=>boolean, set:(on:boolean)=>void, clear:()=>void}}
 */
export function createDemoFlag(flagKey, { ttlMs = DEMO_TTL_MS } = {}) {
  function clear() {
    try {
      localStorage.removeItem(flagKey);
    } catch {
      /* التخزين غير متاح */
    }
  }

  function set(on) {
    if (!on) {
      clear();
      return;
    }
    try {
      localStorage.setItem(flagKey, JSON.stringify({ at: Date.now() }));
    } catch {
      /* التخزين غير متاح */
    }
  }

  function isOn() {
    let raw;
    try {
      raw = localStorage.getItem(flagKey);
    } catch {
      return false;
    }
    if (!raw) return false;

    // صيغة قديمة '1' (لا JSON) أو طابع زمني غير صالح => نعتبرها منتهية.
    let at;
    try {
      at = JSON.parse(raw)?.at;
    } catch {
      at = undefined;
    }

    // نحرّر المستخدم من وضع تجريبي قد يكون عالقاً منذ ما قبل هذا الإصلاح.
    if (!Number.isFinite(at) || Date.now() - at > ttlMs) {
      clear();
      return false;
    }
    return true;
  }

  return { isOn, set, clear };
}

export { DEMO_TTL_MS };