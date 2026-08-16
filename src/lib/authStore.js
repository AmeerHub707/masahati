// تخزين وهمي للمستخدمين (لا يوجد باك إند حقيقى فى هذا المشروع).
// يُستخدم للتحقق مما إذا كان البريد مسجّلاً فعلاً قبل إرسال رمز إعادة التعيين.
// فى النسخة الحقيقية يُستبدل بـ: await supabase.auth.resetPasswordForEmail(email)
// مع العلم أن الخادم يجب ألا يكشف وجود البريد (يرجع 200 دائماً).

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
