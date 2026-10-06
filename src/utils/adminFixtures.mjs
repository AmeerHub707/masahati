/**
 * بيانات اختبار على شكل ردود خادم حقيقي.
 *
 * لماذا هذا الملف: حُذفت كل البيانات الوهمية من كود التطبيق، فاللوحة تعرض
 * ما يرد من `/api/admin` فقط. والاختبار الذي يفرض ذلك يحتاج خادماً، فيقدّم
 * هذا الملف ردوده عبر `fetch` وهمي داخل الاختبار وحده.
 *
 * القواعد:
 *  - كل قيمة هنا ردّ خادم كما يصفه عقد الـ API، لا مدخلات واجهة.
 *  - التواريخ المالية نسبية إلى «اليوم» لأن الشاشات تحسب نطاقاتها من تاريخ
 *    اليوم الحقيقي؛ لو ثبّتنا شهراً بعينه لَعبت كل نافذة على صفر.
 *  - لا شيء هنا يُستورد من كود التطبيق، فلو استورده كود التطبيق لعاد الخلل.
 */

// تاريخ اليوم بصيغة العقد، محسوب بالـ UTC كي لا تنزلق النتيجة في المناطق
// الزمنية الخلفية (نفس سبب البناء بـ Date.UTC في الشاشات).
const iso = (offsetDays = 0) => {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(base - offsetDays * 86400000).toISOString().slice(0, 10);
};

export const TODAY = iso(0);
const MONTH_START = `${TODAY.slice(0, 7)}-01`;

/* ------------------------------------------------------------------ */
/* المستخدمون (§5.1)                                                   */
/* ------------------------------------------------------------------ */

const spark = (seed) => Array.from({ length: 7 }, (_, i) => {
  const wave = Math.round(Math.sin(i * 1.9 + seed) * 4);
  return Math.max(0, Math.round(seed + wave + i * 0.8));
});

// الأدوار هنا على شكل ما يرسله الـ API فعلاً: `space_owner` للدور الجديد و
// `owner` للإملاء القديم (العقد §1.1) و`customer` و`freelancer`. وجود الثلاثة
// معاً يثبت أن الواجهة تتعامل معها كدور واحد للملاك لا كإملاءً واحد.
const USER_SEED = [
  [1, 'أحمد العمري', 'ahmad.omari@mail.com', 'freelancer', 'active', true, 12, 3],
  [2, 'سارة النجار', 'sara.najjar@mail.com', 'freelancer', 'active', true, 34, 7],
  [3, 'خالد المصري', 'khaled.masri@mail.com', 'owner', 'active', true, 0, 1],
  [4, 'ليان أبو خليل', 'layan.abukhalil@mail.com', 'space_owner', 'active', false, 2, 2],
  [5, 'محمد دويدار', 'mohammad.dweidar@mail.com', 'freelancer', 'active', true, 41, 8],
  [6, 'نور شعبان', 'noor.shaban@mail.com', 'freelancer', 'active', false, 3, 2],
  [7, 'راني الشوا', 'rami.shawwa@mail.com', 'space_owner', 'suspended', true, 0, 1],
  [8, 'ديما الجمل', 'dima.jamal@mail.com', 'freelancer', 'active', true, 18, 5],
  [9, 'عمر سكيك', 'omar.skaik@mail.com', 'freelancer', 'active', true, 7, 3],
  [10, 'هبة الرنتيسي', 'heba.rantisi@mail.com', 'space_owner', 'active', false, 0, 1],
  [11, 'يوسف بعلوشة', 'youssef.baalusha@mail.com', 'freelancer', 'suspended', true, 9, 3],
  [12, 'ريم قشطة', 'reem.qashta@mail.com', 'freelancer', 'active', true, 22, 5],
  [13, 'محمود عرفات', 'mahmoud.arafat@mail.com', 'space_owner', 'pending', false, 0, 1],
  [14, 'أمل حسان', 'amal.hassan@mail.com', 'customer', 'active', true, 0, 2],
  [15, 'باسم عودة', 'bassem.awda@mail.com', 'freelancer', 'active', true, 15, 4],
  [16, 'جنى المصري', 'jana.masri@mail.com', 'freelancer', 'active', true, 27, 6],
  [17, 'حسام النابلسي', 'hossam.nabulsi@mail.com', 'space_owner', 'suspended', true, 0, 1],
  [18, 'دلال سليم', 'dallal.salim@mail.com', 'freelancer', 'active', true, 11, 3],
  [19, 'زين الحلبي', 'zain.halabi@mail.com', 'owner', 'active', true, 0, 1],
  [20, 'سمير هواري', 'sameer.hawari@mail.com', 'customer', 'active', false, 0, 1],
  [21, 'شروق صالح', 'shorouq.saleh@mail.com', 'freelancer', 'active', true, 19, 5],
  [22, 'طارق عاشور', 'tareq.ashour@mail.com', 'freelancer', 'active', true, 8, 3],
  [23, 'عالية النجار', 'alia.najjar@mail.com', 'space_owner', 'active', true, 0, 1],
  [24, 'غدير شحادة', 'ghadeer.shahada@mail.com', 'freelancer', 'active', true, 6, 2],
  [25, 'فادي أبو ريا', 'fadi.aburaya@mail.com', 'freelancer', 'suspended', true, 13, 4],
  [26, 'كارولين حداد', 'caroline.haddad@mail.com', 'customer', 'active', true, 0, 6],
  [27, 'لؤي قاسم', 'loay.kassem@mail.com', 'space_owner', 'pending', false, 0, 1],
  [28, 'منى الشيخ', 'mona.sheikh@mail.com', 'freelancer', 'active', true, 31, 7],
  [29, 'نادر سلامة', 'nader.salama@mail.com', 'freelancer', 'active', true, 5, 2],
  [30, 'هشام جرادات', 'hesham.jaradat@mail.com', 'owner', 'active', true, 0, 1],
  [31, 'وفاء نصار', 'wafaa.nassar@mail.com', 'freelancer', 'active', true, 14, 4],
  [32, 'ياسين داوود', 'yaseen.dawood@mail.com', 'customer', 'active', false, 0, 1],
  // حسابات ملاك وصلت بـ`pending` من تسجيل جديد (عقد التفعيل §1). وجودها
  // في البيانات الوهمية شرطٌ لاختبار الطابور: بدونه لا حقل `pending` في
  // أي ردّ، فيمرّ اختبار التبويب والبادج بلا معنى.
  [33, 'رنا شاهين', 'rana.shahin@mail.com', 'space_owner', 'pending', false, 0, 1],
  [34, 'أيمن القيسي', 'aymen.qaisi@mail.com', 'space_owner', 'pending', false, 0, 2],
  // حساب بدور غير معروف وحالة غير معروفة: القفل على `active` وحده
  // (ownerGate) يجب أن يبقيه مقفلاً بلا أن يُقال له إنه موقوف.
  [35, 'حساب مجهول', 'unknown.state@mail.com', 'space_owner', 'archived', false, 0, 1],
];

const RELATIVE = [
  'منذ 5 دقائق', 'قبل ساعة', 'قبل 3 ساعات', 'قبل 25 دقيقة', 'متصلاً الآن',
  'قبل 10 دقائق', 'قبل 12 ساعة', 'قبل ساعتين', 'قبل يوم', 'قبل 40 دقيقة',
];

export const users = USER_SEED.map(([id, name, email, role, status, verified, bookings, sparkSeed], i) => {
  const row = {
    id,
    name,
    email,
    phone: `+970 59 100 2${String(id).padStart(3, '0')}`,
    role,
    status,
    verified,
    joined: iso(200 + id),
    lastActive: RELATIVE[i % RELATIVE.length],
    online: i % 3 !== 2,
    bookings,
    activity: spark(sparkSeed),
    spaces: role === 'owner' ? [{ id: id + 100, name: `مساحة الحساب ${id}` }] : [],
    documents: [],
  };

  // مستندات التحقق: أشكال مختلفة عمداً بين حسابين، لا شكل واحد.
  //
  // المحوّل (adaptUserDocuments) يقرأ شكلين: مصفوفة `documents` وحقولاً
  // مفردة. والحقول المفردة **على مستوى الحساب** لا داخل كائن `documents`،
  // فوضعها داخله ينتج شكلاً لا يقرؤه أحد ولا يورده أي خادم.
  //
  // الحساب 33 (فردي) يغطّي حقلي الملكية والسجل، والحساب 34 (مصفوفة) يغطّي
  // نوع الوثيقة داخل المصفوفة. وكلاهما `pending` مالك مساحة، فلهما قسم
  // مستندات في نافذة الملف.
  if (status === 'pending' && (role === 'space_owner' || role === 'owner')) {
    if (id % 2 === 0) {
      row.documents = [{
        kind: 'property_deed',
        url: `/storage/verification/${id}/property-deed.pdf`,
        name: 'سند-ملكية.pdf',
      }];
    } else {
      row.property_deed = `/storage/verification/${id}/deed.pdf`;
      row.business_license = `/storage/verification/${id}/commercial-register.pdf`;
    }
  }

  return row;
});

/* ------------------------------------------------------------------ */
/* المساحات (§6.1)                                                     */
/* ------------------------------------------------------------------ */

export const spaces = [
  [1, 'مساحة العمل الوسطى', 'غزة - الرمال', 'خالد المصري', 15, 'active', 4.8, 312, 24],
  [2, 'مكتب المبدعين', 'غزة - تل الهوا', 'راني الشوا', 20, 'suspended', 4.1, 150, 12],
  [3, 'قاعة الاجتماعات الذكية', 'غزة - النصر', 'هبة الرنتيسي', 45, 'pending', 0, 0, 16],
  [4, 'استوديو الأناقة', 'غزة - الشاطئ', 'أحمد جودة', 30, 'active', 4.9, 421, 8],
  [5, 'مساحة المهندسين', 'غزة - الزيتون', 'سامي حمدان', 12, 'active', 4.5, 267, 30],
  [6, 'ركن المبرمجين', 'غزة - الجلاء', 'ليان أبو خليل', 18, 'pending', 0, 0, 10],
  [7, 'مركز ريادة الأعمال', 'غزة - النصر', 'ديما الجمل', 25, 'active', 4.7, 389, 40],
  [8, 'رِواء للاستوديوهات', 'غزة - الشجاعية', 'محمود عرفات', 22, 'active', 4.3, 205, 20],
  [9, 'فضاء المبدعين', 'غزة - الرمال', 'نور شعبان', 8, 'suspended', 3.9, 88, 14],
  [10, 'المكتب المستقل', 'غزة - تل الهوا', 'عمر سكيك', 35, 'pending', 0, 0, 6],
].map(([id, name, neighborhood, owner, price, status, rating, bookings, capacity]) => {
  const row = {
    id,
    name,
    neighborhood,
    owner,
    price,
    status,
    rating,
    bookings,
    capacity,
    image: '/storage/spaces/cover.jpg',
  };

  // مستندات التحقق: أشكال مختلفة عمداً بين مساحتين، لا شكل واحد — كما في
  // الحسابات أعلاه. المساحة 3 مصفوفة `documents` بنوع داخلها، والمساحة 6
  // حقولاً مفردة على مستوى المساحة. والقاعدة نفسها: الحقول المفردة **خارج**
  // المصفوفة، فوضعها داخله ينتج شكلاً لا يقرؤه محوّل ولا يورده أي خادم.
  //
  // 10 بلا مستندات عمداً: حالة فارغة صادقة تفصل «القسم يعرض ما وصل» عن
  // «القسم يعرض ما نريده».
  if (status === 'pending') {
    if (id === 3) {
      row.documents = [
        {
          kind: 'property_deed',
          url: `/storage/verification/space-${id}/property-deed.pdf`,
          name: 'سند-ملكية.pdf',
        },
        {
          kind: 'business_license',
          url: `/storage/verification/space-${id}/commercial-register.pdf`,
          name: 'سجل-تجاري.pdf',
        },
      ];
    } else if (id === 6) {
      row.property_deed = `/storage/verification/space-${id}/deed.pdf`;
      row.business_license = `/storage/verification/space-${id}/commercial-register.pdf`;
    }
  }

  return row;
});

/* ------------------------------------------------------------------ */
/* الحجوزات والنزاعات (§7.1 و§8.1)                                    */
/* ------------------------------------------------------------------ */

export const bookings = [
  [201, '#BK-1021', 'سارة النجار', 'استوديو الأناقة', 0, '09:00 - 13:00', 4, 120, 'completed'],
  [202, '#BK-1022', 'محمد دويدار', 'مساحة المهندسين', 1, '08:00 - 17:00', 9, 108, 'confirmed'],
  [203, '#BK-1023', 'أحمد العمري', 'مركز ريادة الأعمال', 1, '13:00 - 17:00', 4, 100, 'confirmed'],
  [204, '#BK-1024', 'ديما الجمل', 'مساحة العمل الوسطى', 2, '09:00 - 14:00', 5, 75, 'disputed'],
  [205, '#BK-1025', 'ريم قشطة', 'رِواء للاستوديوهات', 2, '16:00 - 19:00', 3, 66, 'completed'],
  [206, '#BK-1026', 'عمر سكيك', 'مكتب المبدعين', 3, '08:00 - 16:00', 8, 160, 'confirmed'],
  [207, '#BK-1027', 'نور شعبان', 'فضاء المبدعين', 3, '10:00 - 12:00', 2, 16, 'confirmed'],
  [208, '#BK-1028', 'سارة النجار', 'مركز ريادة الأعمال', 4, '09:00 - 13:00', 4, 100, 'disputed'],
  [209, '#BK-1029', 'يوسف بعلوشة', 'مساحة المهندسين', 4, '14:00 - 18:00', 4, 48, 'completed'],
  [210, '#BK-1030', 'أحمد العمري', 'استوديو الأناقة', 5, '11:00 - 15:00', 4, 120, 'confirmed'],
].map(([id, ref, user, space, back, time, hours, amount, status]) => ({
  id,
  ref,
  user,
  space,
  date: iso(back),
  time,
  hours,
  amount,
  status,
}));

export const disputes = [
  [1, '#DIS-041', '#BK-1024', 'ديما الجمل', 'مساحة العمل الوسطى', 'الإنترنت كان منقطعاً طوال الحجز، وطلبت استرداد المبلغ.', 75, 'open', 2],
  [2, '#DIS-042', '#BK-1028', 'سارة النجار', 'مركز ريادة الأعمال', 'اختلاف في عدد الساعات المحسوبة مقابل ما تم حجزه.', 100, 'open', 1],
  [3, '#DIS-043', '#BK-1005', 'محمد دويدار', 'ركن المبرمجين', 'المساحة لم تكن جاهزة في الموعد المحدد، وأُجّل الحجز ساعتين.', 90, 'resolved', 12],
  [4, '#DIS-044', '#BK-1012', 'ليان أبو خليل', 'فضاء المبدعين', 'ارتفاع سعر مفاجئ بعد تأكيد الحجز.', 32, 'closed', 15],
  [5, '#DIS-045', '#BK-1018', 'عمر سكيك', 'مكتب المبدعين', 'تلف أحد الأجهزة أثناء الاستخدام وطلب إعادة النظر في الخطأ.', 60, 'open', 3],
].map(([id, ref, bookingRef, user, space, issue, amount, status, back]) => ({
  id,
  ref,
  bookingRef,
  user,
  space,
  issue,
  amount,
  status,
  opened: iso(back),
}));

/* ------------------------------------------------------------------ */
/* المراجعات (§9.1)                                                    */
/* ------------------------------------------------------------------ */

export const reviews = [
  [1, 'محمد دويدار', 'استوديو الأناقة', 5, 'أجواء ممتازة وأجهزة قوية، أنصح بها بشدة للمصممين.', 5, true, false],
  [2, 'سارة النجار', 'مساحة المهندسين', 4, 'المكان نظيف والعمل فيه مريح، لكن الكراسي تحتاج تجديد.', 6, true, false],
  [3, 'مجهول', 'مكتب المبدعين', 1, 'أسوأ تجربة! إدارة فاشلة ومكان غير صحي، لا تتعبوا نفسكم.', 7, true, true],
  [4, 'ريم قشطة', 'رِواء للاستوديوهات', 5, 'إضاءة طبيعية رائعة ومناسب للتصوير الفوتوغرافي.', 9, true, false],
  [5, 'يوسف بعلوشة', 'فضاء المبدعين', 2, 'صوت مزعج من الشارع ولا توجد عزل، غير مناسب للعمل المكثف.', 11, true, true],
  [6, 'أحمد العمري', 'مركز ريادة الأعمال', 5, 'بيئة مثالية لفرق العمل، شبكة قوية وخدمة ممتازة.', 13, true, false],
  [7, 'نور شعبان', 'استوديو الأناقة', 4, 'تجربة جيدة عموماً، ينقصها القليل من معدات الصوت.', 15, true, false],
  [8, 'مجهول', 'مساحة العمل الوسطى', 5, 'مكان رائع، الإنترنت سريع والقهوة مجانية. سأعود كل أسبوع!', 17, true, true],
].map(([id, user, space, rating, text, back, visible, flagged]) => ({
  id,
  user,
  space,
  rating,
  text,
  date: iso(back),
  visible,
  flagged,
}));

/* ------------------------------------------------------------------ */
/* النظرة العامة (§4)                                                  */
/* ------------------------------------------------------------------ */

export const stats = {
  totalUsers: 1284,
  spaceOwners: 186,
  registeredSpaces: 342,
  monthlyBookings: 517,
  totalRevenue: 241500,
  openDisputes: 9,
  platformCommission: 0.12,
  payoutsPending: 8240,
  activeSpaces: 261,
  pendingSpaces: 31,
  suspendedSpaces: 19,
};

export const revenueTrend = [
  ['أكتوبر', 8200, 190], ['نوفمبر', 9400, 224], ['ديسمبر', 10100, 248],
  ['يناير', 11300, 287], ['فبراير', 12600, 331], ['مارس', 13800, 372],
  ['أبريل', 14900, 405], ['مايو', 16200, 451], ['يونيو', 17800, 489],
  ['يوليو', 19300, 526], ['أغسطس', 21450, 573], ['سبتمبر', 24150, 617],
].map(([month, revenue, bookingsCount], i) => ({
  id: i + 1,
  month,
  month_key: `2025-${String(10 + i).padStart(2, '0')}`,
  revenue,
  bookings: bookingsCount,
}));

export const activities = [
  [1, 'user', 'سجّل حساب جديد: نور شعبان (فريلانسر)', 'منذ 12 دقيقة'],
  [2, 'space', 'تم رفع مساحة جديدة "ركن المبرمجين" بانتظار المراجعة', 'منذ 45 دقيقة'],
  [3, 'booking', 'تأكيد حجز #BK-1022 من محمد دويدار', 'منذ ساعة'],
  [4, 'dispute', 'فتح نزاع جديد #DIS-045 على مساحة "مكتب المبدعين"', 'منذ ساعتين'],
  [5, 'payment', 'تمت تسوية دفعة مالية إلى "استوديو الأناقة" بقيمة 1,260 ش.ج', 'منذ 4 ساعات'],
  [6, 'review', 'مراجعة جديدة من سارة النجار بخصوص "مساحة المهندسين"', 'منذ 6 ساعات'],
].map(([id, icon, text, time]) => ({ id, icon, text, time, created_at: `${iso(0)}T08:00:00Z` }));

export const recentRegistrations = [
  [1, 'نور شعبان', 'freelancer', 'منذ 12 دقيقة'],
  [2, 'هبة الرنتيسي', 'owner', 'منذ 35 دقيقة'],
  [3, 'عمر سكيك', 'freelancer', 'منذ ساعة'],
  [4, 'ديما الجمل', 'freelancer', 'منذ 3 ساعات'],
  [5, 'محمد دويدار', 'freelancer', 'منذ 5 ساعات'],
].map(([id, name, role, time]) => ({ id, name, role, time, created_at: `${iso(0)}T08:00:00Z` }));

/* ------------------------------------------------------------------ */
/* المالية (§10)                                                      */
/* ------------------------------------------------------------------ */

const COMMISSION_RATE = 0.12;

// سلسلة يومية كثيفة تغطي سنة كاملة تنتهي اليوم، بمولّد ثابت البذرة:
// نفس التاريخ ⇒ نفس الأرقام في كل تشغيل، والفرق بين الأيام متغيّر فلا
// يخرج خطّ مستقيم. القيم الثابتة تجعل توقعات الاختبار ممكنة.
const seededNoise = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const dailySeries = Array.from({ length: 366 }, (_, i) => {
  const back = 365 - i;
  const base = 5200 + Math.round(seededNoise(i + 1) * 5400);
  return {
    date: iso(back),
    revenue: base,
    bookings: 9 + Math.round(seededNoise(i + 40) * 14),
    pending: 140 + Math.round(seededNoise(i + 90) * 320),
  };
});

// تغطية السلسلة: من أول يوم فيها إلى آخر يوم فيها.
export const dailyCoverage = { from: dailySeries[0].date, to: dailySeries.at(-1).date };

export const sumRange = (from, to) => {
  const rows = dailySeries.filter((d) => d.date >= from && d.date <= to);
  const revenue = rows.reduce((s, d) => s + d.revenue, 0);
  const bookingsCount = rows.reduce((s, d) => s + d.bookings, 0);
  return {
    revenue,
    bookings: bookingsCount,
    pending: rows.reduce((s, d) => s + d.pending, 0),
    commission: Math.round(revenue * COMMISSION_RATE),
    payouts: revenue - Math.round(revenue * COMMISSION_RATE),
  };
};

export const MONTH_TOTALS = sumRange(MONTH_START, TODAY);
export const TODAY_TOTALS = sumRange(TODAY, TODAY);
export const WEEK_TOTALS = sumRange(iso(6), TODAY);
export const YEAR_TOTALS = sumRange(iso(365), TODAY);

export const financialSummary = {
  range: 'month',
  revenue: MONTH_TOTALS.revenue,
  bookings: MONTH_TOTALS.bookings,
  commission: MONTH_TOTALS.commission,
  payouts: MONTH_TOTALS.payouts,
  payouts_pending: MONTH_TOTALS.pending,
  commission_rate: COMMISSION_RATE,
};

export const commissionBreakdown = [
  { label: 'حجوزات', amount: MONTH_TOTALS.revenue, key: 'bookings' },
  { label: 'عمولة المنصة (12%)', amount: MONTH_TOTALS.commission, key: 'commission' },
  { label: 'مستحقات الملاك', amount: MONTH_TOTALS.payouts, key: 'owner_payouts' },
  { label: 'مدفوعات معلقة', amount: MONTH_TOTALS.pending, key: 'pending_payouts' },
];

const ownerOf = (spaceName) => spaces.find((s) => s.name === spaceName)?.owner || 'غير محدّد';

export const transactions = bookings.map((b) => ({
  id: b.id,
  ref: b.ref,
  date: b.date,
  space: b.space,
  owner: ownerOf(b.space),
  user: b.user,
  hours: b.hours,
  amount: b.amount,
  status: b.status,
}));

export const settings = {
  commission_rate: 12,
  booking_grace_period_hours: 24,
  auto_approve_bookings: false,
  currency: 'ش.ج',
  updated_at: `${iso(0)}T12:00:00Z`,
};

/* ------------------------------------------------------------------ */
/* صندوق الوارد والإشعارات (§11 و§12)                                 */
/* ------------------------------------------------------------------ */

export const inboxItems = [
  [1, 'dispute', 'فتح نزاع جديد #DIS-045', 'على مساحة "مكتب المبدعين" — الحجز #BK-1018 بقيمة 60 ش.ج.', 'منذ ساعتين', false, false],
  [2, 'space_request', 'طلب مراجعة مساحة جديدة "ركن المبرمجين"', 'قدمتها ليان أبو خليل وتبلغ سعتها 10 مقاعد.', 'منذ 45 دقيقة', false, false],
  [3, 'report', 'بلاغ عن مراجعة غير لائقة', 'محدد كـ"مخالف" على مساحة "مكتب المبدعين".', 'منذ 3 ساعات', false, false],
  [4, 'dispute', 'نزاع #DIS-041 بانتظار قرارك', 'بخصوص مساحة "مساحة العمل الوسطى" بقيمة 75 ش.ج.', 'أمس', true, false],
  [5, 'space_request', 'مساحة جديدة "المكتب المستقل" بانتظار الاعتماد', 'قدمها عمر سكيك بسعة 6 مقاعد ومعدل أسبوعي.', 'قبل 5 ساعات', false, false],
[6, 'report', 'تأكيد إغلاق البلاغ', 'تم إغلاق البلاغ على مساحة "فضاء المبدعين" دون إجراء.', 'منذ يومين', true, true],
  // إشعار توثيق مالك مساحة. `user_id` هو ما يجعل زرّه يفتح **ملف هذا
  // الحساب** بدل قائمة المستخدمين، وهو ما طلبته قاعدة «رفع المستند».
  //بقية الصفوف بلا `user_id`: كل فئاتها تفتح صفحتها العامة، ولا نُلفّق
  // معرّفات لها لتوحيد الشكل على حساب تغيير وجهتها.
  [8, 'owner_verification', 'رفع مستند ملكية جديد بانتظار التفعيل', 'قام رنا شاهين برفع مستند توثيق، وحسابه في طابور التفعيل.', 'منذ 20 دقيقة', false, false, 33],
].map(([id, category, title, body, time, read, archived, user_id]) => ({
  id,
  category,
  title,
  body,
  time,
  read,
  archived,
  user_id: user_id ?? null,
  created_at: `${iso(0)}T06:00:00Z`,
}));

export const inboxUnread = {
  unread: inboxItems.filter((i) => !i.read && !i.archived).length,
  archived: inboxItems.filter((i) => i.archived).length,
};

export const broadcasts = [
  [1, 'صيانة مجدولة للنظام', 'ستتوقف المنصة يوم الجمعة من 2 إلى 4 صباحاً لصيانة دورية.', 'all', 498, 1284, ['in_app', 'email'], ''],
  [2, 'إضافة ميزة حجز جماعي', 'أصبح بإمكان مساحات العمل استقبال حجوزات جماعية تصل إلى 20 شخصاً.', 'owners', 96, 186, ['in_app'], ''],
  [3, 'تحديث سياسة الاسترداد', 'تم تحديث سياسة الاسترداد؛ يمكن طلب الاسترداد خلال 24 ساعة من الحجز.', 'all', 702, 1284, ['in_app', 'email'], '/policies/refund'],
  [4, 'ندعوك لورشة عمل مجانية', 'ورشة بعنوان "التسويق الرقمي لرواد الأعمال" يوم الخميس القادم.', 'freelancers', 411, 1098, ['email'], '/events/workshop'],
].map(([id, title, body, target, opened, total, channels, link], i) => ({
  id,
  title,
  body,
  target,
  opened,
  total,
  channels,
  link,
  sent_at: `${iso(10 - i * 3)} 09:00`,
  sent_by: 'admin',
}));

export const audienceCounts = {
  all: stats.totalUsers,
  owners: stats.spaceOwners,
  freelancers: stats.totalUsers - stats.spaceOwners,
};

export const notificationsUnread = { unread: 4, archived: 0 };

/* ------------------------------------------------------------------ */
/* توزيع الردود على المسارات                                            */
/* ------------------------------------------------------------------ */

// ترتيب الفحص: النقاط قبل الأعمدة الفرعية (/users/stats قبل /users/1)،
// ومطابقة كاملة للمسار لا جزئية، فلا يبتلع /users/stats مسار المستخدم.
const ROUTES = [
  ['/api/admin/stats/revenue-trend', () => revenueTrend],
  ['/api/admin/stats', () => stats],
  ['/api/admin/activities', () => activities],
  ['/api/admin/recent-registrations', () => recentRegistrations],
  ['/api/admin/settings', () => settings],
  ['/api/admin/users/stats', () => ({
    total: users.length,
    activeFreelancers: users.filter((u) => u.role === 'freelancer' && u.status === 'active').length,
    owners: users.filter((u) => u.role === 'owner').length,
    pendingVerif: users.filter((u) => !u.verified).length,
    suspended: users.filter((u) => u.status === 'suspended').length,
  })],
  ['/api/admin/spaces/stats', () => ({
    total: spaces.length,
    active: spaces.filter((s) => s.status === 'active').length,
    pending: spaces.filter((s) => s.status === 'pending').length,
    suspended: spaces.filter((s) => s.status === 'suspended').length,
  })],
  ['/api/admin/reviews/stats', () => ({
    total: reviews.length,
    average: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
    flagged: reviews.filter((r) => r.flagged).length,
    hidden: reviews.filter((r) => !r.visible).length,
  })],
  ['/api/admin/financials/summary', () => financialSummary],
  ['/api/admin/financials/daily', () => ({
    from: dailyCoverage.from,
    to: dailyCoverage.to,
    coverage: dailyCoverage,
    series: dailySeries,
    totals: {
      revenue: YEAR_TOTALS.revenue,
      bookings: YEAR_TOTALS.bookings,
      pending: YEAR_TOTALS.pending,
    },
  })],
  ['/api/admin/financials/commission-breakdown', () => commissionBreakdown],
  ['/api/admin/financials/transactions', () => transactions],
  ['/api/admin/inbox/unread-count', () => inboxUnread],
  ['/api/admin/inbox/categories', () => ({
    dispute: { label: 'نزاع', tone: 'red', cta: 'عرض النزاع', path: '/admin/bookings' },
    space_request: { label: 'طلب مساحة', tone: 'blue', cta: 'مراجعة المساحة', path: '/admin/spaces' },
    report: { label: 'بلاغ', tone: 'violet', cta: 'مراجعة البلاغ', path: '/admin/reviews' },
  })],
  ['/api/admin/inbox', () => inboxItems],
  ['/api/admin/broadcasts/audience-counts', () => audienceCounts],
  ['/api/admin/broadcasts/drafts', () => []],
  ['/api/admin/broadcasts', () => broadcasts],
  ['/api/admin/notifications/unread-count', () => notificationsUnread],
  ['/api/admin/users', () => users],
  ['/api/admin/spaces', () => spaces],
  ['/api/admin/bookings', () => bookings],
  ['/api/admin/disputes', () => disputes],
  ['/api/admin/reviews', () => reviews],
];

// مسار مفرد /users/{id}: نطابقه بعد النقاط، فنمرّر /users/stats من قبله.
const SINGLE = [
  [/^\/api\/admin\/users\/(\d+)$/, (m) => users.find((u) => String(u.id) === m[1])],
  [/^\/api\/admin\/spaces\/(\d+)$/, (m) => spaces.find((s) => String(s.id) === m[1])],
  [/^\/api\/admin\/bookings\/([^/]+)$/, (m) => bookings.find((b) => b.ref === m[1])],
  [/^\/api\/admin\/disputes\/([^/]+)$/, (m) => disputes.find((d) => d.ref === m[1])],
];

/**
 * يردّ ببيانات نقطة النهاية المطلوبة، أو null إن لم تكن معروفة — فيُظهر
 * الاختبار فشل المسار بدل تمرير صمت.
 */
export function fixtureFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const [prefix, get] of ROUTES) {
    if (path === prefix) return get();
  }
  for (const [pattern, get] of SINGLE) {
    const match = pattern.exec(path);
    if (match) return get(match);
  }
  return null;
}

/** غلاف `{ data, meta }` كما يغلّف Laravel كل ردّ (§0.4). */
export function envelopeFor(pathname, total) {
  return { data: fixtureFor(pathname), meta: { page: 1, per_page: 100, total, last_page: 1 } };
}
