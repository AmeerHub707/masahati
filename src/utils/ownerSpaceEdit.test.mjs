// اختبارات وحدة لتعديل المساحة: بناء فرق الحقول، مسار PATCH، مسار الملف
// (multipart)، والرُجوع إلى PUT، وصدق الإبلاغ عن الحقول المُسقطة.
//
// يعمل عبر Vite SSR لأن owner.js يستورد api.js (يحتاج import.meta.env).
// الشبكة كلها مُحاكاة — لا اتصال حقيقي ولا باك إند.
import { JSDOM, VirtualConsole } from 'jsdom';

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
  virtualConsole,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
// لا نستبدل FormData/File/Blob: نتركها بفضاء Node الأصلي، وهو نفس الفضاء الذي
// يعمل فيه owner.js عبر Vite SSR — فـ append يقبلها. نُضيف atob فقط.
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, expected, actual) {
  if (ok) pass++;
  else {
    fail++;
    failures.push({ name, expected, actual });
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
}

const { createServer } = await import('vite');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const api = await server.ssrLoadModule('/src/lib/api.js');
const owner = await server.ssrLoadModule('/src/lib/owner.js');
const BASE = api.BASE_URL;

// توكن مالك حتى يمرّ الطلب كموثَّق.
dom.window.localStorage.setItem('masahati_token', 'tok-owner-1');

// مساحة أصلية كما تعيدها mapSpace تماماً (مفاتيح واجهة، لا مفاتيح API).
const ORIGINAL = {
  id: 12,
  title: 'قاعة العروض',
  description: 'قاعة واسعة',
  location: 'غزة',
  lat: 31.5017,
  lng: 34.4668,
  price_per_hour: 25,
  capacity: 10,
  open_time: '09:00',
  close_time: '17:00',
  contact_phone: '0599000000',
  amenities: ['internet', 'electricity'],
  internet: true,
  power: true,
  image: 'https://cdn.example.com/old.jpg',
  gallery: ['https://cdn.example.com/old.jpg'],
};

// حمولة نموذج مبنية من الأصل (كما يفعل readPayload).
function formOf(overrides = {}) {
  return {
    title: ORIGINAL.title,
    description: ORIGINAL.description,
    location: ORIGINAL.location,
    lat: ORIGINAL.lat,
    lng: ORIGINAL.lng,
    price_per_hour: ORIGINAL.price_per_hour,
    capacity: ORIGINAL.capacity,
    open_time: ORIGINAL.open_time,
    close_time: ORIGINAL.close_time,
    contact_phone: ORIGINAL.contact_phone,
    amenities: [...ORIGINAL.amenities],
    internet: ORIGINAL.internet,
    power: ORIGINAL.power,
    image: ORIGINAL.image,
    ...overrides,
  };
}

// يلتقط الطلبات ويُعيد استجابة ناجحة، مع إمكانية إجبار رمز خطأ.
function makeFetch(opts = {}) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const path = String(url).startsWith(BASE) ? String(url).slice(BASE.length) : String(url);
    calls.push({ path, method: (init.method || 'GET').toUpperCase(), body: init.body });
    const status = opts.statusFor ? opts.statusFor(path, init) : 200;
    if (status >= 400) {
      return new Response(JSON.stringify({ message: 'err' }), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = opts.responseBody ? opts.responseBody : { message: 'تم', space: {} };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetchFn, calls };
}

async function withFetch(opts, fn) {
  const { fetchFn, calls } = makeFetch(opts);
  const prev = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = prev;
  }
}

// شكل جسم الطلب: FormData أو JSON نصّي.
function bodyKeys(body) {
  if (body instanceof globalThis.FormData) return [...body.keys()].sort();
  try {
    return Object.keys(JSON.parse(body)).sort();
  } catch {
    return [];
  }
}

function bodyValue(body, key) {
  if (body instanceof globalThis.FormData) {
    const v = body.get(key);
    return typeof v === 'string' ? v : '(file)';
  }
  try {
    return JSON.parse(body)[key];
  } catch {
    return undefined;
  }
}

// ----- 1. لا تغيير = لا طلب -----
await withFetch({}, async (calls) => {
  const r = await owner.updateOwnerSpace(12, formOf(), ORIGINAL);
  report('1.1 لا تغيير لا يُرسل أي طلب', calls.length === 0, 0, calls.length);
  report('1.2 يُعلَن عدم التغيير', r.unchanged === true, true, r.unchanged);
});

// ----- 2. تعديل الساعات والرقم فقط -----
await withFetch({}, async (calls) => {
  await owner.updateOwnerSpace(12, formOf({ open_time: '08:00', close_time: '18:00', contact_phone: '0599111222' }), ORIGINAL);
  report('2.1 مسار JSON يستخدم PATCH', calls[0]?.method === 'PATCH', 'PATCH', calls[0]?.method);
  const keys = bodyKeys(calls[0]?.body);
  report('2.2 يُرسل الحقول الثلاثة المتغيّرة فقط',
    JSON.stringify(keys) === JSON.stringify(['close_time', 'contact_phone', 'open_time']),
    '["close_time","contact_phone","open_time"]', JSON.stringify(keys));
  report('2.3 القيمة مطبّعة HH:mm', bodyValue(calls[0]?.body, 'open_time') === '08:00', '08:00', bodyValue(calls[0]?.body, 'open_time'));
  report('2.4 لا يُرسل العنوان بلا تغيير', bodyValue(calls[0]?.body, 'title') === undefined, undefined, bodyValue(calls[0]?.body, 'title'));
  report('2.5 لا يوجد مفتاح صورة في فرق بلا صورة', bodyKeys(calls[0]?.body).includes('image') === false, false, bodyKeys(calls[0]?.body).includes('image'));
});

// ----- 3. تعديل السعر فقط لا يُرسل إحداثيات ولا مرافق -----
await withFetch({}, async (calls) => {
  await owner.updateOwnerSpace(12, formOf({ price_per_hour: 30 }), ORIGINAL);
  const keys = bodyKeys(calls[0]?.body);
  report('3.1 السعر فقط في الطلب', JSON.stringify(keys) === JSON.stringify(['price_per_hour']), '["price_per_hour"]', JSON.stringify(keys));
  report('3.2 لا lat في الفرق', !keys.includes('lat'), false, keys.includes('lat'));
  report('3.3 لا amenities في الفرق', !keys.includes('amenities'), false, keys.includes('amenities'));
});

// ----- 4. رُجوع إلى PUT عند عدم دعم PATCH -----
await withFetch({ statusFor: (p, init) => ((init.method || '').toUpperCase() === 'PATCH' ? 405 : 200) }, async (calls) => {
  await owner.updateOwnerSpace(12, formOf({ price_per_hour: 30 }), ORIGINAL);
  report('4.1 محاولة PATCH ثم PUT', calls.map((c) => c.method).join(',') === 'PATCH,PUT', 'PATCH,PUT', calls.map((c) => c.method).join(','));
  const put = calls[1];
  const b = JSON.parse(put.body);
  report('4.2 PUT يحمل المورد كاملاً', b.title === ORIGINAL.title && b.location === ORIGINAL.location, true, b.title);
  report('4.3 لا null في lat/lng', b.lat === ORIGINAL.lat && b.lng === ORIGINAL.lng, [ORIGINAL.lat, ORIGINAL.lng], [b.lat, b.lng]);
  report('4.4 لا مصفوفة مرافق فارغة', Array.isArray(b.amenities) && b.amenities.length === 2, 2, b.amenities?.length);
  report('4.5 الساعات والرقم مضمّنة في PUT', b.open_time === '09:00' && b.contact_phone === '0599000000', '09:00', b.open_time);
  report('4.6 السعر الجديد انتقل', b.price_per_hour === 30, 30, b.price_per_hour);
  report('4.7 الصورة القديمة محفوظة لا فارغة', b.image === ORIGINAL.image, ORIGINAL.image, b.image);
});

// ----- 5. مسار الملف عند اختيار صورة جديدة -----
await withFetch({}, async (calls) => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AL+2gAAAABJRU5ErkJggg==';
  const r = await owner.updateOwnerSpace(12, formOf({ image: dataUrl }), ORIGINAL);
  report('5.1 الصورة الجديدة تستخدم POST', calls[0]?.method === 'POST', 'POST', calls[0]?.method);
  report('5.2 حقل _method=PATCH موجود', bodyValue(calls[0]?.body, '_method') === 'PATCH', 'PATCH', bodyValue(calls[0]?.body, '_method'));
  report('5.3 الصورة ملف حقيقي لا نصّ', bodyValue(calls[0]?.body, 'image') === '(file)', '(file)', bodyValue(calls[0]?.body, 'image'));
  report('5.4 اسم الملف بامتداد png', calls[0]?.body?.get('image')?.name === 'space.png', 'space.png', calls[0]?.body?.get('image')?.name);
  report('5.5 الصورة ليست في فرق JSON', bodyValue(calls[0]?.body, 'image') !== dataUrl, true, true);
  report('5.6 لا إبلاغ عن فقد صورة', !r.imageDropped, false, r.imageDropped);
});

// ----- 6. صورة جديدة + PUT لا يحمل ملفاً: إبلاغ صادق -----
await withFetch({ statusFor: (p, init) => ((init.method || '').toUpperCase() === 'POST' ? 405 : 200) }, async (calls) => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AL+2gAAAABJRU5ErkJggg==';
  const r = await owner.updateOwnerSpace(12, formOf({ image: dataUrl, price_per_hour: 33 }), ORIGINAL);
  report('6.1 يُبلَّغ أن الصورة لم تُحفظ', r.imageDropped === true, true, r.imageDropped);
  const put = calls.find((c) => c.method === 'PUT');
  report('6.2 PUT يُرسل الصورة القديمة لا الجديدة', JSON.parse(put.body).image === ORIGINAL.image, ORIGINAL.image, JSON.parse(put.body).image);
  report('6.3 السعر حُفظ رغم فشل الصورة', JSON.parse(put.body).price_per_hour === 33, 33, JSON.parse(put.body).price_per_hour);
});

// ----- 7. كشف الحقول التي أسقطها الخادم بصمت -----
{
  const payload = formOf({ open_time: '08:00', contact_phone: '0599111222' });
  // الخادم أعاد المساحة كما كانت (أسقط الساعات والرقم) — وهو العقد الحالي.
  const dropped = owner.droppedFields(ORIGINAL, payload, { ...ORIGINAL });
  report('7.1 يُكتشف إسقاط ساعة الفتح', dropped.includes('ساعة الفتح'), true, dropped);
  report('7.2 يُكتشف إسقاط رقم التواصل', dropped.includes('رقم التواصل'), true, dropped);

  // الخادم حفظها فعلاً → لا إبلاغ كاذب.
  const ok = owner.droppedFields(ORIGINAL, payload, { ...ORIGINAL, open_time: '08:00', contact_phone: '0599111222' });
  report('7.3 لا إبلاغ عند الحفظ الناجح', ok.length === 0, 0, ok);

  // حقل لم يُعدَّل أصلاً لا يُحاسب عليه الخادم.
  const untouched = owner.droppedFields(ORIGINAL, formOf({ price_per_hour: 30 }), { ...ORIGINAL, price_per_hour: 30 });
  report('7.4 لا إبلاغ عن حقول لم تُعدَّل', untouched.length === 0, 0, untouched);
}

// ----- 8. safeImageUrl: يمرّر الروابط ويرفض boolean -----
{
  const viaMap = owner.mapSpace({
    space_id: 1,
    title: 'ت',
    image: 'https://cdn.example.com/a.jpg',
    amenities: ['internet'],
  });
  report('8.1 رابط حقيقي يمرّ', viaMap.image.includes('a.jpg'), true, viaMap.image);

  const boolOne = owner.mapSpace({ space_id: 2, title: 'ت', image: '1', amenities: ['internet'] });
  report('8.2 القيمة "1" تُرفض', boolOne.image === '', '', boolOne.image);

  const boolTrue = owner.mapSpace({ space_id: 3, title: 'ت', image: true, amenities: ['internet'] });
  report('8.3 القيمة true تُرفض', boolTrue.image === '', '', boolTrue.image);

  const zero = owner.mapSpace({ space_id: 4, title: 'ت', image: '0', amenities: ['internet'] });
  report('8.4 القيمة "0" تُرفض', zero.image === '', '', zero.image);
}

// ----- 9. إنشاء مساحة: الصورة ملف حقيقي بامتداده، لا نصّ base64 -----
{
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AL+2gAAAABJRU5ErkJggg==';
  const WEBP = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  const createPayload = (overrides = {}) => ({
    title: 'مساحة جديدة',
    description: 'وصف',
    location: 'غزة',
    lat: 31.5,
    lng: 34.46,
    price_per_hour: 20,
    capacity: 5,
    open_time: '09:00',
    close_time: '17:00',
    contact_phone: '0599000000',
    amenities: ['internet'],
    internet: true,
    power: true,
    image: '',
    proofFile: null,
    ...overrides,
  });

  // 9.1 PNG يُرسل كملف باسم space.png على multipart.
  await withFetch({}, async (calls) => {
    await owner.createOwnerSpace(createPayload({ image: PNG }));
    report('9.1 الإنشاء يستخدم POST', calls[0]?.method === 'POST', 'POST', calls[0]?.method);
    report('9.2 الصورة ملف حقيقي لا نصّ', bodyValue(calls[0]?.body, 'image') === '(file)', '(file)', bodyValue(calls[0]?.body, 'image'));
    report('9.3 الامتداد png محفوظ', calls[0]?.body?.get('image')?.name === 'space.png', 'space.png', calls[0]?.body?.get('image')?.name);
    report('9.4 نوع الملف image/png', calls[0]?.body?.get('image')?.type === 'image/png', 'image/png', calls[0]?.body?.get('image')?.type);
  });

  // 9.5 WEBP لا يُحوَّل إلى jpg.
  await withFetch({}, async (calls) => {
    await owner.createOwnerSpace(createPayload({ image: WEBP }));
    const f = calls[0]?.body?.get('image');
    report('9.5a WEBP محفوظ بامتداده', f?.name === 'space.webp', 'space.webp', f?.name);
    report('9.5b نوع WEBP محفوظ', f?.type === 'image/webp', 'image/webp', f?.type);
  });

  // 9.6 مستند الإثبات يرافق الصورة في الطلب نفسه، باسمه.
  await withFetch({}, async (calls) => {
    const proof = new globalThis.File([new Uint8Array([1, 2, 3])], 'deed.pdf', { type: 'application/pdf' });
    await owner.createOwnerSpace(createPayload({ image: PNG, proofFile: proof }));
    const doc = calls[0]?.body?.get('docs');
    report('9.6 المستند يُرسل باسمه الأصلي', doc?.name === 'deed.pdf', 'deed.pdf', doc?.name);
  });

  // 9.7 بلا صورة: لا حقل image إطلاقاً (لا نصّ فارغ يُرسل للخادم).
  await withFetch({}, async (calls) => {
    await owner.createOwnerSpace(createPayload({ image: '' }));
    report('9.7 لا حقل image عند عدم الاختيار', bodyKeys(calls[0]?.body).includes('image') === false, false, bodyKeys(calls[0]?.body).includes('image'));
  });
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(` - ${f.name}`);
  process.exitCode = 1;
}
await server.close();
