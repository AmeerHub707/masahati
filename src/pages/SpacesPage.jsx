import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, MapPin, SlidersHorizontal, X, ChevronDown,
  Grid3X3, List, Map as MapIcon, Star, Users, Clock, Wifi, Zap,
  Check, Loader2, Building2, Phone, BadgeCheck, TrendingUp,
  CalendarCheck, CircleDollarSign, LocateFixed, RotateCcw,
  Snowflake, Mic, Presentation, ArrowUpDown, Funnel,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  loadSpacesWithFallback,
  SPACE_CATEGORIES,
  SORT_OPTIONS,
  RATING_FILTERS,
} from '../lib/spaces';
import { AMENITY_LABELS } from '../lib/requests';
import { fmtNumber, fmtRating } from '../lib/format';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AMENITY_KEYS = Object.keys(AMENITY_LABELS);

const DEFAULT_FILTERS = {
  search: '',
  category: '',
  min_price: '',
  max_price: '',
  amenities: [],
  area: '',
  min_rating: '',
  sort: '',
};

// أيقونة مخصصة للمساحة على الخريطة
function createSpaceIcon(price, isSelected = false) {
  return L.divIcon({
    className: 'space-marker',
    html: `<div class="space-marker__pin${isSelected ? ' is-selected' : ''}">
      <span class="space-marker__price">${fmtNumber(price)}</span>
    </div>`,
    iconSize: [60, 36],
    iconAnchor: [30, 36],
    popupAnchor: [0, -36],
  });
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 12);
    }
  }, [center, zoom, map]);
  return null;
}

function SpaceMap({ spaces, onSelect, selectedId, focus }) {
  const navigate = useNavigate();

  // مركز افتراضي يُشتق من مواقع المساحات المعروضة حتى تظهر العلامات داخل مجال الرؤية
  const fallbackCenter = useMemo(() => {
    const pts = spaces.filter((s) => s.lat && s.lng);
    if (!pts.length) return [31.95, 35.91];
    const lat = pts.reduce((a, s) => a + s.lat, 0) / pts.length;
    const lng = pts.reduce((a, s) => a + s.lng, 0) / pts.length;
    return [lat, lng];
  }, [spaces]);

  // إن حدّد المستخدم موقعه نستخدمه، وإلا نشتق المركز من البيانات
  const center = focus
    ? [focus.lat, focus.lng]
    : fallbackCenter;
  const zoom = focus ? 13 : 12;

  return (
    <div className="spaces__map-container">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={center} zoom={zoom} />
        {spaces.map((s) => {
          if (!s.lat || !s.lng) return null;
          const isSelected = String(s.id) === String(selectedId);
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={createSpaceIcon(s.price_per_hour, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => onSelect?.(s),
              }}
            >
              <Popup>
                <div className="spaces__popup" dir="rtl">
                  {s.image && (
                    <img src={s.image} alt={s.title} className="spaces__popup-img" />
                  )}
                  <h4>{s.title}</h4>
                  <p className="spaces__popup-loc">
                    <MapPin size={14} /> {s.location || s.area}
                  </p>
                  <div className="spaces__popup-meta">
                    <span><Star size={14} /> {s.rating}</span>
                    <span><Users size={14} /> {fmtNumber(s.capacity)}</span>
                  </div>
                  <p className="spaces__popup-price">{fmtNumber(s.price_per_hour)} ش.ج / ساعة</p>
                  <button
                    className="spaces__popup-btn"
                    onClick={() => navigate(`/ads/${s.id}`)}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function SpaceCard({ space, onSelect, view }) {
  const navigate = useNavigate();

  return (
    <article
      className={`msp__card spaces__card${view === 'list' ? ' is-list' : ''}`}
      onClick={() => onSelect?.(space)}
    >
      <div className="msp__card-media">
        {space.image ? (
          <img src={space.image} alt={space.title} loading="lazy" />
        ) : (
          <div className="msp__card-media-fallback"><Building2 /></div>
        )}
        {space.status === 'active' && (
          <span className="msp__card-status is-on">
            <BadgeCheck /> متاحة
          </span>
        )}
        {space.rating > 0 && (
          <span className="msp__card-rating"><Star /> {space.rating}</span>
        )}
        {space.instant_booking && (
          <span className="msp__card-instant"><Zap /> حجز فوري</span>
        )}
      </div>

      <div className="msp__card-body">
        <h3>{space.title}</h3>
        {space.location && (
          <p className="msp__card-loc"><MapPin /> {space.location}</p>
        )}
        {space.description && <p className="msp__card-desc">{space.description}</p>}
        <div className="msp__card-meta">
          {space.capacity > 0 && <span><Users /> {fmtNumber(space.capacity)} شخص</span>}
          {space.internet && <span><Wifi /> إنترنت</span>}
          {space.power && <span><Zap /> كهرباء</span>}
          {(space.open_time && space.close_time) && (
            <span className="msp__card-meta-chip">
              <Clock /> {space.open_time} – {space.close_time}
            </span>
          )}
          {space.contact_phone && (
            <span className="msp__card-meta-chip">
              <Phone /> {space.contact_phone}
            </span>
          )}
          {(space.amenities || []).length > 0 && (
            <span className="msp__card-meta-chip">
              {(space.amenities || []).slice(0, 3).map((a) =>
                AMENITY_LABELS[a] ? (
                  <span key={a} className="msp__card-amenity">{AMENITY_LABELS[a]}</span>
                ) : null
              )}
            </span>
          )}
        </div>
        {space.stats && (
          <div className="msp__card-stats">
            <span title="حجوزات هذا الشهر"><CalendarCheck /> {fmtNumber(space.stats.bookings)}</span>
            <span title="إيراد هذا الشهر"><CircleDollarSign /> {fmtNumber(space.stats.revenue)} ش.ج</span>
            <span title="معدّل الإشغال"><TrendingUp /> {fmtNumber(space.stats.occupancy)}٪</span>
          </div>
        )}
      </div>

      <div className="msp__card-foot">
        <div className="msp__card-price">
          <b>{fmtNumber(space.price_per_hour)}</b>
          <small>ش.ج / ساعة</small>
        </div>
        <button
          type="button"
          className="btn-primary spaces__card-btn"
          onClick={(e) => { e.stopPropagation(); navigate(`/ads/${space.id}`); }}
        >
          عرض التفاصيل
        </button>
      </div>
    </article>
  );
}

/* بطاقة مضغوطة لقائمة الخريطة الجانبية.
   الغرض منها المسح السريع: صورة صغيرة، العنوان، الموقع، التقييم، والسعر.
   تُستبعد عمداً: الوصف، الهاتف، أوقات العمل، وإحصاءات المالك — لأنها
   تزدحم العمود الضيق ولا تفيد المستخدم وهو ينظر إلى الخريطة. */
function MapSpaceCard({ space, onSelect, selected }) {
  const rating = space.rating > 0 ? fmtRating(space.rating) : null;

  return (
    <article
      className={`mcard${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect?.(space)}
    >
      <span className="mcard__media">
        {space.image ? (
          <img src={space.image} alt="" loading="lazy" />
        ) : (
          <span className="mcard__media-fallback"><Building2 /></span>
        )}
      </span>

      <span className="mcard__body">
        <Link className="mcard__title" to={`/ads/${space.id}`} onClick={(e) => e.stopPropagation()}>
          {space.title}
        </Link>

        {/* سطر واحد مختصر: موقع + سعة + مؤشرات سريعة */}
        <span className="mcard__sub">
          {space.location && (
            <span className="mcard__loc">
              <MapPin /> {space.location}
            </span>
          )}
          {space.capacity > 0 && (
            <span className="mcard__cap">
              <Users /> {fmtNumber(space.capacity)}
            </span>
          )}
          {space.internet && <i className="mcard__tag" title="إنترنت"><Wifi /></i>}
          {space.power && <i className="mcard__tag" title="كهرباء"><Zap /></i>}
          {space.instant_booking && (
            <i className="mcard__tag is-instant" title="حجز فوري"><Zap /></i>
          )}
        </span>
      </span>

      <span className="mcard__side">
        {rating && (
          <span className="mcard__rating">
            <Star fill="currentColor" /> {rating}
          </span>
        )}
        <span className="mcard__price">
          <b>{fmtNumber(space.price_per_hour)}</b>
          <small>ش.ج</small>
        </span>
      </span>
    </article>
  );
}

// ====== ثوابت مساعدة للفلاتر ======
const PRICE_MIN = 0;
const PRICE_MAX = 500;
const PRICE_STEP = 5;

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Presentation,
  ac: Snowflake,
  microphone: Mic,
  whiteboard: Presentation,
};

/* قائمة منسدلة تُغلق عند النقر خارجها أو بالضغط على Escape */
function Dropdown({ label, icon: Icon, active, activeText, width = '18rem', children, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="fdrop" ref={wrapRef}>
      <button
        type="button"
        className={`fdrop__btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {Icon && <Icon size={15} />}
        <span>{active && activeText ? activeText : label}</span>
        <ChevronDown size={14} className="fdrop__chev" />
      </button>
      {open && (
        <div className={`fdrop__panel fdrop__panel--${align}`} style={{ width }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* قسم قابل للطي — يقلّل طول الشريط الجانبي ويبرز الفلاتر المهمة */
function FilterSection({ title, icon: Icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`sfilter${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="sfilter__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {Icon && <Icon className="sfilter__icon" size={16} />}
        <span className="sfilter__title">{title}</span>
        {badge > 0 && <span className="sfilter__badge">{fmtNumber(badge)}</span>}
        <ChevronDown className="sfilter__chev" size={16} />
      </button>
      {open && <div className="sfilter__body">{children}</div>}
    </section>
  );
}

/* منزلق سعر مزدوج مع حقول إدخال متزامنة */
function PriceRange({ min, max, onChange }) {
  const lo = min === '' ? PRICE_MIN : Math.max(PRICE_MIN, Number(min) || PRICE_MIN);
  const hi = max === '' ? PRICE_MAX : Math.min(PRICE_MAX, Number(max) || PRICE_MAX);
  const leftPct = (lo / PRICE_MAX) * 100;
  const rightPct = (hi / PRICE_MAX) * 100;

  return (
    <div className="prange">
      <div className="prange__slider">
        <div className="prange__track" />
        <div
          className="prange__fill"
          style={{ insetInlineStart: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />
        <input
          type="range"
          className="prange__input"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange(String(v === PRICE_MIN ? '' : v), max);
          }}
          aria-label="أقل سعر"
        />
        <input
          type="range"
          className="prange__input"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange(min, String(v === PRICE_MAX ? '' : v));
          }}
          aria-label="أعلى سعر"
        />
      </div>
      <div className="prange__fields">
        <label className="prange__field">
          <span>من</span>
          <input
            type="number"
            inputMode="numeric"
            min={PRICE_MIN}
            max={hi}
            value={min}
            placeholder={String(PRICE_MIN)}
            onChange={(e) => onChange(e.target.value, max)}
          />
        </label>
        <label className="prange__field">
          <span>إلى</span>
          <input
            type="number"
            inputMode="numeric"
            min={lo}
            max={PRICE_MAX}
            value={max}
            placeholder="بدون حد"
            onChange={(e) => onChange(min, e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function FilterSidebar({ filters, onChange, onReset, isOpen, onClose }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  const toggleAmenity = (key) => {
    const current = filters.amenities || [];
    const next = current.includes(key)
      ? current.filter((a) => a !== key)
      : [...current, key];
    update('amenities', next);
  };

  const amenityCount = (filters.amenities || []).length;
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.category) n++;
    if (filters.min_price || filters.max_price) n++;
    if (amenityCount) n++;
    if (filters.area) n++;
    if (filters.min_rating) n++;
    if (filters.sort) n++;
    return n;
  }, [filters, amenityCount]);

  return (
    <aside className={`spaces__sidebar${isOpen ? ' is-open' : ''}`}>
      <div className="spaces__sidebar-head">
        <h3><SlidersHorizontal /> تصفية النتائج</h3>
        {activeCount > 0 && (
          <button type="button" className="spaces__reset" onClick={onReset}>
            <RotateCcw size={14} /> إعادة تعيين
          </button>
        )}
        <button type="button" className="spaces__sidebar-close" onClick={onClose} aria-label="إغلاق">
          <X />
        </button>
      </div>

      <div className="spaces__sidebar-body">
        {/* البحث — دائماً مفتوح لأنه الإجراء الأكثر استخداماً */}
        <div className="spaces__filter-group">
          <label htmlFor="spaces-search">البحث</label>
          <div className="spaces__search-wrap">
            <Search className="spaces__search-icon" />
            <input
              id="spaces-search"
              type="search"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              placeholder="ابحث باسم المساحة أو الموقع..."
            />
            {filters.search && (
              <button
                type="button"
                className="spaces__search-clear"
                onClick={() => update('search', '')}
                aria-label="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <FilterSection title="نوع المساحة" icon={Building2} defaultOpen badge={filters.category ? 1 : 0}>
          <div className="spaces__chips">
            {SPACE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`spaces__chip${filters.category === cat.id ? ' is-active' : ''}`}
                onClick={() => update('category', cat.id)}
                aria-pressed={filters.category === cat.id}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection
          title="السعر"
          icon={CircleDollarSign}
          defaultOpen
          badge={filters.min_price || filters.max_price ? 1 : 0}
        >
          <PriceRange
            min={filters.min_price}
            max={filters.max_price}
            onChange={(lo, hi) => onChange({ ...filters, min_price: lo, max_price: hi })}
          />
        </FilterSection>

        <FilterSection
          title="التقييم"
          icon={Star}
          defaultOpen
          badge={filters.min_rating ? 1 : 0}
        >
          <div className="spaces__rating">
            {RATING_FILTERS.map((r) => {
              const isOn = filters.min_rating === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`spaces__rating-btn${isOn ? ' is-active' : ''}`}
                  onClick={() => update('min_rating', r.id)}
                  aria-pressed={isOn}
                >
                  {r.id ? (
                    <>
                      <Star size={14} fill="currentColor" />
                      <span>{r.id}+</span>
                    </>
                  ) : (
                    <span>الكل</span>
                  )}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="الموقع / المنطقة" icon={MapPin} badge={filters.area ? 1 : 0}>
          <div className="spaces__search-wrap">
            <MapPin className="spaces__search-icon" />
            <input
              type="search"
              value={filters.area}
              onChange={(e) => update('area', e.target.value)}
              placeholder="مثال: وسط المدينة"
            />
          </div>
        </FilterSection>

        <FilterSection
          title="المرافق"
          icon={Funnel}
          badge={amenityCount}
        >
          <div className="spaces__amenities">
            {AMENITY_KEYS.map((key) => {
              const isOn = (filters.amenities || []).includes(key);
              const Icon = AMENITY_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`spaces__amenity${isOn ? ' is-on' : ''}`}
                  onClick={() => toggleAmenity(key)}
                  aria-pressed={isOn}
                >
                  <span className="spaces__amenity-ico">
                    {isOn ? <Check size={13} /> : Icon ? <Icon size={13} /> : null}
                  </span>
                  {AMENITY_LABELS[key]}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="الترتيب" icon={ArrowUpDown} defaultOpen badge={filters.sort ? 1 : 0}>
          <div className="spaces__sort">
            {SORT_OPTIONS.map((opt) => {
              const isOn = filters.sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`spaces__sort-btn${isOn ? ' is-active' : ''}`}
                  onClick={() => update('sort', opt.id)}
                  aria-pressed={isOn}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FilterSection>
      </div>

      {/* شريط سفلي للجوال: تطبيق + عدد النتائج */}
      <div className="spaces__sidebar-foot">
        <button type="button" className="btn-primary" onClick={onClose}>
          عرض النتائج
        </button>
      </div>
    </aside>
  )
}

/* ====== شريط الفلاتر العلوي (رأس الصفحة) ====== */
function FilterBar({ filters, onChange, resultCount, loading, activeCount, onOpenDrawer }) {
  const cat = SPACE_CATEGORIES.find((c) => c.id === filters.category);
  const amenityCount = (filters.amenities || []).length;
  const sortOpt = SORT_OPTIONS.find((s) => s.id === filters.sort);

  const priceText =
    filters.min_price || filters.max_price
      ? `${fmtNumber(filters.min_price || PRICE_MIN)} — ${filters.max_price ? fmtNumber(filters.max_price) : '∞'}`
      : 'السعر';
  const ratingText = filters.min_rating ? `${filters.min_rating}+ نجوم` : 'التقييم';
  const areaText = filters.area || 'المنطقة';
  const amenityText = amenityCount ? `المرافق (${fmtNumber(amenityCount)})` : 'المرافق';

  return (
    <div className="fbar">
      {/* الصف الأول: البحث + الترتيب + عرض النتائج + فتح الدرج على الجوال */}
      <div className="fbar__top">
        <div className="fbar__search">
          <Search className="fbar__search-icon" size={17} />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="ابحث باسم المساحة، النوع، أو المنطقة..."
            aria-label="البحث في المساحات"
          />
          {filters.search && (
            <button
              type="button"
              className="fbar__search-clear"
              onClick={() => onChange({ ...filters, search: '' })}
              aria-label="مسح البحث"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="fbar__top-end">
          <span className="fbar__count">
            {loading ? (
              <>
                <Loader2 size={14} className="spin" /> جارٍ البحث
              </>
            ) : (
              <>
                <strong>{fmtNumber(resultCount)}</strong> مساحة
              </>
            )}
          </span>
          <button type="button" className="fbar__more" onClick={onOpenDrawer}>
            <SlidersHorizontal size={16} /> الفلاتر
            {activeCount > 0 && <span className="fbar__more-badge">{fmtNumber(activeCount)}</span>}
          </button>
        </div>
      </div>

      {/* الصف الثاني: الفلاتر السريعة كقوائم منسدلة */}
      <div className="fbar__row">
        <Dropdown
          label="نوع المساحة"
          icon={Building2}
          active={!!filters.category}
          activeText={cat?.label}
          width="17rem"
        >
          <div className="fdrop__title">نوع المساحة</div>
          <div className="spaces__chips">
            {SPACE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`spaces__chip${filters.category === c.id ? ' is-active' : ''}`}
                onClick={() => onChange({ ...filters, category: c.id })}
                aria-pressed={filters.category === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Dropdown>

        <Dropdown
          label="السعر"
          icon={CircleDollarSign}
          active={!!(filters.min_price || filters.max_price)}
          activeText={priceText}
          width="20rem"
        >
          <div className="fdrop__title">نطاق السعر (ش.ج / ساعة)</div>
          <PriceRange
            min={filters.min_price}
            max={filters.max_price}
            onChange={(lo, hi) => onChange({ ...filters, min_price: lo, max_price: hi })}
          />
        </Dropdown>

        <Dropdown
          label="التقييم"
          icon={Star}
          active={!!filters.min_rating}
          activeText={ratingText}
          width="16rem"
        >
          <div className="fdrop__title">أقل تقييم</div>
          <div className="spaces__rating">
            {RATING_FILTERS.map((r) => {
              const isOn = filters.min_rating === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`spaces__rating-btn${isOn ? ' is-active' : ''}`}
                  onClick={() => onChange({ ...filters, min_rating: r.id })}
                  aria-pressed={isOn}
                >
                  {r.id ? (
                    <>
                      <Star size={14} fill="currentColor" />
                      <span>{r.id}+</span>
                    </>
                  ) : (
                    <span>الكل</span>
                  )}
                </button>
              );
            })}
          </div>
        </Dropdown>

        <Dropdown
          label="المرافق"
          icon={Funnel}
          active={amenityCount > 0}
          activeText={amenityText}
          width="19rem"
        >
          <div className="fdrop__title">اختر ما تحتاجه</div>
          <div className="spaces__amenities">
            {AMENITY_KEYS.map((key) => {
              const isOn = (filters.amenities || []).includes(key);
              const Icon = AMENITY_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`spaces__amenity${isOn ? ' is-on' : ''}`}
                  onClick={() =>
                    onChange({
                      ...filters,
                      amenities: isOn
                        ? filters.amenities.filter((x) => x !== key)
                        : [...(filters.amenities || []), key],
                    })
                  }
                  aria-pressed={isOn}
                >
                  <span className="spaces__amenity-ico">
                    {isOn ? <Check size={13} /> : Icon ? <Icon size={13} /> : null}
                  </span>
                  {AMENITY_LABELS[key]}
                </button>
              );
            })}
          </div>
        </Dropdown>

        <Dropdown
          label="المنطقة"
          icon={MapPin}
          active={!!filters.area}
          activeText={areaText}
          width="17rem"
        >
          <div className="fdrop__title">الموقع / المنطقة</div>
          <div className="spaces__search-wrap">
            <MapPin className="spaces__search-icon" />
            <input
              type="search"
              value={filters.area}
              onChange={(e) => onChange({ ...filters, area: e.target.value })}
              placeholder="مثال: وسط المدينة"
            />
          </div>
        </Dropdown>

        <Dropdown
          label="الترتيب"
          icon={ArrowUpDown}
          active={!!filters.sort}
          activeText={sortOpt?.label}
          width="15rem"
          align="end"
        >
          <div className="fdrop__title">ترتيب حسب</div>
          <div className="spaces__sort">
            {SORT_OPTIONS.map((opt) => {
              const isOn = filters.sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`spaces__sort-btn${isOn ? ' is-active' : ''}`}
                  onClick={() => onChange({ ...filters, sort: opt.id })}
                  aria-pressed={isOn}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Dropdown>
      </div>
    </div>
  );
}

/* شرائح الفلاتر النشطة — تسمح بإزالة فلتر واحد دون إعادة تعيين الكل */
function ActiveFilterChips({ filters, onChange }) {
  const chips = [];
  const cat = SPACE_CATEGORIES.find((c) => c.id === filters.category);
  const rating = RATING_FILTERS.find((r) => r.id === filters.min_rating);
  const sort = SORT_OPTIONS.find((s) => s.id === filters.sort);

  if (filters.search) {
    chips.push({
      key: 'search',
      label: `بحث: ${filters.search}`,
      onRemove: () => onChange({ ...filters, search: '' }),
    });
  }
  if (cat && filters.category) {
    chips.push({
      key: 'category',
      label: cat.label,
      onRemove: () => onChange({ ...filters, category: '' }),
    });
  }
  if (filters.min_price || filters.max_price) {
    const lo = filters.min_price || PRICE_MIN;
    const hi = filters.max_price || '+';
    chips.push({
      key: 'price',
      label: `${fmtNumber(lo)} — ${hi === '+' ? '+' : fmtNumber(hi)} ش.ج`,
      onRemove: () => onChange({ ...filters, min_price: '', max_price: '' }),
    });
  }
  if (rating && filters.min_rating) {
    chips.push({
      key: 'rating',
      label: rating.label,
      onRemove: () => onChange({ ...filters, min_rating: '' }),
    });
  }
  if (filters.area) {
    chips.push({
      key: 'area',
      label: `المنطقة: ${filters.area}`,
      onRemove: () => onChange({ ...filters, area: '' }),
    });
  }
  (filters.amenities || []).forEach((a) => {
    chips.push({
      key: `amenity-${a}`,
      label: AMENITY_LABELS[a] || a,
      onRemove: () =>
        onChange({ ...filters, amenities: filters.amenities.filter((x) => x !== a) }),
    });
  });
  if (sort && filters.sort) {
    chips.push({
      key: 'sort',
      label: `ترتيب: ${sort.label}`,
      onRemove: () => onChange({ ...filters, sort: '' }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="spaces__chips-bar">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="spaces__chip-tag"
          onClick={c.onRemove}
          aria-label={`إزالة ${c.label}`}
        >
          {c.label}
          <X size={13} />
        </button>
      ))}
      <button
        type="button"
        className="spaces__chip-clear"
        onClick={() =>
          onChange({
            search: '',
            category: '',
            min_price: '',
            max_price: '',
            amenities: [],
            area: '',
            min_rating: '',
            sort: '',
          })
        }
      >
        <RotateCcw size={13} /> مسح الكل
      </button>
    </div>
  );
}

/* ====== هيدر تصفح إبداعي — بيانات حيّة من النتائج المعروضة ====== */
function SpacesHead({ spaces, total, loading }) {
  // توزيع الأنواع بين النتائج الحالية — يعكس الفلاتر فور تغييرها
  const dist = useMemo(() => {
    const counts = new Map();
    spaces.forEach((s) => {
      if (!s?.category) return;
      counts.set(s.category, (counts.get(s.category) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([id, n]) => ({
        id,
        n,
        label: SPACE_CATEGORIES.find((c) => c.id === id)?.label || id,
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
  }, [spaces]);

  const avgRating = useMemo(() => {
    const rated = spaces.filter((s) => typeof s.rating === 'number');
    if (!rated.length) return null;
    return rated.reduce((a, s) => a + s.rating, 0) / rated.length;
  }, [spaces]);

  const topN = dist[0]?.n || 1;
  const typesCount = dist.length;

  return (
    <header className="sh">
      {/* طبقات زخرفية: هالات متحركة + شبكة نقاط — كلها زخرفية */}
      <div className="sh__deco" aria-hidden="true">
        <span className="sh__aurora sh__aurora--a" />
        <span className="sh__aurora sh__aurora--b" />
        <span className="sh__dots" />
        <span className="sh__ring" />
      </div>

      <div className="wrap wrap--wide sh__inner">
        <div className="sh__copy">
          <span className="sh__live">
            <span className="sh__pulse" />
            {loading ? (
              <>
                <Loader2 size={13} className="spin" /> جارٍ التحديث
              </>
            ) : (
              <>
                <strong>{fmtNumber(total)}</strong> مساحة متاحة الآن
              </>
            )}
          </span>

          <h1>
            اختر مساحتك
            <span className="sh__hl"> بالطريقة التي تناسبك</span>
          </h1>

          <p className="sh__lead">
            قارن الأسعار وسرعة الإنترنت وتوفّر الكهرباء، وابدأ الحجز مباشرةً
            دون اتصال ولا رسالة.
          </p>

          <ul className="sh__stats">
            <li>
              <b>{fmtNumber(total)}</b>
              <span>مساحة</span>
            </li>
            <li>
              <b>{avgRating ? fmtRating(avgRating) : '—'}</b>
              <span>متوسط التقييم</span>
            </li>
            <li>
              <b>{fmtNumber(typesCount)}</b>
              <span>نوع مختلف</span>
            </li>
          </ul>
        </div>

        <aside className="sh__panel">
          <div className="sh__panel-head">
            <span className="sh__panel-title">الأكثر طلباً</span>
            <span className="sh__panel-sub">حسب نتائجك الحالية</span>
          </div>

          {dist.length ? (
            <ul className="sh__bars">
              {dist.map((d, i) => (
                <li key={d.id} className="sh__bar" style={{ '--i': i, '--w': `${(d.n / topN) * 100}%` }}>
                  <span className="sh__bar-label">{d.label}</span>
                  <span className="sh__bar-track">
                    <span className="sh__bar-fill" />
                  </span>
                  <span className="sh__bar-n">{fmtNumber(d.n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sh__panel-empty">لا توجد نتائج مطابقة للفلاتر الحالية.</p>
          )}

          <div className="sh__panel-foot">
            <Star size={14} fill="currentColor" />
            <span>
              {avgRating ? `${fmtRating(avgRating)} من ${fmtNumber(5)}` : 'لا تقييمات'} — تحديث مباشر
            </span>
          </div>
        </aside>
      </div>
    </header>
  );
}

export default function SpacesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    area: searchParams.get('area') || '',
    min_rating: searchParams.get('min_rating') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    sort: searchParams.get('sort') || '',
    amenities: searchParams.get('amenities')
      ? searchParams.get('amenities').split(',').filter(Boolean)
      : [],
  }));
  const [view, setView] = useState('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState(null);
  const loaderRef = useRef(null);

  const [appliedFilters, setAppliedFilters] = useState(filters);
  const debounceRef = useRef(null);
  const [stuck, setStuck] = useState(() => typeof window !== 'undefined' && window.scrollY > 8);

  // ظلّ أعلى الشريط عند التمرير — يعطي إحساس التثبيت
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // تأخير التطبيق: يمنع إعادة الجلب مع كل حرف يكتبه المستخدم
  const handleFilterChange = useCallback((next) => {
    setFilters(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setAppliedFilters(next), 350);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const loadSpaces = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const result = await loadSpacesWithFallback(appliedFilters, pageNum);
      if (append) {
        setSpaces((prev) => [...prev, ...result.spaces]);
      } else {
        setSpaces(result.spaces);
      }
      setHasMore(result.has_more);
      setTotal(result.total);
      setDemo(result.demo);
      setPage(pageNum);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadSpaces(1, false);
  }, [loadSpaces]);

  // مزامنة كل الفلاتر مع الرابط حتى يمكن مشاركة الرابط
  useEffect(() => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.area) params.area = filters.area;
    if (filters.min_rating) params.min_rating = filters.min_rating;
    if (filters.min_price) params.min_price = filters.min_price;
    if (filters.max_price) params.max_price = filters.max_price;
    if (filters.sort) params.sort = filters.sort;
    if (filters.amenities?.length) params.amenities = filters.amenities.join(',');
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadSpaces(page + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, loadSpaces]);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    clearTimeout(debounceRef.current);
  };

  const handleSelectSpace = (space) => {
    setSelectedSpace(space);
  };

  // تحديد موقع المستخدم: يبدّل إلى عرض الخريطة ويوسّع الخريطة على موقعه
  const handleLocate = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearby({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView('map');
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category) count++;
    if (filters.min_price || filters.max_price) count++;
    if (filters.amenities?.length) count++;
    if (filters.area) count++;
    if (filters.min_rating) count++;
    if (filters.sort) count++;
    return count;
  }, [filters]);

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl spaces-page">
      <SpacesHead spaces={spaces} total={total} loading={loading} />

      {/* شريط الفلاتر العلوي — ثابت أسفل الهيدر، والنتائج بعرض كامل تحته */}
      {view !== 'map' && (
        <div className={`spaces__filterbar${stuck ? ' is-stuck' : ''}`}>
          <div className="wrap wrap--wide">
            <FilterBar
              filters={filters}
              onChange={handleFilterChange}
              resultCount={total}
              loading={loading}
              activeCount={activeFilterCount}
              onOpenDrawer={() => setSidebarOpen(true)}
            />
            <ActiveFilterChips filters={filters} onChange={handleFilterChange} />
          </div>
        </div>
      )}

      <div className="wrap wrap--wide spaces__layout">
        <div
          className={`spaces__backdrop${sidebarOpen ? ' is-on' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <FilterSidebar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="spaces__main">
          <div className="spaces__toolbar">
            <div className="spaces__results-info">
              {loading ? (
                <span>جارٍ التحميل...</span>
              ) : (
                <span>{fmtNumber(total)} مساحة متاحة</span>
              )}
              {demo && (
                <span className="spaces__demo-badge">وضع تجريبي</span>
              )}
            </div>

            <div className="spaces__view-toggle">
              <button
                type="button"
                className={view === 'grid' ? 'is-active' : ''}
                onClick={() => setView('grid')}
                aria-label="عرض شبكي"
              >
                <Grid3X3 />
              </button>
              <button
                type="button"
                className={view === 'list' ? 'is-active' : ''}
                onClick={() => setView('list')}
                aria-label="عرض قائمة"
              >
                <List />
              </button>
              <button
                type="button"
                className={view === 'map' ? 'is-active' : ''}
                onClick={() => setView('map')}
                aria-label="عرض الخريطة"
              >
                <MapIcon />
              </button>
            </div>
          </div>

          {error ? (
            <div className="spaces__error">
              <p>تعذّر تحميل المساحات. تحقق من اتصالك وحاول مجدداً.</p>
              <button type="button" className="btn-ghost" onClick={() => loadSpaces(1)}>
                إعادة المحاولة
              </button>
            </div>
          ) : loading ? (
            <div className="spaces__loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="spaces__skeleton">
                  <div className="spaces__skeleton-media" />
                  <div className="spaces__skeleton-body">
                    <div className="spaces__skeleton-title" />
                    <div className="spaces__skeleton-text" />
                    <div className="spaces__skeleton-text short" />
                  </div>
                </div>
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <div className="spaces__empty">
              <Search size={48} />
              <h3>لا توجد مساحات تطابق بحثك</h3>
              <p>جرّب تعديل عوامل التصفية أو البحث بكلمات مختلفة.</p>
              <button type="button" className="btn-primary" onClick={handleReset}>
                إعادة تعيين التصفية
              </button>
            </div>
          ) : view === 'map' ? (
            <div className="spaces__map-view">
              <div className="spaces__map-main">
                <div className={`spaces__filterbar is-over-map${stuck ? ' is-stuck' : ''}`}>
                  <FilterBar
                    filters={filters}
                    onChange={handleFilterChange}
                    resultCount={total}
                    loading={loading}
                    activeCount={activeFilterCount}
                    onOpenDrawer={() => setSidebarOpen(true)}
                  />
                  <ActiveFilterChips filters={filters} onChange={handleFilterChange} />
                </div>
                <SpaceMap
                  spaces={spaces}
                  onSelect={handleSelectSpace}
                  selectedId={selectedSpace?.id}
                  focus={nearby}
                />
                {hasMore && (
                  <button
                    type="button"
                    className="btn-ghost spaces__map-load"
                    onClick={() => loadSpaces(page + 1, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="spin" size={18} />
                    ) : (
                      <span>تحميل المزيد من المساحات</span>
                    )}
                  </button>
                )}
              </div>
              <div className="spaces__map-list">
                <div className="mrail__head">
                  <span className="mrail__title">المساحات على الخريطة</span>
                  <span className="mrail__count">{fmtNumber(spaces.length)}</span>
                </div>
                <div className="mrail__scroll">
                  {spaces.map((s) => (
                    <MapSpaceCard
                      key={s.id}
                      space={s}
                      onSelect={handleSelectSpace}
                      selected={selectedSpace?.id === s.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`spaces__results spaces__results--${view}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  className="spaces__results-inner"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {spaces.map((s) => (
                    <SpaceCard
                      key={s.id}
                      space={s}
                      onSelect={handleSelectSpace}
                      view={view}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {hasMore && (
                <div ref={loaderRef} className="spaces__load-more">
                  {loadingMore ? (
                    <Loader2 className="spin" />
                  ) : (
                    <span>اسحب لتحميل المزيد</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`spaces__fab${locating ? ' is-loading' : ''}`}
        onClick={handleLocate}
        disabled={locating}
        aria-label="تحديد موقعي"
      >
        {locating ? <Loader2 className="spin" /> : <LocateFixed />}
      </button>
    </div>
  );
}
