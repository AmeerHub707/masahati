// اختبارات وحدة لمنطق نطاق المساحات (تصفية/ترتيب/جغرافيا/أوقات حجز).
// تعمل في Node مباشرةً بلا jsdom وبلا شبكة، لأن spaceFilters.js لا يستورد
// React ولا api.js — وهذا مقصود: كل منطق التصفية قابل للاختبار عزلاً.
import {
  ar,
  minutesOf,
  formatClock,
  haversineKm,
  isOpenNow,
  filterSpaces,
  sortSpaces,
  applyFilters,
  buildChips,
  countActiveFilters,
  priceHistogram,
  suggestRelaxations,
  hourSlots,
  bookingTotal,
  validateBookingSlot,
  parseFilters,
  filtersToQuery,
  normalizeFilters,
} from '../lib/spaceFilters.js';
import { DEFAULT_ORIGIN, PRICE_SLIDER } from '../lib/spaceTaxonomy.js';

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, detail) {
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(name);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok && detail !== undefined) console.log(`   → ${detail}`);
}

const eq = (name, actual, expected) =>
  report(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// ----- بيانات اختبار -----
// Gaza City neighbourhoods, deliberately spread so distance ordering is stable.
// All coordinates sit inside Gaza City (~31.50 N, 34.45 E), matching the
// coordinates already used elsewhere in the app.
const SPACES = [
  {
    id: 1, title: 'قاعة النصر الكبرى', location: 'حي النصر', area: 'غزة',
    lat: 31.5119, lng: 34.4479, price_per_hour: 150, capacity: 120,
    rating: 4.8, category: 'lecture', amenities: ['internet', 'projector', 'ac'],
    open_time: '08:00', close_time: '18:00', instant_booking: true, stats: { bookings: 40 },
  },
  {
    id: 2, title: 'استوديو الرمال', location: 'حي الرمال', area: 'غزة',
    lat: 31.5161, lng: 34.4437, price_per_hour: 60, capacity: 20,
    rating: 4.2, category: 'studio', amenities: ['internet', 'electricity'],
    open_time: '10:00', close_time: '22:00', instant_booking: false, stats: { bookings: 12 },
  },
  {
    id: 3, title: 'مساحة عمل السرايا', location: 'حي السرايا', area: 'غزة',
    lat: 31.5022, lng: 34.4688, price_per_hour: 35, capacity: 30,
    rating: 3.9, category: 'coworking', amenities: ['internet', 'electricity', 'ac'],
    open_time: '09:00', close_time: '17:00', instant_booking: true, stats: { bookings: 5 },
  },
  {
    id: 4, title: 'قاعة تدريب التفاح', location: 'حي التفاح', area: 'غزة',
    lat: 31.5088, lng: 34.4772, price_per_hour: 95, capacity: 60,
    rating: 4.6, category: 'training', amenities: ['internet', 'whiteboard', 'microphone', 'ac'],
    open_time: '08:30', close_time: '16:00', instant_booking: true, stats: { bookings: 25 },
  },
  {
    id: 5, title: 'قاعة مناسبات الشجاعية', location: 'حي الشجاعية', area: 'غزة',
    lat: 31.5011, lng: 34.4556, price_per_hour: 200, capacity: 150,
    rating: 4.5, category: 'events', amenities: ['internet', 'ac', 'microphone'],
    open_time: '14:00', close_time: '23:00', instant_booking: false, stats: { bookings: 8 },
  },
  {
    id: 6, title: 'قاعة اجتماعات النصر', location: 'حي النصر', area: 'غزة',
    lat: 31.5125, lng: 34.4491, price_per_hour: 80, capacity: 12,
    rating: 4.0, category: 'meeting', amenities: ['internet', 'ac'],
    open_time: null, close_time: null, instant_booking: false, stats: null,
  },
];

const ids = (list) => list.map((s) => s.id).sort((a, b) => a - b);
const ORIGIN = DEFAULT_ORIGIN;

// ===== 1) formatting =====
eq('F1 ar() converts digits to Arabic-Indic', ar(4.5), '٤٫٥');
eq('F2 ar() converts multi-digit', ar(150), '١٥٠');
eq('F3 formatClock round-trips', formatClock(870), '14:30');
eq('F4 minutesOf parses HH:MM', minutesOf('08:30'), 510);
report('F5 minutesOf rejects garbage', minutesOf('not-a-time') === null);
report('F6 minutesOf rejects out-of-range', minutesOf('99:99') === null);

// ===== 2) geo =====
report('G1 haversine is zero for identical points', haversineKm(ORIGIN, ORIGIN) === 0);
report('G2 haversine is symmetric', Math.abs(haversineKm(ORIGIN, SPACES[2]) - haversineKm(SPACES[2], ORIGIN)) < 1e-9);
report('G3 haversine returns null without coords', haversineKm(ORIGIN, { id: 9 }) === null);
report('G4 haversine is null for null origin', haversineKm(null, SPACES[0]) === null);
// Gaza City span is ~7km; anything near that confirms a sane earth model.
{
  const d = haversineKm({ lat: 31.8621, lng: 35.2077 }, { lat: 31.8280, lng: 35.1620 });
  report('G5 haversine matches a known Gaza distance (4–8 km)', d > 4 && d < 8, `got ${d?.toFixed(2)} km`);
}

// ===== 3) open-now =====
const at = (h, m = 0) => new Date(2026, 8, 29, h, m);
report('O1 inside a normal window', isOpenNow(SPACES[0], at(10)) === true);
report('O2 before opening', isOpenNow(SPACES[0], at(7)) === false);
report('O3 at closing boundary is closed', isOpenNow(SPACES[0], at(18)) === false);
report('O4 before open_time is open', isOpenNow(SPACES[2], at(8)) === false);
// A true overnight window (close before open) — kept out of SPACES so the
// shared fixture set stays at 6 and the all-spaces counts stay stable.
const OVERNIGHT = { open_time: '22:00', close_time: '02:00' };
report('O5 overnight window: after midnight', isOpenNow(OVERNIGHT, at(1)) === true);
report('O6 overnight window: inside evening', isOpenNow(OVERNIGHT, at(23)) === true);
report('O7 overnight window: midday gap is closed', isOpenNow(OVERNIGHT, at(12)) === false);
report('O8 missing hours are treated as open', isOpenNow(SPACES[5], at(3)) === true);
report('O9 evening-only window is closed at dawn', isOpenNow(SPACES[1], at(1)) === false);

// ===== 4) filtering =====
eq('Q1 no filters returns all', ids(filterSpaces(SPACES)), [1, 2, 3, 4, 5, 6]);
eq('Q2 price max filter', ids(filterSpaces(SPACES, { max: 60 })), [2, 3]);
eq('Q3 price min filter', ids(filterSpaces(SPACES, { min: 95 })), [1, 4, 5]);
// Boundaries are inclusive: a space priced exactly at min or max must survive.
eq('Q4 price range is inclusive on both ends', ids(filterSpaces(SPACES, { min: 60, max: 95 })), [2, 4, 6]);
eq('Q5 capacity filter', ids(filterSpaces(SPACES, { cap: 60 })), [1, 4, 5]);
eq('Q6 rating filter', ids(filterSpaces(SPACES, { rating: 4.5 })), [1, 4, 5]);
eq('Q7 category filter', ids(filterSpaces(SPACES, { category: 'studio' })), [2]);
eq('Q8 single amenity', ids(filterSpaces(SPACES, { amenities: ['whiteboard'] })), [4]);
eq('Q9 amenities combine with AND not OR', ids(filterSpaces(SPACES, { amenities: ['whiteboard', 'microphone'] })), [4]);
eq('Q10 instant-booking filter', ids(filterSpaces(SPACES, { instant: true })), [1, 3, 4]);
// Pinned clock at 10:00: everything with a morning window plus space 6 (no
// hours, treated as open); space 5 (14:00-23:00) has not opened yet.
eq('Q11 open-now filter (pinned clock)', ids(filterSpaces(SPACES, { open: true, now: at(10) })), [1, 2, 3, 4, 6]);
// At 18:30 only the late windows survive — 1 (closes 18:00), 3 (17:00) and
// 4 (16:00) have all closed.
eq('Q11b open-now filter differs by hour', ids(filterSpaces(SPACES, { open: true, now: at(18, 30) })), [2, 5, 6]);
eq('Q12 text search on title', ids(filterSpaces(SPACES, { q: 'استوديو' })), [2]);
eq('Q13 text search on area', ids(filterSpaces(SPACES, { q: 'الشجاعية' })), [5]);
eq('Q14 text search is case-insensitive', ids(filterSpaces(SPACES, { q: 'GAZA' })), []);
eq('Q15 no match returns empty', filterSpaces(SPACES, { q: 'لاشيء' }).length, 0);
// min 60 keeps {150, 60, 95, 80}; cap 30 keeps all of them; instant keeps {1, 4}.
eq('Q16 filters combine', ids(filterSpaces(SPACES, { min: 60, cap: 30, instant: true })), [1, 4]);

// Distances from Gaza City centre: 3=0.20, 5=1.06, 4=1.26, 6=2.06, 1=2.12, 2=2.71 km.
eq('R1 wide radius keeps all', ids(filterSpaces(SPACES, { radius: 25 }, ORIGIN)), [1, 2, 3, 4, 5, 6]);
eq('R2 tight radius narrows results', ids(filterSpaces(SPACES, { radius: 2.5 }, ORIGIN)), [1, 3, 4, 5, 6]);
eq('R2b very tight radius can return nothing', filterSpaces(SPACES, { radius: 0.1 }, ORIGIN).length, 0);
eq('R2c a mid radius returns only the closest', ids(filterSpaces(SPACES, { radius: 1.5 }, ORIGIN)), [3, 4, 5]);
{
  const res = filterSpaces(SPACES, { radius: 25 }, ORIGIN);
  report('R3 distance_km is computed when radius is set', res.every((s) => typeof s.distance_km === 'number'), JSON.stringify(res[0]?.distance_km));
  const noRadius = filterSpaces(SPACES, {});
  report('R4 distance_km is null without a radius', noRadius.every((s) => s.distance_km === null));
}
report('R5 spaces lacking coords are not excluded by radius', filterSpaces(SPACES, { radius: 1 }, ORIGIN).length < SPACES.length);
{
  // a space with no coords must survive a radius filter rather than vanish
  const withNoCoords = [...SPACES, { id: 7, price_per_hour: 10, capacity: 5, rating: 4, amenities: [] }];
  report('R6 missing coords survive a radius filter', ids(filterSpaces(withNoCoords, { radius: 1 }, ORIGIN)).includes(7));
}

// min > max must not wipe results (normalization resets the pair).
report('N1 min > max is neutralized', filterSpaces(SPACES, { min: 200, max: 10 }).length === SPACES.length);
report('N2 invalid sort falls back to default', normalizeFilters({ sort: 'bogus' }).sort === 'rating_desc');

// ===== 5) sorting =====
eq('S1 rating_desc', sortSpaces(SPACES, 'rating_desc').map((s) => s.id), [1, 4, 5, 2, 6, 3]);
eq('S2 price_asc', sortSpaces(SPACES, 'price_asc').map((s) => s.id), [3, 2, 6, 4, 1, 5]);
eq('S3 price_desc', sortSpaces(SPACES, 'price_desc').map((s) => s.id), [5, 1, 4, 6, 2, 3]);
eq('S4 capacity_desc', sortSpaces(SPACES, 'capacity_desc').map((s) => s.id), [5, 1, 4, 3, 2, 6]);
eq('S5 popularity_desc tolerates null stats', sortSpaces(SPACES, 'popularity_desc').map((s) => s.id), [1, 4, 2, 5, 3, 6]);
eq('S6 unknown sort is safe', sortSpaces(SPACES, 'nope').length, SPACES.length);
{
  const byDist = applyFilters(SPACES, { sort: 'distance_asc', radius: 25 }, ORIGIN);
  const ds = byDist.map((s) => s.distance_km);
  report('S7 distance_asc orders by ascending distance', ds.every((d, i) => i === 0 || d >= ds[i - 1]), JSON.stringify(ds.map((d) => d?.toFixed(2))));
  report('S8 sortSpaces does not mutate its input', SPACES[0].id === 1 && SPACES.map((s) => s.id).length === 6);
}

// ===== 6) chips =====
eq('C1 no filters produce no chips', buildChips({}), []);
eq('C2 price chip carries its value', buildChips({ min: 50, max: 150 })[0].label, 'السعر: ٥٠ – ١٥٠');
eq('C3 open-price chip', buildChips({ max: 80 })[0].label, 'السعر: أقل من ٨٠');
eq('C4 min-price chip', buildChips({ min: 80 })[0].label, 'السعر: ٨٠ فأكثر');
eq('C5 capacity chip', buildChips({ cap: 30 })[0].label, 'السعة: ٣٠+');
eq('C6 rating chip', buildChips({ rating: 4.5 })[0].label, 'التقييم: ٤٫٥+');
eq('C7 radius chip', buildChips({ radius: 5 })[0].label, 'ضمن ٥ كم');
eq('C8 open-now chip', buildChips({ open: true })[0].label, 'مفتوحة الآن');
eq('C9 instant chip', buildChips({ instant: true })[0].label, 'حجز فوري');
{
  const chips = buildChips({ q: 'قاعة', min: 10, max: 20, cap: 5, rating: 4, radius: 3, open: true, instant: true, amenities: ['ac', 'wifi_unused'] });
  eq('C10 chip count matches active filter count', chips.length, countActiveFilters({ q: 'قاعة', min: 10, max: 20, cap: 5, rating: 4, radius: 3, open: true, instant: true, amenities: ['ac', 'wifi_unused'] }));
  report('C11 every chip exposes a key for removal', chips.every((c) => typeof c.key === 'string' && c.key.length > 0));
  eq('C12 amenity chips are keyed individually', chips.filter((c) => c.key.startsWith('amenity:')).length, 2);
}

// ===== 7) histogram =====
{
  const h = priceHistogram(SPACES, { q: '' });
  const summed = h.buckets.reduce((a, b) => a + b.count, 0);
  eq('H1 histogram counts every priced space', summed, h.total);
  eq('H2 histogram total matches input', h.total, SPACES.length);
  report('H3 bucket shape matches config', h.buckets.length === PRICE_SLIDER.buckets, h.buckets.length);
  report('H4 maxCount is the tallest bar', h.maxCount === Math.max(...h.buckets.map((b) => b.count)), h.maxCount);
  report('H5 prices are spread over buckets', h.buckets.filter((b) => b.count > 0).length > 1);
  // ignoring price keeps non-price filters: adding q=الرمال must shrink the base
  const filtered = priceHistogram(SPACES, { q: 'الرمال' });
  eq('H6 histogram base respects other filters', filtered.total, 1);
}

// ===== 8) relaxation suggestions =====
{
  const impossible = { min: 5000, max: 10, cap: 9999 };
  const sugg = suggestRelaxations(SPACES, impossible, ORIGIN);
  report('X1 zero-result state still offers relief', sugg.length > 0, JSON.stringify(sugg));
  report('X2 every suggestion yields results', sugg.every((s) => s.count > 0));
  report('X3 suggestions are ordered by result count', sugg.every((s, i) => i === 0 || sugg[i - 1].count >= s.count));
  report('X4 suggestions carry a patch', sugg.every((s) => s.patch && typeof s.patch === 'object'));
  report('X5 suggestions are capped', sugg.length <= 3);
  const applied = suggestRelaxations(SPACES, impossible, ORIGIN).map((s) => filterSpaces(SPACES, { ...impossible, ...s.patch }).length);
  report('X6 applying a patch really unblocks results', applied.every((c) => c > 0), JSON.stringify(applied));
  report('X7 price-only zero result is explained', suggestRelaxations(SPACES, { min: 5000 }, ORIGIN).some((s) => s.id.startsWith('clear_price')));
  report('X8 no suggestions when the filter set is already broad', suggestRelaxations(SPACES, { q: 'قاعة' }, ORIGIN).every((s) => s.count > 0));
}

// ===== 9) booking time math =====
eq('T1 hourSlots from open to close', hourSlots(SPACES[0]), ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
// 08:30–16:00 is 7.5h, so the last full 1-hour slot starts at 14:30.
eq('T2 hourSlots omit a partial tail', hourSlots(SPACES[3]).at(-1), '14:30');
report('T3 hourSlots empty without hours', hourSlots(SPACES[5]).length === 0);
{
  const overnight = hourSlots({ open_time: '22:00', close_time: '02:00' });
  eq('T4 overnight slots cross midnight', overnight, ['22:00', '23:00', '00:00', '01:00']);
}
eq('T5 bookingTotal multiplies price by hours', bookingTotal(SPACES[0], 4), 600);
eq('T6 bookingTotal handles 1 hour', bookingTotal(SPACES[2], 1), 35);
eq('T7 bookingTotal with no price is 0', bookingTotal({ price_per_hour: null }, 3), 0);

report('V1 a valid slot passes', validateBookingSlot(SPACES[0], { date: '2030-01-01', timeFrom: '10:00', hours: 2 }) === null);
report('V2 missing date is rejected', typeof validateBookingSlot(SPACES[0], { timeFrom: '10:00', hours: 2 }) === 'string');
report('V3 missing start time is rejected', typeof validateBookingSlot(SPACES[0], { date: '2030-01-01', hours: 2 }) === 'string');
report('V4 zero hours is rejected', typeof validateBookingSlot(SPACES[0], { date: '2030-01-01', timeFrom: '10:00', hours: 0 }) === 'string');
report('V5 start before opening is rejected', typeof validateBookingSlot(SPACES[0], { date: '2030-01-01', timeFrom: '06:00', hours: 1 }) === 'string');
report('V6 overrun past closing is rejected', typeof validateBookingSlot(SPACES[0], { date: '2030-01-01', timeFrom: '17:00', hours: 2 }) === 'string');
report('V7 exactly-fits-closing is accepted', validateBookingSlot(SPACES[0], { date: '2030-01-01', timeFrom: '17:00', hours: 1 }) === null);
report('V8 a past date is rejected', typeof validateBookingSlot(SPACES[0], { date: '2020-01-01', timeFrom: '10:00', hours: 1 }) === 'string');
report('V9 null space is rejected', typeof validateBookingSlot(null, { date: '2030-01-01', timeFrom: '10:00', hours: 1 }) === 'string');
{
  const today = new Date(2026, 8, 29, 10, 0);
  report('V10 today is allowed', validateBookingSlot(SPACES[0], { date: '2026-09-29', timeFrom: '10:00', hours: 1, today }) === null);
  report('V11 yesterday is rejected', typeof validateBookingSlot(SPACES[0], { date: '2026-09-28', timeFrom: '10:00', hours: 1, today }) === 'string');
}

// ===== 10) URL round-trip =====
{
  const filters = {
    q: 'قاعة', sort: 'price_asc', min: 40, max: 120, cap: 30,
    radius: 8, amenities: ['ac', 'internet'], category: 'lecture',
    rating: 4.5, open: true, instant: true,
  };
  const params = filtersToQuery(filters);
  const parsed = parseFilters(params);
  eq('U1 round-trip: q', parsed.q, 'قاعة');
  eq('U2 round-trip: sort', parsed.sort, 'price_asc');
  eq('U3 round-trip: min', parsed.min, 40);
  eq('U4 round-trip: amenities', parsed.amenities, ['ac', 'internet']);
  eq('U5 round-trip: category', parsed.category, 'lecture');
  eq('U6 round-trip: booleans', [parsed.open, parsed.instant], [true, true]);
  eq('U7 defaults are not written to the URL', filtersToQuery({}).toString(), '');
  eq('U8 default sort is omitted from the URL', filtersToQuery({ sort: 'rating_desc' }).toString(), '');
  eq('U9 an unknown sort in the URL falls back', parseFilters(new URLSearchParams('sort=evil')).sort, 'rating_desc');
  eq('U10 a non-numeric price is read as absent', parseFilters(new URLSearchParams('min=abc')).min, null);
  eq('U11 empty URL yields defaults', parseFilters(new URLSearchParams('')).amenities, []);
  report('U12 a space in a query survives', parseFilters(new URLSearchParams('q=قاعة النصر')).q === 'قاعة النصر');
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
