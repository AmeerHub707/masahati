// بيانات وهمية للوحة تحكم المشرف — جاهزة للاستبدال بنقاط نهاية Laravel REST API.

export const adminStats = {
  totalUsers: 1284,
  spaceOwners: 186,
  registeredSpaces: 342,
  monthlyBookings: 517,
  totalRevenue: 24150,
  openDisputes: 9,
  platformCommission: 0.12, // 12%
  payoutsPending: 8240,
  activeSpaces: 261,
  pendingSpaces: 31,
  suspendedSpaces: 19,
};

export const revenueTrend = [
  { month: 'أكتوبر', revenue: 8200, bookings: 190 },
  { month: 'نوفمبر', revenue: 9400, bookings: 224 },
  { month: 'ديسمبر', revenue: 10100, bookings: 248 },
  { month: 'يناير', revenue: 11300, bookings: 287 },
  { month: 'فبراير', revenue: 12600, bookings: 331 },
  { month: 'مارس', revenue: 13800, bookings: 372 },
  { month: 'أبريل', revenue: 14900, bookings: 405 },
  { month: 'مايو', revenue: 16200, bookings: 451 },
  { month: 'يونيو', revenue: 17800, bookings: 489 },
  { month: 'يوليو', revenue: 19300, bookings: 526 },
  { month: 'أغسطس', revenue: 21450, bookings: 573 },
  { month: 'سبتمبر', revenue: 24150, bookings: 617 },
];

const spark = (seed) => Array.from({ length: 7 }, (_, i) => {
  const wave = Math.round(Math.sin(i * 1.9 + seed) * 4);
  return Math.max(0, Math.round(seed + wave + i * 0.8));
});

export const adminUsers = [
  { id: 1, name: 'أحمد العمري', email: 'ahmad.omari@mail.com', phone: '+970 59 100 2001', role: 'freelancer', status: 'active', verified: true, joined: '2025-02-14', lastActive: 'منذ 5 دقائق', online: true, bookings: 12, activity: spark(3) },
  { id: 2, name: 'سارة النجار', email: 'sara.najjar@mail.com', phone: '+970 59 100 2002', role: 'freelancer', status: 'active', verified: true, joined: '2025-03-02', lastActive: 'قبل ساعة', online: true, bookings: 34, activity: spark(7) },
  { id: 3, name: 'خالد المصري', email: 'khaled.masri@mail.com', phone: '+970 59 100 2003', role: 'owner', status: 'active', verified: true, joined: '2024-11-20', lastActive: 'قبل 3 ساعات', online: false, bookings: 0, activity: spark(1) },
  { id: 4, name: 'ليان أبو خليل', email: 'layan.abukhalil@mail.com', phone: '+970 59 100 2004', role: 'owner', status: 'active', verified: false, joined: '2025-05-11', lastActive: 'قبل 25 دقيقة', online: true, bookings: 2, activity: spark(2) },
  { id: 5, name: 'محمد دويدار', email: 'mohammad.dweidar@mail.com', phone: '+970 59 100 2005', role: 'freelancer', status: 'active', verified: true, joined: '2025-01-08', lastActive: 'متصلاً الآن', online: true, bookings: 41, activity: spark(8) },
  { id: 6, name: 'نور شعبان', email: 'noor.shaban@mail.com', phone: '+970 59 100 2006', role: 'freelancer', status: 'review', verified: false, joined: '2025-09-01', lastActive: 'قبل 10 دقائق', online: true, bookings: 3, activity: spark(2) },
  { id: 7, name: 'راني الشوا', email: 'rami.shawwa@mail.com', phone: '+970 59 100 2007', role: 'owner', status: 'suspended', verified: true, joined: '2024-08-15', lastActive: 'قبل 12 ساعة', online: false, bookings: 0, activity: spark(1) },
  { id: 8, name: 'ديما الجمل', email: 'dima.jamal@mail.com', phone: '+970 59 100 2008', role: 'freelancer', status: 'active', verified: true, joined: '2025-04-25', lastActive: 'قبل ساعتين', online: false, bookings: 18, activity: spark(5) },
  { id: 9, name: 'عمر سكيك', email: 'omar.skaik@mail.com', phone: '+970 59 100 2009', role: 'freelancer', status: 'active', verified: true, joined: '2025-06-17', lastActive: 'قبل يوم', online: false, bookings: 7, activity: spark(3) },
  { id: 10, name: 'هبة الرنتيسي', email: 'heba.rantisi@mail.com', phone: '+970 59 100 2010', role: 'owner', status: 'active', verified: false, joined: '2025-09-12', lastActive: 'قبل 40 دقيقة', online: true, bookings: 0, activity: spark(1) },
  { id: 11, name: 'يوسف بعلوشة', email: 'youssef.baalusha@mail.com', phone: '+970 59 100 2011', role: 'freelancer', status: 'suspended', verified: true, joined: '2024-12-30', lastActive: 'قبل 3 أيام', online: false, bookings: 9, activity: spark(3) },
  { id: 12, name: 'ريم قشطة', email: 'reem.qashta@mail.com', phone: '+970 59 100 2012', role: 'freelancer', status: 'active', verified: true, joined: '2025-07-03', lastActive: 'قبل 30 دقيقة', online: true, bookings: 22, activity: spark(5) },
  { id: 13, name: 'محمود عرفات', email: 'mahmoud.arafat@mail.com', phone: '+970 59 100 2013', role: 'owner', status: 'review', verified: false, joined: '2026-09-16', lastActive: 'قبل 8 دقائق', online: true, bookings: 0, activity: spark(1) },
  { id: 14, name: 'أمل حسان', email: 'amal.hassan@mail.com', phone: '+970 59 100 2014', role: 'freelancer', status: 'review', verified: false, joined: '2026-09-15', lastActive: 'منذ 20 دقيقة', online: true, bookings: 1, activity: spark(2) },
  { id: 15, name: 'باسم عودة', email: 'bassem.awda@mail.com', phone: '+970 59 100 2015', role: 'freelancer', status: 'active', verified: true, joined: '2025-03-30', lastActive: 'قبل 6 ساعات', online: false, bookings: 15, activity: spark(4) },
  { id: 16, name: 'جنى المصري', email: 'jana.masri@mail.com', phone: '+970 59 100 2016', role: 'freelancer', status: 'active', verified: true, joined: '2025-05-22', lastActive: 'قبل 50 دقيقة', online: true, bookings: 27, activity: spark(6) },
  { id: 17, name: 'حسام النابلسي', email: 'hossam.nabulsi@mail.com', phone: '+970 59 100 2017', role: 'owner', status: 'suspended', verified: true, joined: '2024-10-05', lastActive: 'قبل أسبوع', online: false, bookings: 0, activity: spark(1) },
  { id: 18, name: 'دلال سليم', email: 'dallal.salim@mail.com', phone: '+970 59 100 2018', role: 'freelancer', status: 'active', verified: true, joined: '2025-08-09', lastActive: 'قبل ساعتين', online: false, bookings: 11, activity: spark(3) },
  { id: 19, name: 'زين الحلبي', email: 'zain.halabi@mail.com', phone: '+970 59 100 2019', role: 'owner', status: 'active', verified: true, joined: '2025-01-27', lastActive: 'قبل 15 دقيقة', online: true, bookings: 0, activity: spark(1) },
  { id: 20, name: 'سمير هواري', email: 'sameer.hawari@mail.com', phone: '+970 59 100 2020', role: 'freelancer', status: 'review', verified: false, joined: '2026-09-18', lastActive: 'قبل 5 دقائق', online: true, bookings: 0, activity: spark(1) },
  { id: 21, name: 'شروق صالح', email: 'shorouq.saleh@mail.com', phone: '+970 59 100 2021', role: 'freelancer', status: 'active', verified: true, joined: '2025-04-03', lastActive: 'قبل 4 ساعات', online: false, bookings: 19, activity: spark(5) },
  { id: 22, name: 'طارق عاشور', email: 'tareq.ashour@mail.com', phone: '+970 59 100 2022', role: 'freelancer', status: 'active', verified: true, joined: '2025-06-28', lastActive: 'متصلاً الآن', online: true, bookings: 8, activity: spark(3) },
  { id: 23, name: 'عالية النجار', email: 'alia.najjar@mail.com', phone: '+970 59 100 2023', role: 'owner', status: 'active', verified: true, joined: '2025-02-11', lastActive: 'قبل ساعة', online: false, bookings: 0, activity: spark(1) },
  { id: 24, name: 'غدير شحادة', email: 'ghadeer.shahada@mail.com', phone: '+970 59 100 2024', role: 'freelancer', status: 'active', verified: true, joined: '2025-09-25', lastActive: 'قبل 35 دقيقة', online: true, bookings: 6, activity: spark(2) },
  { id: 25, name: 'فادي أبو ريا', email: 'fadi.aburaya@mail.com', phone: '+970 59 100 2025', role: 'freelancer', status: 'suspended', verified: true, joined: '2025-01-18', lastActive: 'قبل 5 أيام', online: false, bookings: 13, activity: spark(4) },
  { id: 26, name: 'كارولين حداد', email: 'caroline.haddad@mail.com', phone: '+970 59 100 2026', role: 'freelancer', status: 'active', verified: true, joined: '2025-07-19', lastActive: 'قبل 2 ساعة', online: false, bookings: 24, activity: spark(6) },
  { id: 27, name: 'لؤي قاسم', email: 'loay.kassem@mail.com', phone: '+970 59 100 2027', role: 'owner', status: 'review', verified: false, joined: '2026-09-20', lastActive: 'قبل 12 دقيقة', online: true, bookings: 0, activity: spark(1) },
  { id: 28, name: 'منى الشيخ', email: 'mona.sheikh@mail.com', phone: '+970 59 100 2028', role: 'freelancer', status: 'active', verified: true, joined: '2025-03-15', lastActive: 'قبل 3 ساعات', online: false, bookings: 31, activity: spark(7) },
  { id: 29, name: 'نادر سلامة', email: 'nader.salama@mail.com', phone: '+970 59 100 2029', role: 'freelancer', status: 'active', verified: true, joined: '2025-05-29', lastActive: 'قبل يوم', online: false, bookings: 5, activity: spark(2) },
  { id: 30, name: 'هشام جرادات', email: 'hesham.jaradat@mail.com', phone: '+970 59 100 2030', role: 'owner', status: 'active', verified: true, joined: '2024-09-10', lastActive: 'قبل 45 دقيقة', online: true, bookings: 0, activity: spark(1) },
  { id: 31, name: 'وفاء نصار', email: 'wafaa.nassar@mail.com', phone: '+970 59 100 2031', role: 'freelancer', status: 'active', verified: true, joined: '2025-08-21', lastActive: 'قبل 20 دقيقة', online: true, bookings: 14, activity: spark(4) },
  { id: 32, name: 'ياسين داوود', email: 'yaseen.dawood@mail.com', phone: '+970 59 100 2032', role: 'freelancer', status: 'review', verified: false, joined: '2026-09-21', lastActive: 'قبل 3 دقائق', online: true, bookings: 0, activity: spark(1) },
];

export const adminSpaces = [
  { id: 1, name: 'مساحة العمل الوسطى', neighborhood: 'غزة - الرمال', owner: 'خالد المصري', price: 15, status: 'active', rating: 4.8, bookings: 312, capacity: 24 },
  { id: 2, name: 'مكتب المبدعين', neighborhood: 'غزة - تل الهوا', owner: 'راني الشوا', price: 20, status: 'suspended', rating: 4.1, bookings: 150, capacity: 12 },
  { id: 3, name: 'قاعة الاجتماعات الذكية', neighborhood: 'غزة - النصر', owner: 'هبة الرنتيسي', price: 45, status: 'pending', rating: 0, bookings: 0, capacity: 16 },
  { id: 4, name: 'استوديو الأناقة', neighborhood: 'غزة - الشاطئ', owner: 'أحمد جودة', price: 30, status: 'active', rating: 4.9, bookings: 421, capacity: 8 },
  { id: 5, name: 'مساحة المهندسين', neighborhood: 'غزة - الزيتون', owner: 'سامي حمدان', price: 12, status: 'active', rating: 4.5, bookings: 267, capacity: 30 },
  { id: 6, name: 'ركن المبرمجين', neighborhood: 'غزة - الجلاء', owner: 'ليان أبو خليل', price: 18, status: 'pending', rating: 0, bookings: 0, capacity: 10 },
  { id: 7, name: 'مركز ريادة الأعمال', neighborhood: 'غزة - النصر', owner: 'ديما الجمل', price: 25, status: 'active', rating: 4.7, bookings: 389, capacity: 40 },
  { id: 8, name: 'رِواء للاستوديوهات', neighborhood: 'غزة - الشجاعية', owner: 'محمود عرفات', price: 22, status: 'active', rating: 4.3, bookings: 205, capacity: 20 },
  { id: 9, name: 'فضاء المبدعين', neighborhood: 'غزة - الرمال', owner: 'نور شعبان', price: 8, status: 'suspended', rating: 3.9, bookings: 88, capacity: 14 },
  { id: 10, name: 'المكتب المستقل', neighborhood: 'غزة - تل الهوا', owner: 'عمر سكيك', price: 35, status: 'pending', rating: 0, bookings: 0, capacity: 6 },
];

export const adminBookings = [
  { id: 201, ref: '#BK-1021', user: 'سارة النجار', space: 'استوديو الأناقة', date: '2026-09-18', time: '09:00 - 13:00', hours: 4, amount: 120, status: 'completed' },
  { id: 202, ref: '#BK-1022', user: 'محمد دويدار', space: 'مساحة المهندسين', date: '2026-09-19', time: '08:00 - 17:00', hours: 9, amount: 108, status: 'confirmed' },
  { id: 203, ref: '#BK-1023', user: 'أحمد العمري', space: 'مركز ريادة الأعمال', date: '2026-09-19', time: '13:00 - 17:00', hours: 4, amount: 100, status: 'confirmed' },
  { id: 204, ref: '#BK-1024', user: 'ديما الجمل', space: 'مساحة العمل الوسطى', date: '2026-09-20', time: '09:00 - 14:00', hours: 5, amount: 75, status: 'disputed' },
  { id: 205, ref: '#BK-1025', user: 'ريم قشطة', space: 'رِواء للاستوديوهات', date: '2026-09-20', time: '16:00 - 19:00', hours: 3, amount: 66, status: 'completed' },
  { id: 206, ref: '#BK-1026', user: 'عمر سكيك', space: 'مكتب المبدعين', date: '2026-09-21', time: '08:00 - 16:00', hours: 8, amount: 160, status: 'confirmed' },
  { id: 207, ref: '#BK-1027', user: 'نور شعبان', space: 'فضاء المبدعين', date: '2026-09-21', time: '10:00 - 12:00', hours: 2, amount: 16, status: 'confirmed' },
  { id: 208, ref: '#BK-1028', user: 'سارة النجار', space: 'مركز ريادة الأعمال', date: '2026-09-22', time: '09:00 - 13:00', hours: 4, amount: 100, status: 'disputed' },
  { id: 209, ref: '#BK-1029', user: 'يوسف بعلوشة', space: 'مساحة المهندسين', date: '2026-09-22', time: '14:00 - 18:00', hours: 4, amount: 48, status: 'completed' },
  { id: 210, ref: '#BK-1030', user: 'أحمد العمري', space: 'استوديو الأناقة', date: '2026-09-23', time: '11:00 - 15:00', hours: 4, amount: 120, status: 'confirmed' },
];

export const adminDisputes = [
  { id: 1, ref: '#DIS-041', bookingRef: '#BK-1024', user: 'ديما الجمل', space: 'مساحة العمل الوسطى', issue: 'الإنترنت كان منقطعاً طوال الحجز، وطلبت استرداد المبلغ.', amount: 75, status: 'open', opened: '2026-09-20' },
  { id: 2, ref: '#DIS-042', bookingRef: '#BK-1028', user: 'سارة النجار', space: 'مركز ريادة الأعمال', issue: 'اختلاف في عدد الساعات المحسوبة مقابل ما تم حجزه.', amount: 100, status: 'open', opened: '2026-09-21' },
  { id: 3, ref: '#DIS-043', bookingRef: '#BK-1005', user: 'محمد دويدار', space: 'ركن المبرمجين', issue: 'المساحة لم تكن جاهزة في الموعد المحدد، وأُجّل الحجز ساعتين.', amount: 90, status: 'resolved', opened: '2026-09-12' },
  { id: 4, ref: '#DIS-044', bookingRef: '#BK-1012', user: 'ليان أبو خليل', space: 'فضاء المبدعين', issue: 'ارتفاع سعر مفاجئ بعد تأكيد الحجز.', amount: 32, status: 'closed', opened: '2026-09-08' },
  { id: 5, ref: '#DIS-045', bookingRef: '#BK-1018', user: 'عمر سكيك', space: 'مكتب المبدعين', issue: 'تلف أحد الأجهزة أثناء الاستخدام وطلب إعادة النظر في الخطأ.', amount: 60, status: 'open', opened: '2026-09-19' },
];

export const adminReviews = [
  { id: 1, user: 'محمد دويدار', space: 'استوديو الأناقة', rating: 5, text: 'أجواء ممتازة وأجهزة قوية، أنصح بها بشدة للمصممين.', date: '2026-09-15', visible: true, flagged: false },
  { id: 2, user: 'سارة النجار', space: 'مساحة المهندسين', rating: 4, text: 'المكان نظيف والعمل فيه مريح، لكن الكراسي تحتاج تجديد.', date: '2026-09-14', visible: true, flagged: false },
  { id: 3, user: 'مجهول', space: 'مكتب المبدعين', rating: 1, text: 'أسوأ تجربة! إدارة فاشلة ومكان غير صحي، لا تتعبوا نفسكم.', date: '2026-09-13', visible: true, flagged: true },
  { id: 4, user: 'ريم قشطة', space: 'رِواء للاستوديوهات', rating: 5, text: 'إضاءة طبيعية رائعة ومناسب للتصوير الفوتوغرافي.', date: '2026-09-11', visible: true, flagged: false },
  { id: 5, user: 'يوسف بعلوشة', space: 'فضاء المبدعين', rating: 2, text: 'صوت مزعج من الشارع ولا توجد عزل، غير مناسب للعمل المكثف.', date: '2026-09-09', visible: true, flagged: true },
  { id: 6, user: 'أحمد العمري', space: 'مركز ريادة الأعمال', rating: 5, text: 'بيئة مثالية لفرق العمل، شبكة قوية وخدمة ممتازة.', date: '2026-09-07', visible: true, flagged: false },
  { id: 7, user: 'نور شعبان', space: 'استوديو الأناقة', rating: 4, text: 'تجربة جيدة عموماً، ينقصها القليل من معدات الصوت.', date: '2026-09-05', visible: true, flagged: false },
  { id: 8, user: 'مجهول', space: 'مساحة العمل الوسطى', rating: 5, text: 'مكان رائع، الإنترنت سريع والقهوة مجانية. سأعود كل أسبوع!', date: '2026-09-03', visible: true, flagged: true },
];

export const adminNotifications = [
  { id: 1, title: 'صيانة مجدولة للنظام', body: 'ستتوقف المنصة يوم الجمعة من 2 إلى 4 صباحاً لصيانة دورية.', target: 'all', sentAt: '2026-09-18 09:00', sentBy: 'admin', opened: 498, total: 1284, channels: ['in_app', 'email'], link: '' },
  { id: 2, title: 'إضافة ميزة حجز جماعي', body: 'أصبح بإمكان مساحات العمل استقبال حجوزات جماعية تصل إلى 20 شخصاً.', target: 'owners', sentAt: '2026-09-15 14:30', sentBy: 'admin', opened: 96, total: 186, channels: ['in_app'], link: '' },
  { id: 3, title: 'تحديث سياسة الاسترداد', body: 'تم تحديث سياسة الاسترداد؛ يمكن طلب الاسترداد خلال 24 ساعة من الحجز.', target: 'all', sentAt: '2026-09-10 11:00', sentBy: 'admin', opened: 702, total: 1284, channels: ['in_app', 'email'], link: '/policies/refund' },
  { id: 4, title: 'ندعوك لورشة عمل مجانية', body: 'ورشة بعنوان "التسويق الرقمي لرواد الأعمال" يوم الخميس القادم.', target: 'renters', sentAt: '2026-09-06 16:45', sentBy: 'admin', opened: 411, total: 1098, channels: ['email'], link: '/events/workshop' },
];

// عدد المستلمين المقدر لكل جمهور (بيانات وهمية — تُستبدل بنقطة نهاية الباك إند لاحقاً).
export const audienceRecipients = {
  all: 1284,
  owners: 186,
  renters: 1098,
};

// تصنيفات إشعارات البريد الوارد التشغيلية + وصف كل فئة.
export const inboxCategoryMeta = {
  dispute: { label: 'نزاع', tone: 'red', cta: 'عرض النزاع', path: '/admin/bookings' },
  space_request: { label: 'طلب مساحة', tone: 'blue', cta: 'مراجعة المساحة', path: '/admin/spaces' },
  report: { label: 'بلاغ', tone: 'violet', cta: 'مراجعة البلاغ', path: '/admin/reviews' },
};

// إشعارات البريد الوارد (مهام تشغيلية تتطلب إجراءً من المشرف).
export const adminInbox = [
  { id: 1, category: 'dispute', title: 'فتح نزاع جديد #DIS-045', body: 'على مساحة "مكتب المبدعين" — الحجز #BK-1018 بقيمة 60 ش.ج.', time: 'منذ ساعتين', read: false },
  { id: 2, category: 'space_request', title: 'طلب مراجعة مساحة جديدة "ركن المبرمجين"', body: 'قدمتها ليان أبو خليل وتبلغ سعتها 10 مقاعد.', time: 'منذ 45 دقيقة', read: false },
  { id: 3, category: 'report', title: 'بلاغ عن مراجعة غير لائقة', body: 'محدد كـ"مخالف" على مساحة "مكتب المبدعين".', time: 'منذ 3 ساعات', read: false },
  { id: 4, category: 'dispute', title: 'نزاع #DIS-041 بانتظار قرارك', body: 'بخصوص مساحة "مساحة العمل الوسطى" بقيمة 75 ش.ج.', time: 'أمس', read: true },
  { id: 5, category: 'space_request', title: 'مساحة جديدة "المكتب المستقل" بانتظار الاعتماد', body: 'قدمها عمر سكيك بسعة 6 مقاعد ومعدل أسبوعي.', time: 'قبل 5 ساعات', read: false },
  { id: 6, category: 'report', title: 'تأكيد إغلاق البلاغ', body: 'تم إغلاق البلاغ على مساحة "فضاء المبدعين" دون إجراء.', time: 'منذ يومين', read: true },
];

export const adminActivities = [
  { id: 1, icon: 'user', text: 'سجّل حساب جديد: نور شعبان (فريلانسر)', time: 'منذ 12 دقيقة' },
  { id: 2, icon: 'space', text: 'تم رفع مساحة جديدة "ركن المبرمجين" بانتظار المراجعة', time: 'منذ 45 دقيقة' },
  { id: 3, icon: 'booking', text: 'تأكيد حجز #BK-1022 من محمد دويدار', time: 'منذ ساعة' },
  { id: 4, icon: 'dispute', text: 'فتح نزاع جديد #DIS-045 على مساحة "مكتب المبدعين"', time: 'منذ ساعتين' },
  { id: 5, icon: 'payment', text: 'تمت تسوية دفعة مالية إلى "استوديو الأناقة" بقيمة 1,260 ش.ج', time: 'منذ 4 ساعات' },
  { id: 6, icon: 'review', text: 'مراجعة جديدة من سارة النجار بخصوص "مساحة المهندسين"', time: 'منذ 6 ساعات' },
];

export const recentRegistrations = [
  { id: 1, name: 'نور شعبان', role: 'freelancer', time: 'منذ 12 دقيقة' },
  { id: 2, name: 'هبة الرنتيسي', role: 'owner', time: 'منذ 35 دقيقة' },
  { id: 3, name: 'عمر سكيك', role: 'freelancer', time: 'منذ ساعة' },
  { id: 4, name: 'ديما الجمل', role: 'freelancer', time: 'منذ 3 ساعات' },
  { id: 5, name: 'محمد دويدار', role: 'freelancer', time: 'منذ 5 ساعات' },
];

export const financialRangeData = {
  today: { revenue: 920, bookings: 34, commission: 92, payouts: 640 },
  week: { revenue: 6120, bookings: 138, commission: 612, payouts: 4090 },
  month: { revenue: 24150, bookings: 517, commission: 2415, payouts: 16420 },
  year: { revenue: 189400, bookings: 3870, commission: 18940, payouts: 128900 },
};

export const commissionBreakdown = [
  { label: 'حجوزات', amount: 24150 },
  { label: 'عمولة المنصة (12%)', amount: 2415 },
  { label: 'مستحقات الملاك', amount: 16420 },
  { label: 'مدفوعات معلقة', amount: 8240 },
];