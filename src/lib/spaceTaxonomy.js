// تصنيف مساحات ثابت (فئات + سِمات + خيارات ترتيب) لصفحة تصفح المساحات.
// وحدة بيانات خالصة: لا تستورد React ولا api.js، حتى تبقى قابلة للاختبار في Node
// مباشرة ودون jsdom. الأيقونات تُخزَّن كنصوص أسماء، والربط بمكوّنات lucide
// يحدث في طبقة الواجهة.

export const CURRENCY = 'ش.ج';

// ----- الفئات -----
// قيَم الفئة ثابتة لأنها ستُحفظ في عمود category في قاعدة البيانات؛ أي تعديل
// على المفاتيح يتطلب ترحيل بيانات (migration + backfill).
export const SPACE_CATEGORIES = {
  lecture: { label: 'قاعة محاضرات', icon: 'Presentation', hint: 'مقاعد ثابتة/projector' },
  meeting: { label: 'قاعة اجتماعات', icon: 'Users', hint: 'طاولة roundtable' },
  training: { label: 'قاعة تدريب', icon: 'GraduationCap', hint: 'ورقية + سبورة' },
  studio: { label: 'استوديو تصوير', icon: 'Camera', hint: 'إضاءة استوديو' },
  coworking: { label: 'مساحة عمل', icon: 'Laptop', hint: 'مساحات عمل فردية' },
  events: { label: 'قاعة مناسبات', icon: 'PartyPopper', hint: 'استقبالات وتجمّعات' },
};

export const CATEGORY_KEYS = Object.keys(SPACE_CATEGORIES);

export function categoryLabel(key) {
  return SPACE_CATEGORIES[key]?.label || '';
}

// ----- السِمات (must match AMENITY_LABELS in requests.js) -----
// أضفنا meta هنا (أيقونة + نص مختصر) لأن صفحة التصفّح تعرضها كبطاقات رموز
// قصيرة، وهو ما لا تحتاجه صفحة الطلبات الخاصة.
export const SPACE_AMENITIES = {
  internet: { label: 'إنترنت', short: 'إنترنت', icon: 'Wifi' },
  electricity: { label: 'كهرباء', short: 'كهرباء', icon: 'Zap' },
  projector: { label: 'بروجكتر', short: 'بروجكتر', icon: 'Projector' },
  ac: { label: 'تكييف', short: 'تكييف', icon: 'Snowflake' },
  microphone: { label: 'ميكروفون', short: 'ميكروفون', icon: 'Mic' },
  whiteboard: { label: 'سبورة', short: 'سبورة', icon: 'Presentation' },
};

export const AMENITY_KEYS = Object.keys(SPACE_AMENITIES);

export function amenityLabel(key) {
  return SPACE_AMENITIES[key]?.label || '';
}

// ----- خيارات الترتيب -----
// needsLocation: يعتمد على إحداثيات المستخدم (متطلّب خط عرض/طول).
export const SORT_OPTIONS = {
  rating_desc: { label: 'الأعلى تقييماً', needsLocation: false },
  distance_asc: { label: 'الأقرب إليك', needsLocation: true },
  price_asc: { label: 'الأرخص أولاً', needsLocation: false },
  price_desc: { label: 'الأعلى سعراً', needsLocation: false },
  capacity_desc: { label: 'الأكبر مساحة', needsLocation: false },
  popularity_desc: { label: 'الأكثر رواجاً', needsLocation: false },
};

export const DEFAULT_SORT = 'rating_desc';

// ----- قيمة افتراضية للفلاتر -----
// لا نضع min/max افتراضيين: السعر الكامل هو الحالة الطبيعية، وأضيق نطاق يجب
// أن يكون اختياراً صريحاً من المستخدم، وإلا اختفت فائدة الفلتر.
export const DEFAULT_FILTERS = {
  q: '',
  sort: DEFAULT_SORT,
  min: null,
  max: null,
  cap: null,
  radius: null,
  amenities: [],
  category: '',
  rating: null,
  open: false,
  instant: false,
  // Tests only: مرجع زمني لتثبيت سلوك «مفتوحة الآن». لا يُقرأ من الرابط أبداً
  // (parseFilters لا ينتجه)، فوجوده هنا لا يلوّث حالة الواجهة.
  now: null,
};

// ----- شرائح سريعة (الطبقة الأولى: ضغطة واحدة بلا فتح لوحة) -----
export const PRICE_PRESETS = [
  { id: 'lt80', label: 'أقل من ٨٠', min: null, max: 80 },
  { id: '80_150', label: '٨٠ – ١٥٠', min: 80, max: 150 },
  { id: 'gt150', label: 'أكثر من ١٥٠', min: 150, max: null },
];

export const CAPACITY_PRESETS = [
  { id: 'cap20', label: 'تتسع ٢٠+', capacity: 20 },
  { id: 'cap50', label: 'تتسع ٥٠+', capacity: 50 },
  { id: 'cap100', label: 'تتسع ١٠٠+', capacity: 100 },
];

export const RATING_TIERS = [
  { id: 'r4', label: '٤٫٠+', rating: 4 },
  { id: 'r45', label: '٤٫٥+', rating: 4.5 },
];

// حدود منزلق السعر — تُستعمل لحساب الحزم (histogram) ولضبط granularity.
export const PRICE_SLIDER = { min: 0, max: 250, step: 5, buckets: 12 };

// حدود منزلق المسافة بالكيلومترات (نطاق غزة عملياً ضمن ٢٥ كم).
export const RADIUS_SLIDER = { min: 1, max: 25, step: 1 };

// سعة أقصى للحجوزات الفورية في العرض (٧٥ دقيقة بحد أقصى افتراضياً).
export const BOOKING_LIMITS = { stepHours: 1, minHours: 1, maxHours: 12 };

// قيمة fallback عند رفض/عدم توفر تحديد الموقع: مركز غزة المدينة.
// (31.5017, 34.4668) — وهي نفس الإحداثيات المعتمدة في owner.js وسائر ملفات
// التطبيق. لا نستخدم 31.9/35.2 لأنها تقع خارج غزة وتضع دبابيس الخريطة في
// المكان الخطأ.
export const DEFAULT_ORIGIN = { lat: 31.5017, lng: 34.4668 };
