import { ownerGate } from '../../lib/ownerGate';
import { Clock, Ban, ShieldCheck } from 'lucide-react';

/**
 * بنر حالة الحساب لصاحب المساحة.
 *
 * يظهر أعلى اللوحة لكل حساب ليس `active`، ويشرح ما تبقّى عليه الإدارة
 * وما سيحصل. **ليس** مجرد تحذير: حالته هي نفسها التي يُقفل عليها زر
 * «إضافة مساحة»، فالرسالة هنا هي التفسير، لا زينة.
 *
 * نُظهره لصاحب المساحة وحده: حساب طالبٍ معلَّق يمرّ بنفس الشرط، والمعنى
 * مختلف (لا يملك مساحة أصلاً)، فالظهور له يوهمه أنه يملك.
 */
export default function OwnerPendingBanner({ user }) {
  const gate = ownerGate(user);
  if (!gate.locked) return null;

  const blocked = gate.tone === 'blocked';
  const Icon = blocked ? Ban : Clock;

// اللون من `tone` لا من `status`: الحالة المجهولة تُقفل كـ«بانتظار التفعيل»،
  // فلو لوّناها أحمر لقُلنا لمالك إن حسابه موقوف وهو ليس موقوفاً.
  const toneClass = blocked
    ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';

  return (
    <div
      data-owner-gate={gate.tone}
      role="status"
      aria-live="polite"
      className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${toneClass}`}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
// العنوان يسمّي الحالة بمفرداتها المعتمدة (بانتظار التفعيل / موقوف)،
  // وهي نفس مفردات الأدمن. «قيد المراجعة» كانت تسمية رابعة محذوفة، فبقي
  // ذكرها هنا يخبر المالك بحالةٍ لا وجود لها في النظام.
  <p className="m-0 flex flex-wrap items-center gap-2 font-extrabold">
          {blocked ? 'حسابك موقوف' : 'حسابك بانتظار التفعيل'}
          {!gate.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
              <ShieldCheck className="h-3.5 w-3.5" />
              بانتظار توثيق الهوية
            </span>
          )}
        </p>
        <p className="m-0 mt-1 leading-relaxed opacity-90">{gate.message}</p>
      </div>
    </div>
  );
}