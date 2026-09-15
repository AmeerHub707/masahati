// مساعد مساحاتي — يتواصل مع مسار الباك إند /api/assistant/chat (وسيط AI).
// المفتاح (GEMINI_API_KEY) يبقى على الخادم؛ المتصفح يرسل الرسالة النصية فقط.
// يجب على الباك إند إرجاع JSON بالشكل:
//   { "reply": "نص الرد", "spaces": [ { id, name, location, area, price, image } ] }
//   (spaces اختياري — يُملأ عندما يجد مساحات مطابقة)

import { request, ApiError } from './api';

// مدة مهلة أطول من المعتاد لأن توليد الرد عبر الذكاء الاصطناعي
// يستغرق وقتاً إضافياً (بالإضافة إلى cold start على Render).
const ASSISTANT_TIMEOUT_MS = 45000;

/**
 * إرسال رسالة إلى مساعد مساحاتي.
 * @param {string} message نص المستخدم
 * @returns {Promise<{ reply: string|null, spaces: Array }>}
 */
export async function askAssistant(message) {
  const text = String(message || '').trim();
  if (!text) {
    throw new ApiError('أدخل رسالتك أولاً قبل الإرسال.', 0, null);
  }

  const data = await request('/api/assistant/chat', {
    method: 'POST',
    body: { message: text },
    timeoutMs: ASSISTANT_TIMEOUT_MS,
  });

  const reply =
    data && typeof data.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : null;
  const spaces = Array.isArray(data && data.spaces) ? data.spaces : [];

  return { reply, spaces };
}

// إعادة تصدير لتوحيد الاستخدام عند الحاجة
export { ApiError };