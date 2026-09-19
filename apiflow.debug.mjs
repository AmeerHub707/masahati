#!/usr/bin/env node
// تشخيص مؤقت (يحذف بعد الاستخدام): يعيد محاكاة تدفق الباك إند كاملاً
// (تسجيل مالك مساحة -> تسجيل دخول تلقائي -> جلب الملف -> حذف الحساب)
// ويطبع ردّ كل استدعاء "كما هو"، خاصة حقلي token و user.role.
//
// الاستخدام: node apiflow.debug.mjs <email> <password>
// مثال:      node apiflow.debug.mjs owner@example.com secret123
//
// لا يغيّر أي ملف في المشروع. لا يُرسَل أي شيء غير الطلبات نفسها التي
// يرسلها التطبيق. للتوضيح فقط — عدّل/احذف فور الانتهاء.

const BASE = (process.env.VITE_API_URL || 'https://back-end-kwba.onrender.com').replace(/\/$/, '');

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('الاستخدام: node apiflow.debug.mjs <email> <password>');
  process.exit(2);
}

// محاكاة صغيرة لجلب الاستعلامات التي يرسلها التطبيق فعلياً (Registration-token
// ثم /api/login ثم /api/profile) لنتأكد من صيغة الردود الحقيقية من الباك.
async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${BASE}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ليس JSON */ }
    return {
      url, status: res.status, ms: Date.now() - start,
      headers: res.headers.get('content-type'),
      raw: json ?? (text ? text.slice(0, 600) : '(فارغ)'),
    };
  } catch (err) {
    return { url, error: String(err && err.message || err), ms: Date.now() - start };
  }
}

const line = (c) => `  [${c.status ?? 'ERR'} ${c.ms}ms] ${c.url.split('/api')[1] || ''} ${JSON.stringify(c.raw)}`;

console.log('BASE = ' + BASE);
console.log('\n== هل يوجد حساب بهذا البريد؟ (check-email) ==');
const a = await call('/api/check-email', { method: 'POST', body: { email } });
console.log(line(a));

console.log('\n== تدفق المالك افتراضياً: سجّل الدخول مباشرة (الأكثر صلة) ==');
const l = await call('/api/login', { method: 'POST', body: { login: email, password } });
console.log(line(l));

let token = l?.raw && (l.raw.token || l.raw?.token || l.raw?.access_token);
if (!token) token = (l?.raw && (l.raw.data?.token || l.raw.user?.token)) || '';

console.log('\n== ملف المستخدم الحالي (محمي) — هنا يتوقف دور dashboard ==');
const p = await call('/api/profile', { token });
console.log(line(p));

console.log('\n== خروج ==');
const o = await call('/api/logout', { method: 'POST', token });
console.log(line(o));

// ---- استنتاج أوتوماتيكي بسيط حول حقل الدور ----
const role = p?.raw?.user?.role || p?.raw?.data?.user?.role || p?.raw?.role;
const loginRole = l?.raw?.user?.role || l?.raw?.data?.user?.role;
console.log('\n== قراءة الدور = ملخص ==');
console.log('  role من /api/login  : ' + (loginRole === undefined ? '(غائب!)' : JSON.stringify(loginRole)));
console.log('  role من /api/profile: ' + (role === undefined ? '(غائب!)' : JSON.stringify(role)));
if (loginRole !== 'space_owner' && loginRole !== 'owner') {
  console.log('  => التوجيه سيتجه إلى /dashboard/customer (الدور غير مالك)');
} else {
  console.log('  => التوجيه سيتجه إلى /dashboard/space-owner (دور مالك صحیح)');
}
