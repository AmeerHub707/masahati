// وحدة إعلانات المالك — إرسال AD مُخصص للعملاء (ليس لأصحاب المساحات).
// تتصل بالباك إند الحقيقي (Laravel) عبر عميل api.js، ومع أي فشل
// ينتقل لوضع تجريبي محلي حتى لا تكسر التجربة.

import { request, imageUrl } from './api';
import { listOf } from './requests';

const REQ_TIMEOUT_MS = 8000;

const DEMO_FLAG_KEY = 'masahati_owner_ads_demo_v1';
const DEMO_DATA_KEY = 'masahati_owner_ads_data_v1';

// ----- وضع تجريبي -----
export function isAdsDemo() {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function setDemoFlag(on) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG_KEY, '1');
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

function readDemoStore() {
  try {
    const raw = localStorage.getItem(DEMO_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.ads) ? data : null;
  } catch {
    return null;
  }
}

function writeDemoStore(payload) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

// ----- بذرة تجريبية -----
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

function seedOwnerAds() {
  return [
    {
      id: 'ad-1',
      title: 'عرض خاص للمنصة',
      description: 'خصم 20% على جميع المساحات لفترة محدودة. استمتع بالتوفير الآن!',
      link: 'https://masahati.example.com/promo',
      image: '',
      target: 'customers',
      status: 'published',
      created_at: daysAgo(1),
      sent_at: daysAgo(1),
      impressions: 142,
    },
    {
      id: 'ad-2',
      title: 'مساحة جديدة في وسط المدينة',
      description: 'انطلق في موقعنا الجديد مع إنترنت 100 ميجا وتكييف كامل.',
      link: '',
      image: '',
      target: 'customers',
      status: 'draft',
      created_at: daysAgo(3),
      sent_at: '',
      impressions: 0,
    },
  ];
}

function demoStore() {
  const existing = readDemoStore();
  if (existing) return existing;
  const payload = { ads: seedOwnerAds() };
  writeDemoStore(payload);
  return payload;
}

// ----- التطبيع -----
export function mapAd(a) {
  return {
    id: a.ad_id ?? a.id,
    title: a.title ?? '',
    description: a.description ?? a.notes ?? '',
    link: a.link ?? a.url ?? '',
    image: imageUrl(a.image) || '',
    target: a.target ?? 'customers',
    status: a.status ?? 'draft', // draft | published | archived
    created_at: a.created_at ?? a.created ?? '',
    sent_at: a.sent_at ?? a.sent_at ?? '',
    impressions: Number(a.impressions || a.impressions_count || 0),
    schedule: a.schedule ?? null,
  };
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

// ----- واجهات التطبيق (API → تجريبي) -----
export async function loadAdsWithFallback(force = false) {
  if (isAdsDemo() && !force) {
    return { demo: true, ads: demoStore().ads.map(mapAd) };
  }
  try {
    const ads = await fetchOwnerAds();
    setDemoFlag(false);
    return { demo: false, ads };
  } catch {
    setDemoFlag(true);
    return { demo: true, ads: demoStore().ads.map(mapAd) };
  }
}

export async function createAdWithFallback(payload) {
  const applyLocal = () => {
    const store = demoStore();
    const ad = {
      id: `ad-${Date.now()}`,
      title: payload.title || '',
      description: payload.description || '',
      link: payload.link || '',
      image: payload.image || '',
      target: payload.target || 'customers',
      status: 'draft',
      created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      sent_at: '',
      impressions: 0,
      schedule: payload.schedule || null,
    };
    store.ads.unshift(ad);
    const saved = writeDemoStore(store);
    return { ad: mapAd(ad), saved };
  };

  if (isAdsDemo()) {
    const { ad, saved } = applyLocal();
    return {
      demo: true,
      message: saved ? 'تم إنشاء الإعلان (وضع تجريبي).' : 'تعذّر الحفظ المحلي.',
      ad,
    };
  }

  try {
    const result = await createOwnerAd(payload);
    setDemoFlag(false);
    return { demo: false, message: result.message, ad: result.ad };
  } catch {
    setDemoFlag(true);
    const { ad, saved } = applyLocal();
    return {
      demo: true,
      message: saved
        ? 'تعذّر الوصول للخادم — أُنشئ الإعلان محلياً للتجربة.'
        : 'تعذّر الوصول للخادم والتخزين المحلي ممتلئ.',
      ad,
    };
  }
}

export async function publishAdWithFallback(adId, ad) {
  if (isAdsDemo()) {
    const store = demoStore();
    const hit = store.ads.find((a) => String(a.id) === String(adId));
    if (hit) {
      hit.status = 'published';
      hit.sent_at = new Date().toISOString().slice(0, 16).replace('T', ' ');
      writeDemoStore(store);
    }
    return {
      demo: true,
      message: 'تم نشر الإعلان وبثه إلى جميع العملاء (وضع تجريبي).',
      ad: mapAd(hit ? hit : { ...ad, status: 'published', sent_at: new Date().toISOString().slice(0, 16).replace('T', ' ') }),
    };
  }

  try {
    const result = await publishOwnerAd(adId);
    setDemoFlag(false);
    return { demo: false, message: result.message, ad: result.ad };
  } catch {
    setDemoFlag(true);
    const store = demoStore();
    const hit = store.ads.find((a) => String(a.id) === String(adId));
    if (hit) {
      hit.status = 'published';
      hit.sent_at = new Date().toISOString().slice(0, 16).replace('T', ' ');
      writeDemoStore(store);
    }
    return {
      demo: true,
      message: 'تعذّر الوصول للخادم — نُشر الإعلان محلياً للتجربة.',
      ad: mapAd(hit ? hit : { ...ad, status: 'published', sent_at: new Date().toISOString().slice(0, 16).replace('T', ' ') }),
    };
  }
}

export async function deleteAdWithFallback(adId) {
  if (isAdsDemo()) {
    const store = demoStore();
    store.ads = store.ads.filter((a) => String(a.id) !== String(adId));
    writeDemoStore(store);
    return { demo: true, message: 'تم حذف الإعلان.', deleted: true };
  }

  try {
    const result = await deleteOwnerAd(adId);
    setDemoFlag(false);
    return { demo: false, message: result.message, deleted: true };
  } catch {
    setDemoFlag(true);
    const store = demoStore();
    store.ads = store.ads.filter((a) => String(a.id) !== String(adId));
    writeDemoStore(store);
    return { demo: true, message: 'تعذّر الوصول للخادم — حُذف الإعلان محلياً.', deleted: true };
  }
}

export async function updateAdWithFallback(adId, payload) {
  if (isAdsDemo()) {
    const store = demoStore();
    const idx = store.ads.findIndex((a) => String(a.id) === String(adId));
    if (idx !== -1) {
      store.ads[idx] = { ...store.ads[idx], ...payload };
      writeDemoStore(store);
    }
    return {
      demo: true,
      message: 'تم تحديث الإعلان (وضع تجريبي).',
      ad: mapAd(store.ads[idx] || { ...payload, id: adId }),
    };
  }

  try {
    const result = await updateOwnerAd(adId, payload);
    setDemoFlag(false);
    return { demo: false, message: result.message, ad: result.ad };
  } catch {
    setDemoFlag(true);
    const store = demoStore();
    const idx = store.ads.findIndex((a) => String(a.id) === String(adId));
    if (idx !== -1) {
      store.ads[idx] = { ...store.ads[idx], ...payload };
      writeDemoStore(store);
    }
    return {
      demo: true,
      message: 'تعذّر الوصول للخادم — حُدّث الإعلان محلياً.',
      ad: mapAd(store.ads[idx] || { ...payload, id: adId }),
    };
  }
}
