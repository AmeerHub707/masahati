// بيانات وهمية لإدارة "مساحاتي" (وحدة F3 من SRS).
// جاهزة للاستبدال لاحقاً بـ Laravel REST API — كل مصفوفة تقابل ressource واحدة.
// العملة: ش.ج (شيكل) بنفس اصطلاح لوحة المستخدم.

export const CURRENCY = 'ش.ج';

export const overviewMetrics = {
  totalUsers: 12480,
  spaceOwners: 312,
  registeredSpaces: 486,
  monthlyBookings: 2387,
  totalRevenue: 86450,
  openDisputes: 17,
};

export const users = [
  { id: 1, name: 'آية الشريف', email: 'aya.sharef@example.com', phone: '+970 59 123 4001', role: 'student', status: 'active', verified: true, joinedAt: '2024-03-12', bookingsCount: 34, city: 'غزة' },
  { id: 2, name: 'محمود أبو صالح', email: 'mahmoud.saleh@example.com', phone: '+970 59 123 4002', role: 'freelancer', status: 'active', verified: true, joinedAt: '2024-01-08', bookingsCount: 61, city: 'غزة' },
  { id: 3, name: 'سارة النجار', email: 'sara.najjar@example.com', phone: '+970 59 123 4003', role: 'owner', status: 'active', verified: true, joinedAt: '2023-09-21', bookingsCount: 0, city: 'رفح', spaces: 3 },
  { id: 4, name: 'خليل حمادة', email: 'khaleel@example.com', phone: '+970 59 123 4004', role: 'student', status: 'suspended', verified: false, joinedAt: '2024-11-02', bookingsCount: 2, city: 'دير البلح' },
  { id: 5, name: 'رنا المصري', email: 'rana.masri@example.com', phone: '+970 59 123 4005', role: 'freelancer', status: 'active', verified: true, joinedAt: '2024-06-17', bookingsCount: 48, city: 'غزة' },
  { id: 6, name: 'عمر القانوع', email: 'omar@example.com', phone: '+970 59 123 4006', role: 'owner', status: 'active', verified: false, joinedAt: '2025-01-05', bookingsCount: 0, city: 'خان يونس', spaces: 1 },
  { id: 7, name: 'نور الداية', email: 'nour@example.com', phone: '+970 59 123 4007', role: 'student', status: 'active', verified: true, joinedAt: '2025-02-19', bookingsCount: 11, city: 'غزة' },
  { id: 8, name: 'إياد رضوان', email: 'eyad@example.com', phone: '+970 59 123 4008', role: 'freelancer', status: 'suspended', verified: true, joinedAt: '2024-04-11', bookingsCount: 9, city: 'جباليا' },
  { id: 9, name: 'ليان أبو هدير', email: 'layan@example.com', phone: '+970 59 123 4009', role: 'owner', status: 'active', verified: true, joinedAt: '2023-11-30', bookingsCount: 0, city: 'غزة', spaces: 2 },
  { id: 10, name: 'يوسف بشير', email: 'yousef@example.com', phone: '+970 59 123 4010', role: 'student', status: 'pending', verified: false, joinedAt: '2026-09-14', bookingsCount: 0, city: 'رفح' },
  { id: 11, name: 'هبة الفرا', email: 'heba@example.com', phone: '+970 59 123 4011', role: 'freelancer', status: 'active', verified: true, joinedAt: '2024-08-03', bookingsCount: 27, city: 'غزة' },
  { id: 12, name: 'خالد الصفدي', email: 'khaled@example.com', phone: '+970 59 123 4012', role: 'owner', status: 'active', verified: true, joinedAt: '2023-05-14', bookingsCount: 0, city: 'خان يونس', spaces: 4 },
];

export const spaces = [
  { id: 1, title: 'فكرة — مساحة عمل مشتركة', owner: 'سارة النجار', location: 'غزة — الرمال', price: 12, status: 'active', rating: 4.7, bookings: 420, capacity: 40, image: null },
  { id: 2, title: 'قاعة الإبداع للاجتماعات', owner: 'ليان أبو هدير', location: 'غزة — النصر', price: 45, status: 'active', rating: 4.5, bookings: 189, capacity: 14, image: null },
  { id: 3, title: 'استوديو ظل — تصوير ومونتاج', owner: 'خالد الصفدي', location: 'خان يونس', price: 30, status: 'pending', rating: 0, bookings: 0, capacity: 8, image: null },
  { id: 4, title: 'مختبر البرمجة والتطوير', owner: 'عمر القانوع', location: 'خان يونس — الأمل', price: 15, status: 'pending', rating: 0, bookings: 0, capacity: 25, image: null },
  { id: 5, title: 'صالة المبدعين', owner: 'سارة النجار', location: 'رفح', price: 10, status: 'suspended', rating: 4.1, bookings: 95, capacity: 30, image: null },
  { id: 6, title: 'بَيت العمل — مكتب خاص', owner: 'محمد النبيه', location: 'غزة — التفاح', price: 20, status: 'active', rating: 4.9, bookings: 301, capacity: 6, image: null },
  { id: 7, title: 'منصة الخريجين التدريبية', owner: 'ليان أبو هدير', location: 'غزة — الشاطئ', price: 8, status: 'pending', rating: 0, bookings: 0, capacity: 50, image: null },
  { id: 8, title: 'رواق القرنفل — قاعة نور', owner: 'خالد الصفدي', location: 'جباليا', price: 35, status: 'active', rating: 4.4, bookings: 150, capacity: 18, image: null },
];

export const bookings = [
  { id: 9101, user: 'آية الشريف', space: 'فكرة — مساحة عمل مشتركة', date: '2026-09-18', time: '10:00', hours: 4, amount: 48, status: 'confirmed' },
  { id: 9102, user: 'محمود أبو صالح', space: 'بَيت العمل — مكتب خاص', date: '2026-09-17', time: '13:00', hours: 3, amount: 60, status: 'completed' },
  { id: 9103, user: 'رنا المصري', space: 'قاعة الإبداع للاجتماعات', date: '2026-09-16', time: '09:00', hours: 2, amount: 90, status: 'completed' },
  { id: 9104, user: 'نور الداية', space: 'فكرة — مساحة عمل مشتركة', date: '2026-09-15', time: '15:00', hours: 5, amount: 60, status: 'disputed' },
  { id: 9105, user: 'هبة الفرا', space: 'رواق القرنفل — قاعة نور', date: '2026-09-14', time: '11:00', hours: 3, amount: 105, status: 'completed' },
  { id: 9106, user: 'خليل حمادة', space: 'صالة المبدعين', date: '2026-09-12', time: '16:00', hours: 1, amount: 10, status: 'cancelled' },
  { id: 9107, user: 'يوسف بشير', space: 'مختبر البرمجة والتطوير', date: '2026-09-20', time: '08:00', hours: 6, amount: 90, status: 'confirmed' },
  { id: 9108, user: 'إياد رضوان', space: 'فكرة — مساحة عمل مشتركة', date: '2026-09-11', time: '17:00', hours: 2, amount: 24, status: 'disputed' },
  { id: 9109, user: 'نور الداية', space: 'بَيت العمل — مكتب خاص', date: '2026-09-21', time: '10:00', hours: 2, amount: 40, status: 'confirmed' },
];

export const disputes = [
  { id: 501, bookingId: 9104, user: 'نور الداية', space: 'فكرة — مساحة عمل مشتركة', amount: 60, reason: 'توقف الإنترنت أكثر من ساعة أثناء الحجز وتم رفض طلب الاسترداد.', status: 'open', date: '2026-09-16' },
  { id: 502, bookingId: 9108, user: 'إياد رضوان', space: 'فكرة — مساحة عمل مشتركة', amount: 24, reason: 'المساحة كانت غير نظيفة عند الوصول ولم تتوفر الكهرباء.', status: 'open', date: '2026-09-12' },
  { id: 503, bookingId: 8985, user: 'هبة الفرا', space: 'قاعة الإبداع للاجتماعات', amount: 90, reason: 'تم حجز القاعة لكنها لم تكن متاحة لاجتماع عاجل.', status: 'refunded', date: '2026-09-05' },
];

export const reviews = [
  { id: 1, space: 'فكرة — مساحة عمل مشتركة', user: 'آية الشريف', rating: 5, comment: 'مكان رايق وإضاءة ممتازة والإنترنت ثابت، أنصح به.', date: '2026-09-15', status: 'visible' },
  { id: 2, space: 'قاعة الإبداع للاجتماعات', user: 'خليل حمادة', rating: 1, comment: 'سيئ جداً ولا أستحق ما دفعته، سمعت ضجيجاً طوال الوقت.', date: '2026-09-10', status: 'visible' },
  { id: 3, space: 'بَيت العمل — مكتب خاص', user: 'محمود أبو صالح', rating: 5, comment: 'خصوصية كاملة وهدوء تام، أفضل مكتب في غزة.', date: '2026-09-08', status: 'visible' },
  { id: 4, space: 'رواق القرنفل — قاعة نور', user: 'رنا المصري', rating: 4, comment: 'قاعة مرتبة والتجهيزات جيدة، يلزمها تكييف أقوى.', date: '2026-08-29', status: 'visible' },
  { id: 5, space: 'صالة المبدعين', user: 'إياد رضوان', rating: 2, comment: 'هذا المكان نصاب ولا يستحق نجمة واحدة.!!!', date: '2026-08-20', status: 'visible' },
  { id: 6, space: 'فكرة — مساحة عمل مشتركة', user: 'هبة الفرا', rating: 4, comment: 'تجربة جيدة بشكل عام، الرد على الاستقبال كان لطيفاً.', date: '2026-08-11', status: 'hidden' },
];

export const financials = {
  today: { revenue: 1240, commission: 186, payouts: 1054, bookings: 41 },
  week: { revenue: 9360, commission: 1404, payouts: 7956, bookings: 312 },
  month: { revenue: 86450, commission: 12968, payouts: 73482, bookings: 2387 },
  year: { revenue: 721300, commission: 108195, payouts: 613105, bookings: 21450 },
};

export const revenueTrend = [
  { label: 'يناير', value: 62 },
  { label: 'فبراير', value: 70 },
  { label: 'مارس', value: 58 },
  { label: 'أبريل', value: 82 },
  { label: 'مايو', value: 74 },
  { label: 'يونيو', value: 90 },
  { label: 'يوليو', value: 96 },
  { label: 'أغسطس', value: 100 },
];

export const bookingTrend = [
  { label: 'السبت', value: 55 },
  { label: 'الأحد', value: 72 },
  { label: 'الاثنين', value: 90 },
  { label: 'الثلاثاء', value: 68 },
  { label: 'الأربعاء', value: 80 },
  { label: 'الخميس', value: 61 },
  { label: 'الجمعة', value: 44 },
];

export const activities = [
  { id: 1, kind: 'booking', text: 'حجز جديد لمساحة "فكرة" من العضو آية الشريف', time: 'منذ 5 دقائق' },
  { id: 2, kind: 'space', text: 'قدّم عمر القانوع مساحة "مختبر البرمجة" للمراجعة', time: 'منذ 22 دقيقة' },
  { id: 3, kind: 'dispute', text: 'فتح نزاع جديد على حجز رقم 9104', time: 'منذ ساعة' },
  { id: 4, kind: 'user', text: 'انضم العضو الجديد يوسف بشير إلى المنصة', time: 'منذ ساعتين' },
  { id: 5, kind: 'payout', text: 'تم تحويل مستحقات 14 مالكاً لهذا الأسبوع', time: 'منذ 4 ساعات' },
  { id: 6, kind: 'review', text: 'إخفاء تقييم مسيء على "صالة المبدعين"', time: 'منذ 6 ساعات' },
];

export const recentRegistrations = [
  { id: 100, name: 'يوسف بشير', role: 'student', joinedAt: '2026-09-14' },
  { id: 99, name: 'منى حسن', role: 'freelancer', joinedAt: '2026-09-13' },
  { id: 98, name: 'طارق النمس', role: 'owner', joinedAt: '2026-09-12' },
  { id: 97, name: 'جنى العمصي', role: 'student', joinedAt: '2026-09-10' },
  { id: 96, name: 'بسام سكيك', role: 'student', joinedAt: '2026-09-08' },
];

export const sentNotifications = [
  { id: 1, audience: 'all', title: 'عرض خاص بداية الموسم', message: 'خصم 20٪ على جميع المساحات لهذا الأسبوع، سارعوا بالحجز.', sentAt: '2026-09-12 10:30' },
  { id: 2, audience: 'owners', title: 'تحديث إجراءات المراجعة', message: 'أصبحت المراجعة أسرع، أرسلوا صور المساحة بوضوح.', sentAt: '2026-09-08 14:15' },
  { id: 3, audience: 'all', title: 'صيانة مجدولة', message: 'ستتوقف المنصة مساء الجمعة لصيانة مجدولة لمدة ساعتين.', sentAt: '2026-09-03 09:00' },
];

export const adminProfile = {
  name: 'أحمد مصطفى',
  email: 'admin@masahaty.ps',
  role: 'مدير المنصة',
  supportEmail: 'support@masahaty.ps',
  mailer: 'SMTP',
  mailerHost: 'smtp.masahaty.ps',
  mailerPort: '587',
  mailerUsername: 'noreply@masahaty.ps',
  mailerEncryption: 'TLS',
};

// وسوم وترجمات للأدوار والحالات — مشتركة بين كل التبويبات.
export const ROLE_LABELS = {
  student: 'طالب',
  freelancer: 'فريلانسر',
  owner: 'مالك مساحة',
};

export const STATUS_LABELS = {
  active: 'نشط',
  suspended: 'موقوف',
  pending: 'قيد المراجعة',
};

export const SPACE_STATUS_LABELS = {
  active: 'مفعّلة',
  suspended: 'موقوفة',
  pending: 'قيد المراجعة',
  closed: 'مقفلة',
};

export const BOOKING_STATUS_LABELS = {
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  disputed: 'متنازع عليه',
  cancelled: 'ملغى',
};