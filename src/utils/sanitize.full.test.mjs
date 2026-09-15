// اختبار شامل لطبقة التعقيم (sanitize) تحت DOM حقيقي (jsdom).
// يغطي كل سيناريوهات الخوارزمية:
//   sanitize() / sanitizeText() / sanitizeUrl() + خطاف تقوية الروابط
// يُشغَّل عبر: node --experimental-vm-modules src/utils/sanitize.full.test.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.NodeFilter = dom.window.NodeFilter;

const { sanitize, sanitizeText, sanitizeUrl } = await import('./sanitize.js');

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

// مساعد: لا يجب أن يبقى أي أثر مخرج (لا سكربت، ولا on*، ولا javascript:/data:/vbscript:)
function assertSanitized(name, input) {
  const out = sanitize(input);
  const bad = /<script|<\/script|onerror|onclick|onload|onmouseover|onanimationend|javascript:|data:text|vbscript:|\bsrcdoc=|\bformaction=/i.test(out);
  report(name, !bad && out !== '<script>' && out !== 'script', 'no executable remnants', out);
}

// ============================================================
// القسم A: sanitize() — الوسوم التنفيذية يُحذف محتواها بالكامل
// ============================================================
console.log('\n===== A) sanitize(): script/embed element removal =====');
assertSanitized('A1 <script>alert(1)</script> removed', '<script>alert(1)</script>');
assertSanitized('A2 <iframe src=//evil> removed', '<iframe src="//evil.com"></iframe>');
assertSanitized('A3 <object data=x> removed', '<object data="x"></object>');
assertSanitized('A4 <embed src=x> removed', '<embed src="x">');
assertSanitized('A5 <style> block removed', '<style>body{background:url(javascript:1)}</style>');
assertSanitized('A6 mixed-case <ScRiPt> removed', '<ScRiPt>alert(1)</sCrIpT>');
assertSanitized('A7 <link rel=stylesheet> removed', '<link rel="stylesheet" href="x">');
assertSanitized('A8 <meta http-equiv=refresh> removed', '<meta http-equiv="refresh" content="0;url=javascript:1">');

// ============================================================
// القسم B: sanitize() — سمات معالجات الأحداث (event handlers)
// ============================================================
console.log('\n===== B) sanitize(): event-handler attributes =====');
assertSanitized('B1 onclick stripped but text kept', '<div onclick="alert(1)">x</div>');
assertSanitized('B2 img onerror stripped', '<img src="x" onerror="alert(1)">');
assertSanitized('B3 img onload stripped', '<img src="x" onload="alert(1)">');
assertSanitized('B4 onmouseover stripped', '<a onmouseover="alert(1)">x</a>');
assertSanitized('B5 onanimationend stripped', '<div onanimationend="alert(1)">x</div>');
assertSanitized('B6 onfocus/onblur stripped', '<input onfocus="alert(1)" onblur="alert(1)">');
assertSanitized('B7 mixed-case ONCLICK stripped', '<div ONCLICK="alert(1)">x</div>');

// ============================================================
// القسم C: sanitize() — URIs الخطرة في href/src
// ============================================================
console.log('\n===== C) sanitize(): dangerous URI schemas =====');
assertSanitized('C1 <a href=javascript:> href removed', '<a href="javascript:alert(1)">x</a>');
assertSanitized('C2 <a href=data:text/html> removed', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>');
assertSanitized('C3 <a href=vbscript:> removed', '<a href="vbscript:msgbox(1)">x</a>');
assertSanitized('C4 <img src=javascript:> removed', '<img src="javascript:alert(1)">');
assertSanitized('C5 mixed-case JAVASCRIPT: removed', '<a href="JaVaScRiPt:alert(1)">x</a>');
assertSanitized('C6 obfuscated Java\\tscript: removed', '<a href="java\tscript:alert(1)">x</a>');
assertSanitized('C7 obfuscated newline removed', '<a href="javascri\npt:alert(1)">x</a>');

// ============================================================
// القسم D: sanitize() — سمات CSS/XSS أخرى
// ============================================================
console.log('\n===== D) sanitize(): CSS & other dangerous attributes =====');
const d1 = sanitize('<div style="background:url(javascript:1)">x</div>');
report('D1 style attribute removed', !/style=/i.test(d1), 'no style attr', d1);
assertSanitized('D2 button formaction removed', '<button formaction="javascript:alert(1)">x</button>');
assertSanitized('D3 iframe srcdoc removed', '<iframe srcdoc="<script>alert(1)</script>"></iframe>');
const d4 = sanitize('<input autofocus value="x">');
report('D4 autofocus removed', !/autofocus/i.test(d4), 'no autofocus', d4);
assertSanitized('D5 xlink:href on svg removed', '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>');

// ============================================================
// القسم E: sanitize() — mXSS (SVG/MathML/جدول)
// ============================================================
console.log('\n===== E) sanitize(): mutation XSS (mXSS) =====');
assertSanitized('E1 svg mutation XSS neutralized', '<svg><a xlink:href="javascript:alert(1)"></a></svg>');
assertSanitized('E2 math mutation XSS neutralized', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style>');
const e3 = sanitize('<table><tr><td><style><img onerror=alert(1)></style></td></tr></table>');
report('E3 table mXSS neutralized (no onerror/img)', !/onerror/i.test(e3) && !/<img/i.test(e3), 'no onerror, no img', e3);

// ============================================================
// القسم F: sanitize() — الوسوم المسموحة تُبقى، الممنوعة تُحذف
// ============================================================
console.log('\n===== F) sanitize(): allowed vs disallowed tags =====');
const f1 = sanitize('<b>جريء</b><ul><li>1</li></ul><a href="/p">رابط</a>');
report('F1 allowed tags (b,ul,li,a) kept', /<b>/.test(f1) && /<ul>/.test(f1) && /<li>1<\/li>/.test(f1) && /href="\/p"/.test(f1), 'allowed kept', f1);
const f2 = sanitize('<h1>t</h1><p>p</p><code>x</code><blockquote>q</blockquote>');
report('F2 headings/p/code/blockquote kept', /<h1>/.test(f2) && /<p>p<\/p>/.test(f2) && /<code>x<\/code>/.test(f2) && /<blockquote>q<\/blockquote>/.test(f2), 'kept', f2);
const f3 = sanitize('<font color=red>a</font><marquee>b</marquee><textarea>c</textarea><input value=x>');
report('F3 font/marquee/textarea/input removed, text kept', (!/<font/i.test(f3) && !/<marquee/i.test(f3) && !/<textarea/i.test(f3) && !/<input/i.test(f3)) && /a/.test(f3), 'disallowed removed', f3);

// ============================================================
// القسم G: sanitize() — المدخلات الفارغة/غير النصية
// ============================================================
console.log('\n===== G) sanitize(): empty & non-string inputs =====');
report('G1 empty string -> ""', sanitize('') === '', '""', String(sanitize('')));
report('G2 null -> ""', sanitize(null) === '', '""', String(sanitize(null)));
report('G3 undefined -> ""', sanitize(undefined) === '', '""', String(sanitize(undefined)));
report('G4 whitespace-only -> ""', sanitize('   ') === '', '""', String(sanitize('   ')));
// ملاحظة: التعليق البرمجي يقول "أي مدخل غير نصي يُرجع سلسلة فارغة"،
// لكن السلوك الفعلي يُحوّل غير-النصي عبر String() فيرجع قيماً غير فارغة.
// نثبت السلوك الفعلي هنا، ونرفعه كملاحظة في التقرير (تناقض تعليق/سلوك، أمان غير متأثر).
report('G5 number 0 -> "0" (comment says ""; doc-flag)', sanitize(0) === '0', '"0"', String(sanitize(0)));
report('G6 boolean false -> "false" (comment says ""; doc-flag)', sanitize(false) === 'false', '"false"', String(sanitize(false)));
report('G7 array [1,2] -> "1,2"', sanitize([1, 2]) === '1,2', '"1,2"', String(sanitize([1, 2])));
report('G8 object {} -> "[object Object]" (comment says ""; doc-flag)', sanitize({}) === '[object Object]', '"[object Object]"', String(sanitize({})));

// ============================================================
// القسم H: sanitize() — خطاف تقوية الروابط (rel/target)
// ============================================================
console.log('\n===== H) sanitize(): link-hardening hook =====');
const h1 = sanitize('<a href="https://evil.com">x</a>');
report('H1 external link gets rel=noopener noreferrer nofollow', /rel="noopener noreferrer nofollow"/.test(h1), 'rel hardened', h1);
report('H2 external link gets target=_blank', /target="_blank"/.test(h1), 'target _blank', h1);
const h2 = sanitize('<a href="/page">x</a>');
report('H3 internal link (/page) no target', !/target=/.test(h2) && /href="\/page"/.test(h2), 'no target', h2);
const h3 = sanitize('<a href="#sec">x</a>');
report('H4 hash link (#sec) no target', !/target=/.test(h3) && /href="#sec"/.test(h3), 'no target', h3);
const h4 = sanitize('<a href="https://ok.com" target="_self">x</a>');
report('H5 existing explicit target preserved', /target="_self"/.test(h4), 'target _self kept', h4);
const h5 = sanitize('<a href="https://ok.com" class="btn">x</a>');
report('H6 class attribute preserved', /class="btn"/.test(h5), 'class kept', h5);
const h6 = sanitize('<a href="//evil.com">x</a>');
report('H7 protocol-relative //evil.com href kept (treated as not-dangerous)', /href="\/\/evil\.com"/.test(h6), 'kept', h6);

// ============================================================
// القسم I: sanitize() — config مخصص
// ============================================================
console.log('\n===== I) sanitize(): custom config =====');
const i1 = sanitize('<p>a</p><b>b</b>', { ALLOWED_TAGS: ['p'], ALLOWED_ATTR: [] });
report('I1 config restrict to p only', /<p>a<\/p>/.test(i1) && !/<b>/.test(i1), '<p> only', i1);
const i2 = sanitize('<img src="https://ok.com/i.png">', { ALLOWED_TAGS: ['img'], ALLOWED_ATTR: ['src'] });
report('I2 config allows img/src', /<img src="https:\/\/ok\.com\/i\.png"/.test(i2), 'img kept', i2);

// ============================================================
// القسم J: sanitizeText() — نص خالص بلا وسوم
// ============================================================
console.log('\n===== J) sanitizeText(): plain text only =====');
// ملاحظة: محتوى <script> يُحذف بالكامل (لا يبقى كنص) عند تعقيم النص. هذا سلوك آمن وصحيح.
report('J1 strips all tags (script content fully removed)', sanitizeText('<b>hi</b><script>bad</script>') === 'hi', '"hi"', sanitizeText('<b>hi</b><script>bad</script>'));
report('J2 strips img onerror', sanitizeText('<img src=x onerror=alert(1)>hi') === 'hi', '"hi"', sanitizeText('<img src=x onerror=alert(1)>hi'));
report('J3 null -> ""', sanitizeText(null) === '', '""', String(sanitizeText(null)));
report('J4 empty -> ""', sanitizeText('') === '', '""', String(sanitizeText('')));
report('J5 nested malformed flattened to text', !/<[a-z]/i.test(sanitizeText('<div><p><script>alert(1)</script>hi</p></div>')), 'no tags', sanitizeText('<div><p><script>alert(1)</script>hi</p></div>'));
report('J6 multiline whitespace kept', sanitizeText('  a  b  ').includes('a') && sanitizeText('  a  b  ').includes('b'), 'text kept', sanitizeText('  a  b  '));

// ============================================================
// القسم K: sanitizeUrl() — منع الـ URI الخطرة
// ============================================================
console.log('\n===== K) sanitizeUrl(): blocking dangerous URIs =====');
report('K1 blocks javascript:', sanitizeUrl('javascript:alert(1)') === '', '', sanitizeUrl('javascript:alert(1)'));
report('K2 blocks mixed-case JavaScript:', sanitizeUrl('JaVaScRiPt:alert(1)') === '', '', sanitizeUrl('JaVaScRiPt:alert(1)'));
report('K3 blocks obfuscated java\\tscript:', sanitizeUrl('java\tscript:alert(1)') === '', '', sanitizeUrl('java\tscript:alert(1)'));
report('K4 blocks newline obfuscation:', sanitizeUrl('javascri\npt:alert(1)') === '', '', sanitizeUrl('javascri\npt:alert(1)'));
report('K5 blocks data:text/html:', sanitizeUrl('data:text/html,<script>') === '', '', sanitizeUrl('data:text/html,<script>'));
report('K6 blocks data:image too:', sanitizeUrl('data:image/png;base64,iVBOR') === '', '', sanitizeUrl('data:image/png;base64,iVBOR'));
report('K7 blocks vbscript:', sanitizeUrl('vbscript:msgbox(1)') === '', '', sanitizeUrl('vbscript:msgbox(1)'));
report('K8 blocks quote/attribute breakout:', sanitizeUrl('"><script>alert(1)</script>') === '', '', sanitizeUrl('"><script>alert(1)</script>'));
// ملاحظة: الكوتات داخل القيمة تُرمّز ككيان &quot; (لا يخرج أي كوت خام يتجاوز سمة href).
// عند وضعه لاحقاً في href يُفك المتصفح الكيان بعد التحليل، فيصبح جزءاً من المسار لا خاصية جديدة -> آمن.
const k9 = sanitizeUrl('foo" onerror="alert(1)');
report('K9 embedded quote is entity-encoded &quot; (no raw quote breakout)', !k9.includes('"') && k9.includes('&quot;'), 'encoded &quot;, no raw "', k9);
report('K10 empty -> ""', sanitizeUrl('   ') === '', '""', String(sanitizeUrl('   ')));
report('K11 null -> ""', sanitizeUrl(null) === '', '""', String(sanitizeUrl(null)));

// ============================================================
// القسم L: sanitizeUrl() — السماح بالروابط الآمنة
// ============================================================
console.log('\n===== L) sanitizeUrl(): allowing safe URIs =====');
report('L1 allows https', sanitizeUrl('https://ok.com').startsWith('https://'), 'starts https://', sanitizeUrl('https://ok.com'));
report('L2 allows http', sanitizeUrl('http://ok.com') === 'http://ok.com', 'http://ok.com', sanitizeUrl('http://ok.com'));
report('L3 allows mailto', sanitizeUrl('mailto:a@b.com') === 'mailto:a@b.com', 'mailto:a@b.com', sanitizeUrl('mailto:a@b.com'));
report('L4 allows tel', sanitizeUrl('tel:+12345') === 'tel:+12345', 'tel:+12345', sanitizeUrl('tel:+12345'));
report('L5 allows relative /path', sanitizeUrl('/path') === '/path', '/path', sanitizeUrl('/path'));
report('L6 allows hash #anchor', sanitizeUrl('#anchor') === '#anchor', '#anchor', sanitizeUrl('#anchor'));

// ============================================================
// ملخص
// ============================================================
console.log(`\n===== SUMMARY =====`);
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed scenarios:');
  failures.forEach((f) => console.log(`  - ${f.name}`));
}
process.exit(fail ? 1 : 0);
