const pptxgen = require('pptxgenjs');
const path = require('path');

const OUT = path.join(__dirname, 'Masahati-Presentation.pptx');
const SHOT = path.join(__dirname, 'screenshots');

const ORANGE = 'F97316';
const ORANGE_DK = 'EA580C';
const ORANGE_SOFT = 'FFF3E9';
const INK = '0A0A0A';
const DARK = '18181B';
const WHITE = 'FFFFFF';
const SURFACE = 'F8FAFC';
const MUTED = '52525B';
const BORDER = 'E4E4E7';
const GREEN = '16A34A';

const FONT = 'Cairo';
const FLATIN = 'Calibri';

const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.33, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'Masahati Team';
pptx.company = 'Masahati';
pptx.title = 'Masahati — Platform for Shared Workspaces in Gaza';

const W = 13.33, H = 7.5;

// ---------- helpers ----------
function bg(slide, color) { slide.background = { color }; }

function blob(slide, x, y, d, color, transparency) {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color, transparency }, line: { type: 'none' } });
}

function chip(slide, x, y, d, fill, symbol, symColor) {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color: fill }, line: { type: 'none' } });
  slide.addText(symbol, { x, y, w: d, h: d, align: 'center', valign: 'middle', fontFace: FLATIN, fontSize: Math.round(d * 0.46), color: symColor, bold: true, margin: 0 });
}

function pageTitle(slide, ar, en, opts = {}) {
  const x = opts.x ?? 0.7;
  const y = opts.y ?? 0.55;
  slide.addText(ar, { x, y, w: 11.9, h: 0.9, fontFace: FONT, fontSize: 32, bold: true, color: opts.color || INK, align: 'right', rtl: true, margin: 0 });
  if (en) slide.addText(en, { x, y: y + 0.92, w: 11.9, h: 0.4, fontFace: FLATIN, fontSize: 13, color: ORANGE_DK, align: 'right', charSpacing: 1, margin: 0 });
  // small orange tick before title (motif: a filled dot)
  slide.addShape('ellipse', { x: x + 0.02, y: y + 0.12, w: 0.18, h: 0.18, fill: { color: ORANGE }, line: { type: 'none' } });
}

function footer(slide, n) {
  slide.addText([
    { text: 'مساحاتي | Masahati', options: { fontFace: FONT, color: MUTED, fontSize: 9 } },
    { text: '    •    منصّة مساحات العمل المشتركة في غزة', options: { fontFace: FONT, color: MUTED, fontSize: 9 } },
  ], { x: 0.7, y: 7.05, w: 9, h: 0.35, align: 'right', rtl: true, margin: 0 });
  slide.addText(String(n), { x: 12.3, y: 7.05, w: 0.5, h: 0.35, align: 'center', fontFace: FLATIN, fontSize: 9, color: MUTED, margin: 0 });
}

function bulletList(slide, items, o) {
  slide.addText(
    items.map((t, i) => ({ text: t, options: { bullet: { code: '2022', indent: 18 }, breakLine: i < items.length - 1, color: o.color || DARK, paraSpaceAfter: o.gap || 10 } })),
    { x: o.x, y: o.y, w: o.w, h: o.h, fontFace: FONT, fontSize: o.fs || 15, align: 'right', rtl: true, valign: 'top', margin: 0, lineSpacingMultiple: 1.05 }
  );
}

// ================= SLIDE 1 — TITLE =================
(function () {
  const s = pptx.addSlide();
  bg(s, INK);
  blob(s, -2.2, 3.6, 7.5, ORANGE, 86);
  blob(s, 9.6, -2.6, 6.5, ORANGE_DK, 90);
  s.addShape('rect', { x: 0, y: 0, w: 0.22, h: H, fill: { color: ORANGE }, line: { type: 'none' } });

  s.addText('مساحاتي', { x: 0.9, y: 2.0, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: WHITE, align: 'right', rtl: true, margin: 0 });
  s.addText('Masahati', { x: 0.9, y: 3.15, w: 11.5, h: 0.7, fontFace: FLATIN, fontSize: 26, bold: true, color: ORANGE, align: 'right', charSpacing: 2, margin: 0 });
  s.addText('منصّة مساحات العمل المشتركة في غزة', { x: 0.9, y: 4.0, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 20, color: 'E5E5E5', align: 'right', rtl: true, margin: 0 });
  s.addText('The Shared-Workspace Platform for Gaza', { x: 0.9, y: 4.6, w: 11.5, h: 0.5, fontFace: FLATIN, fontSize: 14, italic: true, color: 'B0B0B0', align: 'right', margin: 0 });

  s.addShape('line', { x: 0.95, y: 5.35, w: 4.2, h: 0, line: { color: ORANGE, width: 2 } });
  s.addText('عرض تقدّمي — للطلاب والمشرفين', { x: 0.9, y: 5.5, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 15, color: WHITE, align: 'right', rtl: true, margin: 0 });
  s.addText('Progress Review • for Students & Supervisors', { x: 0.9, y: 6.0, w: 11.5, h: 0.4, fontFace: FLATIN, fontSize: 12, color: '9A9A9A', align: 'right', margin: 0 });
  s.addText('أغسطس 2026', { x: 0.9, y: 6.45, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: ORANGE, align: 'right', rtl: true, margin: 0 });
  s.addNotes('Welcome. This is Masahati — the first shared-workspace discovery and booking platform built for Gaza. This deck reviews what we have built so far, the technology behind it, and the roadmap ahead. Prepared for students and supervisors.');
})();

// ================= SLIDE 2 — PROBLEM =================
(function () {
  const s = pptx.addSlide();
  bg(s, WHITE);
  pageTitle(s, 'المشكلة: البحث عن مساحة عمل في غزة', 'THE PROBLEM');
  footer(s, 2);

  chip(s, 0.8, 2.1, 1.0, ORANGE_SOFT, '؟', ORANGE_DK);
  s.addText('تحدّيات الطلاب وأصحاب المساحات اليوم', { x: 2.0, y: 2.15, w: 10.5, h: 0.9, fontFace: FONT, fontSize: 20, bold: true, color: DARK, align: 'right', rtl: true, valign: 'middle', margin: 0 });

  bulletList(s, [
    'لا توجد منصّة مركزية تجمع مساحات العمل المشتركة وقاعات الدراسة في غزة.',
    'صعوبة مقارنة السعر، سرعة الإنترنت، وتوفّر الكهرباء قبل اتخاذ قرار الحجز.',
    'الحجز يتم يدوياً عبر اتصالات ورسائل متفرّقة دون متابعة واضحة.',
    'أصحاب المساحات يفتقرون إلى قناة موثوقة لعرض مساحاتهم والوثوقية.',
  ], { x: 1.0, y: 3.4, w: 11.3, h: 3.2, fs: 17, gap: 16 });

  s.addText('النتيجة: وقت ضائع، شفافية أقل، وتجربة مجزّأة.', { x: 1.0, y: 6.5, w: 11.3, h: 0.5, fontFace: FONT, fontSize: 14, italic: true, color: ORANGE_DK, align: 'right', rtl: true, margin: 0 });
  s.addNotes('Gaza lacks a single place to discover and compare shared workspaces. Students and freelancers cannot easily compare price, internet speed, or electricity availability. Booking is manual and fragmented. Space owners have no trusted channel to list.');
})();

// ================= SLIDE 3 — SOLUTION =================
(function () {
  const s = pptx.addSlide();
  bg(s, SURFACE);
  pageTitle(s, 'الحل: منصّة مساحاتي', 'OUR SOLUTION');
  footer(s, 3);

  const cards = [
    { sym: '🔍', t: 'اكتشف', e: 'Discover', d: 'تصفّح كل مساحات العمل المشتركة وقاعات الدراسة في مكان واحد.', c: ORANGE },
    { sym: '⚖', t: 'قارن', e: 'Compare', d: 'قارن السعر، سرعة الإنترنت، وتوفّر الكهرباء جنباً إلى جنب.', c: ORANGE_DK },
    { sym: '⚡', t: 'احجز', e: 'Book', d: 'احجز مقعدك بنقرة واحدة — دون اتصال ولا رسالة.', c: 'FB923C' },
  ];
  const cw = 3.7, gap = 0.55, startX = (W - (cw * 3 + gap * 2)) / 2, y = 2.5;
  cards.forEach((c, i) => {
    const x = startX + i * (cw + gap);
    s.addShape('roundRect', { x, y, w: cw, h: 3.6, rectRadius: 0.18, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 12, offset: 4, angle: 90 } });
    chip(s, x + cw / 2 - 0.55, y + 0.45, 1.1, ORANGE_SOFT, c.sym, c.c);
    s.addText(c.t, { x, y: y + 1.7, w: cw, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: DARK, align: 'center', rtl: true, margin: 0 });
    s.addText(c.e, { x, y: y + 2.3, w: cw, h: 0.35, fontFace: FLATIN, fontSize: 12, color: ORANGE_DK, align: 'center', charSpacing: 1, margin: 0 });
    s.addText(c.d, { x: x + 0.3, y: y + 2.75, w: cw - 0.6, h: 0.8, fontFace: FONT, fontSize: 13, color: MUTED, align: 'center', rtl: true, margin: 0 });
  });
  s.addText('مساحاتي تجمع كل شيء في تجربة عربية واحدة سلسة.', { x: 0.7, y: 6.45, w: 11.9, h: 0.5, fontFace: FONT, fontSize: 15, italic: true, color: DARK, align: 'center', rtl: true, margin: 0 });
  s.addNotes('Masahati brings everything into one Arabic-first experience: discover all spaces in one place, compare what actually matters (price, internet, electricity), and book a seat with one click — no phone calls, no scattered messages.');
})();

// ================= SLIDE 4 — FEATURES BUILT =================
(function () {
  const s = pptx.addSlide();
  bg(s, WHITE);
  pageTitle(s, 'ما الذي بُني حتى الآن', 'FEATURES BUILT');
  footer(s, 4);

  const feats = [
    { sym: '🌐', t: 'واجهة عربية RTL كاملة', d: 'اتجاه من اليمين لليسار مع خط Cairo.' },
    { sym: '📱', t: 'تصميم متجاوب', d: 'جوال وسطح مكتب، لمس 44px، بلا تكبير.' },
    { sym: '👥', t: 'حساب بنوع المستخدم', d: 'طالب أو صاحب مساحة.' },
    { sym: '🔐', t: 'استعادة كلمة المرور (OTP)', d: 'عبر البريد أو واتساب، برمز لمرة واحدة.' },
    { sym: '📄', t: 'تحقّق بصري', d: 'إرفاق وثيقة ملكية للمساحة.' },
    { sym: '⏱', t: 'حجز سريع', d: 'حجز مقعد خلال ~5 دقائق.' },
  ];
  const cw = 3.75, ch = 1.95, gx = 0.4, gy = 0.4, sx = 0.7, sy = 2.2;
  feats.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx), y = sy + row * (ch + gy);
    s.addShape('roundRect', { x, y, w: cw, h: ch, rectRadius: 0.14, fill: { color: SURFACE }, line: { color: BORDER, width: 1 } });
    chip(s, x + 0.3, y + 0.35, 0.85, ORANGE_SOFT, f.sym, ORANGE_DK);
    s.addText(f.t, { x: x + 1.3, y: y + 0.3, w: cw - 1.5, h: 0.6, fontFace: FONT, fontSize: 15, bold: true, color: DARK, align: 'right', rtl: true, valign: 'middle', margin: 0 });
    s.addText(f.d, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 0.65, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'right', rtl: true, margin: 0 });
  });
  s.addNotes('Six core capabilities are already implemented: full Arabic RTL UI, responsive design with 44px touch targets, role-based accounts, a secure OTP password-recovery flow (email or WhatsApp), visual ownership verification, and a fast booking intent.');
})();

// ================= SLIDE 5 — SHOWCASE LANDING =================
(function () {
  const s = pptx.addSlide();
  bg(s, WHITE);
  pageTitle(s, 'الواجهة: الصفحة الرئيسية', 'SHOWCASE — LANDING PAGE');
  footer(s, 5);

  // left text
  bulletList(s, [
    'هيرو بخلفية متحركة (crossfade) مع عنوان واضح.',
    'إحصائيات حيّة (CountUp) عند التمرير.',
    'أقسام: الميزات، كيف يعمل، الأدوار، من نحن.',
    'شريط تنقّل زجاجي (liquid glass) عند التمرير.',
  ], { x: 0.7, y: 2.4, w: 4.8, h: 3.5, fs: 15, gap: 14 });
  s.addText('متجاوب بالكامل مع تفضيل تقليل الحركة.', { x: 0.7, y: 6.2, w: 4.8, h: 0.5, fontFace: FONT, fontSize: 13, italic: true, color: ORANGE_DK, align: 'right', rtl: true, margin: 0 });

  // right screenshot framed
  const img = path.join(SHOT, 'landing.png');
  const iw = 7.4, ih = iw * (653 / 1264);
  const ix = 5.7, iy = (H - ih) / 2;
  s.addShape('roundRect', { x: ix - 0.12, y: iy - 0.12, w: iw + 0.24, h: ih + 0.24, rectRadius: 0.12, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 16, offset: 5, angle: 90 } });
  s.addImage({ path: img, x: ix, y: iy, w: iw, h: ih });
  s.addNotes('The landing page: an animated hero with a clear value proposition, live count-up statistics on scroll, sections for features / how it works / roles / about, and a liquid-glass navbar that appears on scroll. Fully responsive and respects reduced-motion preferences.');
})();

// ================= SLIDE 6 — SHOWCASE AUTH =================
(function () {
  const s = pptx.addSlide();
  bg(s, SURFACE);
  pageTitle(s, 'تجربة الدخول والحساب', 'SHOWCASE — AUTHENTICATION');
  footer(s, 6);

  const shots = [
    { f: 'login.png', t: 'تسجيل الدخول', e: 'Login' },
    { f: 'signup.png', t: 'إنشاء حساب', e: 'Sign Up' },
    { f: 'forgot.png', t: 'نسيت كلمة المرور', e: 'Forgot Password' },
  ];
  const iw = 3.85, ih = iw * (625 / 1264), gx = 0.5, sx = (W - (iw * 3 + gx * 2)) / 2, y = 2.35;
  shots.forEach((sh, i) => {
    const x = sx + i * (iw + gx);
    s.addShape('roundRect', { x: x - 0.1, y: y - 0.1, w: iw + 0.2, h: ih + 0.2, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.16, blur: 12, offset: 4, angle: 90 } });
    s.addImage({ path: path.join(SHOT, sh.f), x, y, w: iw, h: ih });
    s.addText(sh.t, { x, y: y + ih + 0.18, w: iw, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: DARK, align: 'center', rtl: true, margin: 0 });
    s.addText(sh.e, { x, y: y + ih + 0.56, w: iw, h: 0.3, fontFace: FLATIN, fontSize: 11, color: ORANGE_DK, align: 'center', charSpacing: 1, margin: 0 });
  });
  s.addNotes('The auth flow: a polished login card (email/phone + password, remember me, show/hide), a multi-step sign-up with role selection and ownership-document upload, and a 3-step forgot-password wizard with OTP delivered by email or WhatsApp. Error slots use reserved height so the form never jumps.');
})();

// ================= SLIDE 7 — USER ROLES =================
(function () {
  const s = pptx.addSlide();
  bg(s, WHITE);
  pageTitle(s, 'الأدوار: كلٌّ كما يناسبه', 'USER ROLES');
  footer(s, 7);

  const roles = [
    { sym: '🎓', t: 'الطالب', e: 'Student', pts: ['يكتشف ويوازن بين المساحات.', 'يحجز مقعداً مباشرةً.', 'تفعيل فوري بعد التحقق.'], c: ORANGE },
    { sym: '🏢', t: 'صاحب المساحة', e: 'Space Owner', pts: ['يعرض مساحته للجمهور.', 'يرفق وثيقة إثبات ملكية.', 'بانتظار موافقة الإدارة.'], c: ORANGE_DK },
  ];
  const cw = 5.6, gap = 0.7, sx = (W - (cw * 2 + gap)) / 2, y = 2.4;
  roles.forEach((r, i) => {
    const x = sx + i * (cw + gap);
    s.addShape('roundRect', { x, y, w: cw, h: 4.0, rectRadius: 0.18, fill: { color: SURFACE }, line: { color: BORDER, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 12, offset: 4, angle: 90 } });
    chip(s, x + 0.45, y + 0.45, 1.1, ORANGE_SOFT, r.sym, r.c);
    s.addText(r.t, { x: x + 1.8, y: y + 0.5, w: cw - 2, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: DARK, align: 'right', rtl: true, valign: 'middle', margin: 0 });
    s.addText(r.e, { x: x + 1.8, y: y + 1.1, w: cw - 2, h: 0.35, fontFace: FLATIN, fontSize: 12, color: ORANGE_DK, align: 'right', charSpacing: 1, margin: 0 });
    bulletList(s, r.pts, { x: x + 0.5, y: y + 1.8, w: cw - 1.0, h: 2.0, fs: 14, gap: 10 });
  });
  s.addNotes('Two roles. Students discover, compare, and book immediately after verification. Space owners list their space, attach a proof-of-ownership document, and wait for admin approval before going live.');
})();

// ================= SLIDE 8 — TECH STACK =================
(function () {
  const s = pptx.addSlide();
  bg(s, SURFACE);
  pageTitle(s, 'التقنية والبنية', 'TECH STACK & ARCHITECTURE');
  footer(s, 8);

  const blocks = [
    { t: 'الواجهة الأمامية', e: 'FRONTEND', items: ['React 19', 'Vite 8', 'Tailwind CSS v4', 'React Router 7'], c: ORANGE },
    { t: 'الخلفية (قادم)', e: 'BACKEND', items: ['Laravel (PHP)', 'MySQL', 'مصادقة حقيقية', 'REST API'], c: ORANGE_DK },
    { t: 'الجودة والأداء', e: 'QUALITY', items: ['Build & Lint أخضر', '0 ثغرات أمنية', 'JS ~101KB gzip', 'RTL + متجاوب'], c: 'FB923C' },
  ];
  const cw = 3.7, gap = 0.55, sx = (W - (cw * 3 + gap * 2)) / 2, y = 2.35;
  blocks.forEach((b, i) => {
    const x = sx + i * (cw + gap);
    s.addShape('roundRect', { x, y, w: cw, h: 3.7, rectRadius: 0.16, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 12, offset: 4, angle: 90 } });
    s.addShape('rect', { x, y, w: cw, h: 0.14, fill: { color: b.c }, line: { type: 'none' } });
    s.addText(b.t, { x: x + 0.3, y: y + 0.35, w: cw - 0.6, h: 0.55, fontFace: FONT, fontSize: 19, bold: true, color: DARK, align: 'right', rtl: true, margin: 0 });
    s.addText(b.e, { x: x + 0.3, y: y + 0.92, w: cw - 0.6, h: 0.3, fontFace: FLATIN, fontSize: 11, color: ORANGE_DK, align: 'right', charSpacing: 1, margin: 0 });
    bulletList(s, b.items, { x: x + 0.35, y: y + 1.4, w: cw - 0.7, h: 2.1, fs: 14, gap: 9 });
  });
  s.addText('الواجهة جاهزة وتتحدّث مباشرةً مع Laravel/MySQL عند اكتمال الخلفية.', { x: 0.7, y: 6.45, w: 11.9, h: 0.5, fontFace: FONT, fontSize: 14, italic: true, color: DARK, align: 'center', rtl: true, margin: 0 });
  s.addNotes('Modern stack: React 19 + Vite 8 + Tailwind v4 + React Router 7 on the frontend. The backend will be Laravel + MySQL with real authentication via a REST API. Quality gates (build + lint) are green and the bundle is ~101KB gzipped. RTL and responsive throughout.');
})();

// ================= SLIDE 9 — QUALITY & SECURITY =================
(function () {
  const s = pptx.addSlide();
  bg(s, WHITE);
  pageTitle(s, 'الجودة والأمان', 'QUALITY & SECURITY');
  footer(s, 9);

  const items = [
    { sym: '✓', t: 'بناء ونظام Lint بدون أخطاء', d: 'npm run build و npm run lint يمرّان بنجاح.' },
    { sym: '🛡', t: '0 ثغرات أمنية', d: 'تقرير npm audit نظيف تماماً.' },
    { sym: '📱', t: 'متجاوب مع لمس 44px', d: 'حقول 16px تمنع تكبير iOS، safe-area للجوال.' },
    { sym: '♿', t: 'تفضيل تقليل الحركة', d: 'احترام prefers-reduced-motion في كل الأنيميشن.' },
    { sym: '🔒', t: 'إزالة تسريب كلمة المرور', d: 'حُذف console.log للبيانات الحسّاسة.' },
    { sym: '📐', t: 'تثبيت تخطيط بطاقة الدخول', d: 'حجز ارتفاع ثابت لفتحات الخطأ — بلا قفز.' },
  ];
  const cw = 5.9, ch = 1.35, gx = 0.5, gy = 0.35, sx = 0.7, sy = 2.2;
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = sx + col * (cw + gx), y = sy + row * (ch + gy);
    s.addShape('roundRect', { x, y, w: cw, h: ch, rectRadius: 0.12, fill: { color: SURFACE }, line: { color: BORDER, width: 1 } });
    chip(s, x + 0.25, y + 0.27, 0.8, ORANGE_SOFT, it.sym, GREEN);
    s.addText(it.t, { x: x + 1.25, y: y + 0.18, w: cw - 1.45, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: DARK, align: 'right', rtl: true, valign: 'middle', margin: 0 });
    s.addText(it.d, { x: x + 1.25, y: y + 0.72, w: cw - 1.45, h: 0.5, fontFace: FONT, fontSize: 12, color: MUTED, align: 'right', rtl: true, margin: 0 });
  });
  s.addNotes('Quality and security were verified, not assumed: build and lint pass, npm audit reports zero vulnerabilities, the UI is responsive with 44px touch targets and no-iOS-zoom inputs, and reduced-motion is respected. We also removed a password console.log leak and fixed validation layout shift by reserving constant error-slot height.');
})();

// ================= SLIDE 10 — ROADMAP =================
(function () {
  const s = pptx.addSlide();
  bg(s, SURFACE);
  pageTitle(s, 'خارطة الطريق', 'ROADMAP');
  footer(s, 10);

  const steps = [
    { t: 'اليوم', e: 'NOW', d: 'واجهة أمامية كاملة + تحقّق وهمي (mock).', c: ORANGE },
    { t: 'قريباً', e: 'SOON', d: 'ربط Laravel/MySQL بمصادقة حقيقية.', c: ORANGE_DK },
    { t: 'قريباً', e: 'SOON', d: 'تصفّح المساحات + الفلاتر + الخرائط.', c: 'FB923C' },
    { t: 'تالياً', e: 'NEXT', d: 'لوحة تحكّم كاملة: حجوزاتك وإعداداتك.', c: ORANGE_DK },
    { t: 'مستقبلاً', e: 'FUTURE', d: 'الدفع الإلكتروني وحجز المقاعد الحي.', c: ORANGE },
  ];
  const x0 = 1.2, y0 = 2.5, dy = 0.92, lineX = x0 + 0.3;
  s.addShape('line', { x: lineX, y: y0, w: 0, h: dy * (steps.length - 1), line: { color: ORANGE, width: 2.5 } });
  steps.forEach((st, i) => {
    const y = y0 + i * dy;
    s.addShape('ellipse', { x: lineX - 0.28, y: y - 0.28, w: 0.56, h: 0.56, fill: { color: st.c }, line: { color: WHITE, width: 2 } });
    s.addText(String(i + 1), { x: lineX - 0.28, y: y - 0.28, w: 0.56, h: 0.56, align: 'center', valign: 'middle', fontFace: FLATIN, fontSize: 16, bold: true, color: WHITE, margin: 0 });
    s.addText(st.t, { x: lineX + 0.5, y: y - 0.28, w: 2.0, h: 0.56, fontFace: FONT, fontSize: 16, bold: true, color: DARK, align: 'right', rtl: true, valign: 'middle', margin: 0 });
    s.addText(st.e, { x: lineX + 0.5, y: y + 0.18, w: 2.0, h: 0.3, fontFace: FLATIN, fontSize: 10, color: ORANGE_DK, align: 'right', charSpacing: 1, margin: 0 });
    s.addText(st.d, { x: lineX + 2.7, y: y - 0.28, w: 8.5, h: 0.9, fontFace: FONT, fontSize: 14, color: MUTED, align: 'right', rtl: true, valign: 'middle', margin: 0 });
  });
  s.addNotes('Roadmap: the frontend and a mock auth layer are done today. Next we connect Laravel/MySQL for real authentication, then add space browsing with filters and maps, then a full dashboard, and eventually payments with live seat booking.');
})();

// ================= SLIDE 11 — CLOSING =================
(function () {
  const s = pptx.addSlide();
  bg(s, INK);
  blob(s, 9.8, 4.2, 7.0, ORANGE, 88);
  blob(s, -2.4, -2.6, 6.0, ORANGE_DK, 90);
  s.addShape('rect', { x: 0, y: 0, w: 0.22, h: H, fill: { color: ORANGE }, line: { type: 'none' } });

  s.addText('شكراً', { x: 0.9, y: 2.2, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 56, bold: true, color: WHITE, align: 'right', rtl: true, margin: 0 });
  s.addText('Thank you — to our supervisors & fellow students', { x: 0.9, y: 3.35, w: 11.5, h: 0.5, fontFace: FLATIN, fontSize: 16, italic: true, color: 'C0C0C0', align: 'right', margin: 0 });
  s.addShape('line', { x: 0.95, y: 4.1, w: 4.2, h: 0, line: { color: ORANGE, width: 2 } });
  s.addText([
    { text: 'جاهز للتجربة الآن — ابدأ من الصفحة الرئيسية.', options: { fontFace: FONT, color: WHITE, fontSize: 16, breakLine: true } },
    { text: 'تواصل واتساب: +972 56 765 3009', options: { fontFace: FLATIN, color: ORANGE, fontSize: 14, breakLine: true } },
    { text: 'مساحاتي | Masahati — منصّة مساحات العمل المشتركة في غزة', options: { fontFace: FONT, color: '9A9A9A', fontSize: 12 } },
  ], { x: 0.9, y: 4.35, w: 11.5, h: 1.6, align: 'right', rtl: true, lineSpacingMultiple: 1.3, margin: 0 });
  s.addNotes('Thank you to our supervisors and fellow students for the feedback that shaped this build. Masahati is ready to try today, with the backend integration as the next milestone. Contact via WhatsApp for questions or a live demo.');
})();

pptx.writeFile({ fileName: OUT }).then((f) => {
  console.log('WROTE', f);
}).catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
