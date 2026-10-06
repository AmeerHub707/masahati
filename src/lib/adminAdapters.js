/**
 * محوّلات ردود `/api/admin` إلى أسماء الحقول التي تتوقّعها الشاشات.
 *
 * لماذا هذا الملف:
 *   العقد يسمّي بعض الحقول أسماء تختلف عمّا تتوقّعه اللوحة. مثل `/api/admin/bookings`
 *   يرسل `customer` و`price` و`time_from`/`time_to`، بينما جدول الحجوزات يقرأ
 *   `user` و`amount` و`time`. والنتيجة كانت خلايا فارغة: القيمة موجودة في الردّ
 *   لكن باسم لا يطابق.
 *
 *   وقبل هذا الملف كانت الاختبارات تخفي الخلل: `adminFixtures.mjs` كانت تبني
 *   الردود بأسماء الواجهة لا بأسماء العقد، فكان كل شيء أخضر بينما الشاشة فارغة
 *   على خادم حقيقي.
 *
 * القاعدة الحاكمة:
 *   1. اسم الواجهة هو الأولوية الأولى في كل حقل. فإن كان الردّ يحمله نمرّره كما هو،
 *      فلا يتغيّر سلوك أي شاشة ولا اختبار.
 *   2. ثم نجرب أسماء العقد الموثّقة، ثم مرادفات شائعة.
 *   3. ولا نخترع قيمة: الغائب يبقى غائباً (`null` أو `''`) إلا إن كان الغياب يعني
 *      نقصاً في لقطة العرض (اسم مساحة، وقت نسبي) — وعندها نولّد نصاً وصفياً من رقم
 *      السجل نفسه لا من محتواه.
 *
 * كل محوّل دالّة خالصة بلا شبكة ولا حالة، فيُختبر مستقلاً عن React.
 */

/* ------------------------------------------------------------------ */
/* أدوات صغيرة مشتركة                                                 */
/* ------------------------------------------------------------------ */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** أول قيمة غير فارغة من قائمة مفاتيح — `null` و`undefined` و`''` غائبة. */
function pick(source, keys, fallback = undefined) {
  if (!isObject(source)) return fallback;
  for (const key of keys) {
    const v = source[key];
    if (v === null || v === undefined || v === '') continue;
    return v;
  }
  return fallback;
}

/** رقم، أو `fallback` إن لم يكن رقماً صالحاً. */
function num(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** رقم أو `null` — للمبالغ التي نفضّل غيابها على صفر مختلق. */
export function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** نصّ مقصوص، أو `fallback` إن كان غائباً أو فارغاً. */
function str(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const s = typeof value === 'string' ? value.trim() : String(value);
  return s === '' ? fallback : s;
}

/**
 * منطقي متسامح: الحقول قد تأتي `0/1` أو `"true"` أو `null`.
 * `fallback` هو الحدس الوحيد المسموح به — وبخاصة `visible` (انظر adaptReview).
 */
function bool(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return fallback;
}

/**
 * اسم من قيمة قد تكون نصاً أو كائناً (مالك، مساحة، مستخدم داخل حجز).
 * يقبل `owner` و`customer` و`space` نصاً أو `{ name }` أو `{ email }`.
 */
function label(value, keys = ['name', 'title', 'label', 'email', 'full_name']) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (isObject(value)) {
    const inner = pick(value, keys);
    return inner === undefined || inner === null ? '' : String(inner).trim();
  }
  return '';
}

/**
 * اسم آمن للقيم التي قد تصل نصاً أو كائناً: `label` للكائن و`str` للنص.
 *
 * لماذا لا `str` وحدها: `String({ name: 'سارة' })` تعطي `[object Object]`
 * فترث خلية المالك ذلك النصّ بدل اسمها. ولهذا كل حقل قد يكون كائناً يمرّ من هنا.
 */
function nameOf(value, keys) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') return label(value, keys);
  return str(value);
}

/** رابط صورة قد يكون نصاً أو مصفوفة أو كائناً؛ يُرجع نصاً أو `''`. */
function imageOf(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = imageOf(entry);
      if (url) return url;
    }
    return '';
  }
  if (isObject(value)) return imageOf(pick(value, ['url', 'path', 'src', 'image', 'original']));
  return '';
}

/** يطبّق محوّلاً على قائمة، ويتحمّل رداً ليس مصفوفة. */
export function adaptAll(rows, adapter) {
  return Array.isArray(rows) ? rows.map(adapter) : [];
}

/* ------------------------------------------------------------------ */
/* المستخدمون (§3)                                                    */
/* ------------------------------------------------------------------ */

/**
 * `/api/admin/users` — العقد لا يذكر `phone` في قائمة المستخدمين (يذكره في
 * تفاصيل المستخدم فقط). فنضع بديلاً من `whatsapp`/`mobile` حتى لا يخرج التصدير
 * بعمود فارغ ولا يفشل البحث بالرقم.
 *
 * `role` لا يُخمَّن عمداً: حساب بلا دور يبقى `null` ويُعرض له شرطة، لأن اختراع
 * دور يجعله يدخل عدّاد فريق لا ينتمي إليه.
 */
/**
 * إملاء دور مالك المساحة في ردّ `/api/admin/users`: `space_owner` هو ما يرسله
 * اليوم، و`owner` ما كان يرسله سابقاً (عقد §1.1) — دور واحد بإملاءين.
 *
 * **مصدر واحد للقيمة.** كان هذا الجدول مكتوباً مرّتين: هنا، ومصدَّراً من
 * `AdminUsers` باسم `isOwnerRole`. وإملاءٌ يُضاف في أحدهما ينسى الآخر — وهو
 * بعينه ما تفرّقت بسببه جداول `roleLabel`/`roleTone`/`ROLE_AR` أصلاً. تقرأ
 * `AdminUsers` هذه الدالة بدل نسخها.
 */
export const OWNER_ROLES = ['owner', 'space_owner'];

/** هل القيمة دور مالك مساحة بأحد إملائيه؟ (نفسها تستهلكها لوحة الأدمن) */
export function isOwnerRoleValue(role) {
  const key = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return OWNER_ROLES.includes(key);
}

/**
 * تسميات مستندات التحقق. `kind` هو ما تُبنى عليه البطاقة، والتسمية من
 * الواجهة لا من ردّ الخادم: الخادم يرسل مفتاحاً إنجليزياً، والأدمن يقرأ
 * تسمية عربية.
 */
const DOC_LABELS = {
  property_deed: 'وثيقة الملكية',
  business_license: 'السجل التجاري',
  identity: 'وثيقة الهوية',
  other: 'مستند',
};

/**
 * يطبّع نوع المستند إلى `kind` واحد، والتطبيق متسّع عمداً: أي مفتاح فيه
 * `deed`/`property`/`ownership` فهو وثيقة ملكية، وفيه
 * `license`/`commercial`/`register` فهو سجل تجاري. والسبب أن الخادم لم
 * يوثّق هذا الحقل،فتضييقه الآن يعني إسقاط مستندٍ قائم من على الأدمن.
 * وما لا يُعرف يعبر `other` ولا يُرمى: مستندٌ بلا تسمية أوضح من مستندٍ مخفيّ.
 */
function docKind(value) {
  const key = str(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return 'other';
  if (/deed|property|ownership|تملك|ملك/.test(key)) return 'property_deed';
  if (/licen[cs]e|commercial|register|تجاري/.test(key)) return 'business_license';
  if (/identity|id_card|هوية/.test(key)) return 'identity';
  return 'other';
}

/**
 * مستندات التحقق لمالك المساحة (وثيقة الملكية، السجل التجاري…).
 *
 * الحقل غير مذكور في عقد `/api/admin/users`، فنقرأ الأشكال الشائعة معاً
 * بدل افتراض واحد: مصفوفة `documents`/`verification_documents` (كائنات أو
 * روابط نصية)، وحقولاً مفردة. والحقول المفردة تُقرأ **حتى مع وجود
 * المصفوفة**: خادمٌ قد يرسل نوعاً في مصفوفة وآخر حقلاً مفرداً (تسجيل أقدم
 * مثلاً)، وتجاهل الثاني يعني إخفاء وثيقة عن الأدمن.
 *
 * الرابط يبقى كما أرسله الخادم (نسبياً كان): تحويله إلى رابط كامل يحتاج
 * `BASE_URL` من `api.js`، وهذا الملف دواله خالصة بلا شبكة ولا حالة، فالتILY
 * التحويل يقع عند العرض في المكوّن.
 */
function adaptUserDocuments(raw) {
  const out = [];
  const push = (kind, url, name, uploadedAt) => {
    const href = str(url);
    if (!href) return;
    out.push({
      kind,
      label: DOC_LABELS[kind] || DOC_LABELS.other,
      url: href,
      name: str(name),
      uploadedAt: str(uploadedAt),
    });
  };

  const list = pick(raw, ['documents', 'verification_documents', 'proof_documents']);
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'string') {
        push(docKind(''), item, '', '');
      } else if (isObject(item)) {
        push(
          docKind(pick(item, ['kind', 'type', 'key', 'label', 'name'])),
          pick(item, ['url', 'path', 'file', 'src']),
          pick(item, ['name', 'file_name', 'filename', 'original_name']),
          pick(item, ['uploaded_at', 'uploadedAt', 'created_at']),
        );
      }
    }
  }

  // `proof_document` هو ما ترسله صفحة التسجيل («إثبات ملكية/إدارة مساحة:
  // سند ملكية / عقد إيجار / ترخيص») فنصنّفه وثيقة ملكية، ويظهر اسم الملف
  // الأصلي تحتها فيعرف الأدمن أيّها بالضبط.
  push(
    'property_deed',
    pick(raw, ['property_deed', 'property_deed_url', 'property_deed_path', 'deed', 'deed_url', 'proof_document', 'proof_document_url']),
    pick(raw, ['property_deed_name', 'proof_document_name', 'document_name']),
    pick(raw, ['property_deed_uploaded_at', 'proof_document_uploaded_at']),
  );
  push(
    'business_license',
    pick(raw, ['business_license', 'business_license_url', 'business_license_path', 'license', 'license_url', 'commercial_register', 'commercial_register_url']),
    pick(raw, ['business_license_name', 'license_name']),
    pick(raw, ['business_license_uploaded_at', 'license_uploaded_at']),
  );
  push('identity', pick(raw, ['identity_document', 'identity_document_url', 'id_card', 'id_card_url']), pick(raw, ['identity_document_name']), pick(raw, ['identity_document_uploaded_at']));

  // نفس الرابط قد يمرّ من حقلين (مصفوفة + مفرد): نُبقي الأول فقط.
  const seen = new Set();
  return out.filter((d) => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

/**
 * مستندات المساحة — القارئ نفسه ومصدرٌ إضافي.
 *
 * العقد لا يذكر مستنداتٍ للمساحة في أيٍّ من مساريها: §6.1 (القائمة) يردّ
 * `owner` نصاً، و§6.2 (التفصيل) يردّه كائناً. ووثائق التحقق يرفعها المالك عن
 * نفسه لا عن المساحة، فأكثر ما يُرجَّح أن تصل مع كائن المالك في التفصيل.
 *
 * فنقرأ المساحة أولاً ثم كائن المالك، وندمجهما بلا تكرار: قد يجيء كلٌّ منهما
 * بنصف ما يبحث عنه الأدمن، واجتماعهما أتمّ من كلٍّ وحده. و`owner` النصي في
 * القائمة يُتجاهل بصمت لا بخطأ: لا كائن مالك تعني لا مستندات مالك.
 */
export function adaptSpaceDocuments(raw) {
  const own = adaptUserDocuments(raw);
  const owner = isObject(raw?.owner) ? adaptUserDocuments(raw.owner) : [];
  if (!owner.length) return own;
  const seen = new Set(own.map((d) => d.url));
  return [...own, ...owner.filter((d) => !seen.has(d.url))];
}
/**
 * المفردات الثلاث المعتمدة لحالة الحساب، بعد حذف `review`:
 *   `pending` — بانتظار التفعيل، وهو ما يصل به مالك مساحة جديد.
 *   `active`  — اعتُمد توثيقه، فأصبح ملّاك مساحة ينشر.
 *   `suspended`— قرار إداري (نزاع أو إيقاف)، قابل للطعن وإعادة التفعيل.
 *
 * `USER_STATUSES` هو المصدر: تبني عليه `statusMeta` في `AdminUsers` بادج
 * الجدول، وتبني عليه `normalizeUserStatus` هنا، فلا تنحرف المفردات بين
 * ما يراه الأدمن وما يُقرَّر في العرض.
 */
export const USER_STATUSES = ['pending', 'active', 'suspended'];

/** القيمة القديمة المحذوفة، وتُقرأ `pending` لا «حالة غير معروفة». */
const LEGACY_REVIEW_STATUS = 'review';

/**
 * حالة الحساب كما تُعرض، لا كما وصلت حرفاً بحرف.
 *
 * الغرض منها واحد: ألّا يقف حسابٌ قديم خارج كل شاشة. حسابٌ حالته `review`
 * في قاعدة بيانات لم تُرقَّ بعد هو حسابٌ **بانتظار قرار**، لا حساب مجهول؛
 * فترجمناه إلى `pending` عوض «حالة غير معروفة» التي لا يدخلها تبويبُ
 * «بانتظار التفعيل» ولا يجدها الأدمن بالبحث.
 *
 * والغياب يُعالَج حسب الدور: مالك المساحة الغائب حالته `pending` (فرض
 * مغلق)، وغير المالك `active`. انظر الشرح الكامل عند `adaptUser`.
 *
 * @param {*} value  الحالة الخام من الخادم.
 * @param {string} role  الدور الخام لنفس الحساب.
 * @returns {string} إحدى `USER_STATUSES`.
 */
function normalizeUserStatus(value, role) {
  const key = str(value).trim().toLowerCase();
  if (key === LEGACY_REVIEW_STATUS) return 'pending';
  if (USER_STATUSES.includes(key)) return key;
  return isOwnerRoleValue(role) ? 'pending' : 'active';
}

export function adaptUser(raw) {
  const role = str(pick(raw, ['role'])).toLowerCase();
  return {
    ...raw,
    id: pick(raw, ['id']),
    name: str(pick(raw, ['name', 'full_name', 'display_name'])),
    email: str(pick(raw, ['email'])),
    phone: str(pick(raw, ['phone', 'whatsapp', 'mobile', 'phone_number'])),
    role: role || null,
    /**
     * حالة الحساب، وهي أهم سطر في هذا المحوّل. تمرّ بثلاث خطوات:
     *
     * 1. **الحالة القديمة `review` تُقرأ `pending`.** حُذفت من مفردات
     *    اللوحة، لكن سجلات قديمة في القاعدة ما زالت تحملها. ولو تركناها
     *    لوقفت في «حالة غير معروفة» (انظر UNKNOWN_STATUS) — خارج تبويب
     *    «بانتظار التفعيل»، فلا يراها الأدمن ولا يعتمدها أحد، فيبقى حسابٌ
     *    ينتظر قراراً لا يستطيع أحد أخذه. فهي الآن تعود إلى الطابور الذي
     *    يعرضه، على أنها ما تعنيه أصلاً: انتظار قرار.
     * 2. **الغياب يُعامل حسب الدور.** ردٌّ لا يحمل `status` لا يعني حساباً
     *    نشطاً. لمالك المساحة نعتبره `pending` لا `active`، لأن الحساب
     *    الجديد يصل بلا حالة لثوانٍ، والافتراض الحالم كان يخرجه من عدّ
     *    الطابور ويُخفيه عن تبويب «بانتظار التفعيل» ويصبغه أخضر، كل ذلك بلا
     *    مراجعة إنسان واحدة. و«قيد الانتظار» خطأ يُعيده إلى طابور قرار بشري،
     *    والافتراض الخاطئ قرارٌ بُني على لا شيء.
     * 3. **لغير الملاك نبقي `active`:** حساب العميل لا يُفتح ولا يُقفل،
     *    والافتراض الحالم فيه لا يُخرج شيئاً من طابور قرار.
     *
     * ملاحظة: هذا تحقّق في العرض لا في القاعدة. المصدر للحقيقة هو الباك
     * إند، ولا نكتب حالة من هنا.
     */
    status: normalizeUserStatus(pick(raw, ['status']), role),
    verified: bool(pick(raw, ['verified', 'is_verified', 'verified_at'])),
    joined: str(pick(raw, ['joined', 'joined_at', 'created_at'])),
    lastActive: str(pick(raw, ['lastActive', 'last_active', 'last_seen', 'last_activity_at'])),
    online: bool(pick(raw, ['online', 'is_online'])),
    bookings: num(pick(raw, ['bookings', 'bookings_count', 'total_bookings'])),
    activity: Array.isArray(raw?.activity) ? raw.activity : [],
    spaces: Array.isArray(raw?.spaces) ? raw.spaces.map(adaptSpaceRef) : [],
    documents: adaptUserDocuments(raw),
  };
}

/** مساحة داخل `user.spaces` — انظر adaptSpace عن ولادة الاسم. */
function adaptSpaceRef(raw) {
  if (!isObject(raw)) return raw;
  const id = pick(raw, ['id']);
  return {
    ...raw,
    id,
    name: str(pick(raw, ['name', 'title']), id === undefined ? '' : `مساحة #${id}`),
    status: str(pick(raw, ['status'])),
  };
}

/* ------------------------------------------------------------------ */
/* المساحات (§4)                                                      */
/* ------------------------------------------------------------------ */

/**
 * `/api/admin/spaces` — العقد ينبّه أن `name` غير موجود في قاعدة البيانات
 * ويرجع `null` دائماً (TODO في الباك إند).
 *
 * لا نترك الحقل فارغاً: الخلية الفارغة تُظهر بطاقة بلا عنوان، وتجعل البحث
 * بالاسم يطابق لا شيء، وتجعل نموذج التعديل يفشل على تحقق «الاسم مطلوب»
 * لأن الحقل بدأ فارغاً. فنولّد اسماً وصفياً من رقم السجل — نصّ يقول «لا اسم»
 * فعلاً بدل صمت، ويبقى قابلاً للبحث.
 */
export function adaptSpace(raw) {
  const id = pick(raw, ['id']);
  return {
    ...raw,
    id,
    name: str(pick(raw, ['name', 'title', 'space_name']), id === undefined ? '' : `مساحة #${id}`),
    neighborhood: str(pick(raw, ['neighborhood', 'area', 'location', 'district'])),
    owner: nameOf(pick(raw, ['owner', 'owner_name'])),
    price: num(pick(raw, ['price', 'hourly_price', 'rate'])),
    status: str(pick(raw, ['status']), 'pending'),
    rating: num(pick(raw, ['rating', 'average_rating', 'stars'])),
    bookings: num(pick(raw, ['bookings', 'bookings_count', 'total_bookings'])),
    capacity: num(pick(raw, ['capacity', 'seats', 'max_capacity'])),
    image: imageOf(pick(raw, ['image', 'cover', 'cover_image', 'photo', 'photos'])),
    documents: adaptSpaceDocuments(raw),
  };
}

/* ------------------------------------------------------------------ */
/* الحجوزات (§5)                                                      */
/* ------------------------------------------------------------------ */

/**
 * `/api/admin/bookings` — العقد يسمّي المستأجر `customer` والمبلغ `price` والوقت
 * حقلين منفصلين `time_from`/`time_to`، والجدول يقرأ `user` و`amount` و`time`.
 */
export function adaptBooking(raw) {
  const booking = isObject(raw?.booking) ? raw.booking : {};
  const from = str(pick(raw, ['time_from', 'from', 'start_time', 'start']));
  const to = str(pick(raw, ['time_to', 'to', 'end_time', 'end']));
  const id = pick(raw, ['id']);

  return {
    ...raw,
    id,
    // المرجع مفتاح الحجز في العقد (§5)، ويأتي أحياناً مسبوقاً بـ `#`.
    ref: str(pick(raw, ['ref', 'reference', 'code', 'booking_ref'])),
    user: nameOf(pick(raw, ['user', 'customer', 'customer_name', 'client', 'booked_by', 'user_name']))
      || nameOf(booking.customer),
    space: nameOf(pick(raw, ['space', 'space_name', 'venue'])) || nameOf(booking.space),
    date: str(pick(raw, ['date', 'booking_date', 'day'])),
    // وقت واحد للعرض: إما جاهز من الخادم، أو مدمج من طرفَي المدى.
    time: str(pick(raw, ['time', 'time_range', 'slot'])) || (from && to ? `${from} - ${to}` : from || to),
    hours: num(pick(raw, ['hours', 'duration', 'duration_hours', 'hours_count'])),
    amount: num(pick(raw, ['amount', 'price', 'total', 'total_amount', 'amount_paid'])),
    status: str(pick(raw, ['status']), 'confirmed'),
  };
}

/* ------------------------------------------------------------------ */
/* النزاعات (§7)                                                      */
/* ------------------------------------------------------------------ */

/**
 * `/api/admin/disputes` — العقد يسمّي صاحب النزاع `customer` وسببه `reason`
 * ويحطّ الحجز في كائن `booking`، والبطاقة تقرأ `user` و`issue` و`bookingRef`
 * و`space` و`amount` في المستوى الأعلى.
 */
export function adaptDispute(raw) {
  const booking = isObject(raw?.booking) ? raw.booking : {};

  return {
    ...raw,
    ref: str(pick(raw, ['ref', 'reference', 'code', 'dispute_ref'])),
    // مرجع الحجز: قد يكون مدمجاً في ردّ القائمة، أو داخل كائن الحجز.
    bookingRef: str(
      pick(raw, ['bookingRef', 'booking_ref', 'booking_code'])
      || label(booking, ['ref', 'reference', 'code']),
    ),
    user: nameOf(pick(raw, ['user', 'customer', 'customer_name', 'reporter', 'opened_by']))
      || nameOf(raw?.customer)
      || nameOf(booking.customer),
    space: nameOf(pick(raw, ['space', 'space_name', 'venue'])) || nameOf(booking.space),
    // صفر لا null: زر «استرداد المبلغ» يرسل `refund_amount` إجبارياً، فإرساله
    // null كان رفضاً من الخادم.
    amount: num(
      pick(raw, ['amount', 'amount_paid', 'total', 'price'])
      ?? pick(booking, ['amount', 'price', 'total']),
    ),
    issue: str(pick(raw, ['issue', 'reason', 'description', 'message', 'details', 'subject'])),
    status: str(pick(raw, ['status']), 'open'),
    opened: str(pick(raw, ['opened', 'opened_at', 'created_at', 'date'])),
  };
}

/* ------------------------------------------------------------------ */
/* التقييمات (§6)                                                     */
/* ------------------------------------------------------------------ */

/**
 * `/api/admin/reviews` — العقد لا يسمّي أعمدة الصف، فنقبل الأسماء الشائعة.
 *
 * `visible` لها استثناء مقصود: غيابُ الحقل **ليس** invisibility. لو عُدّ الغياب
 * `false` لظهرت كل مراجعة «مخفية» واشتغل عدّاد الإخفاء كذباً. فالغياب يُقرأ
 * `true` لأن الإخفاء فعل صريح لا حالة افتراضية.
 */
export function adaptReview(raw) {
  return {
    ...raw,
    id: pick(raw, ['id']),
    user: str(pick(raw, ['user', 'customer', 'customer_name', 'author', 'reviewer', 'user_name'])),
    space: str(pick(raw, ['space', 'space_name', 'venue'])),
    rating: num(pick(raw, ['rating', 'stars', 'score', 'rate'])),
    text: str(pick(raw, ['text', 'comment', 'body', 'content', 'review', 'review_text'])),
    date: str(pick(raw, ['date', 'created_at', 'published_at'])),
    visible: bool(pick(raw, ['visible', 'is_visible', 'shown', 'is_shown']), true),
    flagged: bool(pick(raw, ['flagged', 'is_flagged', 'reported', 'is_reported']), false),
  };
}

/* ------------------------------------------------------------------ */
/* المعاملات (§8)                                                     */
/* ------------------------------------------------------------------ */

/** `/api/admin/financials/transactions` — يشارك صفّ الحجز أسماءه. */
export function adaptTransaction(raw) {
  return {
    ...raw,
    id: pick(raw, ['id']),
    ref: str(pick(raw, ['ref', 'reference', 'code'])),
    space: nameOf(pick(raw, ['space', 'space_name', 'venue'])),
    owner: nameOf(pick(raw, ['owner', 'owner_name'])),
    user: nameOf(pick(raw, ['user', 'customer', 'customer_name'])),
    hours: num(pick(raw, ['hours', 'duration', 'duration_hours'])),
    amount: num(pick(raw, ['amount', 'price', 'total', 'total_amount'])),
    date: str(pick(raw, ['date', 'created_at', 'paid_at'])),
    status: str(pick(raw, ['status'])),
  };
}

/* ------------------------------------------------------------------ */
/* صندوق الوارد (§10)                                                 */
/* ------------------------------------------------------------------ */

/**
 * مفردات الفئات تجتمع في خريطة واحدة (أدناه) وإن كانت مصادرها موضعين:
 *   · العقد §10.3 يعلن `general | support | report | billing`.
 *   · اللوحة تبني بطاقاتها على `dispute | space_request | report`
 *     (انظر inboxMeta.js) لأن `support` و`billing` لم يكونا لهما وصف.
 *   · `owner_verification` تضيفها هذه الجولة: إشعار رفع مالك مساحة لمستند
 *     توثيقه، وهو إشعار يطلب **قراراً** لا معلومة، فهو يستحق مساراً خاصاً
 *     يفتح ملف المالك نفسه لا صفحة عامة.
 *
 * `canonicalInboxCategory` تُرجع مفتاحاً **من مفردات اللوحة**، فتبقى الشارات
 * والألوان وأزرار الوجهة عاملة ويصلنا الخادم بمفتاح مألوف. القيمة الأصلية تبقى
 * في `rawCategory` حتى يبقى فلتر الوارد مطابقاً لما أرسله الخادم حرفياً.
 */

/** كل تهجئات الفئات التي قد ترد من الخادم → المفتاح القياسي للوحة. */
const INBOX_CATEGORY_ALIASES = {
  // نزاع
  dispute: 'dispute',
  disputes: 'dispute',
  booking_dispute: 'dispute',
  complaint: 'dispute',
  // طلب مساحة
  space_request: 'space_request',
  space_requests: 'space_request',
  space_approval: 'space_request',
  new_space: 'space_request',
  request: 'space_request',
  space: 'space_request',
  // بلاغ
  report: 'report',
  reports: 'report',
  review_report: 'report',
  flagged_review: 'report',
  // توثيق مالك مساحة. تهجئات كثيرة لأن الخادم لم يوثّق الفئة الجديدة بعد،
  // وإظهار إشعار «رفع مستند توثيق» في خانة «عام» يعني أن الأدمن لا يعرف
  // أنه قرارٌ مطلوب منه.
  owner_verification: 'owner_verification',
  owner_document: 'owner_verification',
  owner_documents: 'owner_verification',
  owner_verification_request: 'owner_verification',
  verification: 'owner_verification',
  verification_request: 'owner_verification',
  document: 'owner_verification',
  document_upload: 'owner_verification',
  proof_document: 'owner_verification',
  ownership_document: 'owner_verification',
  new_owner: 'owner_verification',
  space_owner_verification: 'owner_verification',
  // باقي مفردات العقد
  support: 'support',
  help: 'support',
  ticket: 'support',
  billing: 'billing',
  payment: 'billing',
  finance: 'billing',
  general: 'general',
};

const normalizeCategoryKey = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** الفئة القياسية للوحة، أو `''` لقيمة خارج المفردات (تُعرض بوصف عام). */
export function canonicalInboxCategory(value) {
  const key = normalizeCategoryKey(value);
  if (!key) return '';
  return INBOX_CATEGORY_ALIASES[key] || '';
}

/**
 * «منذ ساعتين» من `created_at` — بديل عن حقل `time` الجاهز إن لم يرسله
 * الخادم. نقول وقتاً وصفياً بدل خلية فارغة، ونُعيد النصّ الخام إن كان تاريخاً
 * غير قابل للتفسير.
 */
export function humanizeSince(value) {
  const raw = str(value);
  if (!raw) return '';
  const then = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(then.getTime())) return raw;

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const diff = Date.now() - then.getTime();

  if (diff < minute) return 'الآن';
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return `منذ ${n} ${n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? 'دقائق' : 'دقيقة'}`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return `منذ ${n} ${n === 1 ? 'ساعة' : n === 2 ? 'ساعتين' : n <= 10 ? 'ساعات' : 'ساعة'}`;
  }
  const n = Math.floor(diff / day);
  if (n === 1) return 'أمس';
  if (n < 30) return `منذ ${n} أيام`;
  return raw.slice(0, 10);
}

/**
 * معرّف صاحب الطلب داخل الإشعار، ليعمل زرّ الوجهة على **ملف هذا الحساب**
 * لا على صفحة عامة. خالٍ يعني أن الإشعار لا يشير إلى حساب معيّن، فيستعمل
 * الزرّ مسار فئته العام.
 *
 * `user` يُقبل ككائن `{ id }` لا كنص، لأن `pick` على نص يُرجع '' بدل
 * كائن، فنقرأ `.id` منه صراحةً قبل البحث في بقية المفاتيح.
 */
function inboxItemUserId(raw) {
  const direct = pick(raw, ['user_id', 'owner_id', 'subject_id', 'target_id', 'actor_id']);
  if (direct !== undefined && direct !== null && direct !== '') return direct;

  const user = pick(raw, ['user', 'owner', 'subject', 'target']);
  if (isObject(user)) {
    const nested = pick(user, ['id', 'user_id', 'uuid']);
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }
  return null;
}

/** `/api/admin/inbox` — صفّ الوارد مع توحيد الفئة. */
export function adaptInboxItem(raw) {
  const rawCategory = str(pick(raw, ['category', 'type', 'kind']));
  return {
    ...raw,
    id: pick(raw, ['id']),
    rawCategory,
    category: canonicalInboxCategory(rawCategory),
    // لأزرار الوجهة: تفتح ملف صاحب الطلب (انظر openDetail في
    // InboxNotifications) بدل الصفحة العامة للفئة.
    userId: inboxItemUserId(raw),
    title: str(pick(raw, ['title', 'subject', 'heading'])),
    body: str(pick(raw, ['body', 'message', 'text', 'content', 'preview'])),
    time: str(pick(raw, ['time', 'time_ago', 'relative_time', 'human_time']))
      || humanizeSince(pick(raw, ['created_at', 'sent_at', 'date', 'opened_at'])),
    read: bool(pick(raw, ['read', 'is_read', 'seen'])),
    archived: bool(pick(raw, ['archived', 'is_archived'])),
  };
}

/* ------------------------------------------------------------------ */
/* المالية (§8)                                                       */
/* ------------------------------------------------------------------ */

/**
 * نسبة العمولة كسراً (0.12) لا نسبة مئوية (12).
 *
 * العقد يعرضها بالشكلين: `settings.commission_rate = 12.00` و
 * `stats.platformCommission` (مئويّان)، بينما قد يرسل الملخّص `0.12`. فنوحّد
 * على الكسر: أي قيمة أكبر من 1 هي نسبة مئوية تُقسَم على 100. ولو لم نعمل ذلك
 * لعرضت اللوحة «1200%» وناقضت أرقام التقرير نفسها.
 */
export function adaptCommissionRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n > 1 ? n / 100 : n;
}

/**
 * `/api/admin/financials/summary` — `payouts_pending` ليست في الملخّص، وهي
 * في `stats.payoutsPending`. تُوحَّد هنا باسم واحد، ويبقى `null` إن لم
 * يرد من أي منهما حتى لا يعرض رقمٌ مستعار من مكان آخر.
 */
export function adaptFinancialSummary(raw) {
  const source = isObject(raw) ? raw : {};
  return {
    ...source,
    range: str(pick(source, ['range'])),
    revenue: numOrNull(pick(source, ['revenue', 'total_revenue', 'income'])),
    bookings: numOrNull(pick(source, ['bookings', 'bookings_count', 'total_bookings'])),
    commission: numOrNull(pick(source, ['commission', 'platform_commission', 'commission_amount'])),
    payouts: numOrNull(pick(source, ['payouts', 'owner_payouts', 'payouts_amount'])),
    payouts_pending: numOrNull(
      pick(source, ['payouts_pending', 'pending', 'pending_payouts', 'pending_amount']),
    ),
    commission_rate: adaptCommissionRate(pick(source, ['commission_rate', 'rate', 'platform_commission_rate'])),
    currency: str(pick(source, ['currency'])),
  };
}

/** صفّ واحد من السلسلة اليومية. */
export function adaptDailyRow(raw) {
  const revenue = num(pick(raw, ['revenue', 'income', 'total']));
  return {
    ...raw,
    date: str(pick(raw, ['date', 'day', 'bucket'])),
    revenue,
    bookings: num(pick(raw, ['bookings', 'bookings_count'])),
    pending: num(pick(raw, ['pending', 'payouts_pending', 'pending_payouts'])),
    commission: numOrNull(pick(raw, ['commission'])),
    payouts: numOrNull(pick(raw, ['payouts'])),
  };
}

/**
 * `/api/admin/financials/daily` — نقبل مصفوفةً مباشرة أو مغلّفاً
 * `{ series | rows | daily | data }` مع `coverage`. والشكلان كانا يُفرغان الشاشة
 * كلّها، فنوحّدهما هنا.
 */
export function adaptDailyFinancial(payload) {
  const source = isObject(payload) ? payload : null;
  const rows = Array.isArray(payload)
    ? payload
    : (pick(source, ['series', 'rows', 'daily', 'data'], null) || []);

  const coverage = pick(source, ['coverage', 'span', 'range'], null);

  return {
    series: adaptAll(rows, adaptDailyRow),
    coverage: isObject(coverage) && coverage.from && coverage.to
      ? { from: str(coverage.from), to: str(coverage.to) }
      : null,
  };
}

/**
 * `/api/admin/financials/commission-breakdown` — نقبل مصفوفة أو مغلّفاً
 * `{ rows | items | breakdown }`، ونوحّد كل صفّ إلى `{ label, amount }`.
 */
export function adaptCommissionBreakdown(payload) {
  const source = isObject(payload) ? payload : null;
  const rows = Array.isArray(payload)
    ? payload
    : (pick(source, ['rows', 'items', 'breakdown', 'data'], null) || []);

  return adaptAll(rows, (row) => ({
    ...row,
    label: str(pick(row, ['label', 'name', 'title', 'key']), '—'),
    amount: num(pick(row, ['amount', 'value', 'total', 'commission', 'revenue'])),
  }));
}

/* ------------------------------------------------------------------ */
/* الإعدادات (§11)                                                    */
/* ------------------------------------------------------------------ */

/**
 * `GET /api/admin/settings` — `PUT` على المسار نفسه يطلب **كل** الحقول
 * إجبارياً (العقد §11)، فنحتفظ بقيمة `currency` التي يقرأها الخادم لنرسلها
 * كما هي. لا قيمة مخترعة: ما لم يرد يبقى `''` ويقول النموذج ذلك بدل أن يكتب
 * عملةً في قاعدة البيانات.
 */
export function adaptSettings(raw) {
  const source = isObject(raw) ? raw : {};
  const rate = Number(pick(source, ['commission_rate', 'platform_commission', 'rate']));
  return {
    ...source,
    commission_rate: Number.isFinite(rate) ? rate : null,
    booking_grace_period_hours: numOrNull(
      pick(source, ['booking_grace_period_hours', 'grace_period_hours']),
    ),
    auto_approve_bookings: bool(pick(source, ['auto_approve_bookings'])),
    currency: str(pick(source, ['currency'])),
  };
}
