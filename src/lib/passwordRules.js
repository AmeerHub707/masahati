const MIN_LENGTH = 8;
const SPECIAL_CHARS = /[@$!%*?&]/;
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;

export const PASSWORD_LENGTH_MESSAGE = `كلمة المرور يجب ألا تقل عن ${MIN_LENGTH} أحرف.`;

export const PASSWORD_FORMAT_MESSAGE =
  'كلمة المرور يجب أن تحتوي على: حرف كبير (A-Z)، حرف صغير (a-z)، رقم (0-9)، ورمز خاص (@$!%*?&).';

export const PASSWORD_RULES = [
  { id: 'hasMinLength', label: `${MIN_LENGTH} أحرف على الأقل`, ok: (p) => p.length >= MIN_LENGTH },
  { id: 'hasUpperCase', label: 'حرف كبير (A-Z)', ok: (p) => UPPER.test(p) },
  { id: 'hasLowerCase', label: 'حرف صغير (a-z)', ok: (p) => LOWER.test(p) },
  { id: 'hasNumber', label: 'رقم (0-9)', ok: (p) => DIGIT.test(p) },
  { id: 'hasSpecialChar', label: 'رمز خاص (@$!%*?&)', ok: (p) => SPECIAL_CHARS.test(p) },
];

export function getPasswordChecks(password) {
  const value = String(password || '');
  const checks = {};
  for (const rule of PASSWORD_RULES) checks[rule.id] = rule.ok(value);
  checks.isValid = PASSWORD_RULES.every((rule) => checks[rule.id]);
  return checks;
}

export function checkPassword(password) {
  const checks = getPasswordChecks(password);
  if (checks.isValid) return '';
  const failed = PASSWORD_RULES.filter((rule) => !checks[rule.id]).map((rule) => rule.label);
  return `كلمة المرور يجب أن تحتوي على: ${failed.join('، ')}.`;
}

export function getPasswordStrength(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= MIN_LENGTH) score++;
  if (value.length >= 12) score++;
  if (LOWER.test(value) && UPPER.test(value)) score++;
  if (DIGIT.test(value)) score++;
  if (SPECIAL_CHARS.test(value)) score++;
  return Math.min(score, 4);
}

export const strengthLabels = ['—', 'ضعيف', 'متوسط', 'جيد', 'ممتاز'];
