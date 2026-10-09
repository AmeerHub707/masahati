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

## الوضع التجريبي (Demo)

عند تعذّر الوصول إلى الباك إند، تلتفّ معظم الطلبات في دوال `*WithFallback`
مدعومة بـ `localStorage`، فتظهر الواجهة في «وضع تجريبي» بدل الفشل. هذا
مقصود لأغراض العرض، لكنه يخفي أخطاء الخادم — راجع `docs/` قبل الاعتماد عليه
في الإنتاج.

## التوثيق

مجموعة عقود الباك إند وتقرير التدقيق في مجلد `docs/`، وأهمّها
`docs/What_Should_Backend_Implement.md`.
