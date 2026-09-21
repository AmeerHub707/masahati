import { Home, Users, Building2, CalendarCheck, Star, Wallet, Send, Settings } from 'lucide-react';

// تبويبات لوحة تحكم المشرف — مستخدمة في الشريط الجانبي ومكوّنات الصفحات.
export const ADMIN_TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'users', label: 'إدارة المستخدمين والملاك', icon: Users },
  { id: 'spaces', label: 'إدارة المساحات', icon: Building2 },
  { id: 'bookings', label: 'الحجوزات والنزاعات', icon: CalendarCheck },
  { id: 'reviews', label: 'التقييمات والمراجعات', icon: Star },
  { id: 'financials', label: 'التقارير المالية', icon: Wallet },
  { id: 'notifications', label: 'الإشعارات', icon: Send },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];