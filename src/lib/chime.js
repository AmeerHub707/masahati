// نغمة قصيرة مولّدة محلياً عبر Web Audio — بلا ملف صوتي خارجي ولا بيانات وهمية.
// المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم، لذلك نُهيّئ السياق عند أول
// نقرة أو ضغطة مفتاح ثم نعزف عند وصول الإشعار.

let ctx = null;
let unlocked = false;

function getContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    try { ctx = new AudioCtx(); } catch { return null; }
  }
  return ctx;
}

export function unlockChime() {
  if (unlocked || typeof document === 'undefined') return () => {};
  const onGesture = () => {
    const c = getContext();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    unlocked = true;
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
  };
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);
  return () => {
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
  };
}

export function playChime() {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const now = c.currentTime;
  [[880, 0], [1174, 0.09]].forEach(([frequency, offset]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.17);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.19);
  });
}
