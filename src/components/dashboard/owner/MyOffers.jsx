import { useCallback, useEffect, useState } from 'react';
import {
  Send, Clock, BadgeCheck, X, Loader2, CircleDollarSign, Sparkles, Repeat, Ban, FileText,
} from 'lucide-react';
import { loadOwnerOffersWithFallback, isOwnerDemo } from '../../../lib/owner';

const STATUS_META = {
  pending: { label: 'بانتظار الرد', cls: 'badge--pending', Icon: Clock },
  accepted: { label: 'تم القبول', cls: 'badge--confirmed', Icon: BadgeCheck },
  rejected: { label: 'تم رفضه', cls: 'badge--rejected', Icon: X },
  closed: { label: 'انتهى الطلب', cls: 'badge--muted', Icon: Ban },
};

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return '';
  const diff = Math.max(0, Math.round((Date.now() - t.getTime()) / 3600000));
  if (diff < 1) return 'الآن';
  if (diff < 24) return `منذ ${diff} ساعة`;
  const days = Math.round(diff / 24);
  return days <= 30 ? `منذ ${days} يوم` : `منذ ${Math.round(days / 30)} شهر`;
}

export default function MyOffers({ data }) {
  const [offers, setOffers] = useState(() => (data?.offers || []));
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const loadOffers = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadOwnerOffersWithFallback(force);
      setOffers(result.offers);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadOffers(), 0);
    return () => clearTimeout(t);
  }, [loadOffers]);

  const pending = offers.filter((o) => o.status === 'pending');
  const resolved = offers.filter((o) => o.status !== 'pending');

  const renderBanner = () => {
    if (!demo || bannerDismissed) return null;
    return (
      <div className="odash__banner">
        <Sparkles />
        <p>
          <b>وضع تجريبي</b> — واجهة الخادم (API) غير مفعّلة بعد، البيانات أدناه للتجربة
          وستُحفظ محلياً. عند نزول واجهة الباك إند سيتولّى النظام تلقائياً.
        </p>
        <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
          <X />
        </button>
      </div>
    );
  };

  const renderCard = (o) => {
    const meta = STATUS_META[o.status] || STATUS_META.pending;
    const Icon = meta.Icon;
    return (
      <div className={`odash__offer-card is-${o.status}`} key={o.id}>
        <div className="odash__offer-main">
          <div className="odash__offer-ico"><Send /></div>
          <div className="odash__offer-body">
            <div className="odash__offer-topline">
              <span className={`badge ${meta.cls}`}><Icon /> {meta.label}</span>
              <span className="odash__offer-time">{timeAgo(o.created_at)}</span>
            </div>
            <h3>{o.requestTitle || 'طلب خاص'}</h3>
            <div className="odash__offer-tags">
              {o.duration_hours > 0 && <span><Clock /> {fmtNumber(o.duration_hours)} ساعات</span>}
              <span><CircleDollarSign /> {fmtNumber(o.price_per_hour)} ش.ج/ساعة</span>
            </div>
          </div>
        </div>
        <div className="odash__offer-side">
          <b>{fmtNumber(o.price_per_hour)}</b>
          <small>ش.ج / ساعة</small>
          {o.status === 'accepted' && (
            <span className="odash__offer-side-note"><BadgeCheck /> راجع مراسلاتك</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="odash__offers">
      {renderBanner()}

      <div className="odash__offers-head">
        <div>
          <h2><Send /> عروضي</h2>
          <p>كل العروض التي قدّمتها على طلبات السوق، وحالتها لدى الطالب.</p>
        </div>
        <button
          type="button"
          className="odash__offers-refresh"
          onClick={() => loadOffers(true)}
          disabled={refreshing}
          aria-label="تحديث العروض"
          title="تحديث العروض"
        >
          <Repeat className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل عروضك…</h3>
          <p>نراجع حالة كل عرض قدّمته.</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><FileText /></div>
          <h3>لا توجد عروض بعد</h3>
          <p>تصفّح السوق المفتوح وابدأ بتقديم عروض على الطلبات المناسبة لمساحاتك.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><Clock /> بانتظار الرد</h2>
              </div>
              <div className="odash__offers-grid">
                {pending.map((o) => renderCard(o))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><BadgeCheck /> عروض منتهية</h2>
              </div>
              <div className="odash__offers-grid">
                {resolved.map((o) => renderCard(o))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}