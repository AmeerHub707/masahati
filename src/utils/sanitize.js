// أداة تعقيم (sanitize) المحتوى قبل حقنه في DOM عبر dangerouslySetInnerHTML.
// تُستخدم DOMPurify لإزالة أي HTML/JS خبيث (حماية من XSS).
// فى هذا المشروع لا يُسمح بـ dangerouslySetInnerHTML/innerHTML/eval إلا عبر هذه الدالة.

import DOMPurify from 'dompurify';

// إعدادات التعقيم الافتراضية الآمنة.
// نسمح فقط بوسوم/سمات التنسيق الأساسية، ونمنع كل السمات التى تُنفّذ كوداً
// (onerror, onclick, javascript: …) تلقائياً عبر DOMPurify.
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div',
    'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody',
    'tr', 'td', 'th', 'img', 'small', 'sub', 'sup',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'id', 'title',
    'src', 'alt', 'width', 'height', 'loading',
  ],
  // فتح الروابط فى تبويب جديد وآمن افتراضياً
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

// خطّاف (hook) يُشدّد كل رابط <a> داخل تدفّق DOMPurify نفسه:
// يضيف rel آمناً ويُبقي الروابط الخارجية فى تبويب جديد.
// هكذا لا نكتب innerHTML يدوياً أبداً — كل التعديل يمرّ عبر DOMPurify.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer nofollow');
    const href = node.getAttribute('href') || '';
    const isInternal = href.startsWith('/') || href.startsWith('#');
    if (!isInternal && !node.getAttribute('target')) {
      node.setAttribute('target', '_blank');
    }
  }
});

// دالة التعقيم الرئيسية: تُرجع HTML آمناً فقط.
// أى مدخل فارغ/غير نصى يُرجع سلسلة فارغة.
export function sanitize(dirty, config = DEFAULT_CONFIG) {
  if (dirty == null) return '';
  const value = String(dirty);
  if (value.trim() === '') return '';

  return DOMPurify.sanitize(value, config);
}

// تنظيف النص العادى: يُزيل كل الوسوم ويُرجع نصاً خالصاً (آمن دائماً).
export function sanitizeText(dirty) {
  if (dirty == null) return '';
  const value = String(dirty);
  if (value.trim() === '') return '';
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// تنظيف الروابط: يمنع كل الـ URI الخطيرة (javascript:, data:, vbscript: …).
// يُرجع الرابط الآمن، أو سلسلة فارغة إن كان خطيراً/فارغاً.
export function sanitizeUrl(url) {
  if (url == null) return '';
  const value = String(url).trim();
  if (value === '') return '';

  // نمرّر الرابط فى سياق وسم <a> عبر DOMPurify؛ فتزيل السمات الخطيرة تلقائياً.
  const safe = DOMPurify.sanitize(
    `<a href="${value.replace(/"/g, '&quot;')}"></a>`,
    { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] }
  );
  const match = /href="([^"]*)"/.exec(safe);
  return match ? match[1] : '';
}

export default sanitize;
