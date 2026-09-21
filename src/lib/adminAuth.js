// مصادقة لوحة تحكم المشرف — جلسة محلية مستقلة عن توكن العميل.
// تُستبدل لاحقاً بنقطة نهاية Laravel REST API.
// بيانات الدخول الافتراضية (وهمية): masahati@outlook.com / 123456789admin

const ADMIN_SESSION_KEY = 'masahati_admin_session';
const ADMIN_EMAIL = 'masahati@outlook.com';
const ADMIN_PASSWORD = '123456789admin';

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

export function isAdminLoggedIn() {
  return Boolean(readSession());
}

export async function adminLogin(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized !== ADMIN_EMAIL || String(password || '') !== ADMIN_PASSWORD) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }
  const session = {
    email: ADMIN_EMAIL,
    name: ADMIN_PROFILE.name,
    role: 'admin',
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 ساعة
  };
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage may be unavailable */
  }
  return { ...ADMIN_PROFILE };
}

export function getAdminProfile() {
  const session = readSession();
  if (!session) return null;
  return { ...ADMIN_PROFILE, name: session.name || ADMIN_PROFILE.name };
}

export function adminLogout() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}