// اختبارات محوّلات لوحة الأدمن (src/lib/adminAdapters.js).
//
// ما نتحقق منه، لا نتحقق من العرض ولا من React:
//   - كل محوّل يقرأ الاسم الذي يرسله الخادم حرفياً (انظر adminFixtures.mjs)،
//     فلا يُطلب من المحوّل أن يعرف تنويعة اسم لم يرِد.
//   - الحقول الإلزامية **لا تُخترع لها قيمة** (`user` `amount` `time`
//     `issue`)، فحقلٌ غائب يبقى فارغاً أو صفراً ولا يخترع له اسم.
//   - الاسم البديل يُقرأ كما هو (`customer` `price` `time_from`/`time_to`
//     `reason`)، لأن العقد يعلن الواحد والآخر معاً.
//
// أي تعديل هنا يجب أن يوازي ADMIN_API_GUIDE.md لا أن يخترع مفردات جديدة.
//
// Base: https://back-end-kwba.onrender.com
// التشغيل: node --experimental-vm-modules src/utils/adminAdapters.test.mjs
import { createServer } from 'vite';

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

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const A = await server.ssrLoadModule('/src/lib/adminAdapters.js');
const inboxMeta = await server.ssrLoadModule('/src/components/admin/inboxMeta.js');

/* ------------------------------------------------------------------ */
/* 1. الحجوزات — العقد §5.2 و§5.3                                     */
/* ------------------------------------------------------------------ */

// العقد §5.2: GET /api/admin/bookings/{ref}
const BOOKING_CONTRACT = {
  id: 501,
  ref: 'BK-8F3A2B',
  customer: 'سارة النجار',
  space: 'مساحة المبدعين',
  date: '2026-10-05',
  time_from: '10:00',
  time_to: '13:00',
  hours: 3,
  price: 450,
  status: 'confirmed',
};

console.log('\n===== الحجوزات: العقد ← المحوّل =====');
{
  const b = A.adaptBooking(BOOKING_CONTRACT);

  // الاسم البديل يسبق المعروض: `user` يأخذ `customer`، والأصل يبقى في الحقل الخام.
  report('1.1 customer ← user', b.user === 'سارة النجار', 'سارة النجار', b.user);
  // `amount` لا يُقرأ من `price` مباشرة، بل من `booking.price` أو الاسم البديل.
  report('1.2 price ← amount', b.amount === 450, 450, b.amount);
  // الوقت مركّب من طرفين، فلا يُركَّب المحوّل وقتاً واحداً بلا بداية ونهاية.
  report('1.3 time_from + time_to ← time', b.time === '10:00 - 13:00', '10:00 - 13:00', b.time);
  report('1.4 الحقول المشتركة تنعكس كما وردت',
    b.ref === 'BK-8F3A2B' && b.space === 'مساحة المبدعين'
    && b.date === '2026-10-05' && b.hours === 3 && b.status === 'confirmed',
  'ref/space/date/hours/status', { ref: b.ref, space: b.space, date: b.date, hours: b.hours, status: b.status });

  // شكل قديم من fixtures: الاسم الأول `user` لا `customer`، وغيابه يبقى فارغاً.
  const legacy = { id: 1, ref: '#BK-1', user: '', space: '', date: '2026-01-01', time: '09:00 - 10:00', hours: 1, amount: 20, status: 'completed' };
  const kept = A.adaptBooking(legacy);
  report('1.5 الشكل القديم (user) يُقرأ كما هو',
    kept.user === '' && kept.amount === 20 && kept.time === '09:00 - 10:00',
    'user= amount=20 time=09:00 - 10:00',
    { user: kept.user, amount: kept.amount, time: kept.time });

  // ردٌّ ناقص: صفر ونص فارغ، لا NaN ولا undefined.
  const bare = A.adaptBooking({ id: 9, ref: 'BK-9' });
  report('1.6 ردٌّ ناقص: صفر لا NaN/undefined',
    Number.isFinite(bare.hours) && Number.isFinite(bare.amount) && bare.user === '',
    'أرقام صفرية', { hours: bare.hours, amount: bare.amount, user: bare.user });

  // الاسم المتداخل (كائن `booking` في العقد §7.2) يُقرأ لا يُهمل.
  const nested = A.adaptBooking({ id: 10, ref: 'BK-10', booking: { customer: 'عمر سكيك', space: 'ركن المبرمجين' } });
  report('1.7 الحقل booking المتداخل يُقرأ',
    nested.user === 'عمر سكيك' && nested.space === 'ركن المبرمجين',
    { user: 'عمر سكيك', space: 'ركن المبرمجين' }, { user: nested.user, space: nested.space });
}

/* ------------------------------------------------------------------ */
/* 2. النزاعات — العقد §7.1 و§7.3                                     */
/* ------------------------------------------------------------------ */

// العقد §7.2: GET /api/admin/disputes/{ref}
const DISPUTE_CONTRACT = {
  ref: 'DP-1234',
  booking: { ref: 'BK-8F3A2B', space: 'مساحة المبدعين', price: 450 },
  customer: 'سارة النجار',
  reason: 'المساحة غير مطابقة للحجز.',
  status: 'open',
  opened: '2026-10-06',
};

console.log('\n===== النزاعات: العقد ← المحوّل =====');
{
  const d = A.adaptDispute(DISPUTE_CONTRACT);

  report('2.1 customer ← user', d.user === 'سارة النجار', 'سارة النجار', d.user);
  report('2.2 reason ← issue',
    d.issue === 'المساحة غير مطابقة للحجز.', true, d.issue.slice(0, 30));
  report('2.3 booking.ref ← bookingRef', d.bookingRef === 'BK-8F3A2B', 'BK-8F3A2B', d.bookingRef);
  report('2.4 booking.space ← space', d.space === 'مساحة المبدعين', 'مساحة المبدعين', d.space);
  report('2.5 booking.price ← amount', d.amount === 450, 450, d.amount);
  report('2.6 status/opened تنعكس كما وردت', d.status === 'open' && d.opened === '2026-10-06',
    'open / 2026-10-06', { status: d.status, opened: d.opened });

  // زرّ «استرداد المبلغ» يرسل `refund_amount` إجبارياً (العقد §7.3)، فصفٌّ بلا
  // مبلغ استرداد ليس `null`: الصفر هو ما يمرَّر في الطلب، و`null` سيرفضه الخادم.
  report('2.7 amount صفر لا null (إلزامي في طلب الاسترداد)',
    A.adaptDispute({ ref: 'DP-1' }).amount === 0, 0, A.adaptDispute({ ref: 'DP-1' }).amount);
}

/* ------------------------------------------------------------------ */
/* 3. مساحات الوارد — العقد §10.3                                     */
/* ------------------------------------------------------------------ */

// العقد §10.3: GET /api/admin/inbox/categories
const CONTRACT_CATEGORIES = ['general', 'support', 'report', 'billing'];

console.log('\n===== الوارد: توحيد مفردات الفئات =====');
{
  // كل فئة يعلنها العقد يجب أن تجد وصفاً في اللوحة (تسمية + لون + زر وجهة)،
  // وإلا ظهرت لل الأدمن بلا لون ولا زرّ فتح.
  const uncovered = CONTRACT_CATEGORIES.filter((c) => !inboxMeta.inboxCategoryMeta[c]);
  report('3.1 كل فئات العقد لها وصف في اللوحة', uncovered.length === 0,
    'لا فئة بلا وصف', uncovered);

  const described = CONTRACT_CATEGORIES.every((c) => {
    const m = inboxMeta.inboxCategoryMeta[c];
    return m && typeof m.label === 'string' && m.label && m.tone && m.cta && m.path;
  });
  report('3.2 كل فئة لها تسمية ولون ونص زر وجهة', described, 'حقول كاملة', described);

  // مفردات اللوحة القديمة تبقى صالحة (-contract يطلب ذلك صراحةً).
  report('3.3 مفردات اللوحة القديمة باقية',
    ['dispute', 'space_request', 'report'].every((c) => !!inboxMeta.inboxCategoryMeta[c]),
    'dispute/space_request/report', '');

  // التهجئات المتعدّدة تُطوى على مفتاح واحد.
  report('3.4 disputes ← dispute', A.canonicalInboxCategory('disputes') === 'dispute', 'dispute', A.canonicalInboxCategory('disputes'));
  report('3.5 booking_dispute ← dispute', A.canonicalInboxCategory('booking_dispute') === 'dispute', 'dispute', A.canonicalInboxCategory('booking_dispute'));
  report('3.6 التطبيع يتجاهل الشراط والفراغ', A.canonicalInboxCategory(' Space Request ') === 'space_request', 'space_request', A.canonicalInboxCategory(' Space Request '));
  report('3.7 report يبقى report', A.canonicalInboxCategory('report') === 'report', 'report', A.canonicalInboxCategory('report'));
  report('3.8 قيمة خارج المفردات تبقى فارغة (لا اختراع فئة)',
    A.canonicalInboxCategory('quantum') === '', '', A.canonicalInboxCategory('quantum'));

  // الصفّ نفسه: الفئة الموحّدة + الفئة الأصلية (ليفلتّر الوارد حرفياً)،
  // و«منذ …» يشتقّ من الوقت إن لم يرسله الخادم جاهزاً.
  const item = A.adaptInboxItem({
    id: 7, category: 'billing', title: 'فاتورة شهرية', body: '  ',
    read: false, archived: false, created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  });
  report('3.9 الصفّ: فئة موحّدة + فئة خام',
    item.category === 'billing' && item.rawCategory === 'billing', { category: 'billing', rawCategory: 'billing' },
    { category: item.category, rawCategory: item.rawCategory });
  report('3.10 الوقت المشتقّ «منذ …»', / 3 /.test(item.time), 'منذ 3', item.time);

  // `read` و`archived` يأتيان 0/1 أو "false"، والنص «false» ليست خطأً منطقياً.
  const flagged = A.adaptInboxItem({ id: 8, category: 'report', read: 0, archived: 'false' });
  report('3.11 منطق العلامات (0/1 ونصّ "false")',
    flagged.read === false && flagged.archived === false, { read: false, archived: false },
    { read: flagged.read, archived: flagged.archived });
}

/* ------------------------------------------------------------------ */
/* 4. المساحات — العقد §4.1 وملاحظة 5                                 */
/* ------------------------------------------------------------------ */

console.log('\n===== المساحات: اسم بديل لا null =====');
{
  // ملاحظة 5 من العقد: `name` إجباري، فغيابه لا ينتج `null` يُكسر به الجدول
  // (ولا نصاً فارغاً يبدو كمساحة بلا اسم)، بل اسمٌ بديل من `id`.
  const s = A.adaptSpace({ id: 12, name: null, neighborhood: 'وسط البلد', owner: 'ليان أبو خليل', price: 50, status: 'active', rating: 4.5, bookings: 12, capacity: 20 });
  report('4.1 اسم بديل من المعرّف (لا null)',
    typeof s.name === 'string' && s.name.length > 0, 'نص غير فارغ', JSON.stringify(s.name));
  report('4.2 الاسم البديل يحمل المعرّف (يميّز الصفّ)',
    s.name.includes('12'), 'يحوي 12', s.name);
  // الاسم الفارغ يُعامَل كالغائب، لا كاسمٍ مقصود: `pick` تتخطّى `''` كما
  // تتخطّى `null`، فيأخذ الاسم البديل نفسه. السبب أن `name` إجباري في العقد،
  // فاسمٌ فارغٌ من الخادم خطأ بيانات، وصفٌّ باسمٍ على قدر `id` أأمن من صفٍّ
  // يبدو كأنه بلا اسم. وهذا ما يجعل 4.1 و4.3 و4.5 قاعدةً واحدة لا ثلاثاً.
  report('4.3 اسم فارغ يُعامَل كغائب (لا صفّ بلا اسم)',
    A.adaptSpace({ id: 1, name: '' }).name === 'مساحة #1', 'مساحة #1',
    A.adaptSpace({ id: 1, name: '' }).name);

  // المالك قد يكون كائناً (`owner: {...}` في العقد §4.2).
  report('4.4 owner كائن ← نص',
    A.adaptSpace({ id: 2, name: '', owner: { name: '' } }).owner === '', '',
    A.adaptSpace({ id: 2, name: '', owner: { name: '' } }).owner);

  // اسمٌ ناقص كلياً: الاسم البديل يُبنى بلا مدخلات لينة، فتبقى «مساحة #13»
  // بنصّ لا `null` ولا `undefined` (نموذج التعديل يفرض «الاسم مطلوب»
  // 1..80 في العقد §4.4، فاسمٌ مفقود في القائمة يجب أن يبقى معروفاً).
  const noName = A.adaptSpace({ id: 13 });
  report('4.5 لا مدخلات ولا اسم ← اسم بديل',
    typeof noName.name === 'string' && noName.name.trim().length > 0, 'نص غير فارغ', JSON.stringify(noName.name));

  // مستندات المساحة: العقد لا يوردّها لا في القائمة §6.1 ولا في التفصيل §6.2،
  // ولا في أي مسار من مساريها. فالمصدر المرجَّح هو كائن المالك في التفصيل
  // (§6.2 يردّ `owner` كائناً) لأن الوثائق يرفعها المالك عن حسابه. ونقرأ
  // المساحة معه أيضاً: خادمٌ قد يلصقها بأيٍّ، واجتماع الاثنين أتمّ.
  report('4.6 مستندات على المساحة نفسها تُقرأ',
    A.adaptSpaceDocuments({ id: 3, property_deed: '/s/deed.pdf', business_license: '/s/lic.pdf' })
      .map((d) => d.kind).join(',') === 'property_deed,business_license',
    'property_deed,business_license',
    A.adaptSpaceDocuments({ id: 3, property_deed: '/s/deed.pdf', business_license: '/s/lic.pdf' }).map((d) => d.kind).join(','));

  // تفصيل المساحة §6.2: `owner` كائن، والوثائق داخله.
  report('4.7 مستندات على كائن المالك في التفصيل تُقرأ',
    A.adaptSpaceDocuments({ id: 3, owner: { name: 'ليان', proof_document: '/o/p.pdf' } })
      .map((d) => d.kind).join(',') === 'property_deed',
    'property_deed',
    A.adaptSpaceDocuments({ id: 3, owner: { name: 'ليان', proof_document: '/o/p.pdf' } }).map((d) => d.kind).join(','));

  // نفس الرابط يأتي من المصدرين: دمجٌ بلا تكرار وإلا عُدّت وثيقةٌ واحدة وثقتين.
  const merged = A.adaptSpaceDocuments({
    id: 3,
    property_deed: '/same.pdf',
    owner: { property_deed: '/same.pdf', business_license: '/o/lic.pdf' },
  });
  report('4.8 رابط مشترك بين المساحة والمالك لا يتكرّر',
    merged.map((d) => d.url).join(',') === '/same.pdf,/o/lic.pdf', '/same.pdf,/o/lic.pdf',
    merged.map((d) => d.url).join(','));

  // القائمة §6.1 تردّ `owner` نصاً: لا كائن مالك تعني لا مستندات مالك، وهذا
  // صمتٌ صادق لا خطأ — والمساحة تبقى تقرؤها وحدها.
  const strOwner = A.adaptSpaceDocuments({ id: 3, owner: 'راني الشوا', property_deed: '/s/deed.pdf' });
  report('4.9 owner نصّي (شكل القائمة) لا يُعطّل القراءة',
    strOwner.length === 1 && strOwner[0].kind === 'property_deed', 1, JSON.stringify(strOwner));

  // القسم في النافذة يبني على `length`: فلا بدّ أن يكون مصفوفة حتى وهي خالية،
  // وإلا انهار الفرع إلى خطأٍ بدل حالة فارغة صريحة.
  report('4.10 بلا مستندات ← مصفوفة فارغة لا null',
    Array.isArray(A.adaptSpaceDocuments({ id: 10 })) && A.adaptSpaceDocuments({ id: 10 }).length === 0,
    '[]', JSON.stringify(A.adaptSpaceDocuments({ id: 10 })));

  // المساحة نفسها تحمل النتيجة: نافذة المعاينة تقرأ من صفّ القائمة أوّلاً،
  // فلا يُطلب منها انتظار التفصيل لترى ما وصل أصلاً.
  const viaSpace = A.adaptSpace({ id: 3, name: null, documents: [{ kind: 'business_license', url: '/a.pdf' }] });
  report('4.11 adaptSpace تُخرج documents من جسمها',
    Array.isArray(viaSpace.documents) && viaSpace.documents.length === 1
      && viaSpace.documents[0].label === 'السجل التجاري', 'السجل التجاري',
    JSON.stringify(viaSpace.documents));

  // صورة المساحة: الطلب الصريح «لو توفّرت image_url اعرض صورة المساحة». الاسم
  // لا يُفترض من اصطلاح الخادم وحده، بل يُقرأ ب ApiController العام إن غاب
  // `image` — وإلا بقيت البطاقة على البديل المحايد ولُوِّي صورةٌ قائمة كغائبة.
  report('4.12 image_url يُقرأ كصورة المساحة',
    A.adaptSpace({ id: 4, image_url: '/storage/sp.jpg' }).image === '/storage/sp.jpg',
    '/storage/sp.jpg',
    A.adaptSpace({ id: 4, image_url: '/storage/sp.jpg' }).image);

  // `image` هو اسم العقد §5.1، فيسبق الاصطلاح الثانوي عند اجتماعهما: الترجيح
  // من اليسار يعني ألّا يُغيّر حقلٌ اصطلاحيٌّ حقيقةً مُبلَّغة.
  report('4.13 image يسبق image_url عند اجتماعهما',
    A.adaptSpace({ id: 4, image: '/a.jpg', image_url: '/b.jpg' }).image === '/a.jpg',
    '/a.jpg',
    A.adaptSpace({ id: 4, image: '/a.jpg', image_url: '/b.jpg' }).image);
}

/* ------------------------------------------------------------------ */
/* 5. المستخدمون — العقد §3.1 (لا phone في القائمة)                  */
/* ------------------------------------------------------------------ */

console.log('\n===== المستخدمون: لا phone في القائمة =====');
{
  // العقد §3.1 لا يذكر `phone` في القائمة (يذكره في §3.4 التفاصيل فقط)،
  // لكن المحوّل يقرأه من الاسم البديل `whatsapp` إذا جاء، فلا ينهار.
  const u = A.adaptUser({ id: 1, name: 'نور شعبان', email: 'a@b.c', role: 'customer', status: 'active', verified: true, bookings: 3, joined: '2026-01-01' });
  report('5.1 phone نصّ دائماً (لا number)', typeof u.phone === 'string', 'نص', typeof u.phone);
  report('5.2 الحقول المشتركة تنعكس',
    u.name === 'نور شعبان' && u.role === 'customer' && u.verified === true && u.bookings === 3,
    'نور/ customer/true/3', { name: u.name, role: u.role, verified: u.verified, bookings: u.bookings });

  // الاسم البديل للهاتف: `phone` ← `whatsapp`، فليس حقلاً مشطّراً بلا بديل.
  report('5.3 whatsapp يقرأ phone',
    A.adaptUser({ id: 2, name: 'عمر', whatsapp: '0501234567' }).phone === '0501234567',
    '0501234567', A.adaptUser({ id: 2, name: 'عمر', whatsapp: '0501234567' }).phone);

  // دور غائب: `null` صريح (لا نص فارغ)، فنعرف أنه غائب ولا نخترع له دوراً.
  report('5.4 دور غائب ⇒ null (لا اختراع)',
    A.adaptUser({ id: 3, name: 'ز' }).role === null, null, A.adaptUser({ id: 3, name: 'ز' }).role);
  report('5.5 دور مالك يُقرأ حرفياً',
    A.adaptUser({ id: 4, role: 'space_owner' }).role === 'space_owner', 'space_owner',
    A.adaptUser({ id: 4, role: 'space_owner' }).role);
  // المساحات المتداخلة: اسمها بديل أيضاً، لأن الجدول يعرضها ولا يكسر.
  report('5.6 مساحة متداخلة بلا اسم ← اسم بديل',
    A.adaptUser({ id: 5, spaces: [{ id: 5, status: 'active' }] }).spaces[0].name.length > 0,
    'نص غير فارغ', A.adaptUser({ id: 5, spaces: [{ id: 5, status: 'active' }] }).spaces[0].name);
}
/* ------------------------------------------------------------------ */
/* 5.4 حالة الحساب: طابور التفعيل بدل الافتراض الحالم                   */
/* ------------------------------------------------------------------ */

console.log('\n===== حالة الحساب: pending لا active افتراضاً =====');
{
  // أهم سطر في المحوّل: حسابٌ بلا `status` لا يعني حساباً نشطاً. لمالك
  // المساحة نعتبره `pending` لا `active`، لأن الحساب الجديد يصل بلا حالة
  // لثوانٍ، والافتراض الحالم كان يخرجه من عدّ الطابور ويُخفيه عن تبويب
  // «بانتظار التفعيل» ويصبغه أخضر، كل ذلك بلا مراجعة إنسان.
  const ownerNoStatus = A.adaptUser({ id: 40, name: 'مالك', role: 'space_owner' });
  report('5.7 مالك بلا status يُعامل كـ pending لا active',
    ownerNoStatus.status === 'pending', 'pending', ownerNoStatus.status);

  // الإملاء القديم للدور يلتزم القاعدة نفسها، وإلا بقي الباب مفتوحاً على
  // كل حساب قادم بالدور القديم.
  report('5.8 الإملاء القديم للدور يلتزم القاعدة نفسها',
    A.adaptUser({ id: 41, role: 'owner' }).status === 'pending', 'pending',
    A.adaptUser({ id: 41, role: 'owner' }).status);

  // الحالة الصريحة تُمرَّر كما هي: القاعدة على الغياب وحده.
  report('5.9 حالة موجودة تُمرَّر كما وردت',
    A.adaptUser({ id: 42, role: 'space_owner', status: 'active' }).status === 'active'
    && A.adaptUser({ id: 43, role: 'space_owner', status: 'suspended' }).status === 'suspended',
    'active / suspended',
    [A.adaptUser({ id: 42, role: 'space_owner', status: 'active' }).status,
      A.adaptUser({ id: 43, role: 'space_owner', status: 'suspended' }).status]);

  // غير الملاك يبقي `active`: حساب العميل لا يُفتح ولا يُقفل، وقفله هنا كان
  // سيُخفي عملاء عاديين عن العدّادات بلا سبب.
  report('5.10 غير المالك يبقى active عند الغياب',
    A.adaptUser({ id: 44, role: 'customer' }).status === 'active', 'active',
    A.adaptUser({ id: 44, role: 'customer' }).status);

  // حساب بلا دور أصلاً: لا نعرف أنه مالك، فنبقي الافتراض القديم. فافتراض
  // انتظارٍ لحساب زبون أسوأ من الافتراض الحالم.
  report('5.11 حساب بلا دور يبقى active (لا نخترع له انتظاراً)',
    A.adaptUser({ id: 45, name: 'ز' }).status === 'active', 'active',
    A.adaptUser({ id: 45, name: 'ز' }).status);

  // الإملاء يُقرأ بعد `toLowerCase` مع `trim`، فلا يفتح إملاء مختلط مثل
  // `Space_Owner` باباً لا يعرفه أحد.
  report('5.12 الإملاء المختلط مالك أيضاً',
    A.adaptUser({ id: 46, role: ' Space_Owner ' }).status === 'pending', 'pending',
    A.adaptUser({ id: 46, role: ' Space_Owner ' }).status);
}

/* ------------------------------------------------------------------ */
/* 5.5 مستندات التحقق                                                   */
/* ------------------------------------------------------------------ */

console.log('\n===== مستندات التحقق: مصفوفة وحقول مفردة =====');
{
  // الشكل الأول: مصفوفة `documents`، ونوع الوثيقة من `kind`.
  const fromArray = A.adaptUser({
    id: 50,
    role: 'space_owner',
    documents: [{ kind: 'property_deed', url: '/storage/a.pdf', name: 'سند.pdf' }],
  });
  report('5.13 مصفوفة documents تُقرأ بنوعها',
    fromArray.documents.length === 1
    && fromArray.documents[0].kind === 'property_deed'
    && fromArray.documents[0].url === '/storage/a.pdf'
    && fromArray.documents[0].name === 'سند.pdf',
    'property_deed /storage/a.pdf سند.pdf',
    fromArray.documents[0]);

  // الشكل الثاني: حقول مفردة، وهو ما يرسله تسجيل `proof_document`.
  const fromFields = A.adaptUser({
    id: 51,
    role: 'space_owner',
    property_deed: '/storage/deed.pdf',
    business_license: '/storage/cr.pdf',
  });
  report('5.14 الحقول المفردة تُقرأ كلّها',
    fromFields.documents.length === 2
    && fromFields.documents.some((d) => d.kind === 'property_deed')
    && fromFields.documents.some((d) => d.kind === 'business_license'),
    'وثيقتان', fromFields.documents.map((d) => d.kind));

  // التسمية عربية من الواجهة لا من رد الخادم.
  report('5.15 تسميات المستندات عربية',
    fromFields.documents.find((d) => d.kind === 'business_license')?.label === 'السجل التجاري'
    && fromFields.documents.find((d) => d.kind === 'property_deed')?.label === 'وثيقة الملكية',
    'السجل التجاري / وثيقة الملكية', fromFields.documents.map((d) => d.label));

  // `proof_document` هو ما ترسله صفحة التسجيل، فيُصنَّف وثيقة ملكية.
  report('5.16 proof_document يُقرأ كوثيقة ملكية',
    A.adaptUser({ id: 52, role: 'space_owner', proof_document: '/storage/p.pdf' }).documents[0]?.kind === 'property_deed',
    'property_deed',
    A.adaptUser({ id: 53, role: 'space_owner', proof_document: '/storage/p.pdf' }).documents[0]?.kind);

  // نفس الرابط من مصفوفة ومن حقل مفرد: نسخة واحدة، فالتكرار يُربك الأدمن.
  report('5.17 الرابط المكرَّر لا يتكرّر',
    A.adaptUser({
      id: 54,
      role: 'space_owner',
      documents: [{ kind: 'property_deed', url: '/storage/d.pdf' }],
      property_deed: '/storage/d.pdf',
    }).documents.length === 1,
    1,
    A.adaptUser({ id: 55, role: 'space_owner', documents: [{ kind: 'property_deed', url: '/storage/d.pdf' }], property_deed: '/storage/d.pdf' }).documents.length);

  // غياب المستندات ليس خطأ: مصفوفة فارغة دائماً، لا `undefined` تنهار عند
  // `.length` في الواجهة.
  report('5.18 غياب المستندات مصفوفة فارغة لا undefined',
    Array.isArray(A.adaptUser({ id: 56, role: 'space_owner' }).documents)
    && A.adaptUser({ id: 57, role: 'space_owner' }).documents.length === 0,
    'مصفوفة فارغة',
    A.adaptUser({ id: 58, role: 'space_owner' }).documents);

  // نوع مجهول: يعبر `other` ولا يُرمى. مستندٌ بلا تسمية أوضح من مستند مخفيّ.
  report('5.19 نوع مجهول يعبر other ولا يُسقط',
    A.adaptUser({ id: 59, role: 'space_owner', documents: [{ kind: 'x', url: '/storage/u.bin' }] }).documents[0]?.kind === 'other',
    'other',
    A.adaptUser({ id: 60, role: 'space_owner', documents: [{ kind: 'x', url: '/storage/u.bin' }] }).documents[0]?.kind);

  // عنصر بلا رابط: يُسقط، لأن بطاقة بلا وجهة لا تفيد الأدمن.
  report('5.20 عنصر بلا رابط يُسقط',
    A.adaptUser({ id: 61, role: 'space_owner', documents: [{ kind: 'property_deed' }] }).documents.length === 0,
    0,
    A.adaptUser({ id: 62, role: 'space_owner', documents: [{ kind: 'property_deed' }] }).documents.length);
}

/* ------------------------------------------------------------------ */
/* 5.6 المفردات الثلاث، والقيمة القديمة `review`                       */
/* ------------------------------------------------------------------ */

console.log('\n===== المفردات: ثلاث حالات، وreview تعود إلى الطابور =====');
{
  // **مفردات الحساب ثلاث لا رابعة.** هذا الاختبار هو من يمنع عودة `review`
  // أو أي قيمة رابعة: يقرأ `USER_STATUSES` لا قائمةً مكتوبة هنا، فإضافة حالة
  // إلى هناك تُفشل الاختبار فوراً. و`STATUS_ORDER` في AdminUsers مبنية عليه.
  report('5.21 مفردات الحساب ثلاث: pending / active / suspended',
    JSON.stringify(A.USER_STATUSES) === JSON.stringify(['pending', 'active', 'suspended']),
    'pending/active/suspended', A.USER_STATUSES);

  // القيمة القديمة `review` تُقرأ `pending` لا «حالة غير معروفة». والسبب أن
  // «غير معروفة» خارج تبويب «بانتظار التفعيل» ولا يجدها الأدمن بالبحث، فيبقى
  // حسابٌ ينتظر قراراً لا يستطيع أحد أخذه.
  report('5.22 الحالة القديمة review تعود إلى الطابور (pending)',
    A.adaptUser({ id: 47, role: 'space_owner', status: 'review' }).status === 'pending', 'pending',
    A.adaptUser({ id: 47, role: 'space_owner', status: 'review' }).status);

  // الترجمة لا تعني أن `review` صارت مقبولة: هي قيمة محذوفة من المفردات،
  // وكل ما تفعله الترجمة أنها تمنع ظهورها «حالة غير معروفة».
  report('5.23 القيمة المحذوفة خارج المفردات',
    !A.USER_STATUSES.includes('review'),
    'review خارج المفردات', A.USER_STATUSES);

  // الترجمة لا تميّز بين الأدوار: مَن كانت حالته `review` ينتظر قراراً سواء كان
  // مالكاً أو غير مالك، وتبويب الطابور يعرضها كلها.
  report('5.24 الترجمة لا تميّز بين الأدوار',
    A.adaptUser({ id: 48, role: 'customer', status: 'review' }).status === 'pending', 'pending',
    A.adaptUser({ id: 48, role: 'customer', status: 'review' }).status);

  // الشراط والفراغ لا يفتحان الترجمة: ` Review ` من الخادم خطأ تنسيق لا
  // حالة جديدة.
  report('5.25 الترجمة تتجاهل الشراط والفراغ',
    A.adaptUser({ id: 49, role: 'space_owner', status: ' REVIEW ' }).status === 'pending', 'pending',
    A.adaptUser({ id: 49, role: 'space_owner', status: ' REVIEW ' }).status);
}

/* ------------------------------------------------------------------ */
/* 5.7 إشعار التوثيق: فئة الوارد ومعرّف صاحب الطلب                      */
/* ------------------------------------------------------------------ */

console.log('\n===== إشعار توثيق مالك: الفئة والوجهة =====');
{
  // الفئة الجديدة تُطوى على مفتاح واحد من مفردات اللوحة، فتراها الشارة
  // ببرتقالية اللوحة وزرّها «مراجعة التوثيق» لا في خانة «عام».
  report('5.26 تهجئات توثيق المالك تطوى على owner_verification',
    A.canonicalInboxCategory('owner_document') === 'owner_verification'
    && A.canonicalInboxCategory('verification_request') === 'owner_verification',
    'owner_verification',
    [A.canonicalInboxCategory('owner_document'), A.canonicalInboxCategory('verification_request')]);

  // ولها وصف في اللوحة، وإلا خرج الإشعار بلا لون ولا زرّ.
  report('5.27 فئة توثيق المالك لها وصف',
    !!inboxMeta.inboxCategoryMeta.owner_verification
    && !!inboxMeta.inboxCategoryMeta.owner_verification.cta,
    'وصف كامل', inboxMeta.inboxCategoryMeta.owner_verification);

  // معرّف صاحب الطلب هو ما يجعل زرّ الوجهة يفتح ملف هذا الحساب. يُقرأ من
  // `user_id` مباشرة، أو من كائن `user` (لا من نص، فالنصّ لا معرّف داخله).
  report('5.28 user_id يُقرأ من الحقل المباشر',
    A.adaptInboxItem({ id: 1, category: 'owner_verification', user_id: 33 }).userId === 33, 33,
    A.adaptInboxItem({ id: 1, category: 'owner_verification', user_id: 33 }).userId);

  report('5.29 معرّف من كائن user لا من نص',
    A.adaptInboxItem({ id: 2, category: 'owner_verification', user: { id: 34 } }).userId === 34, 34,
    A.adaptInboxItem({ id: 3, category: 'owner_verification', user: 'أحمد' }).userId);

  // بلا معرّف: `null` صريح لا `undefined`، فيرجع الزرّ إلى مسار فئته العام.
  report('5.30 بلا معرّف ⇒ null (يرجع لمسار الفئة)',
    A.adaptInboxItem({ id: 4, category: 'dispute' }).userId === null, null,
    A.adaptInboxItem({ id: 5, category: 'dispute' }).userId);
}
/* ------------------------------------------------------------------ */
/* 6. التقييمات                                                      */
/* ------------------------------------------------------------------ */

console.log('\n===== التقييمات: غياب visible ليس إخفاءً =====');
{
  // العقد §6.3 يعرّف `visible: false` ← إخفاء. غيابُ الحقل ليس إخفاءً،
  // ولو عُدّ الغياب false لظهرت كل مراجعة «مخفية» واشتغل عدّاد الإخفاء كذباً.
  const r = A.adaptReview({ id: 1, customer: 'أحمد', comment: 'حلقة', stars: 5 });
  report('6.1 غياب visible يُقرأ ظاهراً', r.visible === true, true, r.visible);
  report('6.2 customer ← user و comment ← text',
    r.user === 'أحمد' && r.text === 'حلقة', { user: 'أحمد', text: 'حلقة' }, { user: r.user, text: r.text });
  report('6.3 stars ← rating', r.rating === 5, 5, r.rating);
  report('6.4 visible: false يُحترم صراحةً',
    A.adaptReview({ id: 2, visible: false }).visible === false, false, A.adaptReview({ id: 2, visible: false }).visible);
  report('6.5 flagged غائب ⇒ false', A.adaptReview({ id: 3 }).flagged === false, false, A.adaptReview({ id: 3 }).flagged);
  report('6.6 الحقول من الواجهة محفوظة',
    A.adaptReview({ id: 4, user: 'س', visible: false, flagged: true, rating: 1 }).flagged === true,
    true, A.adaptReview({ id: 4, user: 'س', visible: false, flagged: true, rating: 1 }).flagged);
}

/* ------------------------------------------------------------------ */
/* 7. المالية — العقد §8                                              */
/* ------------------------------------------------------------------ */

console.log('\n===== المالية: نسبة العمولة والمدفوعات المعلّقة =====');
{
  // العقد §2.2/§11.1: النسبة مئوية (12.00 = 12%). لو عُوملت كسر لعرضت 1200%.
  report('7.1 نسبة مئوية تُقسَم على 100',
    A.adaptCommissionRate(12) === 0.12, 0.12, A.adaptCommissionRate(12));
  report('7.2 نسبة كسرية تُحفظ كما هي',
    A.adaptCommissionRate(0.12) === 0.12, 0.12, A.adaptCommissionRate(0.12));
  report('7.3 نسبة صفر تُحفظ', A.adaptCommissionRate(0) === 0, 0, A.adaptCommissionRate(0));
  report('7.4 نسبة غائبة ⇒ null (لا صفر مخترع)',
    A.adaptCommissionRate(undefined) === null, null, A.adaptCommissionRate(undefined));

  // العقد §8.1: الملخّص فيه revenue/bookings/commission/payouts بلا payouts_pending.
  const summary = A.adaptFinancialSummary({
    range: 'month', revenue: 15400, bookings: 23, commission: 1848, payouts: 13552, currency: 'ش.ج',
  });
  report('7.5 حقول الملخّص تُقرأ',
    summary.revenue === 15400 && summary.bookings === 23 && summary.commission === 1848 && summary.payouts === 13552,
    '15400/23/1848/13552', { revenue: summary.revenue, bookings: summary.bookings, commission: summary.commission, payouts: summary.payouts });
  report('7.6 payouts_pending غائبة ⇒ null (الواجهة تعرض — لا صفر)',
    summary.payouts_pending === null, null, summary.payouts_pending);

  // السلسلة اليومية: عقدان محتملان — غلاف أو مصفوفة مباشرة.
  const wrapped = A.adaptDailyFinancial({ series: [{ date: '2026-10-01', revenue: 100, bookings: 2, pending: 5 }], coverage: { from: '2026-10-01', to: '2026-10-31' } });
  report('7.7 سلسلة بغلاف { series, coverage }',
    wrapped.series.length === 1 && wrapped.series[0].revenue === 100
    && wrapped.coverage.from === '2026-10-01',
    'series[1] revenue=100 coverage=2026-10-01',
    { len: wrapped.series.length, revenue: wrapped.series[0]?.revenue, from: wrapped.coverage?.from });
  const bare = A.adaptDailyFinancial([{ date: '2026-10-02', revenue: 50, bookings: 1 }]);
  report('7.8 سلسلة كمصفوفة مباشرة (لا تُفرغ الشاشة)',
    bare.series.length === 1 && bare.series[0].revenue === 50 && bare.coverage === null,
    'series[1] revenue=50 coverage=null',
    { len: bare.series.length, revenue: bare.series[0]?.revenue, coverage: bare.coverage });
  report('7.9 ردٌّ فارغ ⇒ سلسلة فارغة لا انهيار',
    A.adaptDailyFinancial(null).series.length === 0, 0, A.adaptDailyFinancial(null).series.length);

  // تفصيل العمولة: شكلان.
  report('7.10 تفصيل كمصفوفة',
    A.adaptCommissionBreakdown([{ label: 'حجوزات', amount: 100 }]).length === 1, 1,
    A.adaptCommissionBreakdown([{ label: 'حجوزات', amount: 100 }]).length);
  report('7.11 تفصيل بغلاف { rows }',
    A.adaptCommissionBreakdown({ rows: [{ name: 'عمولة', value: 12 }] })[0].label === 'عمولة', 'عمولة',
    A.adaptCommissionBreakdown({ rows: [{ name: 'عمولة', value: 12 }] })[0].label);
  report('7.12 تفصيل بردّ فارغ ⇒ مصفوفة فارغة',
    A.adaptCommissionBreakdown(undefined).length === 0, 0, A.adaptCommissionBreakdown(undefined).length);

  report('7.13 معاملة: customer ← user و price ← amount',
    (() => {
      const t = A.adaptTransaction({ id: 1, ref: 'BK-1', customer: 'سارة', price: 120, date: '2026-10-01', status: 'completed' });
      return t.user === 'سارة' && t.amount === 120;
    })(), { user: 'سارة', amount: 120 }, 'معاملة');
}

/* ------------------------------------------------------------------ */
/* 8. الإعدادات — العقد §11 (PUT يطلب كل الحقول)                     */
/* ------------------------------------------------------------------ */

console.log('\n===== الإعدادات: PUT يطلب كل الحقول إجبارياً =====');
{
  const s = A.adaptSettings({ commission_rate: 12.00, booking_grace_period_hours: 24, auto_approve_bookings: false, currency: 'ش.ج' });
  report('8.1 الحقول الأربعة كلها تُقرأ',
    s.commission_rate === 12 && s.booking_grace_period_hours === 24
    && s.auto_approve_bookings === false && s.currency === 'ش.ج',
    '12/24/false/ش.ج', { r: s.commission_rate, g: s.booking_grace_period_hours, a: s.auto_approve_bookings, c: s.currency });

  // `currency` إجباري عند الخادم؛ فإن لم يرد نبقى فارغين ونقول ذلك، ولا نخترع.
  report('8.2 عملة غائبة تبقى فارغة (لا اختراع عملة)',
    A.adaptSettings({ commission_rate: 12 }).currency === '', '', A.adaptSettings({ commission_rate: 12 }).currency);
  report('8.3 نسبة غائبة ⇒ null (لا 0 يُكتب في القاعدة)',
    A.adaptSettings({}).commission_rate === null, null, A.adaptSettings({}).commission_rate);
}

/* ------------------------------------------------------------------ */
/* 9. شكل غائب / خبيث                                                 */
/* ------------------------------------------------------------------ */

console.log('\n===== المتانة =====');
{
  report('9.1 محوّل على قيمة ليست كائناً لا ينهار',
    A.adaptBooking(null).ref === '' && A.adaptSpace(undefined).name === ''
    && A.adaptDispute(5).status === 'open' && A.adaptUser('x').role === null,
    'قيم افتراضية آمنة', 'انهيار');

  report('9.2 قائمة غير مصفوفة ⇒ مصفوفة فارغة',
    A.adaptAll(null, A.adaptBooking).length === 0 && A.adaptAll({ a: 1 }, A.adaptBooking).length === 0,
    0, 'انهار أو أعاد غير مصفوفة');

  report('9.3 حقول العقد الناقصة لا تنتج NaN',
    (() => {
      const cols = ['amount', 'hours', 'rating', 'bookings', 'capacity', 'price', 'revenue', 'pending'];
      const rows = [A.adaptBooking({}), A.adaptSpace({}), A.adaptUser({}), A.adaptDispute({}), A.adaptReview({}), A.adaptTransaction({})];
      return rows.every((r) => cols.every((c) => !Number.isNaN(r[c])));
    })(), 'لا NaN في أي عمود رقمي', 'NaN تسرّب');

  report('9.4 محوّل الفئات لا يرمي على مدخلات غريبة',
    [null, undefined, '', '   ', 0, {}, []].every((v) => typeof A.canonicalInboxCategory(v) === 'string'),
    'نص دائماً', 'انهيار');
}

await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
