import { useState } from 'react';
import {
  Search,
  Eye,
  Ban,
  CheckCircle2,
  Trash2,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { adminUsers } from '../../data/adminMockData';
import {
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,
  Modal,
  btnGhost,
  btnDanger,
  btnPrimary,
  Pill,
  IconButton,
  Avatar,
} from './ui';

const roleOptions = [
  { id: 'all', label: 'كل الحسابات' },
  { id: 'freelancer', label: 'فريلانسرز' },
  { id: 'owner', label: 'ملاك' },
];

const roleLabel = { freelancer: 'فريلانسر', owner: 'صاحب مساحة' };
const roleTone = { freelancer: 'violet', owner: 'orange' };

export default function AdminUsers() {
  const [users, setUsers] = useState(adminUsers);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [viewUser, setViewUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = users.filter((u) => {
    const matchRole = role === 'all' || u.role === role;
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.replace(/\s/g, '').includes(query.replace(/\s/g, ''));
    return matchRole && matchQuery;
  });

  const toggleSuspend = (id) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u
      )
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const counts = users.reduce(
    (acc, u) => {
      acc.total += 1;
      acc[u.role] = (acc[u.role] || 0) + 1;
      if (u.status === 'suspended') acc.suspended += 1;
      return acc;
    },
    { total: 0, freelancer: 0, owner: 0, suspended: 0 }
  );

  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHeading
          icon={Users}
          title="إدارة المستخدمين والملاك"
          subtitle={`${counts.total} حساب · ${counts.freelancer} فريلانسر · ${counts.owner} مالك · ${counts.suspended} موقوف`}
        />

        {/* شريط البحث والتصفية */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:max-w-xs md:flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو البريد أو الهاتف…"
              className={`dash__input dash__input--icon`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((opt) => (
              <Pill key={opt.id} active={role === opt.id} onClick={() => setRole(opt.id)}>
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا توجد نتائج مطابقة"
            description="جرّب تعديل كلمة البحث أو تغيير الفلتر للعثور على الحسابات."
            actionLabel="إعادة الضبط"
            onAction={() => {
              setQuery('');
              setRole('all');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="dash__table min-w-[46rem] text-sm">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>التحقق</th>
                  <th>عدد الحجوزات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} xs />
                        <div className="min-w-0">
                          <p className="truncate font-bold" style={{ color: 'var(--text-strong)' }}>{u.name}</p>
                          <p className="txt-muted truncate text-xs" dir="ltr">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={roleTone[u.role]}>{roleLabel[u.role]}</StatusBadge>
                    </td>
                    <td>
                      {u.status === 'active' ? (
                        <StatusBadge tone="green" icon={UserCheck}>نشط</StatusBadge>
                      ) : (
                        <StatusBadge tone="red" icon={UserX}>موقوف</StatusBadge>
                      )}
                    </td>
                    <td>
                      {u.verified ? (
                        <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                      ) : (
                        <StatusBadge tone="amber" icon={Clock}>قيد المراجعة</StatusBadge>
                      )}
                    </td>
                    <td className="num">{u.bookings}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <IconButton tone="sky" label={`عرض ${u.name}`} onClick={() => setViewUser(u)}>
                          <Eye />
                        </IconButton>
                        <IconButton
                          tone={u.status === 'suspended' ? 'green' : 'amber'}
                          label={u.status === 'suspended' ? 'تفعيل الحساب' : 'إيقاف الحساب'}
                          onClick={() => toggleSuspend(u.id)}
                        >
                          {u.status === 'suspended' ? <CheckCircle2 /> : <Ban />}
                        </IconButton>
                        <IconButton tone="red" label={`حذف ${u.name}`} onClick={() => setDeleteTarget(u.id)}>
                          <Trash2 />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* نافذة التفاصيل */}
      <Modal open={Boolean(viewUser)} onClose={() => setViewUser(null)} title={viewUser?.name || 'تفاصيل المستخدم'}>
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="dash__avatar" style={{ width: '4rem', height: '4rem', fontSize: '1.3rem' }}>
                {(viewUser.name || 'م').trim().slice(0, 2)}
              </span>
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <StatusBadge tone={roleTone[viewUser.role]}>{roleLabel[viewUser.role]}</StatusBadge>
                  <StatusBadge tone={viewUser.status === 'active' ? 'green' : 'red'}>
                    {viewUser.status === 'active' ? 'نشط' : 'موقوف'}
                  </StatusBadge>
                </div>
                <p className="txt-muted text-xs" dir="ltr">
                  {viewUser.email} · {viewUser.phone}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="dash__soft">
                <dt className="txt-caption text-xs">تاريخ الانضمام</dt>
                <dd className="mt-0.5 font-bold" style={{ color: 'var(--text-strong)' }}>{viewUser.joined}</dd>
              </div>
              <div className="dash__soft">
                <dt className="txt-caption text-xs">عدد الحجوزات</dt>
                <dd className="mt-0.5 font-bold" style={{ color: 'var(--text-strong)' }}>{viewUser.bookings}</dd>
              </div>
              <div className="dash__soft col-span-2">
                <dt className="txt-caption text-xs">حالة التحقق</dt>
                <dd className="mt-1">
                  <StatusBadge tone={viewUser.verified ? 'blue' : 'amber'}>
                    {viewUser.verified ? 'تم التحقق' : 'قيد المراجعة'}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setViewUser(null)}>
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleSuspend(viewUser.id);
                  setViewUser(null);
                }}
                className={btnPrimary}
              >
                {viewUser.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                {viewUser.status === 'suspended' ? 'تفعيل الحساب' : 'إيقاف الحساب'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* تأكيد الحذف */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف الحساب نهائياً؟"
      >
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم حذف جميع بيانات المستخدم وحجوزاته نهائياً من المنصة، ولا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button type="button" onClick={handleDelete} className={btnDanger}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف الحساب
          </button>
        </div>
      </Modal>
    </div>
  );
}