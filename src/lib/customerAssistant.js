// مساعد العميل الذكي — يعمل داخل لوحة العميل ويحل محل فقاعة الواتساب العائمة
// (الواتساب يبقى كخيار دعم بشري داخل لوحة المساعد نفسه، كمان في لوحة المالك).
//
// مبدأ الخصوصية (الأولوية القصوى) — نفس قاعدة لوحة المالك:
//   بدون موافقة صريحة، لا يُرسل أي جزء من بيانات العميل لأي مسار ذكاء.
//   consent = 'granted' → يُرسل ملخّص السياق + الرسالة إلى /api/assistant/chat.
//   consent = 'local'   → رد محلي قائم على القواعد، لا يغادر المتصفح.
//   consent = null      → شاشة إذن تُعرض أول مرة، ولا يحدث شيء قبل القرار.
//   أي فشل (شبكة/مهلة/خطأ خادم) → نعود للرد المحلي فوراً، والمساعد لا ينقطع أبداً.

import { request } from './api';

const CONSENT_KEY = 'masahati_customer_assistant_consent';
const CONSENT_VALUE_GRANTED = 'granted';
const CONSENT_VALUE_LOCAL = 'local';
const CUSTOMER_ASSISTANT_TIMEOUT_MS = 45000;

export function readCustomerAssistantConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === CONSENT_VALUE_GRANTED) return CONSENT_VALUE_GRANTED;
    if (raw === CONSENT_VALUE_LOCAL) return CONSENT_VALUE_LOCAL;
    return null;
  } catch {
    return null;
  }
}

export function writeCustomerAssistantConsent(value) {
  const v = value === CONSENT_VALUE_GRANTED ? CONSENT_VALUE_GRANTED : CONSENT_VALUE_LOCAL;
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch { /* التخزين غير متاح */ }
  return v;
}

export function clearCustomerAssistantConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch { /* التخزين غير متاح */ }
}

// ----- بناء سياق العميل الآمن -----
// ملخّص من بيانات اللوحة الحية (حجوزات، مفضّلة، طلبات) — لا يُبنى إلا عند
// طلب المساعد صراحةً، أي بعد موافقة العميل أو في الوضع المحلي.
export function buildCustomerContext(data) {
  const bookings = Array.isArray(data && data.bookings) ? data.bookings : [];
  const upcoming = Array.isArray(data && data.upcoming) ? data.upcoming : [];
  const favorites = Array.isArray(data && data.favorites) ? data.favorites : [];
  const requests = Array.isArray(data && data.requests) ? data.requests : [];
  const stats = (data && data.stats) || {};

  const all = [...upcoming, ...bookings];
  const active = all.filter((b) => b.status !== 'cancelled');
  const next = [...upcoming].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0];

  return {
    bookingsCount: all.length,
    activeBookingsCount: active.length,
    upcomingCount: upcoming.length,
    cancelledBookings: all.length - active.length,
    nextBookingDate: next ? next.date || '' : '',
    nextBookingName: next ? next.spaceName || '' : '',
    hoursThisMonth: Number(stats.hoursThisMonth) || 0,
    hoursSpentThisMonth: Number(stats.hoursSpentThisMonth) || 0,
    favoritesCount: favorites.length,
    openRequests: requests.filter((r) => r.status === 'open' || r.status === 'pending').length,
    totalSpent: active.reduce((sum, b) => sum + (Number(b.price) || 0), 0),
  };
}

// ----- رد محلي قائم على القواعد (الوضع المحلي، أو احتياط عند تعذّر الذكاء) -----
// النطاق مقصور على علاقة العميل بما يملكه: حجوزاته، مفضّلته، طلباته، ونشاطه.
// لا ينشئ المساعد حجوزات ولا مساحات ولا يبحث عن أماكن — يوجّه إلى التبويب المناسب فقط.
export function localCustomerReply(message, ctx) {
  const text = String(message || '').trim();
  const c = ctx || {};
  const has = (keys) => keys.some((k) => text.includes(k));

  // خارج النطاق: أي طلب لإنشاء مساحة أو حجز جديد أو البحث عن مكان. نوجّه ولا ننفّذ.
  if (has(['احجز', 'أحجز', 'حجز مساحة', 'انشئ', 'أضف مساحة', 'ابحث عن', 'تصفح', 'اقترح', 'نصيحة', 'أفضل مكان', 'أفضل مساحة'])) {
    return 'أنا أساعدك في حجوزاتك ومفضّلتك وطلباتك فقط. لشيء جديد افتح «تصفح المساحات» في الشريط العلوي.';
  }

  // 1. الطلبات الخاصة
  //    نطابق «عروض» لا «عرض» وحدها: كلمة «اعرض» تعني «أريه» في كل استعلام ملخص.
  if (has(['الطلبات', 'طلب', 'عروض', 'special'])) {
    if (c.openRequests === 0) {
      return 'ليس لديك طلب خاص مفتوح الآن. ما تنشره من طلبات يظهر في تبويب «طلباتي الخاصة».';
    }
    return `لديك ${c.openRequests} طلب خاص مفتوح بانتظار العروض، وتابعها من تبويب «طلباتي الخاصة».`;
  }

  // 2. المساحات المفضلة
  if (has(['مفضل', 'المفضلة', 'محفوظ', 'المحفوظة', 'save'])) {
    if (c.favoritesCount === 0) {
      return 'مفضّلتك فارغة حالياً. ما تحفظه يظهر في تبويب «المساحات المفضلة».';
    }
    return `لديك ${c.favoritesCount} مساحة في مفضّلتك، كلها في تبويب «المساحات المفضلة».`;
  }

  // 3. ملخص نشاطك وإنفاقك
  if (has(['ملخص', 'نظرة عامة', 'نشاطي', 'كيف الوضع', 'كم', 'إنفاق', 'أنفقت', 'ساعات', 'summary'])) {
    return `لديك ${c.activeBookingsCount} حجز فعّال و${c.upcomingCount} حجز قادم، بمجموع ${c.totalSpent} ش.ج، و${c.hoursThisMonth} ساعة محجوزة هذا الشهر.`;
  }

  // 4. حجوزاتي
  if (has(['حجز', 'حجوزات', 'القادم', 'قادمه', 'متى', 'موعدي', 'جدول', 'ملغاة', 'ملغي', 'الغاء', 'إلغاء'])) {
    if (c.upcomingCount === 0) {
      return 'ليس لديك حجز قادم حالياً. سجلك الكامل بالتواريخ والحالات في تبويب «حجوزاتي».';
    }
    const when = c.nextBookingDate ? ` وأقربها «${c.nextBookingName}» بتاريخ ${c.nextBookingDate}` : '';
    const cancelled = c.cancelledBookings > 0 ? `، و${c.cancelledBookings} حجز ملغى` : '';
    return `لديك ${c.upcomingCount} حجز قادم${when}${cancelled}. سجلك في تبويب «حجوزاتي».`;
  }

  return 'اسألني عن حجوزاتك أو مفضّلتك أو طلباتك — مثل: ما هي حجوزاتي القادمة؟';
}

// ----- سؤال الذكاء الاصطناعي الحقيقي (مُقيَّد بالإذن وبالنطاق) -----
// الردود تبقى في علاقة العميل فقط: لا نطلب من الذكاء ترشيح مساحات ولا إنشاء حجوزات.
export async function askCustomerAssistant(message, context, consent) {
  const text = String(message || '').trim();
  const local = () => ({ reply: localCustomerReply(text, context || {}), local: true });

  if (!text) return local();

  // 1. بدون إذن كامل → وضع محلي فقط: البيانات لا تغادر المتصفح أبداً.
  if (consent !== CONSENT_VALUE_GRANTED) return local();

  // 2. إذن كامل → محاولة الذكاء الحقيقي. نرسل ملخّص العميل في حقل مستقل
  //    (customer_context) حتى لا يختلط سياق العميل بسياق المالك على الخادم.
  try {
    const res = await request('/api/assistant/chat', {
      method: 'POST',
      auth: true,
      body: { message: text, customer_context: context || {} },
      timeoutMs: CUSTOMER_ASSISTANT_TIMEOUT_MS,
    });
    const reply = res && typeof res.reply === 'string' && res.reply.trim() ? res.reply.trim() : null;
    if (reply) return { reply, local: false };
    return local();
  } catch {
    return local();
  }
}
