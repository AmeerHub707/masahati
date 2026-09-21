// SafeHTML: يحقن HTML بعد تعقيمه عبر sanitize() (حماية من XSS).
// لا تستخدم dangerouslySetInnerHTML مباشرةً فى أى مكان آخر بالمشروط،
// بل مرّ عبر هذا المكوّن دائماً.

import { sanitize } from '../../utils/sanitize';

export default function SafeHTML({
  html,
  className,
  tag: Tag = 'div',
  ...rest
}) {
  const clean = sanitize(html);

  if (!clean) return null;

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
      {...rest}
    />
  );
}
