// مصادقة لوحة تحكم المشرف — جلسة محلية مستقلة عن توكن العميل.
// تُستبدل لاحقاً بنقطة نهاية Laravel REST API.
// بيانات الدخول الافتراضية (وهمية): masahati@outlook.com / 123456789admin

const ADMIN_SESSION_KEY = 'masahati_admin_session';
const ADMIN_PROFILE_KEY = 'masahati_admin_profile';
const ADMIN_PASSWORD_KEY = 'masahati_admin_password';
const ADMIN_EMAIL = 'masahati@outlook.com';
const DEFAULT_PASSWORD = '123456789admin';

const ADMIN_PROFILE = {
  name: 'إدارة مساحاتي',
  email: ADMIN_EMAIL,
  role: 'admin',
};

function readSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.email && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

// الملف المحفوظ من صفحة الإعدادات (الاسم/البريد/واتساب) مع قيم افتراضية آمنة.
export function readAdminProfile() {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
    if (!raw) return { ...ADMIN_PROFILE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...ADMIN_PROFILE };
    return {
      ...ADMIN_PROFILE,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : ADMIN_PROFILE.name,
      email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email.trim() : ADMIN_PROFILE.email,
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp.trim() : '',
    };
  } catch {
    return { ...ADMIN_PROFILE };
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
}

function currentPassword() {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_PASSWORD;
  } catch {
    return DEFAULT_PASSWORD;
  }
}

export function isAdminLoggedIn() {
  return Boolean(readSession());
}

export async function adminLogin(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized !== ADMIN_EMAIL || String(password || '') !== currentPassword()) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }
  const session = {
    email: ADMIN_EMAIL,
    name: readAdminProfile().name,
    role: 'admin',
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 ساعة
  };
  writeStored(ADMIN_SESSION_KEY, session);
  return { ...readAdminProfile() };
}

export function getAdminProfile() {
  const session = readSession();
  if (!session) return null;
  const profile = readAdminProfile();
  return { ...profile, name: profile.name || session.name || ADMIN_PROFILE.name };
}

// يحفظ بيانات الملف الشخصى فوراً (بدون وعود — عملية محلية متزامنة).
export function updateAdminProfile({ name, email, whatsapp } = {}) {
  const current = readAdminProfile();
  const next = {
    ...current,
    name: String(name ?? current.name).trim() || current.name,
    email: String(email ?? current.email).trim() || current.email,
    whatsapp: String(whatsapp ?? current.whatsapp ?? '').trim(),
  };
  writeStored(ADMIN_PROFILE_KEY, next);
  const session = readSession();
  if (session) writeStored(ADMIN_SESSION_KEY, { ...session, name: next.name });
  return { ...next };
}

// تغيير كلمة مرور المشرف (محلية) — يتحقق من الحالية قبل الحفظ.
export function changeAdminPassword(current, next) {
  if (String(current || '') !== currentPassword()) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }
  const value = String(next || '');
  if (value.length < 8) throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
  writeStored(ADMIN_PASSWORD_KEY, value);
  return true;
}

export function adminLogout() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}