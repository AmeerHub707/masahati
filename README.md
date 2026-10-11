# مساحاتي (Masahati)

منصة عربية (RTL) لحجز مساحات العمل المشتركة في غزة — مكاتب، قاعات اجتماعات
وتدريب، قاعات مناسبات، واستوديوهات. تربط المنصة بين **العميل** الذي يبحث
ويحجز، و**صاحب المساحة** الذي ينشر مساحاته ويدير حجوزاته.

## المتطلبات

- Node.js 20+
- npm

## البدء السريع

```bash
npm install
cp .env.example .env   # ثم املأ القيم
npm run dev
```

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل خادم التطوير (Vite) |
| `npm run build` | بناء نسخة الإنتاج في `dist/` |
| `npm run preview` | معاينة نسخة الإنتاج محلياً |
| `npm run lint` | فحص الشيفرة عبر ESLint |
| `npm test` | تشغيل مجموعة اختبارات الوحدة والتكامل والواجهة |

## متغيرات البيئة

| المتغير | الوصف |
|---|---|
| `VITE_API_URL` | عنوان واجهة الباك إند (Laravel + Sanctum). الافتراضي: `https://back-end-kwba.onrender.com` |
| `VITE_GOOGLE_CLIENT_ID` | معرّف عميل Google OAuth لتسجيل الدخول بجوجل |

## التقنيات

- **React 19** + **React Router 7**
- **Vite 8** مع alias `@` → `src/`
- **Tailwind CSS 4**
- **framer-motion** للحركة، **lucide-react** للأيقونات
- **react-leaflet / leaflet** للخرائط، **dompurify** لتنقية HTML

## بنية المشروع

```
src/
├── components/     مكوّنات مشتركة (layout, dashboard, ui)
├── context/        سياقات React
├── features/       وحدات حسب المجال (landing, customer, owner)
├── hooks/          خطافات مخصّصة
├── lib/            طبقة المنطق والبيانات وعميل الـ API
├── pages/          صفحات المسارات
├── security/       طبقات الأمان (بنية تنظيمية)
└── utils/          دوال مساعدة + الاختبارات
```

## الأدوار والمسارات

- `/` الصفحة الرئيسية، `/spaces` تصفّح المساحات، `/compare` المقارنة
- `/login` `/signup` `/verify-otp` `/forgot` `/reset-password`
- `/dashboard/customer` لوحة العميل
- `/dashboard/space-owner` لوحة صاحب المساحة

حماية المسارات والدور في `src/App.jsx` (`RequireAuth`, `RequireRole`).

## البيانات (لا وضع تجريبي)

الواجهة تتصل حصراً بالباك إند الحقيقي (Laravel على Render) عبر `src/lib/api.js`.
لا توجد بيانات مُختلقة ولا «وضع تجريبي»: أي فشل في القراءة يُرجَع كخطأ
`{ error, ... }` مع قيم فارغة تعرضها الشاشات، وأي إجراء كتابة يرمي الخطأ الحقيقي
بدل ادّعاء النجاح. غيّر عنوان الباك إند عبر `VITE_API_URL`.

## النشر على Vercel

الواجهة جاهزة للنشر على Vercel (`vercel.json` يضبط البناء والأمان والـ rewrites):

1. استورد مستودع GitHub في Vercel (framework: Vite، بناء: `npm run build`، مخرجات `dist`).
2. أضف متغيرات البيئة في مشروع Vercel:
   - `VITE_API_URL=https://back-end-kwba.onrender.com`
   - `VITE_GOOGLE_CLIENT_ID=<معرّف عميل Google OAuth>`
3. أضف نطاق النشر في قائمة CORS للباك إند (`config/cors.php` → `allowed_origins`)
   وفي «Authorized JavaScript origins» لمشروع Google OAuth نفسه.
4. جرّب المسارات الرئيسية بعد النشر: الرئيسية، المساحات، التسجيل/الدخول، Google، لوحة العميل، لوحة المالك.

## التوثيق

مجموعة عقود الباك إند وتقرير التدقيق في مجلد `docs/`، وأهمّها
`docs/What_Should_Backend_Implement.md`.
