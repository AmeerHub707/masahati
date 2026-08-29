import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

// ملاحظة: قم بإنشاء ملفات وهمية/مؤقتة لهذه الصفحات لحين بنائها تفصيلياً
import SpacesPage from './pages/SpacesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import { isLoggedIn } from './lib/authStore';

// حماية المسار: الزائر غير المسجّل يُحوَّل للصفحة الرئيسية
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* الصفحة الرئيسية - صفحة الهبوط */}
      <Route path="/" element={<LandingPage />} />
      
      {/* باقي صفحات المنصة */}
      <Route path="/spaces" element={<SpacesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/password-reset" element={<ResetPasswordPage />} />
      <Route path="/password-reset/:token" element={<ResetPasswordPage />} />
      <Route path="/reset-password" element={<Navigate to="/password-reset" replace />} />
      <Route path="/reset-password/:token" element={<Navigate to="/password-reset" replace />} />
      <Route path="/api/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      
      {/* مسار احتياطي للصفحات غير الموجودة 404 */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}