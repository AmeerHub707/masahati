const TOUR_PREFIX = 'masahati.owner-tour.v1.completed';
const memory = new Set();

function normalizeId(userId) {
  const value = String(userId ?? '').trim();
  return value || 'guest';
}

export function ownerTourKey(userId) {
  return `${TOUR_PREFIX}:${normalizeId(userId)}`;
}

export function hasCompletedOwnerTour(userId) {
  const key = ownerTourKey(userId);
  if (memory.has(key)) return true;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markOwnerTourCompleted(userId) {
  const key = ownerTourKey(userId);
  memory.add(key);
  try {
    localStorage.setItem(key, '1');
  } catch { /* التخزين غير متاح: نكتفي بالحالة داخل الجلسة */ }
}

export function clearOwnerTourCompleted(userId) {
  const key = ownerTourKey(userId);
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch { /* لا حاجة للفشل هنا */ }
}
