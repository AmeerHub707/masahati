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
import DashboardPage from './pages/DashboardPage';
import AdDetailsPage from './pages/AdDetailsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import { isLoggedIn, getHomePath } from './lib/authStore';

// حماية المسار: الزائر غير المسجّل يُحوَّل للصفحة الرئيسية
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
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
      <Route path="/ads/:id" element={<AdDetailsPage />} />
      <Route path="/dashboard" element={<RequireAuth><Navigate to={getHomePath()} replace /></RequireAuth>} />
      <Route path="/dashboard/customer" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/dashboard/space-owner" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      
      {/* لوحة تحكم المشرف — مسار شامل واحد حتى لا يُعاد تركيب الصفحة بين التبويبات */}
      <Route path="/admin/*" element={<AdminDashboardPage />} />
      
      {/* مسار احتياطي للصفحات غير الموجودة 404 */}
      <Route path="*" element={<LandingPage />} />
      </Routes>
    </AppReadyContext.Provider>
  );
}