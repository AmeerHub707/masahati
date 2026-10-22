// وحدة لوحة صاحب المساحة — السوق المفتوح، العروض المقدمة، إدارة المساحات.
// تتصل بالباك إند الحقيقي (Laravel) عبر عميل api.js؛ لا يوجد وضع تجريبي.

import { request, imageUrl, ApiError } from './api';
import { getUser } from './authStore';
import { mapRequest, mapOffer, listOf, isRequestOpen } from './requests';

const REQ_TIMEOUT_MS = 8000;
// الرفع (multipart) أبطأ من قراءة JSON — مهلة أوسع للملفات.
const UPLOAD_TIMEOUT_MS = REQ_TIMEOUT_MS + 60000;

// ----- كاش لوحة المالك (عرض فوري عند العودة) -----
export function readOwnerCache() {
  try {
    const raw = localStorage.getItem('masahati_owner_cache');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function writeOwnerCache(payload) {
  try {
    localStorage.setItem('masahati_owner_cache', JSON.stringify(payload));
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearOwnerCache() {
  try {
    localStorage.removeItem('masahati_owner_cache');
  } catch {
    /* التخزين غير متاح */
  }
}

// ----- مطبّعات (normalizers) -----
// أسماء المرافق تختلف بين الواجهة والباك إند: الواجهة تستخدم electricity،
// بينما كتالوج الباك إند (والمرشّح العام GET /api/spaces?amenities=wifi,ac)
// يستخدم power. نحوّل في الطرفين حتى يجد العميل ما كتبه المالك.
const AMENITY_TO_API = { electricity: 'power' };
const AMENITY_FROM_API = { power: 'electricity', wifi: 'internet' };

// مفاتيح الواجهة → مفاتيح الباك إند، بلا تكرار.
export function toApiAmenities(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    const key = AMENITY_TO_API[a] || a;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function normalizeAmenities(b) {
  const raw = Array.isArray(b.amenities) ? b.amenities : [];
  const keys = raw
    .map((a) => {
      if (typeof a === 'string') return a;
      return a.key ?? a.name ?? '';
    })
    .filter(Boolean);
  const out = [];
  for (const k of keys) {
    const key = AMENITY_FROM_API[k] || k;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

// حالة المساحة الموحّدة: active | inactive | pending (بانتظار مراجعة الإدارة) | rejected.
function spaceStatus(s) {
  const known = ['active', 'inactive', 'pending', 'rejected'];
  if (typeof s.status === 'string' && known.includes(s.status)) return s.status;
  return typeof s.is_active === 'boolean' ? (s.is_active ? 'active' : 'inactive') : 'active';
}

// يعيد وثائق إثبات المساحة بشكل موحّد
function normalizeSpaceDocs(docs) {
  const items = Array.isArray(docs)
    ? docs
    : docs && typeof docs === 'object'
      ? Object.entries(docs).map(([id, d]) => ({ id, ...(d || {}) }))
      : [];
  return items
    .filter((d) => d && (d.name || d.file?.name))
    .map((d) => ({
      id: d.id ?? d.key ?? '',
      name: d.name || d.file?.name || 'مستند',
      size: Number(d.size ?? d.file?.size ?? 0),
      type: d.type || d.file?.type || 'application/octet-stream',
    }));
}

function coordOf(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100000) / 100000 : null;
}

function normTime(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2];
  if (!Number.isInteger(h) || h > 23 || Number(min) > 59) return '';
  const mer = m[3] ? m[3].toLowerCase() : '';
  if (mer === 'pm' && h < 12) h += 12;
  else if (mer === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function normPhone(v) {
  return String(v ?? '').trim();
}

// الباك إند الحالي قد يحفظ نتيجة boolean من Cloudinary مكان مسار الصورة، فتعود
// الصورة كـ "1" بدل رابط. نرفض هذه القيم حتّى لا تُعرض صورة مكسورة، لكننا
// نمرّر أي رابط حقيقي فور أن يبدأ الخادم بإعادته — بلا أي تعديل لاحق هنا.
function safeImageUrl(v) {
  if (v === true || v === false || v === 1 || v === 0 || v === '1' || v === '0') return '';
  const s = String(v ?? '').trim();
  if (!s || s === '1' || s === '0' || s === 'true' || s === 'false') return '';
  // روابط مطلقة، أو مسارات نسبية يعالجها imageUrl.
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return imageUrl(s) || '';
  return '';
}

export function mapSpace(s) {
  const img = safeImageUrl(s.image);
  const gallery = Array.isArray(s.gallery)
    ? s.gallery.map((g) => safeImageUrl(g)).filter(Boolean)
    : (img ? [img] : []);
  const status = spaceStatus(s);
  return {
    id: s.space_id ?? s.id,
    created_at: s.approved_at ?? s.published_at ?? s.created_at ?? s.created ?? '',
    title: s.title ?? '',
    description: s.description ?? '',
    location: s.location ?? '',
    lat: coordOf(s.lat ?? s.latitude ?? s.lat_f ?? s.latitude_f),
    lng: coordOf(s.lng ?? s.longitude ?? s.lng_f ?? s.longitude_f ?? s.lon ?? s.long),
    image: img,
    gallery,
    price_per_hour: Number(s.price_per_hour ?? s.price ?? 0),
    capacity: Number(s.capacity ?? 0),
    open_time: normTime(s.open_time ?? s.opening_time ?? s.opens_at ?? s.start_time),
    close_time: normTime(s.close_time ?? s.closing_time ?? s.closes_at ?? s.end_time),
    contact_phone: normPhone(s.contact_phone ?? s.contact_number ?? s.phone ?? s.mobile),
    amenities: normalizeAmenities(s),
    internet: s.internet ?? s.has_internet ?? s.wifi ?? null,
    power: s.power ?? s.has_power ?? s.electricity ?? null,
    status,
    is_active: status === 'active',
    docs: normalizeSpaceDocs(s.docs),
    rating: Math.round(Number(s.rating ?? 0) * 10) / 10,
    category: typeof s.category === 'string' ? s.category : '',
    area: String(s.area ?? s.neighborhood ?? s.district ?? ''),
    review_count: Number(s.review_count ?? s.reviews_count ?? s.ratings_count ?? 0),
    instant_booking: Boolean(s.instant_booking ?? s.instant ?? false),
    stats: s.stats
      ? {
          bookings: Number(s.stats.bookings ?? 0),
          revenue: Number(s.stats.revenue ?? 0),
          occupancy: Number(s.stats.occupancy ?? 0),
          totalBookings: Number(s.stats.totalBookings ?? 0),
        }
      : null,
  };
}

export function mapMyOffer(o) {
  return {
    id: o.offer_id ?? o.id,
    requestId: o.request_id ?? null,
    requestTitle: o.request_title ?? o.title ?? '',
    status: o.status || 'pending',
    price_per_hour: Number(o.price_per_hour ?? o.price ?? 0),
    currency: o.currency ?? 'ش.ج',
    duration_hours: Number(o.duration_hours ?? o.hours ?? 0),
    created_at: o.created_at ?? o.created ?? '',
  };
}

function hoursFromTimes(from, to) {
  const parse = (t) => {
    const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  const diff = (b - a) / 60;
  return diff > 0 ? diff : null;
}

export function mapOwnerBooking(b) {
  const timeFrom = b.time_from || b.start_time || '';
  const timeTo = b.time_to || b.end_time || '';
  const hours = Number(b.hours ?? b.duration_hours ?? 0) || hoursFromTimes(timeFrom, timeTo) || 0;
  return {
    id: b.booking_id ?? b.id,
    spaceId: b.space_id ?? b.spaceId ?? null,
    spaceName: b.space_name ?? b.title ?? '',
    image: imageUrl(b.image) || '',
    date: b.date || '',
    time: timeFrom && timeTo ? `${timeFrom} – ${timeTo}` : (timeFrom || timeTo || b.time || ''),
    timeFrom,
    timeTo,
    hours,
    price: Number(b.price || b.cost || 0),
    customer: b.customer ?? b.customer_name ?? '',
    status: b.status || 'pending',
  };
}

export function belongsToSpace(b, sp) {
  if (!sp) return true;
  if (b.spaceId != null && sp.id != null && String(b.spaceId) === String(sp.id)) return true;
  return Boolean(b.spaceName) && b.spaceName === sp.title;
}

// ----- API حقيقي -----
export async function fetchMarketRequests() {
  const res = await request('/api/special-requests/open', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'requests').map(mapRequest);
}

export async function submitOwnerProposal(requestId, payload) {
  const res = await request(`/api/special-requests/${requestId}/offers`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      space_id: payload.space_id,
      price_per_hour: payload.price_per_hour,
      duration_hours: payload.duration_hours,
      notes: payload.notes || '',
      currency: payload.currency || 'ش.ج',
    },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || 'تم إرسال عرضك، وسيصل صاحب الطلب للاختيار.',
    offer: body.offer ? mapOffer(body.offer) : null,
  };
}

export async function fetchOwnerOffers() {
  const res = await request('/api/owner/offers', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'offers').map(mapMyOffer);
}

export async function fetchOwnerSpaces() {
  const res = await request('/api/owner/spaces', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'spaces').map(mapSpace);
}

// مرافق الطلب = الشرائح المختارة + مفاتيح الإنترنت/الكهرباء، موحّدة بأسماء
// الباك إند وبلا تكرار. الباك إند يشترط مصفوفة مرافق غير فارغة.
function unionApiAmenities(payload) {
  const list = [
    ...(Array.isArray(payload.amenities) ? payload.amenities : []),
    ...(payload.internet ? ['internet'] : []),
    ...(payload.power ? ['electricity'] : []),
  ];
  return toApiAmenities(list);
}

// إنشاء المساحة multipart (لا JSON): الباك إند يشترط ملف إثبات `docs` ضمن
// الطلب نفسه، ويرفض أي طلب JSON. كل الحقول تُرسل كنصوص، والمرافق كمصفوفة JSON.
export async function createOwnerSpace(payload) {
  const proof = payload.proofFile || null;
  const fd = new FormData();
  fd.append('title', String(payload.title ?? ''));
  fd.append('description', String(payload.description ?? ''));
  fd.append('location', String(payload.location ?? ''));
  fd.append('lat', String(coordOf(payload.lat) ?? ''));
  fd.append('lng', String(coordOf(payload.lng) ?? ''));
  fd.append('price_per_hour', String(payload.price_per_hour ?? ''));
  fd.append('capacity', String(payload.capacity ?? ''));
  fd.append('open_time', normTime(payload.open_time));
  fd.append('close_time', normTime(payload.close_time));
  fd.append('contact_phone', normPhone(payload.contact_phone));
  fd.append('amenities', JSON.stringify(unionApiAmenities(payload)));
  fd.append('internet', payload.internet ? 'true' : 'false');
  fd.append('power', payload.power ? 'true' : 'false');
  // الصورة تُرفع كملف حقيقي يحمل امتداده، لا كنصّ base64 بلا اسم: كان
  // النصّ المجرّد يمنع الخادم من معرفة الامتداد (png/jpg/webp) فيحفظ نوعاً
  // عامّاً أو يرفضه. الاسم مبنيٌّ على نوع الملصق نفسه، فما رسا في المعاينة
  // هو ما يُرسل. وإن تعذّر بناء الملف نُرجع خطأً صريحاً بدل إرسال نصٍّ صامت.
  if (payload.image) {
    const fileName = `space.${extForType(imageTypeOf(payload.image))}`;
    if (!appendImage(fd, payload.image, fileName)) {
      throw new ApiError('تعذّر تجهيز صورة المساحة للرفع — جرّب صورة أخرى.', 0);
    }
  }
  if (proof) fd.append('docs', proof, proof.name || 'proof');

  const res = await request('/api/owner/spaces', {
    method: 'POST',
    auth: true,
    isForm: true,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    body: fd,
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تمت إضافة المساحة.', space: mapSpace(body.space ?? body) };
}

export async function toggleOwnerSpaceActive(spaceId, isActive) {
  const res = await request(`/api/owner/spaces/${spaceId}/active`, {
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: { is_active: isActive },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تم تحديث حالة المساحة.', space: mapSpace(body.space ?? body) };
}

// ----- تعديل المساحة -----
// مبدآن يحكمان هذا القسم:
//   1) لا نرسل إلا الحقول التي تغيّرت فعلاً (مقارنةً بالمساحة الأصلية)، فلا
//      يضطر المالك لإعادة تعبئة كل الحقول لتعديل حقل واحد.
//   2) لا نرسل `null` ولا `[]` لحقل كان له قيمة ولم يُقصد محوه — `PUT` دلالته
//      استبدال المورد بالكامل، فإرسال قيمة فارغة يمحو البيانات بصمت.

// معرّف ملف الصورة الجديد (data-URL أو File) إن اختاره المالك في هذه الجلسة.
// عند وجوده ننتقل إلى مسار multipart لرفع ملف حقيقي بدل نص داخل JSON.
function isNewImage(v) {
  const s = String(v ?? '');
  return s.startsWith('data:') || s.startsWith('blob:');
}

// مقارنة نصية متسامحة: تُعيد true إن اختلفت القيمتان بعد التطبيع.
function changed(next, prev) {
  return String(next ?? '').trim() !== String(prev ?? '').trim();
}

// الفرق بين النموذج والمساحة الأصلية — مفاتيح بأسماء الباك إند.
// القيم المُعادة هنا **جاهزة للإرسال** (مطبّعة)، لا خام.
function diffPayload(payload, original) {
  const diff = {};
  const o = original || {};

  if (changed(payload.title, o.title)) diff.title = String(payload.title ?? '').trim();
  if (changed(payload.description, o.description)) diff.description = String(payload.description ?? '').trim();
  if (changed(payload.location, o.location)) diff.location = String(payload.location ?? '').trim();

  const lat = coordOf(payload.lat);
  const lng = coordOf(payload.lng);
  if (lat !== null && lat !== coordOf(o.lat)) diff.lat = lat;
  if (lng !== null && lng !== coordOf(o.lng)) diff.lng = lng;

  const price = Number(payload.price_per_hour);
  if (Number.isFinite(price) && price !== Number(o.price_per_hour)) diff.price_per_hour = price;

  const cap = Number(payload.capacity);
  if (Number.isFinite(cap) && cap !== Number(o.capacity)) diff.capacity = cap;

  const open = normTime(payload.open_time);
  if (open && open !== normTime(o.open_time)) diff.open_time = open;

  const close = normTime(payload.close_time);
  if (close && close !== normTime(o.close_time)) diff.close_time = close;

  const phone = normPhone(payload.contact_phone);
  if (phone && phone !== normPhone(o.contact_phone)) diff.contact_phone = phone;

  // المرافق مزامنة كاملة: نقارن في فضاء مفاتيح الواجهة (فالمساحة الأصلية
  // مرّت أصلاً بـ mapSpace)، ولا نرسلها إن لم تتغيّر حتى لا نستبدل المجموعة
  // القائمة بلا داعٍ. `ne` مفاتيح واجهة، و`oe` كذلك.
  const nextAmen = unionApiAmenities(payload);
  const nextFacing = nextAmen.map((a) => AMENITY_FROM_API[a] || a).sort();
  const prevFacing = [...(Array.isArray(o.amenities) ? o.amenities : [])].sort();
  if (JSON.stringify(nextFacing) !== JSON.stringify(prevFacing)) {
    diff.amenities = nextAmen;
  }

  if (Boolean(payload.internet) !== Boolean(o.internet)) diff.internet = Boolean(payload.internet);
  if (Boolean(payload.power) !== Boolean(o.power)) diff.power = Boolean(payload.power);

  // الصورة: تُرسل فقط عند اختيار صورة جديدة تختلف عن الحالية. الصورة الجديدة
  // تُعرَف بكونها data-URL/blob (نتيجة قراءة ملف محلي)، أو باختلافها عن الأصل.
  const img = payload.image || '';
  const nextImg = isNewImage(img) ? '__new__' : img;
  const prevImg = o.image || '';
  if (img && nextImg !== prevImg) {
    diff.image = img;
  }

  return diff;
}

// الكائن الكامل للتعديل: الأصل + التغييرات. يُستخدم في مسار `PUT` الاحتياطي
// حيث يُطلب المورد كاملاً — وكل حقل فيه يحمل قيمة صالحة، لا فراغات.
function fullPayloadFrom(payload, original) {
  const o = original || {};
  const lat = coordOf(payload.lat);
  const lng = coordOf(payload.lng);
  const price = Number(payload.price_per_hour);
  const cap = Number(payload.capacity);
  const image = payload.image || o.image || '';
  return {
    title: String(payload.title ?? o.title ?? '').trim(),
    description: String(payload.description ?? o.description ?? '').trim(),
    location: String(payload.location ?? o.location ?? '').trim(),
    lat: lat !== null ? lat : coordOf(o.lat),
    lng: lng !== null ? lng : coordOf(o.lng),
    price_per_hour: Number.isFinite(price) ? price : Number(o.price_per_hour ?? 0),
    capacity: Number.isFinite(cap) ? cap : Number(o.capacity ?? 0),
    open_time: normTime(payload.open_time) || normTime(o.open_time),
    close_time: normTime(payload.close_time) || normTime(o.close_time),
    contact_phone: normPhone(payload.contact_phone) || normPhone(o.contact_phone),
    amenities: unionApiAmenities(payload),
    internet: Boolean(payload.internet),
    power: Boolean(payload.power),
    // صورة موجودة تبقى كما هي إن لم يُختر غيرها — لا تُرسل '' فتمحوها.
    // والصورة الجديدة (data-URL) لا تُرسل في مسار JSON: مسارها multipart.
    image: isNewImage(image) ? (o.image || '') : image,
  };
}

// تحويل data-URL إلى كائن ملف حقيقي. الصور في النموذج تُقرأ كـ data-URL
// (`readImageFile`)، وإرسال النص داخل FormData يرفع base64 كنصّ لا كملف —
// وهذا أصل مشكلة حقل الصورة. هنا نعيد ثنائيات الملف الحقيقية.
function dataUrlToFile(dataUrl, filename) {
  const m = String(dataUrl).match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!m) return null;
  const type = m[1] || 'application/octet-stream';
  const isB64 = Boolean(m[2]);
  try {
    const bin = isB64 ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    if (typeof globalThis.File === 'function') return new globalThis.File([bytes], filename, { type });
    if (typeof globalThis.Blob === 'function') return new globalThis.Blob([bytes], { type });
    return null;
  } catch {
    return null;
  }
}

// إرفاق الصورة كملف. `append` يرفض كائناً من فضاء عام مختلف، وفي هذه الحالة
// نُرجع خطأً صريحاً بدل إرسال base64 كنصّ يُحفظ خطأً في الخادم.
function appendImage(fd, dataUrl, filename) {
  const file = dataUrlToFile(dataUrl, filename);
  if (!file) return false;
  try {
    fd.append('image', file, filename);
    return true;
  } catch {
    return false;
  }
}

// امتداد مناسب من نوع الملف، لاسم الملف المرفوع.
function extForType(type) {
  if (/png/i.test(type)) return 'png';
  if (/webp/i.test(type)) return 'webp';
  if (/jpe?g/i.test(type)) return 'jpg';
  return 'jpg';
}

// نوع MIME المستخرج من ترويسة data-URL (مثل data:image/png;base64,...).
function imageTypeOf(v) {
  const m = String(v ?? '').match(/^data:([^;,]+)/);
  return m ? m[1] : '';
}

// هل يدعم الخادم `PATCH` على هذه النقطة؟ 404/405/501 = لا.
function isPatchUnsupported(err) {
  const s = err?.status;
  return s === 404 || s === 405 || s === 501;
}

function unwrapSpace(res) {
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message, space: mapSpace(body.space ?? body) };
}

// تعديل المساحة. مساران منفصلان:
//   • بلا صورة جديدة → `PATCH` بجسم JSON يحتوي الحقول المتغيّرة فقط.
//   • مع صورة جديدة  → `POST .../_method=PATCH` وmultipart/form-data مع ملف حقيقي.
// وإن لم يُدعم `PATCH` (404/405/501) نرجع إلى `PUT` بكامل الكائن الحالي.
//
// `original` هو الكائن قبل التعديل (من `mapSpace`)، وبه وحده نستطيع بناء الفرق.
export async function updateOwnerSpace(spaceId, payload, original = null) {
  const diff = diffPayload(payload, original);
  const pickNewImage = isNewImage(payload.image);

  // لا تغيير = لا طلب. إرسال طلب فارغ قد يمحو حقولاً على خوادم تُفسّر `PUT`
  // كاستبدال كامل.
  if (!pickNewImage && Object.keys(diff).length === 0) {
    return { message: 'لا توجد تغييرات للحفظ.', space: original ? mapSpace(original) : null, unchanged: true };
  }

  try {
    if (pickNewImage) {
      // مسار الملف: multipart. نفس عقد الإنشاء، لكن كل الحقول اختيارية.
      const fileName = `space.${extForType(imageTypeOf(payload.image))}`;
      const fd = new FormData();
      fd.append('_method', 'PATCH');
      const fields = { ...diff };
      delete fields.image;
      for (const [key, value] of Object.entries(fields)) {
        fd.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
      }
      // نرفق ملفاً حقيقياً لا نصاً. إن تعذّر بناء الملف نرمي خطأً صريحاً بدل
      // إرسال base64 كنصّ يُخزَّن خطأً في الخادم (وهو أصل مشكلة الصورة).
      if (!appendImage(fd, payload.image, fileName)) {
        const e = new Error('تعذّر تجهيز ملف الصورة للرفع.');
        e.status = 0;
        throw e;
      }
      const res = await request(`/api/owner/spaces/${spaceId}`, {
        method: 'POST',
        auth: true,
        isForm: true,
        timeoutMs: UPLOAD_TIMEOUT_MS,
        body: fd,
      });
      return unwrapSpace(res);
    }

    const res = await request(`/api/owner/spaces/${spaceId}`, {
      method: 'PATCH',
      auth: true,
      timeoutMs: REQ_TIMEOUT_MS,
      body: diff,
    });
    return unwrapSpace(res);
  } catch (err) {
    if (!isPatchUnsupported(err)) throw err;
    // الخادم لا يدعم `PATCH` بعد — نرسل المورد كاملاً عبر `PUT`، مدمجاً مع
    // التغييرات، وبلا أي قيمة فارغة مكان قيمة قائمة.
    //
    // تحذير صريح: `PUT` هنا JSON ولا يحمل ملفاً. إن كان المالك قد اختار صورة
    // جديدة، فلا سبيل لإرسالها بهذا المسار — نُكمل الحقول الأخرى ونُبلّغ
    // أن الصورة لم تُحفظ، بدل نجاح كاذب.
    const full = fullPayloadFrom(payload, original);
    const imageDropped = isNewImage(payload.image);
    const res = await request(`/api/owner/spaces/${spaceId}`, {
      method: 'PUT',
      auth: true,
      timeoutMs: REQ_TIMEOUT_MS,
      body: {
        title: full.title,
        description: full.description,
        location: full.location,
        lat: full.lat,
        lng: full.lng,
        price_per_hour: full.price_per_hour,
        capacity: full.capacity,
        amenities: full.amenities,
        internet: full.internet,
        power: full.power,
        image: full.image,
        // حقول قد يتجاهلها الخادم اليوم، لكن إرسالها هنا شرط أن تعمل ميزة
        // «عدّل الساعات/الرقم بلا إعادة تعبئة» إن كان الخادم يدعمها في PUT.
        open_time: full.open_time,
        close_time: full.close_time,
        contact_phone: full.contact_phone,
      },
    });
    const out = unwrapSpace(res);
    return { ...out, imageDropped };
  }
}

// مقارنة ما أرسلناه بما أعاده الخادم — لكشف الحقول التي أسقطها بصمت
// (مثل ساعات العمل والرقم في العقد الحالي) وعرضها للمالك بدل رسالة نجاح كاذبة.
export function droppedFields(original, payload, returned) {
  if (!returned) return [];
  const o = original || {};
  const labels = {
    open_time: 'ساعة الفتح',
    close_time: 'ساعة الإغلاق',
    contact_phone: 'رقم التواصل',
    title: 'اسم المساحة',
    description: 'الوصف',
    location: 'الموقع',
    price_per_hour: 'سعر الساعة',
    capacity: 'السعة',
  };
  const sent = fullPayloadFrom(payload, o);
  const out = [];
  for (const [key, label] of Object.entries(labels)) {
    if (key === 'title' || key === 'description' || key === 'location') {
      // نصّية: نقارن فقط إن كان الحقل قد تغيّر فعلاً عن الأصل.
      if (!changed(sent[key], o[key])) continue;
      if (changed(sent[key], returned[key])) out.push(label);
    } else if (key === 'contact_phone' || key === 'open_time' || key === 'close_time') {
      if (!changed(sent[key], o[key])) continue;
      if (changed(sent[key], returned[key])) out.push(label);
    } else {
      if (Number(sent[key]) !== Number(o[key]) && Number(sent[key]) !== Number(returned[key])) out.push(label);
    }
  }
  return out;
}

export async function deleteOwnerSpace(spaceId) {
  const res = await request(`/api/owner/spaces/${spaceId}`, {
    method: 'DELETE',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تم حذف المساحة.' };
}

export async function fetchOwnerBookings() {
  const res = await request('/api/owner/bookings', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'bookings').map(mapOwnerBooking);
}

export function mapOwnerReview(r) {
  return {
    id: r.review_id ?? r.id,
    spaceId: r.space_id ?? null,
    spaceName: r.space_name ?? '',
    spaceImage: imageUrl(r.space_image || r.image) || '',
    rating: Number(r.rating || 0),
    title: r.title ?? '',
    comment: r.comment ?? r.text ?? r.review ?? '',
    customer: r.customer_name ?? r.customer ?? '',
    customerAvatar: imageUrl(r.customer_avatar || r.avatar) || '',
    date: r.date || r.created_at || '',
    createdAt: r.created_at ?? '',
  };
}

export async function fetchOwnerReviews(spaceId) {
  const qs = spaceId ? `?space_id=${encodeURIComponent(spaceId)}` : '';
  const res = await request(`/api/owner/reviews${qs}`, {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'reviews').map(mapOwnerReview);
}

export async function updateOwnerBookingStatus(bookingId, status) {
  const res = await request(`/api/owner/bookings/${bookingId}/status`, {
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: { status },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || (status === 'confirmed' ? 'تم تأكيد الحجز.' : 'تم رفض طلب الحجز.'),
    booking: body.booking ? mapOwnerBooking(body.booking) : null,
  };
}

// ----- واجهات التطبيق (loaders: لا ترمي، تعيد {error,...})
export async function loadMarketWithFallback() {
  try {
    const requests = await fetchMarketRequests();
    return { error: null, requests };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل السوق المفتوح';
    return { error: message, requests: [] };
  }
}

export async function submitProposalWithFallback(requestId, payload) {
  const result = await submitOwnerProposal(requestId, payload);
  return { message: result.message, offer: result.offer, duplicate: false };
}

export async function loadOwnerOffersWithFallback() {
  try {
    const offers = await fetchOwnerOffers();
    return { error: null, offers };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل العروض';
    return { error: message, offers: [] };
  }
}

export async function loadSpacesWithFallback() {
  try {
    const spaces = await fetchOwnerSpaces();
    return { error: null, spaces };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل مساحات المالك';
    return { error: message, spaces: [] };
  }
}

export async function createSpaceWithFallback(payload) {
  const result = await createOwnerSpace(payload);
  return { message: result.message, space: result.space };
}

export async function toggleSpaceActiveWithFallback(spaceId, isActive) {
  const result = await toggleOwnerSpaceActive(spaceId, isActive);
  return { message: result.message, space: result.space };
}

export async function updateSpaceWithFallback(spaceId, payload, original = null) {
  const result = await updateOwnerSpace(spaceId, payload, original);
  return {
    message: result.message,
    space: result.space,
    unchanged: result.unchanged,
    imageDropped: result.imageDropped,
  };
}

export async function deleteSpaceWithFallback(spaceId) {
  const result = await deleteOwnerSpace(spaceId);
  return { message: result.message, deleted: true };
}

export async function loadOwnerBookingsWithFallback() {
  try {
    const bookings = await fetchOwnerBookings();
    return { error: null, bookings };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل الحجوزات';
    return { error: message, bookings: [] };
  }
}

export async function setBookingStatusWithFallback(bookingId, status) {
  const result = await updateOwnerBookingStatus(bookingId, status);
  return { message: result.message };
}

export async function loadReviewsWithFallback(spaceId) {
  try {
    const reviews = await fetchOwnerReviews(spaceId);
    return { error: null, reviews };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل التقييمات';
    return { error: message, reviews: [] };
  }
}

// ----- وثائق المالك -----
const DOCS_KEY = 'masahati_owner_documents_v1';
const LEGACY_DOCS_KEY = 'masahati.owner-docs';
const LEGACY_SENT_KEY = 'masahati.owner-docs-sent';

export const DOC_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export function canAddSpace(doc) {
  return doc?.status === DOC_STATUS.APPROVED;
}

export function isDocsLocked(doc) {
  return doc?.status === DOC_STATUS.PENDING || doc?.status === DOC_STATUS.APPROVED;
}

function normalizeDocFiles(files) {
  const out = {};
  if (files && typeof files === 'object') {
    for (const id of ['assets', 'cert']) {
      const f = files[id];
      const src = f && (f.name || f.file?.name) ? f : null;
      if (src) {
        out[id] = {
          name: src.name || src.file.name,
          size: Number(src.size ?? src.file?.size ?? 0),
          type: src.type || src.file?.type || 'file',
        };
      }
    }
  }
  return out;
}

function normalizeDoc(raw) {
  const d = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data
    : (raw && typeof raw === 'object' ? raw : {});
  return {
    status: Object.values(DOC_STATUS).includes(d.status) ? d.status : DOC_STATUS.NONE,
    files: normalizeDocFiles(d.files),
    note: d.note || d.review_note || d.admin_note || '',
    submittedAt: d.submitted_at || d.submittedAt || '',
    reviewedAt: d.reviewed_at || d.reviewedAt || '',
  };
}

function readLegacyDocs() {
  try {
    const rawFiles = localStorage.getItem(LEGACY_DOCS_KEY);
    const files = rawFiles ? JSON.parse(rawFiles) : {};
    const sent = localStorage.getItem(LEGACY_SENT_KEY) === '1';
    if (!rawFiles && !sent) return null;
    return normalizeDoc({
      status: sent ? DOC_STATUS.PENDING : DOC_STATUS.NONE,
      files,
    });
  } catch {
    return null;
  }
}

export function readOwnerDocuments() {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return normalizeDoc(data);
    }
  } catch {
    /* التخزين غير متاح أو تالف */
  }
  return readLegacyDocs() || normalizeDoc(null);
}

export function writeOwnerDocuments(doc) {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(normalizeDoc(doc)));
    return true;
  } catch {
    return false;
  }
}

export function clearOwnerDocuments() {
  try {
    localStorage.removeItem(DOCS_KEY);
    localStorage.removeItem(LEGACY_DOCS_KEY);
    localStorage.removeItem(LEGACY_SENT_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

export async function fetchOwnerDocuments() {
  const res = await request('/api/owner/documents', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return normalizeDoc(res);
}

export async function submitOwnerDocuments(entries) {
  const fd = new FormData();
  for (const [id, entry] of Object.entries(entries || {})) {
    if (entry?.file) fd.append(id, entry.file);
  }
  const res = await request('/api/owner/documents', {
    method: 'POST',
    auth: true,
    isForm: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: fd,
  });
  return normalizeDoc(res);
}

export async function loadOwnerDocumentsWithFallback() {
  try {
    const doc = await fetchOwnerDocuments();
    writeOwnerDocuments(doc);
    return { error: null, doc };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل وثائق المالك';
    return { error: message, doc: readOwnerDocuments() };
  }
}

export async function submitOwnerDocumentsWithFallback(entries) {
  const local = readOwnerDocuments();
  if (isDocsLocked(local)) {
    return {
      locked: true,
      doc: local,
      message: local.status === DOC_STATUS.APPROVED
        ? 'وثائقك معتمدة بالفعل — يمكنك إضافة المساحات.'
        : 'وثائقك قيد المراجعة حالياً؛ لا يمكن تعديلها حتى قرار الإدارة.',
    };
  }
  const doc = await submitOwnerDocuments(entries);
  writeOwnerDocuments(doc);
  return { locked: false, doc, message: 'تم إرسال وثائقك للمراجعة.' };
}

// ----- مستندات المساحة (تُرفع بعد إنشائها) -----
// إضافة المساحة تُرسل البيانات بوصف المستند (الاسم، الحجم، النوع) في
// `docs[]`، لكن الملف نفسه لا يصل المخدم بذلك الوصف وحده: لعرضه على
// المشرف قبل القرار (تفعيل/رفض) يُرفع الملف الحقيقي عبر multipart هنا.
// الحقل يطابق معرّف الدرج في نموذج المساحة (proof).
export async function uploadSpaceDocument(spaceId, slotId, file) {
  const fd = new FormData();
  fd.append(slotId, file, file.name);
  const res = await request(`/api/owner/spaces/${spaceId}/documents`, {
    method: 'POST',
    auth: true,
    isForm: true,
    timeoutMs: REQ_TIMEOUT_MS + 60000, // الرفع أبطأ من قراءة JSON — مهلة أوسع
    body: fd,
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || 'تم رفع المستند.',
    documents: Array.isArray(body.documents) ? body.documents : [],
  };
}

export async function uploadSpaceDocumentWithFallback(spaceId, slotId, file) {
  const result = await uploadSpaceDocument(spaceId, slotId, file);
  return { error: null, message: result.message, documents: result.documents };
}

// ----- تحميل لوحة المالك كاملة (بالتوازي) مع الكاش -----
let dashboardInFlight = null;

async function loadOwnerDashboardImpl() {
  const settled = await Promise.allSettled([
    fetchOwnerSpaces(),
    fetchOwnerOffers(),
    fetchMarketRequests(),
    fetchOwnerBookings(),
    request('/api/profile', { method: 'GET', auth: true, timeoutMs: REQ_TIMEOUT_MS }),
    fetchOwnerReviews(),
  ]);

  if (!settled.some((r) => r.status === 'fulfilled')) {
    return {
      error: 'تعذّر تحميل بيانات لوحة المالك',
      user: getUser() || { name: '' },
      stats: { spacesCount: 0, activeSpacesCount: 0, openMarket: 0, pendingOffers: 0, acceptedOffers: 0 },
      spaces: [],
      offers: [],
      market: [],
      bookings: [],
      reviews: [],
    };
  }

  const pick = (i, fallback) =>
    settled[i] && settled[i].status === 'fulfilled' ? settled[i].value : fallback;
  const spacesApi = pick(0, []);
  const offersApi = pick(1, []);
  const marketApi = pick(2, []);
  const bookingsApi = pick(3, []);
  const profileApi = pick(4, null);
  const reviewsApi = pick(5, []);

  const localUser = getUser() || {};
  const p = profileApi && typeof profileApi === 'object' ? profileApi : {};
  const name = p.name || localUser.name || '';
  const email = p.email || localUser.email || '';
  const phone = p.phone || localUser.phone || '';
  const photo = imageUrl(p.picture || p.photo || localUser.photo || localUser.picture) || '';

  const spaces = spacesApi;
  const offers = offersApi;
  const market = marketApi.filter((r) => isRequestOpen(r));

  const store = {
    spaces: spaces.map((s) => ({ ...s, id: s.id })),
    offers: offers.map((o) => ({ ...o, request_id: o.requestId, request_title: o.requestTitle, status: o.status })),
  };

  const openMarket = market.filter((r) => isRequestOpen(r)).length;
  const stats = {
    spacesCount: store.spaces.length,
    activeSpacesCount: store.spaces.filter((s) => s.is_active !== false).length,
    openMarket,
    pendingOffers: store.offers.filter((o) => o.status === 'pending').length,
    acceptedOffers: store.offers.filter((o) => o.status === 'accepted').length,
  };

  return {
    error: null,
    user: { name, email, phone, photo, role: 'owner' },
    stats,
    spaces,
    offers,
    market,
    bookings: bookingsApi,
    reviews: reviewsApi,
  };
}

export async function loadOwnerDashboardWithFallback(force = false) {
  if (!force && dashboardInFlight) return dashboardInFlight;
  dashboardInFlight = loadOwnerDashboardImpl().then((r) => {
    dashboardInFlight = null;
    return r;
  });
  return dashboardInFlight;
}
