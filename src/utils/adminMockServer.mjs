/**
 * خادم اختبار بحالة داخلية.
 *
 * لماذا لا يكفي ردّ ثابت: الشاشات تُجري تغييرات حقيقية (إخفاء مراجعة، أرشفة
 * إشعار، حفظ الملف الشخصي، تغيير حالة حساب). وردّ ثابت يجعل الإجراء «تفشل»
 * دائماً فيمرّ الاختبار أو يفشل لأسباب لا علاقة لها بالواجهة. فنحتفظ بنسخة
 * قابلة للتعديل من بيانات الـ fixtures ونطبّق عليها ما يصل.
 *
 * كل تعديل يعود بالشكل نفسه الذي يصفه عقد الـ API، حتى لا تمرّ الواجهة على
 * مسار نجاح لم يختبره خادم حقيقي.
 */

import {
  fixtureFor,
  users as seedUsers,
  spaces as seedSpaces,
  bookings as seedBookings,
  disputes as seedDisputes,
  reviews as seedReviews,
  inboxItems as seedInbox,
  broadcasts as seedBroadcasts,
  settings as seedSettings,
  audienceCounts,
  activities,
  recentRegistrations,
  revenueTrend,
  stats,
  dailySeries,
  dailyCoverage,
  financialSummary,
  commissionBreakdown,
  transactions,
  notificationsUnread,
} from './adminFixtures.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ok = (data) => json({ data });
const list = (rows) =>
  json({ data: rows, meta: { page: 1, per_page: 100, total: rows.length, last_page: 1 } });

/** خطأ تحقّق بالشكل الذي يقرؤه العميل (العقد §0.5). */
const invalid = (message) => json({ message, errors: {} }, 422);
const missing = () => json({ message: 'العنصر غير موجود.', errors: {} }, 404);

export function createFixtureServer() {
  const state = {
    users: clone(seedUsers),
    spaces: clone(seedSpaces),
    bookings: clone(seedBookings),
    disputes: clone(seedDisputes),
    reviews: clone(seedReviews),
    inbox: clone(seedInbox),
    broadcasts: clone(seedBroadcasts),
    drafts: [],
    settings: clone(seedSettings),
    profile: {
      id: 1,
      name: 'إدارة مساحاتي',
      email: 'masahati@outlook.com',
      whatsapp: '',
    },
    seq: 1000,
  };

  // عدّاد الوارد غير المقروء = غير المقروء وغير المؤرشف بالضبط (العقد §11.2).
  const unreadCount = () => ({
    unread: state.inbox.filter((i) => !i.read && !i.archived).length,
    archived: state.inbox.filter((i) => i.archived).length,
  });

  const findBy = (collection, id) =>
    state[collection].find((row) => String(row.id) === String(id));

  async function readBody(req) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }

  async function fetchImpl(input, init = {}) {
    const req = new Request(new URL(String(input?.url || input), 'http://localhost.test'), init);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();

    /* ---------------- التصدير: ملف لا مغلّف ---------------- */
    if (path.endsWith('/export')) {
      return new Response('id,name\n1,test\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=UTF-8',
          'Content-Disposition': 'attachment; filename="test.csv"',
        },
      });
    }

    /* ---------------- المصادقة ---------------- */
    if (path === '/api/admin/login' && method === 'POST') {
      const body = await readBody(req);
      // حساب واحد مبذور في الاختبار: كلمة مرفوضة تعني رفضاً حقيقياً.
      if (body.password !== '123456789admin') {
        return json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', errors: {} }, 401);
      }
      return ok({
        token: 'test-admin-token',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        admin: state.profile,
      });
    }
    if (path === '/api/admin/logout' && method === 'POST') return new Response(null, { status: 204 });
    if (path === '/api/admin/me') return ok(state.profile);
    if (path === '/api/admin/profile' && method === 'PATCH') {
      Object.assign(state.profile, await readBody(req));
      return ok(state.profile);
    }
    // رفع الصورة: الطلب multipart فلا نقرأ جسمه (readBody يفشل على غير JSON
    // ويُعيد {})، ونحفظ مساراً ثابتاً بدل ملف وهمية — ما يهمّ الواجهة هو
    // رابط يعود به الخادم لا مضمّن الملف.
    if (path === '/api/admin/profile/picture' && method === 'POST') {
      state.profile.profile_picture_url = `/storage/admin/${++state.seq}.jpg`;
      return ok(state.profile);
    }
    if (path === '/api/admin/password' && method === 'PUT') {
      const body = await readBody(req);
      if (!body.current_password) return invalid('كلمة المرور الحالية مطلوبة.');
      return ok({ message: 'تم تغيير كلمة المرور.' });
    }

    /* ---------------- الإعدادات ---------------- */
    if (path === '/api/admin/settings') {
      if (method === 'GET') return ok(state.settings);
      Object.assign(state.settings, await readBody(req));
      return ok(state.settings);
    }

    /* ---------------- النظرة العامة ---------------- */
    if (path === '/api/admin/stats/revenue-trend') return ok(revenueTrend);
    if (path === '/api/admin/stats') return ok(stats);
    if (path === '/api/admin/activities') return ok(activities);
    if (path === '/api/admin/recent-registrations') return ok(recentRegistrations);

    /* ---------------- المستخدمون ---------------- */
    if (path === '/api/admin/users/stats') {
      return ok({
        total: state.users.length,
        // الملاك بإملاءَيه (`owner` و`space_owner`) — العقد §1.1 يذكر الأول
        // والخادم يرسل الثاني، وعدّ واحدٌ على واحدٍ فقط يجعل العدّاد نصّف
        // الحقيقة ويُظهر «اختفاء» بلا سبب.
        activeFreelancers: state.users.filter((u) => u.role === 'freelancer' && u.status === 'active').length,
        owners: state.users.filter((u) => u.role === 'owner' || u.role === 'space_owner').length,
        customers: state.users.filter((u) => u.role === 'customer').length,
        pendingVerif: state.users.filter((u) => !u.verified).length,
        suspended: state.users.filter((u) => u.status === 'suspended').length,
      });
    }
    if (path === '/api/admin/users/bulk-status' && method === 'POST') {
      const { ids = [], action } = await readBody(req);
      const status = action === 'activate' ? 'active' : 'suspended';
      state.users.forEach((u) => {
        if (!ids.map(String).includes(String(u.id))) return;
        u.status = status;
        // التفعيل الجماعي يوثّق كذلك، للسبب نفسه في التفعيل المفرد.
        if (status === 'active') u.verified = true;
      });
      return ok({ updated: ids.length, ids });
    }
    if (/^\/api\/admin\/users\/\d+\/status$/.test(path) && method === 'PATCH') {
      const row = findBy('users', path.split('/')[4]);
      if (!row) return missing();
      Object.assign(row, await readBody(req));
      // تفعيل الحساب يوثّق الهية معه: حساب معلّق من مُسجَّل جديد ليس
      // موثّقاً بعد، وإلزام الأدمن بخطوتين (تفعيل ثم توثيق) كان يجعل
      // «تفعيل الحساب» يبدو ناقصاً بلا خطأ ظاهر.
      if (row.status === 'active') row.verified = true;
      return ok(row);
    }
    if (/^\/api\/admin\/users\/\d+\/verify$/.test(path) && method === 'PATCH') {
      const row = findBy('users', path.split('/')[4]);
      if (!row) return missing();
      // عقد A4.5: التوثيق يضع `verified` و`status` معاً — لا يبقى معتمدٌ
      // بحالة `pending` بعد أن قرّر الأدمن اعتماده.
      row.verified = true;
      row.status = 'active';
      return ok(row);
    }
    if (/^\/api\/admin\/users\/\d+$/.test(path)) {
      const id = path.split('/')[4];
      const row = findBy('users', id);
      if (!row) return missing();
      if (method === 'GET') return ok(row);
      if (method === 'PATCH') {
        Object.assign(row, await readBody(req));
        return ok(row);
      }
      if (method === 'DELETE') {
        state.users = state.users.filter((u) => String(u.id) !== String(id));
        return new Response(null, { status: 204 });
      }
    }
    if (path === '/api/admin/users') return list(state.users);

    /* ---------------- المساحات ---------------- */
    if (path === '/api/admin/spaces/stats') {
      return ok({
        total: state.spaces.length,
        active: state.spaces.filter((s) => s.status === 'active').length,
        pending: state.spaces.filter((s) => s.status === 'pending').length,
        suspended: state.spaces.filter((s) => s.status === 'suspended').length,
      });
    }
    if (/^\/api\/admin\/spaces\/\d+\/status$/.test(path) && method === 'PATCH') {
      const row = findBy('spaces', path.split('/')[4]);
      if (!row) return missing();
      Object.assign(row, await readBody(req));
      return ok(row);
    }
    if (/^\/api\/admin\/spaces\/\d+$/.test(path)) {
      const id = path.split('/')[4];
      const row = findBy('spaces', id);
      if (!row) return missing();
      if (method === 'GET') return ok(row);
      if (method === 'PATCH') {
        Object.assign(row, await readBody(req));
        return ok(row);
      }
      if (method === 'DELETE') {
        state.spaces = state.spaces.filter((s) => String(s.id) !== String(id));
        return new Response(null, { status: 204 });
      }
    }
    if (path === '/api/admin/spaces') return list(state.spaces);

    /* ---------------- الحجوزات ---------------- */
    if (/^\/api\/admin\/bookings\/[^/]+\/status$/.test(path) && method === 'PATCH') {
      const row = state.bookings.find((b) => b.ref === path.split('/')[4]);
      if (!row) return missing();
      Object.assign(row, await readBody(req));
      return ok(row);
    }
    if (/^\/api\/admin\/bookings\/[^/]+$/.test(path)) {
      const row = state.bookings.find((b) => b.ref === path.split('/')[4]);
      return row ? ok(row) : missing();
    }
    if (path === '/api/admin/bookings') return list(state.bookings);

    /* ---------------- النزاعات ---------------- */
    if (/^\/api\/admin\/disputes\/[^/]+\/resolve$/.test(path) && method === 'PATCH') {
      const row = state.disputes.find((d) => d.ref === path.split('/')[4]);
      if (!row) return missing();
      const body = await readBody(req);
      if (body.decision === 'refund' && !Number.isFinite(body.refund_amount)) {
        return invalid('مبلغ الاسترداد مطلوب عند اختيار الاسترداد.');
      }
      row.status = body.decision === 'refund' ? 'closed' : 'resolved';
      return ok(row);
    }
    if (/^\/api\/admin\/disputes\/[^/]+$/.test(path)) {
      const row = state.disputes.find((d) => d.ref === path.split('/')[4]);
      return row ? ok(row) : missing();
    }
    if (path === '/api/admin/disputes') return list(state.disputes);

    /* ---------------- المراجعات ---------------- */
    if (path === '/api/admin/reviews/stats') {
      const total = state.reviews.length;
      return ok({
        total,
        average: total ? (state.reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '—',
        flagged: state.reviews.filter((r) => r.flagged).length,
        hidden: state.reviews.filter((r) => !r.visible).length,
      });
    }
    if (/^\/api\/admin\/reviews\/\d+$/.test(path)) {
      const id = path.split('/')[4];
      const row = findBy('reviews', id);
      if (!row) return missing();
      if (method === 'GET') return ok(row);
      if (method === 'PATCH') {
        Object.assign(row, await readBody(req));
        return ok(row);
      }
      if (method === 'DELETE') {
        state.reviews = state.reviews.filter((r) => String(r.id) !== String(id));
        return new Response(null, { status: 204 });
      }
    }
    if (path === '/api/admin/reviews') return list(state.reviews);

    /* ---------------- المالية ---------------- */
    if (path === '/api/admin/financials/summary') return ok(financialSummary);
    if (path === '/api/admin/financials/daily') {
      return ok({
        from: dailyCoverage.from,
        to: dailyCoverage.to,
        coverage: dailyCoverage,
        series: dailySeries,
        totals: {
          revenue: dailySeries.reduce((s, d) => s + d.revenue, 0),
          bookings: dailySeries.reduce((s, d) => s + d.bookings, 0),
          pending: dailySeries.reduce((s, d) => s + d.pending, 0),
        },
      });
    }
    if (path === '/api/admin/financials/commission-breakdown') return ok(commissionBreakdown);
    if (path === '/api/admin/financials/transactions') return list(transactions);

    /* ---------------- صندوق الوارد ---------------- */
    if (path === '/api/admin/inbox/unread-count') return ok(unreadCount());
    if (path === '/api/admin/inbox/categories') return ok(fixtureFor(path));
    if (path === '/api/admin/inbox/bulk' && method === 'POST') {
      const { ids = [], action } = await readBody(req);
      const targets = state.inbox.filter((i) => ids.map(String).includes(String(i.id)));
      targets.forEach((i) => {
        if (action === 'read') i.read = true;
        if (action === 'unread') i.read = false;
        if (action === 'archive') i.archived = true;
        if (action === 'unarchive') i.archived = false;
      });
      if (action === 'delete') {
        state.inbox = state.inbox.filter((i) => !ids.map(String).includes(String(i.id)));
      }
      return ok({ updated: targets.length, ids });
    }
    if (path === '/api/admin/inbox/mark-all-read' && method === 'POST') {
      const updated = state.inbox.filter((i) => !i.archived && !i.read).length;
      state.inbox.forEach((i) => { if (!i.archived) i.read = true; });
      return ok({ updated });
    }
    if (/^\/api\/admin\/inbox\/\d+$/.test(path) && method === 'PATCH') {
      const row = findBy('inbox', path.split('/')[4]);
      if (!row) return missing();
      Object.assign(row, await readBody(req));
      return ok(row);
    }
    if (path === '/api/admin/inbox') {
      const view = url.searchParams.get('view');
      const rows = view === 'archived' ? state.inbox.filter((i) => i.archived) : state.inbox.filter((i) => !i.archived);
      return list(rows);
    }

    /* ---------------- البث ---------------- */
    if (path === '/api/admin/broadcasts/audience-counts') return ok(audienceCounts);
    if (/^\/api\/admin\/broadcasts\/\d+\/resend$/.test(path) && method === 'POST') {
      const id = Number(path.split('/')[4]);
      const row = state.broadcasts.find((b) => b.id === id);
      if (!row) return missing();
      const { channels } = await readBody(req);
      return ok({ ...row, channels: Array.isArray(channels) && channels.length ? channels : row.channels });
    }
    if (path === '/api/admin/broadcasts/drafts') {
      if (method === 'GET') return list(state.drafts);
      if (method === 'POST') {
        state.seq += 1;
        const draft = { id: state.seq, ...(await readBody(req)), updated_at: new Date().toISOString() };
        state.drafts.push(draft);
        return ok(draft);
      }
    }
    if (/^\/api\/admin\/broadcasts\/drafts\/\d+$/.test(path)) {
      const id = path.split('/')[4];
      if (method === 'PUT' || method === 'PATCH') {
        const draft = state.drafts.find((d) => String(d.id) === String(id));
        if (!draft) return missing();
        Object.assign(draft, await readBody(req));
        return ok(draft);
      }
      if (method === 'DELETE') {
        state.drafts = state.drafts.filter((d) => String(d.id) !== String(id));
        return new Response(null, { status: 204 });
      }
    }
    if (path === '/api/admin/broadcasts') {
      if (method === 'GET') return list(state.broadcasts);
      if (method === 'POST') {
        const body = await readBody(req);
        const row = {
          id: (state.broadcasts.at(-1)?.id ?? 0) + 1,
          opened: 0,
          total: audienceCounts[body.target] ?? 0,
          sent_by: 'admin',
          sent_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
          ...body,
        };
        state.broadcasts.unshift(row);
        return json({ data: row }, 201);
      }
    }

    /* ---------------- الإشعارات والتسجيلات ---------------- */
    if (path === '/api/admin/notifications/unread-count') return ok(notificationsUnread);
    if (/^\/api\/admin\/registrations\/\d+\/recheck$/.test(path) && method === 'POST') {
      return ok({ id: path.split('/')[4], status: 'active' });
    }

    return json({ message: `مسار غير معروف في الاختبار: ${method} ${path}`, errors: {} }, 404);
  }

  return { fetch: fetchImpl, state, unreadCount };
}
