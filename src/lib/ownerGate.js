// قفل إضافة المساحات على صاحب المساحة غير المُفعَّل.
//
// لماذا ملف مستقلّ: الحكم على الحساب يحتاجه طرفان لا ثالث — لوحة صاحب
// المساحة (تعرض البنر وقفل الزر) ولوحة الأدمن (تقرأ الحالة نفسها لتقرّر
// التفعيل). كتابته مرتين كان سيجعلاه يتفرّقان عند أول تعديل.
//
// **الحكم لا يُخمَّن من غياب الحقل.** القاعدة صريحة: يُسمح فقط عند
// `status === 'active'`. فالحقل الغائب أو المجهول يُعامل كغير مُفعَّل، لأن
// الافتراض الحالم هو ما فتح الباب لمالك معلَّق أن ينشر مساحة بلا مراجعة.
//
// ملاحظة: هذا قفلٌ في الواجهة، وهو راحةٌ للمستخدم لا ضمان. المصدر للحقيقة
// هو الباك إند (انظر BACKEND_OWNER_ACTIVATION_CONTRACT.md §3): الطلب من
// `owner` غير النشط يرفضه الخادم بحد ذاته.

// الحالات كما تصل من /api/profile و /api/admin/users.
//
// **ثلاث حالات لا رابعة.** مفردات الحساب مقصورة على: `active` (اعتُمد
// التوثيق)، `pending` (بانتظار قرار الأدمن)، `suspended` (قرار إداري). وقيمة
// رابعة كانت تُدعى `review` («قيد المراجعة») فحُذفت: لم تكن حالة مستقلة بل
// تسمية ثانية لـ`pending`، فجعلت الأدمن يرى مسارَي قرارٍ واحد كأنهما قراران.
// وأي حساب ما زال يحملها في قاعدة بيانات قديمة يقرؤه المحوّل `pending`
// (انظر adaptUser) فيعود إلى الطابور الذي يعرضه، بدل أن يقف في «حالة غير
// معروفة» لا يراه أحد ولا يعتمده أحد.
//
// **المجهول غير مذكور عمداً:** يُعامل كـ«غير مُفعَّل» (أقفال) لا كـ«موقوف»
// فيبقى حسابٌ بحالة غير معروفة مقفلاً على قاعدة «active أو لا شيء» بدل أن
// يُقال له إنه موقوف وهو ليس كذلك.
export const OWNER_STATUS_ACTIVE = 'active';
export const OWNER_STATUS_PENDING = 'pending';
export const OWNER_STATUS_SUSPENDED = 'suspended';

const KNOWN_STATUSES = [OWNER_STATUS_ACTIVE, OWNER_STATUS_PENDING, OWNER_STATUS_SUSPENDED];

/** الحالة كما وصلت، بلا تحويل إلى قيمة نخترعها عند الغياب. */
export function normalizeOwnerStatus(status) {
  const key = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return KNOWN_STATUSES.includes(key) ? key : '';
}

/**
 * هل الحساب مُفعَّل؟ نعم فقط عند `active` صراحةً.
 * @param {string} status  الحالة من الخادم.
 * @returns {boolean} true = لا يُقفل أي إجراء.
 */
export function isOwnerActive(status) {
  return normalizeOwnerStatus(status) === OWNER_STATUS_ACTIVE;
}

/**
 * خلاصة واحدة للقفل، تعيد السبب أيضاً ليعرضه المكوّن بلا تأليف رسالة
 * مرتين في كل مكان.
 * @param {object} user  كائن المستخدم من اللوحة.
 * @returns {{ locked: boolean, status: string, verified: boolean, tone: 'ok'|'wait'|'blocked', message: string }}
 */
export function ownerGate(user) {
  const status = normalizeOwnerStatus(user?.status);
  const verified = Boolean(user?.verified);

  if (isOwnerActive(status)) {
    return {
      locked: false,
      status,
      verified,
      tone: 'ok',
      message: '',
    };
  }

  // موقوف ≠ بانتظار التفعيل: الأول قرار إداري قابل للطعن، والثانية انتظار.
  // دمجهما في رسالة «بانتظار التفعيل» تُخبر الموقوف أنه في الطريق إلى
  // التفعيل، وهي كذبة. والمجهول (status '') يُقفل بلا أن يُنسب إليه قرار.
  const blocked = status === OWNER_STATUS_SUSPENDED;
  return {
    locked: true,
    status,
    verified,
    tone: blocked ? 'blocked' : 'wait',
    message: blocked
      ? 'حسابك موقوف من قبل الإدارة. تواصل معنا لمعرفة السبب وكيفية رفع الإيقاف.'
      : 'حسابك بانتظار التفعيل من قبل الإدارة، ستتمكن من إضافة مساحاتك فور اعتماد توثيقك.',
  };
}