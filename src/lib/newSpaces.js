// منطق «المساحات الجديدة» — نافذة ٣ أيام منذ إضافة/اعتماد المساحة.
// وحدة نقية تماماً مثل spaceFilters.js: لا تستورد api.js ولا React،
// فتعمل في Node مباشرةً ضمن اختبارات src/utils/newSpaces.test.mjs.
//
// القاعدة: مساحة تظهر في بانر «جديد» على لوحة كل عميل ما دامت مضافة
// خلال آخر ٣ أيام (٧٢ ساعة) من لحظة التحميل، ثم تختفي تلقائياً للجميع.

const DAY_MS = 24 * 60 * 60 * 1000;

export const NEW_SPACES_WINDOW_DAYS = 3;

// بانر البطل يعرض بحد أقصى ٨ بطاقات — الأحدث أولاً.
export const NEW_SPACES_LIMIT = 8;

// ساعتان سماح للانحراف في ساعة الخادم (قد يكون created_at قليلاً في المستقبل).
const CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 60 * 1000; // ساعتان

/**
 * يحوّل تاريخاً من الباك إند إلى timestamp.
 * يقبل صيغة Laravel المعتادة "YYYY-MM-DD HH:MM:SS" وISO 8601.
 * يعيد null للقيم الناقصة أو غير القابلة للتحليل (لا بيانات مُختلقة).
 */
export function parseSpaceDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Date.parse يفشل أحياناً على صيغة Laravel المسافة بدل T — نوحّدها.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)
    ? raw.replace(' ', 'T')
    : raw;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : null;
}

/**
 * هل أُضيفت المساحة خلال آخر `days` أيام لحظة `now`؟
 * الحدّ شُمل (٧٢ ساعة كاملة تُعرض)، وتُرفض التواريخ المستقبلية
 * ما عدا ساعتَي سماح لانحراف ساعة الخادم.
 */
export function isNewSpace(space, now = Date.now(), days = NEW_SPACES_WINDOW_DAYS) {
  const at = parseSpaceDate(space?.created_at);
  if (at === null) return false;
  const age = now - at;
  return age <= days * DAY_MS && age >= -CLOCK_SKEW_TOLERANCE_MS;
}

/**
 * ينتقى المساحات الجديدة من كتالوج (الأحدث أولاً كما ترجعه /api/spaces)،
 * بحد أقصى `limit` بطاقة. أي مساحة بلا تاريخ صالح لا تُعرض كجديدة.
 */
export function pickNewSpaces(
  spaces,
  { now = Date.now(), days = NEW_SPACES_WINDOW_DAYS, limit = NEW_SPACES_LIMIT } = {},
) {
  if (!Array.isArray(spaces)) return [];
  return spaces
    .filter((s) => isNewSpace(s, now, days))
    .sort((a, b) => (parseSpaceDate(b?.created_at) ?? 0) - (parseSpaceDate(a?.created_at) ?? 0))
    .slice(0, limit);
}
