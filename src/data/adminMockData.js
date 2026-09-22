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

export const adminUsers = [
  { id: 1, name: 'أحمد العمري', email: 'ahmad.omari@mail.com', phone: '+970 59 100 2001', role: 'freelancer', status: 'active', verified: true, joined: '2025-02-14', bookings: 12 },
  { id: 2, name: 'سارة النجار', email: 'sara.najjar@mail.com', phone: '+970 59 100 2002', role: 'freelancer', status: 'active', verified: true, joined: '2025-03-02', bookings: 34 },
  { id: 3, name: 'خالد المصري', email: 'khaled.masri@mail.com', phone: '+970 59 100 2003', role: 'owner', status: 'active', verified: true, joined: '2024-11-20', bookings: 0 },
  { id: 4, name: 'ليان أبو خليل', email: 'layan.abukhalil@mail.com', phone: '+970 59 100 2004', role: 'freelancer', status: 'suspended', verified: false, joined: '2025-05-11', bookings: 2 },
  { id: 5, name: 'محمد دويدار', email: 'mohammad.dweidar@mail.com', phone: '+970 59 100 2005', role: 'freelancer', status: 'active', verified: true, joined: '2025-01-08', bookings: 41 },
  { id: 6, name: 'نور شعبان', email: 'noor.shaban@mail.com', phone: '+970 59 100 2006', role: 'freelancer', status: 'active', verified: false, joined: '2025-09-01', bookings: 3 },
  { id: 7, name: 'راني الشوا', email: 'rami.shawwa@mail.com', phone: '+970 59 100 2007', role: 'owner', status: 'suspended', verified: true, joined: '2024-08-15', bookings: 0 },
  { id: 8, name: 'ديما الجمل', email: 'dima.jamal@mail.com', phone: '+970 59 100 2008', role: 'freelancer', status: 'active', verified: true, joined: '2025-04-25', bookings: 18 },
  { id: 9, name: 'عمر سكيك', email: 'omar.skaik@mail.com', phone: '+970 59 100 2009', role: 'freelancer', status: 'active', verified: true, joined: '2025-06-17', bookings: 7 },
  { id: 10, name: 'هبة الرنتيسي', email: 'heba.rantisi@mail.com', phone: '+970 59 100 2010', role: 'owner', status: 'active', verified: false, joined: '2025-09-12', bookings: 0 },
  { id: 11, name: 'يوسف بعلوشة', email: 'youssef.baalusha@mail.com', phone: '+970 59 100 2011', role: 'freelancer', status: 'suspended', verified: true, joined: '2024-12-30', bookings: 9 },
  { id: 12, name: 'ريم قشطة', email: 'reem.qashta@mail.com', phone: '+970 59 100 2012', role: 'freelancer', status: 'active', verified: true, joined: '2025-07-03', bookings: 22 },
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
  { id: 1, title: 'صيانة مجدولة للنظام', body: 'ستتوقف المنصة يوم الجمعة من 2 إلى 4 صباحاً لصيانة دورية.', target: 'all', sentAt: '2026-09-18 09:00', sentBy: 'admin' },
  { id: 2, title: 'إضافة ميزة حجز جماعي', body: 'أصبح بإمكان مساحات العمل استقبال حجوزات جماعية تصل إلى 20 شخصاً.', target: 'owners', sentAt: '2026-09-15 14:30', sentBy: 'admin' },
  { id: 3, title: 'تحديث سياسة الاسترداد', body: 'تم تحديث سياسة الاسترداد؛ يمكن طلب الاسترداد خلال 24 ساعة من الحجز.', target: 'all', sentAt: '2026-09-10 11:00', sentBy: 'admin' },
  { id: 4, title: 'ندعوك لورشة عمل مجانية', body: 'ورشة بعنوان "التسويق الرقمي لرواد الأعمال" يوم الخميس القادم.', target: 'freelancers', sentAt: '2026-09-06 16:45', sentBy: 'admin' },
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