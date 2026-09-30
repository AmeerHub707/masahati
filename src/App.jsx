import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { AppReadyContext } from './context/AppReadyContext';

// ملاحظة: قم بإنشاء ملفات وهمية/مؤقتة لهذه الصفحات لحين بنائها تفصيلياً
import SpacesPage from './pages/SpacesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import CustomerDashboard from './pages/CustomerDashboard';
import SpaceOwnerDashboard from './pages/SpaceOwnerDashboard';
import AdDetailsPage from './pages/AdDetailsPage';
import ComparePage from './pages/ComparePage';
import { isLoggedIn, getUser, getHomePath, normalizeRole } from './lib/authStore';

// حماية المسار: الزائر غير المسجّل يُحوَّل للصفحة الرئيسية
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
}

// إعادة توجيه المستخدم إلى لوحة التحكم الخاصة بدوره (أو الرئيسية إن كان الدور مفقوداً).
function redirectForRole() {
  const userRole = normalizeRole(getUser()?.role);
  if (userRole !== 'customer' && userRole !== 'space_owner') return '/';
  return getHomePath();
}

// حماية الدور (شرط صارم): كل لوحة تحكم تُفتح لنوع حسابها فقط، ولا يُسمح
// بالخلط بين لوحة العميل ولوحة صاحب المساحة. الدور غير المتطابق يُحوَّل
// إلى لوحة تحكم بدوره (أو الرئيسية إن لم يكن له دور صالح).
function RequireRole({ role, children }) {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  const userRole = normalizeRole(getUser()?.role);
  if (role === 'space_owner') {
    if (userRole === 'space_owner') return children;
  } else if (role === 'customer') {
    if (userRole === 'customer') return children;
  }
  return <Navigate to={redirectForRole()} replace />;
}

export default function App() {
  return (
    <AppReadyContext.Provider value={true}>
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
      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/ads/:id" element={<AdDetailsPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/dashboard" element={<RequireAuth><Navigate to={getHomePath()} replace /></RequireAuth>} />
      <Route path="/dashboard/customer" element={<RequireAuth><RequireRole role="customer"><CustomerDashboard /></RequireRole></RequireAuth>} />
      <Route path="/dashboard/space-owner" element={<RequireAuth><RequireRole role="space_owner"><SpaceOwnerDashboard /></RequireRole></RequireAuth>} />
      
      {/* مسار احتياطي للصفحات غير الموجودة 404 */}
      <Route path="*" element={<LandingPage />} />
      </Routes>
    </AppReadyContext.Provider>
  );
}