// اختبارات وحدة لمحوّل مستندات الأدمن (`adaptAdminDocuments`).
//
// الحمولة المستخدمة **ليست مُختلقة**: هي الردّ الحقيقي المسجَّل من الخادم
// الحيّ عبر `GET /api/admin/documents?space_id=1` (مع تعمية الاسم لا أكثر).
// الهدف أن يبقى المحوّل متطابقاً مع العقد الفعلي، وأن نمنع انزلاقاً صامتاً
// يعيد الأدمن إلى قائمة فارغة بعد أن كانت تعمل.
//
// يعمل عبر Vite SSR لأن adminAdapters.js وحدة ESM بلا اعتماد على DOM.
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

const { createServer } = await import('vite');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const { adaptAdminDocuments } = await server.ssrLoadModule('/src/lib/adminAdapters.js');

// ردّ حقيقي كما وصل من الخادم (space_id=1).
const REAL = {
  documents: [
    {
      id: null,
      kind: 'proof',
      label: 'إثبات الملكية',
      name: 'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      url: 'https://res.cloudinary.com/wlxftoau/image/upload/documents/vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      path: 'documents/vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      uploaded_at: '2026-10-16T00:39:16+03:00',
      space_id: 1,
      space_title: 'test',
      owner_id: 5,
      owner_name: 'AMEER AYYAD',
      status: 'pending',
    },
  ],
  data: [
    {
      id: null,
      kind: 'proof',
      label: 'إثبات الملكية',
      name: 'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      url: 'https://res.cloudinary.com/wlxftoau/image/upload/documents/vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      path: 'documents/vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
      uploaded_at: '2026-10-16T00:39:16+03:00',
      space_id: 1,
      space_title: 'test',
      owner_id: 5,
      owner_name: 'AMEER AYYAD',
      status: 'pending',
    },
  ],
  meta: { total: 1 },
};

// ----- 1. الردّ الحقيقي -----
{
  const docs = adaptAdminDocuments(REAL);
  report('1.1 يُقرأ مستند واحد', docs.length === 1, 1, docs.length);
  report('1.2 النوع proof يُطبّع إلى property_deed', docs[0]?.kind === 'property_deed', 'property_deed', docs[0]?.kind);
  report('1.3 التسمية العربية الصحيحة', docs[0]?.label === 'وثيقة الملكية', 'وثيقة الملكية', docs[0]?.label);
  report('1.4 الرابط الكامل يُمرَّر كما هو', docs[0]?.url === REAL.documents[0].url, REAL.documents[0].url, docs[0]?.url);
  report('1.5 اسم الملف محفوظ', docs[0]?.name === REAL.documents[0].name, REAL.documents[0].name, docs[0]?.name);
  report('1.6 وقت الرفع محفوظ', docs[0]?.uploadedAt === '2026-10-16T00:39:16+03:00', '2026-10-16T00:39:16+03:00', docs[0]?.uploadedAt);
  report('1.7 معرّف المساحة محفوظ نصّاً', docs[0]?.spaceId === '1', '1', docs[0]?.spaceId);
}

// ----- 2. مصفوفة فارغة: «لا مستندات» ليست خطأ -----
{
  report('2.1 ردّ فارغ لا يرمي', adaptAdminDocuments({ documents: [], data: [], meta: { total: 0 } }).length === 0, 0, adaptAdminDocuments({ documents: [], data: [], meta: { total: 0 } }).length);
  report('2.2 null لا يرمي', adaptAdminDocuments(null).length === 0, 0, adaptAdminDocuments(null).length);
  report('2.3 بلا وسيط لا يرمي', adaptAdminDocuments().length === 0, 0, adaptAdminDocuments().length);
}

// ----- 3. أشكال بديلة محتملة (لا نُسقط مستنداً بسبب اختلاف التسمية) -----
{
  const bare = adaptAdminDocuments([{ kind: 'proof', url: 'https://x/d.jpg' }]);
  report('3.1 مصفوفة مباشرة تُقرأ', bare.length === 1, 1, bare.length);

  const rootLevel = adaptAdminDocuments({ documents: null, data: [{ kind: 'proof', path: '/storage/d.jpg' }] });
  report('3.2 الرجوع إلى data عند فراغ documents', rootLevel.length === 1, 1, rootLevel.length);
  report('3.3 مسار نسبي يُمرَّر (التحويل عند العرض)', rootLevel[0]?.url === '/storage/d.jpg', '/storage/d.jpg', rootLevel[0]?.url);

  const strItem = adaptAdminDocuments(['https://x/raw.pdf']);
  report('3.4 عنصر نصّي يُقرأ كمستند', strItem.length === 1 && strItem[0].url === 'https://x/raw.pdf', true, strItem.length);

  const unknown = adaptAdminDocuments({ documents: [{ kind: 'something_new', label: 'نوع جديد', url: 'https://x/n.pdf' }] });
  report('3.5 نوع مجهول يُحفظ لا يُرمى', unknown.length === 1, 1, unknown.length);
  report('3.6 نوع مجهول يأخذ تسمية الخادم إن وُجدت', unknown[0]?.label === 'نوع جديد', 'نوع جديد', unknown[0]?.label);

  const noUrl = adaptAdminDocuments({ documents: [{ kind: 'proof', name: 'x.jpg' }] });
  report('3.7 مستند بلا رابط يُسقط (لا زرّ ميّت)', noUrl.length === 0, 0, noUrl.length);
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(` - ${f.name}`);
  process.exitCode = 1;
}
await server.close();
