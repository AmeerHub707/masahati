import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import Roles from '../components/landing/Roles';
import About from '../components/landing/About';
import CtaBand from '../components/landing/CtaBand';
import Footer from '../components/layout/Footer';
import WhatsAppBubble from '../components/common/WhatsAppBubble';

export default function LandingPage() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-white font-['Cairo'] text-zinc-900 dir-rtl">
      <Navbar />
      <main id="top">
        <Hero />
        <Features />
        <HowItWorks />
        <Roles />
        <About />
        <CtaBand />
      </main>
      <Footer />

      {/* زر العودة لأعلى أسفل الصفحة */}
      <div className="flex justify-center pb-8 bg-white">
        <button
          type="button"
          onClick={scrollTop}
          className="inline-flex items-center gap-2 bg-orange-500 text-white font-medium text-sm py-2.5 px-5 rounded-full shadow-[0_10px_24px_-10px_rgba(249,115,22,0.6)] hover:-translate-y-0.5 hover:bg-orange-600 transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          العودة إلى الأعلى
        </button>
      </div>

      <WhatsAppBubble />

      {/* زر العودة لأعلى الصفحة */}
      <button
        type="button"
        onClick={scrollTop}
        aria-label="العودة إلى الأعلى"
        className={`fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-[0_14px_30px_-8px_rgba(249,115,22,0.6)] hover:-translate-y-1 hover:scale-105 transition-all duration-200 ${showTop ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}