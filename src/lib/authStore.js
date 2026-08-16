// تخزين وهمي للمستخدمين (لا يوجد باك إند حقيقى فى هذا المشروع بعد).
// يُستخدم للتحقق مما إذا كان البريد مسجّلاً فعلاً قبل إرسال رمز إعادة التعيين.
// فى النسخة الحقيقية يُستبدل بطلب إلى API فريق Laravel/MySQL
// (مثلاً: POST /api/forgot-password). يجب ألا يكشف الخادم وجود البريد.

const STORAGE_KEY = 'masahati_users';
const SEED = [
  'student@masahati.ps',
  'owner@masahati.ps',
  'admin@masahati.ps',
];

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set([...JSON.parse(raw), ...SEED]);
  } catch {
    /* تجاهل أخطاء القراءة */
  }
  return new Set(SEED);
}

function write(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* التخزين غير متاح */
  }
}

export function isEmailRegistered(email) {
  return read().has(String(email).trim().toLowerCase());
}

export function registerEmail(email) {
  const set = read();
  set.add(String(email).trim().toLowerCase());
  write(set);
}

// حالة الجلسة (وهمية حتى يصل مفتاح الـ API من الفريق).
// فى النسخة الحقيقية تُستبدل بجلسة Supabase الحقيقية.
const SESSION_KEY = 'masahati_session';

export function isLoggedIn() {
  try {
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLoggedIn(value) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, '1');
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}
