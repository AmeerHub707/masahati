import { useEffect } from 'react';

/**
 * قفل تمرير الصفحة بعدّاد مراجع، بدل `classList` مشترك بلا مالك واحد.
 *
 * العطل الذي يحلّه: كان `DashboardLoading` و`LogoutOverlay` يضيفان
 * `no-scroll` على `document.body` ويرفعانه كلٌّ في تنظيفه، بلا تنسيق بينهما.
 * عند الخروج يتعاقب الاثنان على الصنف نفسه: تنظيفٌ متأخّر يرفعه بينما الطبقة
 * الحاجبة ما زالت معروضة (فيصير التمرير خلفها ممكناً)، أو إضافةٌ متأخّرة
 * تُبقيه بعد زوال الطبقة (فيقفل التمرير إلى الأبد). الفائز كان آخر من يعمل،
 * وهو ترتيب غير مضمون — ومن هنا كان العطل متقطّعاً لا ثابتاً.
 *
 * الحل: العدّاد يملك الحقيقة. الصف يُرفع فقط حين يخرج **آخر** مالك، فلا
 * يرفع أحدٌ صنفاً يحتاجه غيره، ولا يُضاف صنفٌ بلا مالك يرفعه.
 *
 * `active=false` لا يلمس شيئاً: من لا يحتاج القفل لا يشارك في العدّ.
 */
let lockCount = 0;

// الفرضية: كل مالك يضيف مرة واحدة ويرفع مرة واحدة، فالعدّ لا يهبط تحت الصفر.
// لكن حمايةً من تنظيفٍ مكرّر (StrictMode في التطوير يُعيد تشغيل التأثيرات)
// نمنع الهبوط تحت الصفر بدل قفلٍ عالق لا يرفعه أحد.
function acquire() {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount === 1) document.body.classList.add('no-scroll');
}

function release() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.classList.remove('no-scroll');
}

/**
 * يقفل تمرير الصفحة ما دام `active` صحيحاً، ويشارك القفل مع بقية المستهلكين.
 * @param {boolean} active هل يحتاج هذا المستهلك القفل الآن؟
 */
export default function useScrollLock(active, tag = '?') {
  useEffect(() => {
    if (!active) return undefined;
    acquire();
    if (globalThis.__scrollLockDebug) console.log(`[lock] acquire ${tag} -> ${lockCount}`);
    return () => {
      release();
      if (globalThis.__scrollLockDebug) console.log(`[lock] release ${tag} -> ${lockCount}`);
    };
  }, [active, tag]);
}

// للاختبارات: تصفير الحالة المشتركة بين حالات الاختبار.
export function __resetScrollLock() {
  lockCount = 0;
  if (typeof document !== 'undefined') document.body.classList.remove('no-scroll');
}
