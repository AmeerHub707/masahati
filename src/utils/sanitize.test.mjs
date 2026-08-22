// اختبار فعلى لطبقة التعقيم تحت DOM حقيقى (jsdom).
// يُشغَّل عبر: node --experimental-vm-modules src/utils/sanitize.test.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.NodeFilter = dom.window.NodeFilter;

const { sanitize, sanitizeText, sanitizeUrl } = await import('./sanitize.js');

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
}
function assert(name, cond) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

// 1) سكربت خبيث يُزال بالكامل
let out = sanitize('<p>hi</p><script>alert(1)</script>');
assert('script removed', !/<script/i.test(out) && /<p>hi<\/p>/.test(out));

// 2) onerror على صورة يُزال
out = sanitize('<img src=x onerror="alert(1)">');
assert('img onerror removed', !/onerror/i.test(out));

// 3) رابط javascript: يُزال
out = sanitize('<a href="javascript:alert(1)">x</a>');
assert('javascript: href removed', !/href="javascript:/i.test(out));

// 4) روابط خارجية تُشدّد بـ rel + target
out = sanitize('<a href="https://evil.com">x</a>');
assert('external link hardened', /rel="noopener noreferrer nofollow"/.test(out) && /target="_blank"/.test(out));

// 5) رابط داخلى لا يأخذ target
out = sanitize('<a href="/page">x</a>');
assert('internal link no target', /href="\/page"/.test(out) && !/target=/.test(out));

// 6) وسوم مسموحة تبقى
out = sanitize('<b>جريء</b><ul><li>1</li></ul>');
assert('allowed tags kept', /<b>جريء<\/b>/.test(out) && /<ul><li>1<\/li><\/ul>/.test(out));

// 7) sanitizeText يُزيل كل الوسوم
check('sanitizeText strips tags', sanitizeText('<img src=x onerror=1><b>hi</b>'), 'hi');

// 8) sanitizeUrl يرفض javascript:
check('sanitizeUrl blocks js', sanitizeUrl('javascript:alert(1)'), '');
// 9) sanitizeUrl يسمح https
assert('sanitizeUrl allows https', sanitizeUrl('https://ok.com').startsWith('https://'));
// 10) sanitizeUrl يرفض فارغ
check('sanitizeUrl empty', sanitizeUrl('   '), '');

// 11) مدخل فارغ
check('empty input', sanitize(''), '');
check('null input', sanitize(null), '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
