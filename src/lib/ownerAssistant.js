// مساعد المالك الذكي — يعمل داخل لوحة صاحب المساحة ويحل محل فقاعة الواتساب.
//
// مبدأ الخصوصية (الأولوية القصوى):
//   بدون موافقة صريحة من المالك، لا يُرسل أي جزء من بياناته لأي مسار AI إطلاقاً.
//   الإذن يُحفظ في localStorage ومِنطقة قابلة للتغيير من داخل لوحة المساعد.
//   القيمة الافتراضية الآمنة دائماً هي «الوضع المحلي فقط» (لا خروج للبيانات).
//
// ثلاثة أوضاع يحكمها الإذن:
//   consent = 'granted'  → يُرسل السياق + الرسالة لمسار AI الحقيقي (الافتراضي بعد الموافقة).
//   consent = 'local'    → توصيات محلية قائمة على القواعد من بيانات المالك (لا مغادرة للمتصفح).
//   consent = null       → شاشة إذن تُعرض أول مرة؛ لا يحدث شيء قبل القرار.

const CONSENT_KEY = 'masahati_owner_assistant_consent';
const CONSENT_VALUE_GRANTED = 'granted';
const CONSENT_VALUE_LOCAL = 'local';

export function readOwnerAssistantConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === CONSENT_VALUE_GRANTED) return CONSENT_VALUE_GRANTED;
    if (raw === CONSENT_VALUE_LOCAL) return CONSENT_VALUE_LOCAL;
    return null;
  } catch {
    return null;
  }
}

// يسجّل قرار المالك. 'granted' يسمح بمشاركة البيانات مع الذكاء،
// 'local' يقيّد كل شيء على جهاز المالك نفسه.
export function writeOwnerAssistantConsent(value) {
  const v = value === CONSENT_VALUE_GRANTED ? CONSENT_VALUE_GRANTED : CONSENT_VALUE_LOCAL;
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* التخزين غير متاح */
  }
  return v;
}

export function clearOwnerAssistantConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

// ----- بناء سياق المالك الآمن -----
// يُجمّع ملخّصاً من بيانات المالك الحية ليكون أساس التوصيات.
// لا يُبنى حتى تُسأل الدالة — تُستدعى فقط بعد موافقة المالك أو في الوضع المحلي.
export function buildOwnerContext(data) {
  const spaces = Array.isArray(data && data.spaces) ? data.spaces : [];
  const bookings = Array.isArray(data && data.bookings) ? data.bookings : [];
  const ads = Array.isArray(data && data.ads) ? data.ads : [];
  const market = Array.isArray(data && data.market) ? data.market : [];
  const financials = (data && data.financials) || data || {};

  const activeSpaces = spaces.filter((s) => s.is_active !== false);
  const inactiveSpaces = spaces.filter((s) => s.is_active === false);
  const confirmedBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed'
  );
  const totalRevenue = financials.totals?.revenue ?? financials.revenue ?? 0;

  return {
    spacesCount: spaces.length,
    activeSpacesCount: activeSpaces.length,
    inactiveSpacesCount: inactiveSpaces.length,
    spacesWithoutImage: spaces.filter((s) => !s.image).length,
    unpricedSpaces: spaces.filter((s) => Number(s.price_per_hour) <= 0).length,
    amenitiesThinSpaces: spaces.filter((s) => (s.amenities || []).length < 2).length,
    weakRatedSpaces: spaces.filter((s) => s.rating && s.rating < 4).length,
    confirmedBookings: confirmedBookings.length,
    bookingsThisWeek: confirmedBookings.filter((b) => {
      if (!b.date) return false;
      const d = new Date(String(b.date).slice(0, 10));
      if (Number.isNaN(d.getTime())) return false;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay() + 1); // الاثنين
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return d >= start && d < end;
    }).length,
    totalRevenue,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    adsCount: ads.length,
    activeAds: ads.filter((a) => a.status !== 'inactive' && a.status !== 'paused').length,
    openMarketCount: market.filter(
      (r) => r.status !== 'closed' && r.status !== 'cancelled'
    ).length,
  };
}

// ----- رد محلي قائم على القواعد (وضع محلي أو احتياط عند تعذّر الذكاء) -----
// يُنتج رداً ذكياً بسيطاً يتفاعل مع أسئلة المالك ويشير لأقرب إجراء فعلي.
export function localOwnerReply(message, ctx) {
  const text = String(message || '').trim();
  const has = (keys) => keys.some((k) => text.includes(k));

  // 1. لماذا مساحتي غير محجوزة؟ → أرباب السبب حسب البيانات
  if (has(['لماذا', 'ليش', 'لا يوجد حجز', 'ما في حجز', 'لا حجوزات', 'الإشغال'])) {
    const reasons = [];
    if (ctx.spacesWithoutImage > 0) reasons.push(`أضف صورة لـ ${ctx.spacesWithoutImage} مساحة — الصور تزيد الحجز.`);
    if (ctx.unpricedSpaces > 0) reasons.push(`${ctx.unpricedSpaces} مساحة بدون سعر — حدّد السعر لتظهر في نتائج البحث بالأسعار.`);
    if (ctx.amenitiesThinSpaces > 0) reasons.push(`أضف مرافق أساسية (الإنترنت، التكييف، البروجيكتور) لمساحتك.`);
    if (ctx.weakRatedSpaces > 0) reasons.push(`حسّن تقييم ${ctx.weakRatedSpaces} مساحة أقل من 4 — التقييم يؤثر على قرار الطالب.`);
    if (reasons.length === 0) reasons.push('مساحاتك تبدو جاهزة — راجع أسعارك مقارنة مع مساحات مشابهة في السوق.');
    return `${reasons.join(' ')}` + `${ctx.inactiveSpacesCount > 0 ? ` لديك ${ctx.inactiveSpacesCount} مساحة متوقفة — فعّلها لزيادة الظهور.` : ''}`;
  }

  // 2. كيف أرفع أرباحي؟ → توصيات مالية
  if (has(['أرباح', 'الدخل', 'إيراد', 'الإيرادات', 'فلوس', 'أموال', 'كيف أرفع'])) {
    const t = [];
    if (ctx.inactiveSpacesCount > 0) t.push(`فعّل ${ctx.inactiveSpacesCount} مساحة متوقفة — كل مساحة نشطة مصدر دخل محتمل.`);
    if (ctx.unpricedSpaces > 0) t.push('حدّد أسعار الساعة — المساحات المسعّرة تظهر في نتائج البحث وتجذب الحجوزات.');
    if (ctx.spacesWithoutImage > 0) t.push('أضف صوراً — المساحات المصوّرة تحجز أكثر بنسبة كبيرة.');
    if (ctx.openMarketCount > 0) t.push(`هناك ${ctx.openMarketCount} طلب سوق مفتوح — قدّم عروضاً سعرية تنافسية لتحويلها لحجوزات.`);
    if (ctx.adsCount === 0) t.push('أضف إعلاناً في تبويب إعلاناتي — الإعلان يجلب طلبات ويدعم الظهور.');
    if (t.length === 0) t.push('أداؤك الحالي جيد — راقِب السوق بانتظام وقدّم عروضاً للأعرض الجديدة.');
    return t.join(' ');
  }

  // 3. أداء / ملخص عام
  if (has(['ملخص', 'نظرة عامة', 'الأداء', 'نبذة', 'كيف الوضع', 'أدائي', 'تقرير'])) {
    return `لديك ${ctx.activeSpacesCount} مساحة نشطة من أصل ${ctx.spacesCount}، مع ${ctx.confirmedBookings} حجز مؤكد${ctx.bookingsThisWeek > 0 ? ` (منها ${ctx.bookingsThisWeek} هذا الأسبوع)` : ''} وإيراد إجمالي ${ctx.totalRevenue} ش.ج.${ctx.pendingBookings > 0 ? ` هناك ${ctx.pendingBookings} طلب حجز بانتظار ردّك — راجعها في الحجوزات.` : ''}`;
  }

  // 4. اقتراح/توصية مباشرة
  if (has(['اقترح', 'قترح', 'نصيحة', 'انصحني', 'توصية', 'وش اسوي'])) {
    if (ctx.inactiveSpacesCount > 0) return `فعّل مساحتك المتوقفة أولاً — هي الخطوة الأعلى أثراً لزيادة الوصول. بعدها أضف الصور والمرافق الأساسية.`;
    if (ctx.spacesWithoutImage > 0) return `أضف صورة لمساحتك التالية: المساحات المزوّدة بصور تجذب المزيد من الحجوزات. وهي خطوة سريعة من تبويب مساحاتي.`;
    if (ctx.unpricedSpaces > 0) return `حدّد سعر الساعة لمساحتك — المساحة بدون سعر لا تظهر في نتائج البحث بالأسعار.`;
    if (ctx.openMarketCount > 0) return `قدّم عروضاً على الطلبات المفتوحة في السوق (${ctx.openMarketCount} طلب متاح) — إنها أسرع طريق لحجز جديد.`;
    return 'مساحاتك في حالة جيدة. المتابعة المنتظمة بالصور والمرافق وتحديث الأسعار تُبقي ظهورك تنافسياً.';
  }

  return `فهمت سؤالك عن «${text}» — اطّلع على الاقتراحات في الأعلى، أو اسألني عن: كيف أرفع أرباحي؟، لماذا مساحتي غير محجوزة؟، أو اعرض ملخص أدائي.`;
}

// ----- سؤال المالك للذكاء الاصطناعي الحقيقي (مُقيَّد بالإذن) -----
//
// القاعدة الحاسمة: لا يُرسل أي شيء لمسار AI إلا إذا كان الإذن = 'granted'.
//   consent = 'granted' → نرسل الرسالة + ملخّص سياق خاص بالمستخدم إلى /api/assistant/chat.
//   consent = 'local' أو null → رد محلي قائم على القواعد فقط (لا مغادرة للمتصفح).
// على أي فشل (شبكة، مهلة، خطأ خادم) نعود فوراً للرد المحلي — تجربة المساعد لا تنقطع أبداً.

import { request } from './api';

const OWNER_ASSISTANT_TIMEOUT_MS = 45000;

export async function askOwnerAssistant(message, context, consent) {
  const text = String(message || '').trim();
  if (!text) {
    const local = localOwnerReply('', context || {});
    return { reply: local, spaces: [], local: true };
  }

  // 1. بدون إذن كامل → وضع محلي فقط: البيانات لا تغادر المتصفح أبداً.
  if (consent !== CONSENT_VALUE_GRANTED) {
    return { reply: localOwnerReply(text, context || {}), spaces: [], local: true };
  }

  // 2. إذن كامل → محاولة الذكاء الحقيقي مع سياق المالك.
  try {
    const res = await request('/api/assistant/chat', {
      method: 'POST',
      auth: true,
      body: { message: text, owner_context: context || {} },
      timeoutMs: OWNER_ASSISTANT_TIMEOUT_MS,
    });
    const reply =
      res && typeof res.reply === 'string' && res.reply.trim() ? res.reply.trim() : null;
    const spaces = Array.isArray(res && res.spaces) ? res.spaces : [];
    if (reply) return { reply, spaces, local: false };
    return { reply: localOwnerReply(text, context || {}), spaces: [], local: true };
  } catch {
    // أي فشل في الذكاء → رد محلي قائم على القواعد (لا ينقطع المساعد).
    return { reply: localOwnerReply(text, context || {}), spaces: [], local: true };
  }
}
