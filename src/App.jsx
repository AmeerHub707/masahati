import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

// ملاحظة: قم بإنشاء ملفات وهمية/مؤقتة لهذه الصفحات لحين بنائها تفصيلياً
import SpacesPage from './pages/SpacesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

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
      
      {/* مسار احتياطي للصفحات غير الموجودة 404 */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}