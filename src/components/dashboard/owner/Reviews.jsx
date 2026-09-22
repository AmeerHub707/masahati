import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Store, Building2, Search, X, ChevronDown, Star, MessageSquare,
  Repeat, Sparkles, Loader2,
} from 'lucide-react';
import { isOwnerDemo, loadOwnerDashboardWithFallback } from '../../../lib/owner';

const STAR_VALUES = [1, 2, 3, 4, 5];

const RATING_VIEWS = [
  { id: 'all', label: 'الكل' },
  { id: 'high', label: 'مميزة (٤–٥)' },
  { id: 'mid', label: 'متوسطة (٣)' },
  { id: 'low', label: 'منخفضة (١–٢)' },
];

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function fmtDate(iso) {
  if (!iso) return '';
  const t = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name) {
  return (
    (name || 'م')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('') || 'م'
  );
}

function ratingScore(r) {
  return Math.max(1, Math.min(5, Math.round(Number(r.rating || 0))));
}

export default function Reviews({ data }) {
  const [reviews, setReviews] = useState(() => data?.reviews || []);
  const [spaces, setSpaces] = useState(() => data?.spaces || []);
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [spaceId, setSpaceId] = useState(''); // '' = كل المساحات
  const [query, setQuery] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('all');
  const pickerRef = useRef(null);

  const allSpaces = (spaces || []).filter((s) => s.is_active !== false);

  const selectedSpace = allSpaces.find((s) => String(s.id) === String(spaceId)) || null;

  const filteredPicker = query
    ? allSpaces.filter((s) => (s.title || '').toLowerCase().includes(query.toLowerCase()))
    : allSpaces;

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadOwnerDashboardWithFallback(force);
      setReviews(result.reviews || []);
      setSpaces(result.spaces || []);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenPicker(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickSpace = (id) => {
    setSpaceId(id);
    setQuery('');
    setOpenPicker(false);
  };

  const scopedReviews = useMemo(() => {
    if (!spaceId) return reviews;
    return reviews.filter((r) => r.spaceId && String(r.spaceId) === String(spaceId));
  }, [reviews, spaceId]);

  const avgRating = useMemo(() => {
    if (!scopedReviews.length) return 0;
    const sum = scopedReviews.reduce((s, r) => s + Number(r.rating || 0), 0);
    return Math.round((sum / scopedReviews.length) * 10) / 10;
  }, [scopedReviews]);

  const distribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    scopedReviews.forEach((r) => { counts[ratingScore(r)] += 1; });
    return counts;
  }, [scopedReviews]);

  const ratedSpaceCount = useMemo(() => {
    const seen = new Set();
    scopedReviews.forEach((r) => {
      const key = r.spaceId != null ? `id:${r.spaceId}` : (r.spaceName ? `name:${r.spaceName}` : '');
      if (key) seen.add(key);
    });
    return seen.size;
  }, [scopedReviews]);

  const matchesFilter = useCallback((id, r) => {
    if (id === 'all') return true;
    if (id === 'high') return ratingScore(r) >= 4;
    if (id === 'mid') return ratingScore(r) === 3;
    if (id === 'low') return ratingScore(r) <= 2;
    return true;
  }, []);

  const visibleReviews = useMemo(() => {
    return scopedReviews.filter((r) => matchesFilter(ratingFilter, r));
  }, [scopedReviews, ratingFilter, matchesFilter]);

  const filterCount = useCallback((id) => {
    return scopedReviews.filter((r) => matchesFilter(id, r)).length;
  }, [scopedReviews, matchesFilter]);

  const emptyMessage = (() => {
    if (ratingFilter !== 'all') return 'لا توجد تقييمات تطابق هذا التصنيف.';
    if (selectedSpace) return 'لم تتلقَّ هذه المساحة أي تقييمات بعد.';
    return 'لم تتلقَّ أي من مساحاتك تقييمات بعد. ستظهر هنا بمجرد أن يقيمها العملاء.';
  })();

  return (
    <section className="odash__reviews obk">
      {demo && !bannerDismissed && (
        <div className="odash__banner">
          <Sparkles />
          <p>
            <b>وضع تجريبي</b> — تُبنى التقييمات أدناه من بيانات لوحتك الحالية.
            عند تفعيل واجهة الباك إند ستُحدَّث تلقائياً من تقييمات العملاء الحقيقية.
          </p>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
            <X />
          </button>
        </div>
      )}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2><Star /> التقييمات</h2>
          <p>كل تقييمات مساحاتك مرتبة من الأحدث — راقب رضا العملاء وتابع تعليقاتهم.</p>
          <div className="obk__hero-meta">
            <span className={`obk__hero-chip${avgRating >= 4 ? ' is-good' : (avgRating > 0 && avgRating < 3 ? ' is-bad' : '')}`}>
              <Star /> متوسط التقييم {avgRating ? `${avgRating} / 5` : '—'}
            </span>
            <span className="obk__hero-chip"><MessageSquare /> {fmtNumber(scopedReviews.length)} تقييم</span>
            <span className="obk__hero-chip"><Building2 /> {fmtNumber(ratedSpaceCount)} مساحة مقيّمة</span>
          </div>
        </div>
        <div className="obk__hero-side">
          <div className="odash__filter" ref={pickerRef}>
            <div className="odash__filter-ico"><Store /></div>
            <div className="odash__filter-main">
              <span className="odash__filter-label">
                {selectedSpace ? 'تُعرض تقييمات ' : 'تُعرض تقييمات كل المساحات'}
              </span>
              <div className="odash__filter-field">
                <Search className="odash__filter-search-ico" />
                <input
                  type="text"
                  value={query}
                  placeholder={selectedSpace ? selectedSpace.title : 'ابحث عن مساحة محددة…'}
                  onFocus={() => setOpenPicker(true)}
                  onChange={(e) => { setQuery(e.target.value); setOpenPicker(true); }}
                  aria-label="بحث عن مساحة"
                />
                {query || selectedSpace ? (
                  <button
                    type="button"
                    className="odash__filter-clear"
                    onClick={() => pickSpace('')}
                    aria-label="إلغاء اختيار المساحة"
                  >
                    <X />
                  </button>
                ) : (
                  <ChevronDown className="odash__filter-caret" />
                )}
              </div>
            </div>

            {openPicker && (
              <div className="odash__filter-menu" role="listbox">
                <button type="button" role="option" className="odash__filter-item is-all" onClick={() => pickSpace('')}>
                  <Building2 /> كل المساحات
                </button>
                {filteredPicker.map((s) => (
                  <button
                    type="button"
                    role="option"
                    key={s.id}
                    className={`odash__filter-item${String(s.id) === String(spaceId) ? ' is-active' : ''}`}
                    onClick={() => pickSpace(String(s.id))}
                  >
                    <Building2 />
                    <span>
                      <b>{s.title}</b>
                      <small>{s.location || `تتسع لـ ${s.capacity} شخص`}</small>
                    </span>
                  </button>
                ))}
                {filteredPicker.length === 0 && (
                  <span className="odash__filter-empty">لا توجد مساحات تطابق بحثك.</span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="odash__market-refresh obk__hero-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="تحديث التقييمات"
            title="تحديث التقييمات"
          >
            <Repeat className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && reviews.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل التقييمات…</h3>
          <p>نعرض تقييمات العملاء على مساحاتك.</p>
        </div>
      ) : (
        <>
          <section className="odash__stats odash__stats--3">
            <div className="odash__stat odash__stat--orange">
              <div className="ost-ico"><Star /></div>
              <b>{avgRating || '—'}</b>
              <span>متوسط التقييم</span>
            </div>
            <div className="odash__stat odash__stat--blue">
              <div className="ost-ico"><MessageSquare /></div>
              <b>{fmtNumber(scopedReviews.length)}</b>
              <span>إجمالي التقييمات</span>
            </div>
            <div className="odash__stat odash__stat--green">
              <div className="ost-ico"><Building2 /></div>
              <b>{fmtNumber(ratedSpaceCount)}</b>
              <span>مساحات مقيّمة</span>
            </div>
          </section>

          {scopedReviews.length > 0 && (
            <section className="odash__section odash__section--rating-dist">
              <div className="odash__section-head">
                <div>
                  <h2><Star /> توزيع التقييمات</h2>
                  <p>كم عدد التقييمات الحاصلة على كل نجم من 5.</p>
                </div>
              </div>
              <div className="odash__dist">
                {STAR_VALUES.slice().reverse().map((star) => {
                  const count = distribution[star];
                  const pct = scopedReviews.length > 0 ? Math.round((count / scopedReviews.length) * 100) : 0;
                  return (
                    <div className="odash__dist-row" key={star}>
                      <span className="odash__dist-label"><Star /> {star}</span>
                      <div className="odash__dist-bar"><i style={{ width: `${pct}%` }} /></div>
                      <b className="odash__dist-count">{fmtNumber(count)}</b>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="filterbar" role="group" aria-label="تصفية التقييمات حسب النجوم">
            {RATING_VIEWS.map((v) => {
              const on = ratingFilter === v.id;
              const count = filterCount(v.id);
              return (
                <button
                  type="button"
                  key={v.id}
                  className={on ? 'is-active' : ''}
                  onClick={() => setRatingFilter(v.id)}
                  aria-pressed={on}
                >
                  {on && (
                    <motion.span
                      layoutId="filterbar-reviews"
                      className="filterbar-pill"
                      transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
                    />
                  )}
                  <Star />
                  <span className="filterbar-label">{v.label}</span>
                  {count > 0 && <b className="filterbar-count">{fmtNumber(count)}</b>}
                </button>
              );
            })}
          </div>

          <section className="odash__section">
            <div className="odash__section-head">
              <div>
                <h2><MessageSquare /> التقييمات</h2>
                <p>{selectedSpace ? 'مراجعات حاضرة على هذه المساحة.' : 'كل تقييمات مساحاتك، مرتبة من الأحدث.'}</p>
              </div>
              {visibleReviews.length > 0 && (
                <span className="odash__reviews-count">{fmtNumber(visibleReviews.length)} تقييم</span>
              )}
            </div>

            {visibleReviews.length > 0 ? (
              <div className="odash__list odash__list--reviews">
                {visibleReviews.map((r) => (
                  <motion.div
                    key={r.id}
                    className="odash__review"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    <div className="odash__review-ico">
                      {r.customerAvatar ? (
                        <img className="odash__review-avatar" src={r.customerAvatar} alt={r.customer || ''} />
                      ) : (
                        <div className="odash__review-avatar odash__review-avatar--placeholder">
                          {initials(r.customer)}
                        </div>
                      )}
                    </div>
                    <div className="odash__review-body">
                      <div className="odash__review-topline">
                        <b>{r.customer || 'عميل'}</b>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {STAR_VALUES.map((i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${i <= Number(r.rating || 0) ? 'fill-current' : 'text-zinc-300'}`}
                            />
                          ))}
                        </div>
                        <small className="odash__review-date">{fmtDate(r.date || r.createdAt)}</small>
                      </div>

                      {!selectedSpace && (
                        <small className="odash__review-space">
                          <Building2 /> {r.spaceName || 'مساحة غير محددة'}
                        </small>
                      )}

                      {r.title && <h4 className="odash__review-title">{r.title}</h4>}
                      {r.comment && <p className="odash__review-text">{r.comment}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><Star /></div>
                <h3>لا توجد تقييمات</h3>
                <p>{emptyMessage}</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}