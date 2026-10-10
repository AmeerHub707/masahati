// حساب موضع القوائم العائمة (position: fixed) داخل حدود النافذة.
// وحدة مستقلة عمداً: تصدير دالة من ملف مكوّنات يخالف قاعدة react-refresh،
// ووجودها هنا يجعلها قابلة لإعادة الاستخدام من أي قائمة إجراءات في اللوحة.

// أبعاد القوائم وثوابت التباعد — تُضبط حسب عدد عناصر كل قائمة.
export const MENU_WIDTH = 176;
export const MENU_HEIGHT = 200;
export const VIEWPORT_PAD = 8;
export const MENU_GAP = 6;

/**
 * يضع قائمة ثابتة بجانب مرساة، ويبقيها داخل حدود النافذة في الاتجاهين.
 * يفضّل اليسار افتراضياً (RTL)، ويرجع إلى اليمين أو إلى أي جهة ممكنة عند ضيق المساحة.
 */
export function placeFixed(rect, width, height, prefer = 'left') {
  const canStart = rect.left - width - MENU_GAP >= VIEWPORT_PAD;
  const canEnd = rect.right + MENU_GAP + width <= window.innerWidth - VIEWPORT_PAD;
  let left;
  if (prefer === 'left' && canStart) left = rect.left - width - MENU_GAP;
  else if (prefer === 'right' && canEnd) left = rect.right + MENU_GAP;
  else if (canStart) left = rect.left - width - MENU_GAP;
  else if (canEnd) left = rect.right + MENU_GAP;
  else left = rect.left - width - MENU_GAP;
  left = Math.min(Math.max(VIEWPORT_PAD, left), Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD));

  const below = rect.bottom + MENU_GAP;
  const above = rect.top - height - MENU_GAP;
  const fitsBelow = below + height <= window.innerHeight - VIEWPORT_PAD;
  const top = Math.min(
    Math.max(VIEWPORT_PAD, fitsBelow ? below : above),
    Math.max(VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD)
  );
  return { top, left };
}
