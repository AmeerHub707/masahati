// اختبارات وحدة لأدوات معاينة المستندات (`src/lib/docPreview.js`).
//
// الحمولة مأخوذة من الردّ الحقيقي المسجَّل من الخادم عبر
// `GET /api/admin/documents?space_id=1` (انظر adminDocuments.test.mjs).
// الهدف أن يبقى كشف النوع صحيحاً مع الأشكال التي يرسلها الخادم فعلاً،
// لأن الخطأ هنا يعني إطار PDF فارغاً أو صورة مكسورة أمام قرار أدمن.
//
// يعمل عبر Vite SSR لأن docPreview.js وحدة ESM بلا اعتماد على DOM.
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

const { detectDocType, docFileName, docExtension, isInlineViewable } = await server.ssrLoadModule(
  '/src/lib/docPreview.js'
);

// ----- 1. الرابط الحقيقي من الخادم -----
const REAL_IMAGE =
  'https://res.cloudinary.com/wlxftoau/image/upload/documents/vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg';
{
  report('1.1 صورة Cloudinary حقيقية تُكشف صورةً', detectDocType(REAL_IMAGE) === 'image', 'image', detectDocType(REAL_IMAGE));
  report(
    '1.2 اسم الملف الحقيقي يُحفظ',
    docFileName({ name: 'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg', url: REAL_IMAGE }) ===
      'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
    'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg',
    docFileName({ name: 'vAqplmUPcv8QaXdGqlrjwN69zru40GOz6Cr5h1pU.jpg', url: REAL_IMAGE })
  );
  report('1.3 الامتداد JPG للشارة', docExtension({ url: REAL_IMAGE }) === 'JPG', 'JPG', docExtension({ url: REAL_IMAGE }));
  report('1.4 الصورة تُعرض داخل الصفحة', isInlineViewable('image') === true, true, isInlineViewable('image'));
}

// ----- 2. PDF -----
{
  report('2.1 رابط PDF', detectDocType('https://x.test/files/deed.pdf') === 'pdf', 'pdf', detectDocType('https://x.test/files/deed.pdf'));
  report('2.2 PDF بحروف كبيرة', detectDocType('https://x.test/FILES/DEED.PDF') === 'pdf', 'pdf', detectDocType('https://x.test/FILES/DEED.PDF'));
  report('2.3 PDF يُعرض داخل إطار', isInlineViewable('pdf') === true, true, isInlineViewable('pdf'));
}

// ----- 3. سلسلة الاستعلام لا تُفسد الكشف -----
{
  const signed = 'https://res.cloudinary.com/x/image/upload/v1/documents/scan.jpg?signature=abc&expires=9';
  report('3.1 الامتداد قبل معاملات الرابط يُقرأ', detectDocType(signed) === 'image', 'image', detectDocType(signed));

  const pdfQuery = 'https://x.test/download?file=contract.pdf&token=1';
  report('3.2 PDF داخل معامل يُقرأ من الاسم', detectDocType(pdfQuery, 'contract.pdf') === 'pdf', 'pdf', detectDocType(pdfQuery, 'contract.pdf'));
}

// ----- 4. الرجوع إلى اسم الملف عندما يخلو الرابط من امتداد -----
{
  report(
    '4.1 رابط بلا امتداد + اسم صورة',
    detectDocType('/storage/documents/8f3c9a', 'proof.png') === 'image',
    'image',
    detectDocType('/storage/documents/8f3c9a', 'proof.png')
  );
  report(
    '4.2 رابط بلا امتداد + اسم PDF',
    detectDocType('/storage/documents/8f3c9a', 'deed.pdf') === 'pdf',
    'pdf',
    detectDocType('/storage/documents/8f3c9a', 'deed.pdf')
  );
  report(
    '4.3 رابط Cloudinary بلا امتداد يُعرف من مسار المورد',
    detectDocType('https://res.cloudinary.com/x/image/upload/documents/8f3c9a') === 'image',
    'image',
    detectDocType('https://res.cloudinary.com/x/image/upload/documents/8f3c9a')
  );
}

// ----- 5. أنواع لا يعرضها المتصفّح داخل إطار -----
{
  report('5.1 Word يُصنَّف office', detectDocType('https://x.test/deed.docx') === 'office', 'office', detectDocType('https://x.test/deed.docx'));
  report('5.2 Excel يُصنَّف office', detectDocType('https://x.test/fin.xlsx') === 'office', 'office', detectDocType('https://x.test/fin.xlsx'));
  report('5.3 office لا يُعرض داخل الصفحة', isInlineViewable('office') === false, false, isInlineViewable('office'));
  report('5.4 مجهول يُصنَّف unknown', detectDocType('https://x.test/thing') === 'unknown', 'unknown', detectDocType('https://x.test/thing'));
  report('5.5 مجهول لا يُعرض داخل الصفحة', isInlineViewable('unknown') === false, false, isInlineViewable('unknown'));
  report('5.6 قيمة فارغة لا ترمي', detectDocType('') === 'unknown', 'unknown', detectDocType(''));
  report('5.7 بلا وسائط لا يرمي', detectDocType() === 'unknown', 'unknown', detectDocType());
}

// ----- 6. اسم العرض والامتداد -----
{
  report(
    '6.1 الاسم من الرابط عند غياب name',
    docFileName({ url: '/storage/documents/deed-2026.pdf' }) === 'deed-2026.pdf',
    'deed-2026.pdf',
    docFileName({ url: '/storage/documents/deed-2026.pdf' })
  );
  report(
    '6.2 الاسم من الرابط مع سلسلة استعلام',
    docFileName({ url: 'https://x.test/a/b/deed.pdf?token=1' }) === 'deed.pdf',
    'deed.pdf',
    docFileName({ url: 'https://x.test/a/b/deed.pdf?token=1' })
  );
  report('6.3 اسم بديل عند الفراغ', docFileName({}) === 'مستند', 'مستند', docFileName({}));
  report(
    '6.4 الامتداد من الاسم أولاً',
    docExtension({ url: '/storage/abc', name: 'license.pdf' }) === 'PDF',
    'PDF',
    docExtension({ url: '/storage/abc', name: 'license.pdf' })
  );
  report('6.5 لا امتداد ← نصّ فارغ', docExtension({ url: '/storage/abc' }) === '', '', docExtension({ url: '/storage/abc' }));
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(` - ${f.name}`);
  process.exitCode = 1;
}
await server.close();
