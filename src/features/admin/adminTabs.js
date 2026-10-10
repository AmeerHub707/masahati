import { Home, Users, Building2, CalendarCheck, Star, Wallet, Inbox, Megaphone, Settings } from 'lucide-react';

// تبويبات لوحة تحكم المشرف — مستخدمة في الشريط الجانبي ومكوّنات الصفحات.
// كل تبويب له مسار URL خاص به؛ عنصر "الإشعارات" هو مجموعة قائمة فرعية قابلة للطيّ.
export const ADMIN_TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home, path: '/admin' },
  { id: 'users', label: 'إدارة المستخدمين والملاك', icon: Users, path: '/admin/users' },
  { id: 'spaces', label: 'إدارة المساحات', icon: Building2, path: '/admin/spaces' },
  { id: 'bookings', label: 'الحجوزات والنزاعات', icon: CalendarCheck, path: '/admin/bookings' },
  { id: 'reviews', label: 'التقييمات والمراجعات', icon: Star, path: '/admin/reviews' },
  { id: 'financials', label: 'التقارير المالية', icon: Wallet, path: '/admin/financials' },
  { id: 'notifications', label: 'الإشعارات', icon: Inbox, path: '/admin/notifications/inbox', group: true },
  { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
];

// عناصر القائمة الفرعية لتبويب الإشعارات (قائمة قابلة للطي في الشريط الجانبي).
export const ADMIN_NOTIF_TABS = [
  { id: 'inbox', label: 'التنبيهات الواردة', icon: Inbox, path: '/admin/notifications/inbox' },
  { id: 'broadcast', label: 'البث الجماعي', icon: Megaphone, path: '/admin/notifications/broadcast' },
];