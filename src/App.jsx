import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { AppReadyContext } from './context/AppReadyContext';

// صفحات المصادح تبقى في الحزمة الأولى عمداً: زائر صفحة الهبوط لا يحتاج
// أياً منها، وتحميلها كسولاً كان سيضيف طلبات شبكة بلا فائدة له.
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { isLoggedIn, getHomePath } from './lib/authStore';

// الصفحات الثقيلة تُحمّل كسولاً؛ لوحدة المرشف كانت تسحب معها
// recharts وframer-motion وجداول كبيرة إلى الحزمة الأولية، فيُدفع ذلك لكل زائر حتى لو
// لم يفتح لوحة التحكم قط.
const SpacesPage = lazy(() => import('./pages/SpacesPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdDetailsPage = lazy(() => import('./pages/AdDetailsPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

// حماية المسار: الزائر غير المسجّل يُحوَّل للصفحة الرئيسية
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
}

// بديل انتظار حزمة المسار: هيكل ثابت بلا قفزة في الارتفاع. اللوحة المشرف
// تعرض DashboardLoading الخاص بها، وهذا الغلاف للصفحات العامة.
function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-bar" />
      <span className="route-loading-bar is-short" />
    </div>
  );
}

export default function App() {
  return (
    <AppReadyContext.Provider value={true}>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* الصفحة الرئيسية - صفحة الهبوط (الترحيب) */}
      <Route path="/" element={<LandingPage />} />
      
      {/* باقي صفحات المنصة */}
      <Route path="/spaces" element={<SpacesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/password-reset" element={<Navigate to="/reset-password" replace />} />
      <Route path="/password-reset/:token" element={<Navigate to="/reset-password" replace />} />
      <Route path="/api/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/ads/:id" element={<AdDetailsPage />} />
      <Route path="/dashboard" element={<RequireAuth><Navigate to={getHomePath()} replace /></RequireAuth>} />
      <Route path="/dashboard/customer" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/dashboard/space-owner" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      
      {/* لوحة تحكم المشرف — مسار شامل واحد حتى لا يُعاد تركيب الصفحة بين التبويبات.
          مسار صريح قبل الشامل: يمرّر :id إلى useParams، فالرابط المباشر
          /admin/users/:id يعمل بالطريقتين (المسار + قراءة pathname). */}
      <Route path="/admin/users/:id" element={<AdminDashboardPage />} />
      <Route path="/admin/*" element={<AdminDashboardPage />} />
      
      {/* مسار احتياطي للصفحات غير الموجودة 404 */}
      <Route path="*" element={<LandingPage />} />
      </Routes>
      </Suspense>
    </AppReadyContext.Provider>
  );
}