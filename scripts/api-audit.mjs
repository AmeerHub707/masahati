#!/usr/bin/env node
/**
 * API audit harness.
 *
 * Probes every backend endpoint the frontend calls and classifies it, so gaps can
 * be reported to the backend team with evidence instead of guesswork.
 *
 * Three sweeps:
 *   A1  OPTIONS per unique path - reads the Allow header. Never invokes a
 *       controller, so it cannot mutate data on any endpoint, any method.
 *   A2  Unauthenticated request per method. Auth middleware rejects before the
 *       handler, so 401 proves the route exists while 404 proves it does not.
 *   B   Authenticated GET-only sweep using real tokens, with assertions on the
 *       JSON keys the frontend mappers actually read. No writes are ever sent
 *       with a valid token.
 *
 * Credentials are read from the environment only and are never written to disk.
 *
 *   MASAHATI_API_BASE      defaults to the frontend's hardcoded backend URL
 *   OWNER_EMAIL / OWNER_PASSWORD
 *   CUSTOMER_EMAIL / CUSTOMER_PASSWORD
 *
 * Usage: node scripts/api-audit.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const BASE_URL = (
  process.env.MASAHATI_API_BASE || 'https://back-end-kwba.onrender.com'
).replace(/\/$/, '');

const WARMUP_TIMEOUT_MS = 90_000;
const PROBE_TIMEOUT_MS = 30_000;
const GAP_MS = 300;

const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || '';

// role: which account the frontend authenticates as when it calls this.
// probeBody: sent only on unauthenticated probes, kept empty enough that
// validation rejects rather than a handler performing real work.
const ENDPOINTS = [
  // --- Auth & account ---------------------------------------------------
  { method: 'POST', path: '/api/login', group: 'Auth & account', file: 'src/lib/authStore.js:42', fn: 'login', role: 'public', live: true,
    bodyNote: 'JSON { login, password } - field is `login`, not `email`',
    expect: [['token']] },
  { method: 'GET', path: '/api/profile', group: 'Auth & account', file: 'src/lib/authStore.js:56,177; dashboard.js:124; owner.js:1301', fn: 'login/getProfile/fetchDashboard/loadOwnerDashboardImpl', role: 'both', live: true,
    expect: [['role'], ['name', 'full_name'], ['email'], ['phone'], ['picture', 'photo']] },
  { method: 'POST', path: '/api/register/customer', group: 'Auth & account', file: 'src/lib/authStore.js:80', fn: 'registerCustomer', role: 'public', live: true,
    bodyNote: 'JSON { name, email, phone, password, password_confirmation }',
    expect: [['registration_token']] },
  { method: 'POST', path: '/api/register/space-owner', group: 'Auth & account', file: 'src/lib/authStore.js:88', fn: 'registerOwner', role: 'public', live: true, form: true,
    bodyNote: 'FORM name,email,phone,password,password_confirmation + proof_document file',
    expect: [['registration_token']] },
  { method: 'POST', path: '/api/auth/google', group: 'Auth & account', file: 'src/lib/authStore.js:121', fn: 'googleLogin', role: 'public', live: true,
    bodyNote: 'JSON { id_token } or { id_token, role }',
    expect: [['token']] },
  { method: 'POST', path: '/api/change-pass', group: 'Auth & account', file: 'src/lib/authStore.js:165', fn: 'changePassword', role: 'both', live: true,
    bodyNote: 'JSON { oldPassword, newPassword, newPassword_confirmation }',
    expect: [['message']] },
  { method: 'PATCH', path: '/api/customer/profile', group: 'Auth & account', file: 'src/lib/authStore.js:182', fn: 'updateProfile', role: 'both', live: true,
    bodyNote: 'JSON { full_name, phone, email } - response ignored by caller',
    expect: [['message']] },
  { method: 'POST', path: '/api/uploadPicture', group: 'Auth & account', file: 'src/lib/authStore.js:194', fn: 'uploadPicture', role: 'both', live: true, form: true,
    bodyNote: 'FORM profile_picture file - one-time upload path',
    expect: [['profile_picture_url', 'picture', 'photo', 'image', 'avatar', 'path']] },
  { method: 'PATCH', path: '/api/profile/picture', group: 'Auth & account', file: 'src/lib/authStore.js:206', fn: 'updateProfilePicture', role: 'both', live: true, form: true,
    bodyNote: 'FORM profile_picture file - replace path',
    expect: [['profile_picture_url', 'picture', 'photo', 'image', 'avatar', 'path']] },
  { method: 'POST', path: '/api/logout', group: 'Auth & account', file: 'src/lib/authStore.js:217', fn: 'logout', role: 'both', live: true,
    bodyNote: 'no body; errors swallowed, local session cleared in finally' },
  { method: 'DELETE', path: '/api/delete-user', group: 'Auth & account', file: 'src/lib/authStore.js:229', fn: 'deleteUser', role: 'both', live: true,
    bodyNote: 'no body' },
  { method: 'POST', path: '/api/forgot-password', group: 'Auth & account', file: 'src/lib/authStore.js:239; ForgotPasswordPage.jsx:48', fn: 'isEmailRegistered/handleSubmit', role: 'public', live: true,
    bodyNote: 'JSON { email } - existence inferred from 4xx vs 2xx',
    expect: [['message']] },

  // --- OTP & password reset ---------------------------------------------
  { method: 'POST', path: '/api/verify-otp', group: 'OTP & reset', file: 'src/pages/VerifyOtpPage.jsx:76', fn: 'handleOtpSubmit', role: 'public', live: true,
    bodyNote: 'JSON { registration_token, code }; 422/401 -> invalid-code message' },
  { method: 'POST', path: '/api/resend-otp', group: 'OTP & reset', file: 'src/pages/VerifyOtpPage.jsx:110', fn: 'handleResendOtp', role: 'public', live: true,
    bodyNote: 'JSON { registration_token }' },
  { method: 'POST', path: '/api/reset-password', group: 'OTP & reset', file: 'src/pages/ResetPasswordPage.jsx:95', fn: 'handleSubmit', role: 'public', live: true,
    bodyNote: 'JSON { email, token, password, password_confirmation }; errors.password/token/email read on 422' },

  // --- Customer dashboard ------------------------------------------------
  { method: 'GET', path: '/api/dashboard/stats', group: 'Customer dashboard', file: 'src/lib/dashboard.js:120', fn: 'fetchDashboard', role: 'customer', live: true,
    expect: [['upcoming_bookings_count'], ['total_hours'], ['favorite_spaces_count'], ['booked_hours_this_month']] },
  { method: 'GET', path: '/api/dashboard/upcoming-booking', group: 'Customer dashboard', file: 'src/lib/dashboard.js:121', fn: 'fetchDashboard', role: 'customer', live: true,
    expect: [['bookings', 'data'], ['booking_id', 'id'], ['space_name', 'title'], ['date'], ['time_from'], ['time_to'], ['status']] },
  { method: 'GET', path: '/api/dashboard/bookings', group: 'Customer dashboard', file: 'src/lib/dashboard.js:122', fn: 'fetchDashboard', role: 'customer', live: true,
    expect: [['bookings', 'data'], ['booking_id', 'id'], ['space_name', 'title'], ['date'], ['hours'], ['price', 'cost'], ['status']] },
  { method: 'GET', path: '/api/dashboard/favorites', group: 'Customer dashboard', file: 'src/lib/dashboard.js:123', fn: 'fetchDashboard', role: 'customer', live: true,
    expect: [['favorites', 'data'], ['space_id', 'id'], ['title', 'name'], ['location'], ['price', 'price_per_hour'], ['rating']] },
  { method: 'POST', path: '/api/dashboard/favorites/toggle', group: 'Customer dashboard', file: 'src/lib/dashboard.js:170', fn: 'toggleFavorite', role: 'customer', live: true,
    bodyNote: 'JSON { space_id }; expects is_favorited at root or under data' },
  { method: 'GET', path: '/api/dashboard/spaces', group: 'Customer dashboard', file: 'src/lib/dashboard.js:183', fn: 'fetchSpaces', role: 'customer', live: false,
    note: 'dead code - no importer', expect: [['data', 'spaces'], ['current_page'], ['last_page']] },

  // --- Special requests --------------------------------------------------
  { method: 'GET', path: '/api/special-requests', group: 'Special requests', file: 'src/lib/requests.js:412', fn: 'fetchMyRequests', role: 'customer', live: true,
    expect: [['requests', 'data'], ['request_id', 'id'], ['title'], ['notes', 'description', 'details'], ['space_type'], ['capacity'], ['schedule'], ['preferred_time'], ['area', 'location'], ['amenities'], ['budget', 'max_budget'], ['status', 'is_accepted'], ['offers_count'], ['created_at'], ['expires_at']] },
  { method: 'POST', path: '/api/special-requests', group: 'Special requests', file: 'src/lib/requests.js:421', fn: 'createSpecialRequest', role: 'customer', live: true,
    bodyNote: 'JSON { title, description, space_type, capacity, schedule_preset, schedule_count, preferred_time, area, amenities, budget }' },
  { method: 'GET', path: '/api/special-requests/{id}', group: 'Special requests', file: 'src/lib/requests.js:443', fn: 'fetchRequestDetail', role: 'customer', live: true,
    dynamic: true, harvest: 'request',
    expect: [['request'], ['title'], ['offers'], ['offer_id', 'id'], ['owner_name'], ['price_per_hour'], ['currency'], ['duration_hours', 'hours'], ['location'], ['notes', 'message'], ['status', 'is_accepted']] },
  { method: 'POST', path: '/api/special-requests/{requestId}/offers/{offerId}/accept', group: 'Special requests', file: 'src/lib/requests.js:455', fn: 'acceptRequestOffer', role: 'customer', live: true, dynamic: true,
    bodyNote: 'no body; expects booking|order|reservation wrapper' },
  { method: 'POST', path: '/api/special-requests/{requestId}/offers/{offerId}/reject', group: 'Special requests', file: 'src/lib/requests.js:654', fn: 'rejectRequestOffer', role: 'customer', live: true, dynamic: true,
    bodyNote: 'no body' },
  { method: 'POST', path: '/api/special-requests/{requestId}/close', group: 'Special requests', file: 'src/lib/requests.js:668', fn: 'closeSpecialRequest', role: 'customer', live: true, dynamic: true,
    bodyNote: 'no body' },
  { method: 'GET', path: '/api/special-requests/open', group: 'Special requests', file: 'src/lib/owner.js:518', fn: 'fetchMarketRequests', role: 'owner', live: true,
    expect: [['requests', 'data'], ['request_id', 'id'], ['title'], ['space_type'], ['capacity'], ['schedule'], ['preferred_time'], ['area', 'location'], ['amenities'], ['budget', 'max_budget']] },
  { method: 'POST', path: '/api/special-requests/{requestId}/offers', group: 'Special requests', file: 'src/lib/owner.js:527', fn: 'submitOwnerProposal', role: 'owner', live: true, dynamic: true,
    bodyNote: 'JSON { space_id, price_per_hour, duration_hours, notes, currency }' },

  // --- Owner dashboard ---------------------------------------------------
  { method: 'GET', path: '/api/owner/spaces', group: 'Owner dashboard', file: 'src/lib/owner.js:558', fn: 'fetchOwnerSpaces', role: 'owner', live: true,
    expect: [['spaces', 'data'], ['space_id', 'id'], ['title'], ['description'], ['location'], ['lat', 'latitude'], ['lng', 'lon', 'longitude'], ['image'], ['gallery'], ['price_per_hour', 'price'], ['capacity'], ['open_time'], ['close_time'], ['contact_phone'], ['amenities'], ['internet', 'has_internet', 'wifi'], ['power', 'has_power', 'electricity'], ['status', 'is_active'], ['docs'], ['rating'], ['stats']] },
  { method: 'POST', path: '/api/owner/spaces', group: 'Owner dashboard', file: 'src/lib/owner.js:567', fn: 'createOwnerSpace', role: 'owner', live: true,
    bodyNote: 'JSON title,description,location,lat,lng,price_per_hour,capacity,open_time,close_time,contact_phone,amenities,internet,power,image,docs[],status' },
  { method: 'PATCH', path: '/api/owner/spaces/{spaceId}/active', group: 'Owner dashboard', file: 'src/lib/owner.js:599', fn: 'toggleOwnerSpaceActive', role: 'owner', live: true, dynamic: true,
    bodyNote: 'JSON { is_active }', contractFlag: 'BACKEND_OWNER_DASHBOARD_CONTRACT.md:197 - NOT IMPLEMENTED YET' },
  { method: 'PUT', path: '/api/owner/spaces/{spaceId}', group: 'Owner dashboard', file: 'src/lib/owner.js:612', fn: 'updateOwnerSpace', role: 'owner', live: true, dynamic: true,
    bodyNote: 'JSON same as create minus status; known bug: omits gallery', contractFlag: 'BACKEND_OWNER_DASHBOARD_CONTRACT.md:298 - NOT IMPLEMENTED YET' },
  { method: 'DELETE', path: '/api/owner/spaces/{spaceId}', group: 'Owner dashboard', file: 'src/lib/owner.js:643', fn: 'deleteOwnerSpace', role: 'owner', live: true, dynamic: true,
    bodyNote: 'no body', contractFlag: 'BACKEND_OWNER_DASHBOARD_CONTRACT.md:353 - NOT IMPLEMENTED YET' },
  { method: 'GET', path: '/api/owner/bookings', group: 'Owner dashboard', file: 'src/lib/owner.js:655', fn: 'fetchOwnerBookings', role: 'owner', live: true,
    contractFlag: 'BACKEND_OWNER_DASHBOARD_CONTRACT.md:232 - NOT IMPLEMENTED YET',
    expect: [['bookings', 'data'], ['booking_id', 'id'], ['space_id'], ['space_name', 'title'], ['date'], ['time_from', 'start_time'], ['time_to', 'end_time'], ['hours', 'duration_hours'], ['price', 'cost'], ['customer', 'customer_name'], ['status']] },
  { method: 'PATCH', path: '/api/owner/bookings/{bookingId}/status', group: 'Owner dashboard', file: 'src/lib/owner.js:787', fn: 'updateOwnerBookingStatus', role: 'owner', live: true, dynamic: true,
    bodyNote: 'JSON { status }', note: 'code comment says not enabled in backend; absent from every BACKEND_*.md' },
  { method: 'GET', path: '/api/owner/reviews', group: 'Owner dashboard', file: 'src/lib/owner.js:682', fn: 'fetchOwnerReviews', role: 'owner', live: true,
    note: 'absent from every BACKEND_*.md; optional ?space_id=',
    expect: [['reviews', 'data'], ['review_id', 'id'], ['space_id'], ['space_name'], ['space_image', 'image'], ['rating'], ['title'], ['comment', 'text', 'review'], ['customer_name', 'customer'], ['customer_avatar', 'avatar'], ['date', 'created_at']] },
  { method: 'GET', path: '/api/owner/documents', group: 'Owner dashboard', file: 'src/lib/owner.js:1177', fn: 'fetchOwnerDocuments', role: 'owner', live: true,
    expect: [['status'], ['files'], ['assets'], ['cert'], ['note', 'review_note', 'admin_note'], ['submitted_at'], ['reviewed_at']] },
  { method: 'POST', path: '/api/owner/documents', group: 'Owner dashboard', file: 'src/lib/owner.js:1190', fn: 'submitOwnerDocuments', role: 'owner', live: true, form: true,
    bodyNote: 'FORM assets=<file>, cert=<file>', note: 'GET is in contract 8; the POST upload is undocumented' },
  { method: 'GET', path: '/api/owner/offers', group: 'Owner dashboard', file: 'src/lib/owner.js:549', fn: 'fetchOwnerOffers', role: 'owner', live: true,
    expect: [['offers', 'data'], ['offer_id', 'id'], ['request_id'], ['request_title', 'title'], ['status'], ['price_per_hour', 'price'], ['currency'], ['duration_hours', 'hours'], ['created_at', 'created']] },

  // --- Owner ads ---------------------------------------------------------
  { method: 'GET', path: '/api/owner/ads', group: 'Owner ads', file: 'src/lib/ads.js:116', fn: 'fetchOwnerAds', role: 'owner', live: true,
    expect: [['ads', 'data'], ['ad_id', 'id'], ['title'], ['description', 'notes'], ['link', 'url'], ['image'], ['target'], ['space_id', 'space'], ['status'], ['created_at', 'created'], ['sent_at'], ['impressions', 'impressions_count'], ['schedule']] },
  { method: 'POST', path: '/api/owner/ads', group: 'Owner ads', file: 'src/lib/ads.js:125', fn: 'createOwnerAd', role: 'owner', live: true,
    bodyNote: 'JSON { title, description, link, image, target, schedule }' },
  { method: 'PUT', path: '/api/owner/ads/{adId}', group: 'Owner ads', file: 'src/lib/ads.js:149', fn: 'updateOwnerAd', role: 'owner', live: true, dynamic: true,
    bodyNote: 'JSON { title, description, link, image, target, status, schedule }' },
  { method: 'DELETE', path: '/api/owner/ads/{adId}', group: 'Owner ads', file: 'src/lib/ads.js:174', fn: 'deleteOwnerAd', role: 'owner', live: true, dynamic: true, bodyNote: 'no body' },
  { method: 'POST', path: '/api/owner/ads/{adId}/publish', group: 'Owner ads', file: 'src/lib/ads.js:187', fn: 'publishOwnerAd', role: 'owner', live: true, dynamic: true, bodyNote: 'no body' },

  // --- Notifications -----------------------------------------------------
  { method: 'GET', path: '/api/notifications', group: 'Notifications', file: 'src/lib/notifications.js:162', fn: 'fetchNotifications', role: 'both', live: true,
    expect: [['notifications', 'data'], ['id', 'notification_id'], ['text', 'message'], ['time'], ['read'], ['created_at']] },
  { method: 'PATCH', path: '/api/notifications/read', group: 'Notifications', file: 'src/lib/notifications.js:171', fn: 'markNotificationsRead', role: 'both', live: true,
    bodyNote: 'no body' },

  // --- AI assistant ------------------------------------------------------
  { method: 'POST', path: '/api/assistant/chat', group: 'AI assistant', file: 'src/lib/assistant.js:24; ownerAssistant.js:166; customerAssistant.js:134', fn: 'askAssistant/askOwnerAssistant/askCustomerAssistant', role: 'both', live: true,
    bodyNote: 'three call sites on one route: anonymous {message}; authed {message, owner_context}; authed {message, customer_context}',
    note: 'probed with an empty body so validation rejects before the LLM runs - no paid model call is made',
    expect: [['reply'], ['spaces']] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Evidence files get shared with the backend team, so strip account PII from
// anything captured. Bearer tokens are never written to the results file.
function redact(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\b\d{9,15}\b/g, '[number]');
}

async function probe(path, { method = 'GET', token, timeoutMs = PROBE_TIMEOUT_MS, body, form }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = new FormData();
    payload.append('__audit', 'probe');
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload, signal: controller.signal });
    const text = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('json');
    let json = null;
    if (isJson && text) { try { json = JSON.parse(text); } catch { /* non-JSON body */ } }
    return {
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      allow: res.headers.get('allow'),
      contentType: res.headers.get('content-type') || '',
      json,
      snippet: redact(text.replace(/\s+/g, ' ').slice(0, 300)),
    };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return {
      status: 0,
      ok: false,
      ms: Date.now() - started,
      error: aborted ? 'timeout' : String(err.message || err),
      snippet: '',
    };
  } finally {
    clearTimeout(timer);
  }
}

function classify(p) {
  if (!p || p.status === 0) return { verdict: 'UNREACHABLE', detail: p?.error || 'no response' };
  const s = p.status;
  if (s === 404) return { verdict: 'MISSING', detail: 'no route registered' };
  if (s === 401) return { verdict: 'EXISTS', detail: 'auth middleware rejected (route present)' };
  if (s === 403) return { verdict: 'EXISTS', detail: 'route present, authorization denied' };
  if (s === 405) return { verdict: 'WRONG-METHOD', detail: `route present, allowed: ${p.allow || 'unknown'}` };
  if (s === 422) return { verdict: 'EXISTS', detail: 'route present, validation rejected probe body' };
  if (s >= 500) return { verdict: 'BROKEN', detail: `server error ${s}` };
  if (s >= 400) return { verdict: 'EXISTS', detail: `client error ${s} (route present, reached handler)` };
  return { verdict: 'EXISTS', detail: `${s} (route present and reachable)` };
}

function collectKeys(value, out = new Set(), depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return out;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 5)) collectKeys(item, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    out.add(k);
    collectKeys(v, out, depth + 1);
  }
  return out;
}

// An account with no rows yet returns {"spaces":[]} - every expected item field is
// then "absent" purely because there is nothing to inspect. Reporting that as a
// shape mismatch would be a false positive, so empty collections are reported as
// EMPTY (unverifiable) and only a non-empty collection can prove a field is absent.
function surveyArrays(value, out = [], path = '', depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return out;
  if (Array.isArray(value)) {
    out.push({ path: path || '(root)', length: value.length });
    for (const item of value.slice(0, 3)) surveyArrays(item, out, `${path}[]`, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(value)) surveyArrays(v, out, path ? `${path}.${k}` : k, depth + 1);
  return out;
}

function checkShape(json, expect) {
  if (!expect) return null;
  const arrays = surveyArrays(json);
  const nonEmpty = arrays.filter((a) => a.length > 0);
  const keys = collectKeys(json);
  const missing = expect.filter((alts) => !alts.some((k) => keys.has(k)));
  const wrapperOnly = missing.every((alts) => !keys.has(alts[0]) && !alts.some((k) => keys.has(k)));
  return {
    checked: expect.length,
    missing,
    found: expect.length - missing.length,
    arrays,
    mode: nonEmpty.length === 0 && arrays.length > 0 ? 'EMPTY' : 'CHECKED',
    wrapperPresent: wrapperOnly,
  };
}

function materialize(path, ids) {
  return path
    .replace(/\{requestId\}/g, ids.request ?? 1)
    .replace(/\{offerId\}/g, ids.offer ?? 1)
    .replace(/\{spaceId\}/g, ids.space ?? 1)
    .replace(/\{bookingId\}/g, ids.booking ?? 1)
    .replace(/\{adId\}/g, ids.ad ?? 1)
    .replace(/\{id\}/g, ids.request ?? 1);
}

async function login(label, email, password) {
  if (!email || !password) return { ok: false, reason: 'credentials not supplied' };
  const attempts = [];
  for (const [keyName, body] of [['login', { login: email, password }], ['email', { email, password }]]) {
    let p;
    for (let tryNo = 0; tryNo < 4; tryNo += 1) {
      p = await probe('/api/login', { method: 'POST', body, timeoutMs: 45_000 });
      if (p.status !== 429) break;
      const backoff = 15_000 * (tryNo + 1);
      console.log(`  ${label}: throttled (429), backing off ${backoff / 1000}s`);
      await sleep(backoff);
    }
    attempts.push({ field: keyName, status: p.status, snippet: p.snippet });
    const token = p.json?.token;
    if (p.ok && token) return { ok: true, token, viaField: keyName, profile: p.json, attempts };
  }
  return { ok: false, reason: 'no token returned for any field name', attempts };
}

async function harvestIds(token) {
  const ids = {};
  const grab = (json, ...keys) => {
    const stack = [json];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object') continue;
      if (Array.isArray(cur)) { stack.push(...cur.slice(0, 5)); continue; }
      for (const k of keys) {
        if (ids[k] == null && (typeof cur[k] === 'number' || typeof cur[k] === 'string') && /\d/.test(String(cur[k]))) {
          ids[k] = cur[k];
        }
      }
      stack.push(...Object.values(cur).slice(0, 20));
    }
  };
  const [spaces, offers, bookings, requests, ads] = await Promise.all([
    probe('/api/owner/spaces', { token }),
    probe('/api/owner/offers', { token }),
    probe('/api/owner/bookings', { token }),
    probe('/api/special-requests', { token: ids.customerToken || token }),
    probe('/api/owner/ads', { token }),
  ]);
  grab(spaces.json, 'space_id', 'id');
  grab(offers.json, 'booking_id', 'offer_id', 'request_id', 'id');
  grab(bookings.json, 'booking_id', 'id');
  grab(requests.json, 'request_id', 'id');
  grab(ads.json, 'ad_id', 'id');
  return ids;
}

async function main() {
  console.log(`node ${process.version}`);
  console.log(`target: ${BASE_URL}`);

  console.log('\n[warmup] forcing Render cold start...');
  const warm = await probe('/api/login', { method: 'OPTIONS', timeoutMs: WARMUP_TIMEOUT_MS });
  console.log(`  -> ${warm.status} in ${warm.ms}ms${warm.error ? ` (${warm.error})` : ''}`);

  const results = { meta: { baseUrl: BASE_URL, node: process.version, startedAt: new Date().toISOString(), warmup: warm }, endpoints: [] };

  // --- Sweep A: existence classification ---------------------------------
  const SKIP_A = process.env.AUDIT_SKIP_A === '1';
  const outUrl = new URL('../api-audit-results.json', import.meta.url);

  if (SKIP_A) {
    if (!existsSync(outUrl)) throw new Error('AUDIT_SKIP_A=1 but no previous results file to resume from');
    const prior = JSON.parse(readFileSync(outUrl, 'utf8'));
    results.endpoints = prior.endpoints || [];
    // Superseded by results.reads; drop any stale pre-redaction copies.
    for (const e of results.endpoints) delete e.authed;
    results.options = prior.options || {};
    console.log('\n[A] skipped - resumed existing results from disk');
  } else {
    // A1: OPTIONS per unique path - reads Allow header, runs no controller.
    console.log('\n[A1] OPTIONS per unique path (reads Allow header, runs no controller)');
    const uniquePaths = [...new Set(ENDPOINTS.map((e) => e.path))];
    const optionsByPath = {};
    for (const p of uniquePaths) {
      const r = await probe(p, { method: 'OPTIONS' });
      optionsByPath[p] = { status: r.status, allow: r.allow || '', error: r.error || '' };
      const verdict = r.status === 0 ? 'UNREACHABLE' : (r.allow ? 'EXISTS' : r.status === 404 ? 'MISSING' : `?${r.status}`);
      console.log(`  ${verdict.padEnd(12)} ${r.status} allow=${(r.allow || '-').padEnd(22)} ${p}`);
      await sleep(GAP_MS);
    }
    results.options = optionsByPath;

    // A2: unauthenticated per method - auth middleware blocks before handler.
    console.log('\n[A2] Unauthenticated request per method (auth middleware blocks before handler)');
    for (const ep of ENDPOINTS) {
      const path = materialize(ep.path, {});
      const body = ep.form ? undefined : (ep.method === 'GET' ? undefined : {});
      const r = await probe(path, { method: ep.method, body, form: ep.form && ep.method !== 'GET' });
      const c = classify(r);
      results.endpoints.push({ ...ep, resolvedPath: path, unauth: { ...c, status: r.status, ms: r.ms, allow: r.allow || '', snippet: r.snippet } });
      console.log(`  ${c.verdict.padEnd(12)} ${String(r.status).padEnd(4)} ${ep.method.padEnd(6)} ${path}  - ${c.detail}`);
      await sleep(GAP_MS);
    }
  }

  // --- Sweep B: authenticated, GET only ----------------------------------
  console.log('\n[B] Authenticating (GET-only sweep, no writes with a valid token)');
  const owner = await login('owner', OWNER_EMAIL, OWNER_PASSWORD);
  const customer = await login('customer', CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  console.log(`  owner:    ${owner.ok ? `OK via '${owner.viaField}' field` : `FAILED - ${owner.reason}`}`);
  console.log(`  customer: ${customer.ok ? `OK via '${customer.viaField}' field` : `FAILED - ${customer.reason}`}`);
  results.auth = {
    owner: owner.ok ? { ok: true, viaField: owner.viaField, role: owner.profile?.user?.role ?? owner.profile?.role ?? null } : { ok: false, reason: owner.reason, response: owner.response?.snippet ?? null },
    customer: customer.ok ? { ok: true, viaField: customer.viaField, role: customer.profile?.user?.role ?? customer.profile?.role ?? null } : { ok: false, reason: customer.reason, response: customer.response?.snippet ?? null },
  };

  if (owner.ok || customer.ok) {
    const ids = { ...(await harvestIds(owner.token)) };
    results.ids = ids;
    console.log(`  harvested ids: ${JSON.stringify(ids)}`);

    const authedPlans = [
      { path: '/api/profile', token: owner.token, role: 'owner' },
      { path: '/api/profile', token: customer.token, role: 'customer' },
      { path: '/api/owner/spaces', token: owner.token, role: 'owner' },
      { path: '/api/owner/offers', token: owner.token, role: 'owner' },
      { path: '/api/owner/bookings', token: owner.token, role: 'owner' },
      { path: '/api/owner/reviews', token: owner.token, role: 'owner' },
      { path: '/api/owner/documents', token: owner.token, role: 'owner' },
      { path: '/api/owner/ads', token: owner.token, role: 'owner' },
      { path: '/api/special-requests/open', token: owner.token, role: 'owner' },
      { path: '/api/special-requests', token: customer.token, role: 'customer' },
      { path: '/api/dashboard/stats', token: customer.token, role: 'customer' },
      { path: '/api/dashboard/upcoming-booking', token: customer.token, role: 'customer' },
      { path: '/api/dashboard/bookings', token: customer.token, role: 'customer' },
      { path: '/api/dashboard/favorites', token: customer.token, role: 'customer' },
      { path: '/api/notifications', token: customer.token, role: 'customer' },
      { path: '/api/notifications', token: owner.token, role: 'owner' },
    ];
    if (ids.request) authedPlans.push({ path: `/api/special-requests/${ids.request}`, token: customer.token, role: 'customer' });
    // Route-ordering probe: a literal segment captured by a {id} param shows up as
    // a model-not-found for that literal. Numeric proves the param route works.
    authedPlans.push({ path: '/api/special-requests/1', token: customer.token, role: 'customer', probe: 'route-order' });

    const reads = [];
    for (const plan of authedPlans) {
      const ep = ENDPOINTS.find((e) => e.method === 'GET' && materialize(e.path, ids) === plan.path && (e.role === plan.role || e.role === 'both'));
      const r = await probe(plan.path, { token: plan.token });
      const c = classify(r);
      const shape = checkShape(r.json, ep?.expect);
      reads.push({ path: plan.path, role: plan.role, probe: plan.probe || null, ...c, status: r.status, ms: r.ms, shape, snippet: r.snippet });

      let note;
      if (shape?.mode === 'EMPTY') {
        note = `EMPTY ${shape.arrays.map((a) => `${a.path}[${a.length}]`).join(' ')} - field names unverifiable`;
      } else if (shape?.missing?.length) {
        note = `MISSING: ${shape.missing.map((a) => a.join('|')).join(', ')}`;
      } else if (shape) {
        note = `all ${shape.checked} expected keys present`;
      } else {
        note = '';
      }
      console.log(`  ${c.verdict.padEnd(12)} ${String(r.status).padEnd(4)} ${plan.path} [${plan.role}] ${note}`);
      await sleep(GAP_MS);
    }
    results.reads = reads;
  }

  // --- Summary -----------------------------------------------------------
  const tally = {};
  for (const e of results.endpoints) {
    const v = e.unauth.verdict;
    tally[v] = (tally[v] || 0) + 1;
  }
  results.summary = tally;

  const outPathFinal = outUrl.pathname;
  writeFileSync(outUrl, JSON.stringify(results, null, 2));
  console.log(`\n[summary] ${JSON.stringify(tally)}`);
  console.log(`[written] ${outPathFinal}`);
}

main().catch((err) => { console.error('fatal:', err); process.exit(1); });
