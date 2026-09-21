import { useState } from 'react';
import { Building2, Search, CheckCircle2, XCircle, Star, Users, MapPin, Ban, PlayCircle } from 'lucide-react';
import { adminSpaces } from '../../data/adminMockData';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Pill, SmallAction } from './ui';

const statusMeta = {
  pending: { label: 'قيد المراجعة', tone: 'amber' },
  active: { label: 'مفعّلة', tone: 'green' },
  suspended: { label: 'موقوفة', tone: 'red' },
};

const filterOptions = [
  { id: 'all', label: 'كل المساحات' },
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'active', label: 'مفعّلة' },
  { id: 'suspended', label: 'موقوفة' },
];

export default function AdminSpaces() {
  const [spaces, setSpaces] = useState(adminSpaces);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = spaces.filter((s) => {
    const matchStatus = filter === 'all' || s.status === filter;
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.neighborhood.toLowerCase().includes(q) ||
      s.owner.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  const approve = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'active' } : s)));
  const reject = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'suspended' } : s)));
  const suspend = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'suspended' } : s)));
  const activate = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'active' } : s)));

  const pendingCount = spaces.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHeading
          icon={Building2}
          title="إدارة المساحات"
          subtitle={`${spaces.length} مساحة مسجلة · ${pendingCount} بانتظار المراجعة`}
        />

        {/* البحث والتصفية */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:max-w-xs md:flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن مساحة بالاسم أو الحي أو المالك…"
              className="dash__input dash__input--icon"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <Pill key={opt.id} active={filter === opt.id} onClick={() => setFilter(opt.id)}>
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="لا توجد مساحات مطابقة"
            description="لم نعثر على مساحات تطابق البحث أو الفلتر الحالي. جرّب تغيير المعايير."
            actionLabel="إعادة الضبط"
            onAction={() => {
              setQuery('');
              setFilter('all');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="dash__card flex flex-col transition hover:-translate-y-1"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="st-ico">
                    <Building2 />
                  </span>
                  <StatusBadge tone={statusMeta[s.status].tone}>{statusMeta[s.status].label}</StatusBadge>
                </div>

                <h3 className="text-base font-extrabold" style={{ color: 'var(--text-strong)' }}>{s.name}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  {s.neighborhood}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    {s.capacity} مقعد
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className={`h-4 w-4 ${s.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                    {s.rating ? s.rating.toFixed(1) : 'لا تقييمات'}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{s.price} ش.ج/ساعة</span>
                </div>

                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  المالك: {s.owner} · {s.bookings} حجز
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                  {s.status === 'pending' && (
                    <>
                      <SmallAction tone="green" onClick={() => approve(s.id)} className="flex-1">
                        <CheckCircle2 />
                        الموافقة
                      </SmallAction>
                      <SmallAction tone="red" onClick={() => reject(s.id)} className="flex-1">
                        <XCircle />
                        الرفض
                      </SmallAction>
                    </>
                  )}
                  {s.status === 'active' && (
                    <SmallAction tone="amber" onClick={() => suspend(s.id)} className="flex-1">
                      <Ban />
                      إيقاف المساحة
                    </SmallAction>
                  )}
                  {s.status === 'suspended' && (
                    <SmallAction tone="sky" onClick={() => activate(s.id)} className="flex-1">
                      <PlayCircle />
                      إعادة التفعيل
                    </SmallAction>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}