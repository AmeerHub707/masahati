import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, Search, ChevronDown, X, Building2 } from 'lucide-react';

export default function SpacePicker({ spaces = [], spaceId = '', onPick, label }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selectedSpace = spaces.find((s) => String(s.id) === String(spaceId)) || null;

  const filtered = useMemo(() => {
    return query
      ? spaces.filter((s) => (s.title || '').toLowerCase().includes(query.toLowerCase()))
      : spaces;
  }, [query, spaces]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (id) => {
    onPick(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="odash__filter" ref={ref}>
      <div className="odash__filter-ico"><Store /></div>
      <div className="odash__filter-main">
        <span className="odash__filter-label">
          {label ? label(selectedSpace) : (selectedSpace ? selectedSpace.title : 'كل المساحات')}
        </span>
        <div className="odash__filter-field">
          <Search className="odash__filter-search-ico" />
          <input
            type="text"
            value={query}
            placeholder={selectedSpace ? selectedSpace.title : 'ابحث عن مساحة محددة…'}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            aria-label="بحث عن مساحة"
          />
          {query || selectedSpace ? (
            <button
              type="button"
              className="odash__filter-clear"
              onClick={() => pick('')}
              aria-label="إلغاء اختيار المساحة"
            >
              <X />
            </button>
          ) : (
            <ChevronDown className="odash__filter-caret" />
          )}
        </div>
      </div>

      {open && (
        <div className="odash__filter-menu" role="listbox">
          <button type="button" role="option" className="odash__filter-item is-all" onClick={() => pick('')}>
            <Building2 /> كل المساحات
          </button>
          {filtered.map((s) => (
            <button
              type="button"
              role="option"
              key={s.id}
              className={`odash__filter-item${String(s.id) === String(spaceId) ? ' is-active' : ''}`}
              onClick={() => pick(String(s.id))}
            >
              <Building2 />
              <span>
                <b>{s.title}</b>
                <small>{s.location || `تتسع لـ ${s.capacity} شخص`}</small>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <span className="odash__filter-empty">لا توجد مساحات تطابق بحثك.</span>
          )}
        </div>
      )}
    </div>
  );
}