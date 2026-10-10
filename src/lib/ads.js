// وحدة إعلانات المالك — إرسال AD مُخصص للعملاء (ليس لأصحاب المساحات).
// تتصل بالباك إند الحقيقي (Laravel) عبر عميل api.js.
// القراءات لا ترمي أبداً (تعود {error,...}) والإجراءات ترمي الأخطاء الحقيقية.

import { request, imageUrl } from './api';
import { listOf } from './requests';

const REQ_TIMEOUT_MS = 8000;

// ----- التطبيع -----
export function mapAd(a) {
  return {
    id: a.ad_id ?? a.id,
    title: a.title ?? '',
    description: a.description ?? a.notes ?? '',
    link: a.link ?? a.url ?? '',
    image: imageUrl(a.image) || '',
    target: a.target ?? 'customers',
    space_id: a.space_id ?? a.space ?? null,
    status: a.status ?? 'draft', // draft | published | archived
    created_at: a.created_at ?? a.created ?? '',
    sent_at: a.sent_at ?? '',
    impressions: Number(a.impressions || a.impressions_count || 0),
    schedule: a.schedule ?? null,
  };
}

// ----- تغذية إعلانات العميل -----
// GET /api/ads/open — تعرض على شريط إعلانات العميل؛ عند فشلها تبقى القائمة
// فارغة دون أي بيانات مُختلقة.

const CUSTOMER_TAG_DEFAULT = 'عرض';
const CUSTOMER_TAG_SEGMENTED = 'خاص';

// يحوّل عنصر إعلان من نقطة /api/ads/open إلى الشكل الذي يعرضه AdBanner، وهو
// { id, tag, title, spaceName }. العقد يقبل { data: [...] } أو { ads: [...] }
// أو مصفوفة مباشرة.
export function mapCustomerAd(a) {
  const expires = a.expires_at ?? a.expiresAt ?? '';
  return {
    id: a.ad_id ?? a.id,
    title: a.title ?? '',
    description: a.description ?? a.notes ?? '',
    link: a.link ?? a.url ?? '',
    image: imageUrl(a.image) || '',
    ownerName: a.owner_name ?? '',
    spaceName: a.owner_name ?? a.space_name ?? '',
    tag: a.target === 'space_customers' ? CUSTOMER_TAG_SEGMENTED : CUSTOMER_TAG_DEFAULT,
    expiresAt: expires,
  };
}

function isExpired(ad) {
  if (!ad.expiresAt) return false;
  const t = Date.parse(ad.expiresAt);
  // تاريخ غير قابل للتحليل => لا نخفيه (العقد يذكر أن expires_at اختياري).
  return Number.isFinite(t) && t < Date.now();
}

export async function fetchOpenAds() {
  const res = await request('/api/ads/open', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'ads')
    .map(mapCustomerAd)
    .filter((a) => !isExpired(a));
}

// أي فشل في نقطة /api/ads/open يعطي قائمة فارغة مع تسجيل السبب.
export async function loadCustomerAdsWithFallback() {
  try {
    return { error: null, ads: await fetchOpenAds() };
  } catch (err) {
    return { error: err?.message || 'تعذّر تحميل الإعلانات', ads: [] };
  }
}

// ----- واجهة برمجية حقيقية -----
export async function fetchOwnerAds() {
  const res = await request('/api/owner/ads', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'ads').map(mapAd);
}

export async function createOwnerAd(payload) {
  const res = await request('/api/owner/ads', {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      title: payload.title,
      description: payload.description,
      link: payload.link,
      image: payload.image,
      target: payload.target,
      schedule: payload.schedule,
    },
  });
  const body =
    res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? res.data
      : res || {};
  return {
    message: body.message || 'تم إنشاء الإعلان.',
    ad: mapAd(body.ad ?? body),
  };
}

export async function updateOwnerAd(adId, payload) {
  const res = await request(`/api/owner/ads/${adId}`, {
    method: 'PUT',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      title: payload.title,
      description: payload.description,
      link: payload.link,
      image: payload.image,
      target: payload.target,
      status: payload.status,
      schedule: payload.schedule,
    },
  });
  const body =
    res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? res.data
      : res || {};
  return {
    message: body.message || 'تم تحديث الإعلان.',
    ad: mapAd(body.ad ?? body),
  };
}

export async function deleteOwnerAd(adId) {
  const res = await request(`/api/owner/ads/${adId}`, {
    method: 'DELETE',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body =
    res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? res.data
      : res || {};
  return { message: body.message || 'تم حذف الإعلان.' };
}

export async function publishOwnerAd(adId) {
  const res = await request(`/api/owner/ads/${adId}/publish`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body =
    res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? res.data
      : res || {};
  return {
    message: body.message || 'تم نشر الإعلان وبثه إلى جميع العملاء.',
    ad: mapAd(body.ad ?? body),
  };
}

// ----- واجهة التطبيق -----
export async function loadAdsWithFallback() {
  try {
    const ads = await fetchOwnerAds();
    return { error: null, ads };
  } catch (err) {
    return { error: err?.message || 'تعذّر تحميل الإعلانات', ads: [] };
  }
}

export async function createAdWithFallback(payload) {
  try {
    const result = await createOwnerAd(payload);
    return { error: null, message: result.message, ad: result.ad };
  } catch (err) {
    throw err instanceof Error ? err : new Error(err?.message || 'تعذّر إنشاء الإعلان.');
  }
}

export async function publishAdWithFallback(adId) {
  try {
    const result = await publishOwnerAd(adId);
    return { error: null, message: result.message, ad: result.ad };
  } catch (err) {
    throw err instanceof Error ? err : new Error(err?.message || 'تعذّر نشر الإعلان.');
  }
}

export async function deleteAdWithFallback(adId) {
  try {
    const result = await deleteOwnerAd(adId);
    return { error: null, message: result.message, deleted: true };
  } catch (err) {
    throw err instanceof Error ? err : new Error(err?.message || 'تعذّر حذف الإعلان.');
  }
}

export async function updateAdWithFallback(adId, payload) {
  try {
    const result = await updateOwnerAd(adId, payload);
    return { error: null, message: result.message, ad: result.ad };
  } catch (err) {
    throw err instanceof Error ? err : new Error(err?.message || 'تعذّر تحديث الإعلان.');
  }
}