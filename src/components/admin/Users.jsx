import { useState } from 'react';
import { Eye, ShieldCheck, ShieldX, Trash2, BadgeCheck, Clock3, Search } from 'lucide-react';
import { users as initialUsers, ROLE_LABELS } from '../../lib/adminMock';
import { Card, SearchInput, Badge, Modal, EmptyState, IconButton, PrimaryButton } from './ui';

const ROLE_FILTERS = [
  { id: 'all', label: 'كل الحسابات' },
  { id: 'student', label: 'طلاب' },
  { id: 'freelancer', label: 'فريلانسرز' },
  { id: 'owner', label: 'ملاك' },
];

export default function AdminUsers() {
  const [list, setList] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [viewed, setViewed] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = list.filter((u) => {
    const matchRole = role === 'all' || u.role === role;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.city.toLowerCase().includes(q);
    return matchRole && matchQuery;
  });

  const toggleStatus = (id) =>
    setList((prev) => prev.map((u) => (u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u)));

  const confirmDelete = () => {
    setList((prev) => prev.filter((u) => u.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <Card className="p-0! overflow-hidden">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو البريد أو المدينة…" />
          <div className="flex flex-wrap items-center gap-2">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRole(f.id)}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  role === f.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Search}
              title="لا توجد نتائج مطابقة"
              description="جرّب تعديل كلمة البحث أو تغيير فلتر الدور للحصول على نتائج."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-700/30 dark:text-gray-500">
                  <th className="px-5 py-3 text-start font-extrabold">المستخدم</th>
                  <th className="px-5 py-3 text-start font-extrabold">الدور</th>
                  <th className="px-5 py-3 text-start font-extrabold">الحالة</th>
                  <th className="px-5 py-3 text-start font-extrabold">التحقق</th>
                  <th className="px-5 py-3 text-start font-extrabold">الحجوزات</th>
                  <th className="px-5 py-3 text-start font-extrabold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((u) => (
                  <tr key={u.id} className="transition hover:bg-orange-50/40 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-b from-orange-400 to-orange-600 text-xs font-extrabold text-white">
                          {u.name.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 truncate text-xs font-bold text-zinc-800 dark:text-gray-200">{u.name}</p>
                          <p className="m-0 truncate text-xs text-gray-400" dir="ltr">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={u.role === 'owner' ? 'orange' : u.role === 'freelancer' ? 'blue' : 'green'}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {u.status === 'active' ? (
                        <Badge tone="green"><ShieldCheck className="h-3 w-3" /> نشط</Badge>
                      ) : (
                        <Badge tone="red"><ShieldX className="h-3 w-3" /> موقوف</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {u.verified ? (
                        <Badge tone="blue"><BadgeCheck className="h-3 w-3" /> تم التحقق</Badge>
                      ) : (
                        <Badge tone="amber"><Clock3 className="h-3 w-3" /> قيد المراجعة</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-zinc-700 dark:text-gray-300">{u.bookingsCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <IconButton label="عرض التفاصيل" onClick={() => setViewed(u)}>
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={u.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                          onClick={() => toggleStatus(u.id)}
                          className={u.status === 'active' ? 'hover:!bg-amber-50 hover:!text-amber-600' : 'hover:!bg-green-50 hover:!text-green-600'}
                        >
                          {u.status === 'active' ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </IconButton>
                        <IconButton label="حذف الحساب" onClick={() => setToDelete(u)} className="hover:!bg-red-50 hover:!text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-gray-100 px-5 py-3 text-xs font-semibold text-gray-400 dark:border-gray-700">
          إجمالي النتائج: {filtered.length} من {list.length}
        </div>
      </Card>

      {/* نافذة عرض التفاصيل */}
      <Modal open={!!viewed} onClose={() => setViewed(null)} title="تفاصيل المستخدم">
        {viewed && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-orange-400 to-orange-600 text-lg font-extrabold text-white">
                {viewed.name.slice(0, 2)}
              </span>
              <div>
                <p className="m-0 text-sm font-extrabold text-zinc-900 dark:text-gray-100">{viewed.name}</p>
                <p className="m-0 text-xs text-gray-400">{ROLE_LABELS[viewed.role]} · {viewed.city}</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40">
              <InfoRow label="البريد الإلكتروني" value={viewed.email} ltr />
              <InfoRow label="رقم الهاتف" value={viewed.phone} ltr />
              <InfoRow label="تاريخ الانضمام" value={viewed.joinedAt} ltr />
              <InfoRow label="عدد الحجوزات" value={String(viewed.bookingsCount)} />
              {viewed.spaces != null && <InfoRow label="المساحات المسجلة" value={String(viewed.spaces)} />}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Badge tone={viewed.status === 'active' ? 'green' : 'red'}>{viewed.status === 'active' ? 'نشط' : 'موقوف'}</Badge>
              <Badge tone={viewed.verified ? 'blue' : 'amber'}>{viewed.verified ? 'تم التحقق' : 'قيد المراجعة'}</Badge>
            </div>
          </div>
        )}
      </Modal>

      {/* تأكيد الحذف */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="حذف الحساب">
        {toDelete && (
          <div>
            <p className="m-0 text-sm leading-6 text-gray-500 dark:text-gray-400">
              هل أنت متأكد من حذف حساب <strong className="text-zinc-900 dark:text-gray-100">{toDelete.name}</strong> نهائياً؟
              سيتم إزالة جميع بياناته وحجوزاته من المنصة ولا يمكن التراجع.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              <PrimaryButton onClick={confirmDelete} className="bg-red-500! shadow-red-500/25! hover:bg-red-600!">
                <Trash2 className="h-4 w-4" />
                نعم، احذف
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, ltr = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-bold text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="m-0 font-semibold text-zinc-800 dark:text-gray-200" dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}