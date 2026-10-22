import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Download,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  TriangleAlert,
  LoaderCircle,
} from 'lucide-react';
import { imageUrl } from '@/lib/api';
import useLanguage from '@/hooks/useLanguage';
import useScrollLock from '@/hooks/useScrollLock';
import { useDialogA11y } from '@/lib/dialogA11y';
import { detectDocType, docFileName, docExtension } from '@/lib/docPreview';

const TYPE_LABEL = {
  image: 'صورة',
  pdf: 'PDF',
  office: 'مستند',
  unknown: 'مستند',
};

/** أيقونة النوع — تُستعمل في البطاقة البديلة وفي مصغّرات شريط التنقل. */
export function DocTypeIcon({ type, className }) {
  if (type === 'image') return <ImageIcon className={className} />;
  if (type === 'pdf') return <FileText className={className} />;
  if (type === 'office') return <FileSpreadsheet className={className} />;
  return <TriangleAlert className={className} />;
}

/**
 * مصغّرة مستند: صورة إن كان المستند صورة، وأيقونة نوعه إن لم تكن أو فشل
 * تحميلها.
 *
 * الصورة تُعرض كصورة فعلاً — أسرع تعرّف على المستند من اسم ملف. ونحفظ
 * المسار الفاشل لا علماً منطقياً، فلا تتكرّر محاولة تحميل رابط مكسور عند
 * كل تصيير. الحجم يأتي من الحاوية (شريط التنقل أو بطاقة المستند).
 */
export function DocThumbnail({ doc, alt = '', className = '' }) {
  const type = detectDocType(doc.url, doc.name);
  const [failedSrc, setFailedSrc] = useState(null);
  const src = type === 'image' ? imageUrl(doc.url) : '';

  if (!src || failedSrc === src) {
    return (
      <span className={`docthumb docthumb--icon ${className}`} aria-hidden="true">
        <DocTypeIcon type={type} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`docthumb docthumb--img ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}

/**
 * عارض مستندات المساحة — نافذة كاملة فوق نافذة معاينة المساحة.
 *
 * **لماذا لا نعرض المستند داخل نافذة المعاينة نفسها؟** لأن المساحة قد تحمل
 * ثلاثة مستندات أو أكثر، ولكلٍّ نسبة عرض مختلفة (صورة عمودية، مسح أفقي،
 * PDF متعدّد الصفحات). حشرها في عمودٍ ضيّق يعني دليلَ تملكٍ يُقرأ بحجم طابع
 * بريد. فالعارض يأخذ الشاشة، ويبقى قرار التفعيل في نافذة المساحة خلفه.
 *
 * **ماذا يعرض؟**
 *  - صورة: داخل الصفحة مع تكبير/تصغير (25%–400%) وإعادة ضبط.
 *  - PDF: إطار مدمج يعرض صفحات PDF الأصلية بأدوات المتصفّح (تمرير، طباعة…).
 *  - غير ذلك (Word/Excel/غريب): بطاقة صريحة بزرّي «فتح» و«تنزيل» بدل إطار
 *    أبيض يوهم الأدمن بأن المستند فارغ.
 *
 * **التنقل:** أسهم لوحة المفاتيح (يمين/يسار حسب اتجاه اللغة) وأزرار الشريط
 * السفلي والمصغّرات. وكل مستند يبقى متاحاً بـ«فتح في تبويب جديد» و«تنزيل»
 * كطريق احتياطي إن حجب المتصفّح العرض المدمج.
 */
export default function DocViewer({ docs, index, onIndexChange, onClose }) {
  const { isRtl } = useLanguage();
  const doc = docs?.[index] || null;
  const count = docs?.length || 0;

  const type = doc ? detectDocType(doc.url, doc.name) : 'unknown';
  const file = doc ? docFileName(doc) : '';
  const ext = doc ? docExtension(doc) : '';
  const href = doc ? imageUrl(doc.url) : '';

  // التكبير وحالة الصورة عرضٌ يخصّ المستند المعروض. نُصفّرها بإعادة تركيب
  // المكوّن على مفتاح المستند (في نداء Spaces) بدل `setState` داخل تأثير:
  // التصفير داخل التأثير يُنتج تصييراً إضافياً بعد الطلاء، ويرث المستندُ
  // الجديد تكبيرَ سابقه لحظةً فيظهر مقصوصاً بلا سبب.
  const [scale, setScale] = useState(1);
  const [imgState, setImgState] = useState(type === 'image' ? 'loading' : 'ready'); // loading | ready | error

  // قياس المسرح والأبعاد الأصلية للصورة — لأجل تكبيرٍ حقيقي.
  //
  // `transform: scale()` لا يغيّر صندوق التخطيط، فلا تظهر أشرطة تمرير
  // والمحتوى المكبَّر يُقتطع بلا وسيلة لرؤية أطرافه. لذلك نحسب الأبعاد
  // المعروضة صراحةً: «ملاءمة المسرح» عند 100%، ثم تتضاعف مع التكبير فيكبر
  // الصندوق فعلاً ويعمل التمرير — وهذا هو التكبير المفيد لقراءة وثيقة.
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setStage({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const fit = useMemo(() => {
    if (!natural.w || !natural.h || !stage.w || !stage.h) return null;
    const pad = 32; // حشوة المسرح من كل جهة
    return Math.min(1, (stage.w - pad) / natural.w, (stage.h - pad) / natural.h);
  }, [natural, stage]);

  const rendered = useMemo(
    () =>
      fit == null
        ? null
        : {
            width: Math.max(1, Math.round(natural.w * fit * scale)),
            height: Math.max(1, Math.round(natural.h * fit * scale)),
          },
    [fit, natural, scale]
  );

  const onImgLoad = useCallback((e) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    setImgState('ready');
  }, []);

  // حصر التركيز داخل العارض وإرجاعه لزرّ المعاينة عند الإغلاق (نفس عقد
  // نوافذ لوحة المالك). والخطّاف يتولّى Escape ويُوقف انتشاره، فلا تُغلق
  // نافذة المساحة خلفه في الوقت نفسه.
  const containerRef = useDialogA11y({ open: Boolean(doc), onClose });

  // قفل تمرير الصفحة ما دام العارض مفتوحاً: عجلة الفأرة فوق طبقة ثابتة
  // تتسرّب إلى الصفحة تحتها فتتحرك نافذة المساحة خلف العارض. نستخدم العدّاد
  // المشترك (`useScrollLock`) لا كتابةً مباشرة على `body.style`: الطبقة قد
  // تتشارك الصفحة مع حاجب خروج أو تحميل، والعدّاد يرفع القفل عند خروج آخر
  // مالك فقط — والكتابة المباشرة تلغي قفلاً يملكه غيرنا.
  useScrollLock(Boolean(doc));

  const go = useCallback(
    (delta) => {
      if (count < 2) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange]
  );

  // سهم «السابق» في RTL يشير يميناً (اتجاه الرجوع في القراءة العربية).
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!doc || count < 2) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(isRtl ? 1 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(isRtl ? -1 : 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, count, go, isRtl]);

  const zoom = useCallback((step) => {
    setScale((s) => {
      const next = Math.round((s + step) * 100) / 100;
      return Math.min(4, Math.max(0.25, next));
    });
  }, []);

  const typeLabel = TYPE_LABEL[type] || TYPE_LABEL.unknown;

  const thumbs = useMemo(
    () => (docs || []).map((d, i) => ({ doc: d, i, key: `${d.kind}:${d.url}:${i}` })),
    [docs]
  );

  if (!doc) return null;

  return (
    <div
      className="docv"
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة المستند: ${file}`}
      data-doc-viewer
      data-doc-viewer-type={type}
    >
      <div className="docv__scrim" onClick={onClose} />

      <div className="docv__panel" ref={containerRef} tabIndex={-1}>
        {/* الشريط العلوي: هوية المستند + أدوات العرض */}
        <header className="docv__bar">
          <div className="docv__ident">
            <span className="docv__badge" aria-hidden="true">
              {ext || typeLabel}
            </span>
            <span className="docv__titlewrap">
              <span className="docv__name" title={file}>
                {file}
              </span>
              <span className="docv__meta">
                <span className="bidi-iso">{doc.label}</span>
                {count > 1 && (
                  <>
                    {' · '}
                    <span className="num" dir="ltr">
                      {index + 1}/{count}
                    </span>
                  </>
                )}
              </span>
            </span>
          </div>

          <div className="docv__tools">
            {type === 'image' && (
              <>
                <button
                  type="button"
                  className="docv__tool"
                  onClick={() => zoom(-0.25)}
                  disabled={scale <= 0.25}
                  aria-label="تصغير"
                  title="تصغير"
                  data-doc-zoom-out
                >
                  <ZoomOut />
                </button>
                <span className="docv__zoom" aria-live="polite" data-doc-zoom>
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  className="docv__tool"
                  onClick={() => zoom(0.25)}
                  disabled={scale >= 4}
                  aria-label="تكبير"
                  title="تكبير"
                  data-doc-zoom-in
                >
                  <ZoomIn />
                </button>
                <button
                  type="button"
                  className="docv__tool"
                  onClick={() => setScale(1)}
                  disabled={scale === 1}
                  aria-label="إعادة ضبط التكبير"
                  title="إعادة ضبط التكبير"
                  data-doc-zoom-reset
                >
                  <RotateCcw />
                </button>
              </>
            )}

            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="docv__tool"
              aria-label="فتح في تبويب جديد"
              title="فتح في تبويب جديد"
              data-doc-open
            >
              <ExternalLink />
            </a>
            <a
              href={href}
              download={file}
              className="docv__tool"
              aria-label="تنزيل المستند"
              title="تنزيل المستند"
              data-doc-download
            >
              <Download />
            </a>
            <button
              type="button"
              className="docv__tool docv__tool--close"
              onClick={onClose}
              aria-label="إغلاق المعاينة"
              title="إغلاق المعاينة"
              data-doc-close
              data-autofocus
            >
              <X />
            </button>
          </div>
        </header>

        {/* المسرح: خلفية داكنة ثابتة في الوضعين، كما في كل عارض مستندات. */}
        <div className="docv__stage" data-doc-stage ref={stageRef}>
          {type === 'image' && imgState === 'loading' && (
            <span className="docv__spin" role="status" aria-label="جارٍ تحميل الصورة">
              <LoaderCircle />
            </span>
          )}

          {type === 'image' && imgState !== 'error' ? (
            <div className="docv__canvas">
              <img
                src={href}
                alt={`مستند: ${doc.label}`}
                className="docv__img"
                style={{
                  ...(rendered || { maxWidth: '100%', maxHeight: '100%' }),
                  opacity: imgState === 'ready' ? 1 : 0,
                }}
                draggable={false}
                decoding="async"
                onLoad={onImgLoad}
                onError={() => setImgState('error')}
                data-doc-image
              />
            </div>
          ) : type === 'pdf' ? (
            <iframe className="docv__frame" src={href} title={`PDF: ${file}`} data-doc-frame />
          ) : (
            <div className="docv__fallback" data-doc-fallback>
              <span className="docv__fallbackico">
                <DocTypeIcon type={type} className="h-7 w-7" />
              </span>
              <p className="docv__fallbacktitle">
                {imgState === 'error' ? 'تعذّر تحميل الصورة' : 'هذا النوع لا يُعرض داخل الصفحة'}
              </p>
              <p className="docv__fallbacktext">
                {imgState === 'error'
                  ? 'قد يكون الرابط منتهي الصلاحية أو الملف غير متاح. استخدم «فتح في تبويب جديد» للتحقق.'
                  : 'ملفات Word وExcel وغيرها لا يعرضها المتصفّح مدمجة. افتح المستند في تبويب جديد أو نزّله لمراجعته قبل القرار.'}
              </p>
              <div className="docv__fallbackacts">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="docv__cta docv__cta--primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح في تبويب جديد
                </a>
                <a href={href} download={file} className="docv__cta">
                  <Download className="h-4 w-4" />
                  تنزيل
                </a>
              </div>
            </div>
          )}
        </div>

        {/* شريط التنقل بين المستندات — يظهر فقط عند وجود أكثر من مستند. */}
        {count > 1 && (
          <footer className="docv__strip">
            <button
              type="button"
              className="docv__nav"
              onClick={() => go(isRtl ? 1 : -1)}
              aria-label="المستند السابق"
              title="المستند السابق"
            >
              <PrevIcon />
            </button>

            <div className="docv__thumbs" role="tablist" aria-label="مستندات المساحة">
              {thumbs.map(({ doc: d, i, key }) => {
                const activeThumb = i === index;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeThumb}
                    className={`docv__thumb${activeThumb ? ' is-active' : ''}`}
                    onClick={() => onIndexChange(i)}
                    aria-label={`${d.label} — ${docFileName(d)}`}
                    title={`${d.label} — ${docFileName(d)}`}
                  >
                    <DocThumbnail doc={d} alt="" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="docv__nav"
              onClick={() => go(isRtl ? -1 : 1)}
              aria-label="المستند التالي"
              title="المستند التالي"
            >
              <NextIcon />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
