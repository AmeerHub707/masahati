// SafeLink: رابط آمن لا يُنفّذ كوداً خبيثاً (حماية من javascript:/data: …).
// يُعقّم الرابط عبر sanitizeUrl، ويضيف rel/target آمنين تلقائياً.
// إن كان الرابط خطيراً يُعطّل النقر بدل فتحه.

import { sanitizeUrl } from '../../utils/sanitize';

export default function SafeLink({
  href,
  children,
  className,
  target,
  rel,
  onClick,
  ...rest
}) {
  const safeHref = sanitizeUrl(href);

  // رابط داخلى (نسبى) → نفتحه فى نفس التبويب دون rel خاص.
  const isInternal = safeHref.startsWith('/') || safeHref.startsWith('#');

  const finalTarget = target ?? (isInternal ? undefined : '_blank');
  const finalRel = isInternal
    ? rel
    : rel ?? 'noopener noreferrer nofollow';

  if (!safeHref) {
    // رابط غير آمن/فارغ: نعرض النص كعنصر غير قابل للنقر.
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={safeHref}
      className={className}
      target={finalTarget}
      rel={finalRel}
      onClick={onClick}
      {...rest}
    >
      {children}
    </a>
  );
}
