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
      <WhatsAppBubble />
    </div>
  );
}