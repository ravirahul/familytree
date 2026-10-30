// Node check for public_html/assets/panchang.js. Run: node tools/test-panchang.mjs
// Same reference cases as tools/test-panchang.php (Drik Panchang, New Delhi), plus
// a parity check against the PHP version for random dates when php is on PATH.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const P = createRequire(import.meta.url)(path.join(here, '../public_html/assets/panchang.js'));

const SUNRISE = [
  ['2024-04-08', 'Chaitra Krishna Amavasya'], ['2024-07-05', 'Ashadh Krishna Amavasya'],
  ['2024-11-01', 'Kartik Krishna Amavasya'], ['2024-12-30', 'Paush Krishna Amavasya'],
  ['2025-01-29', 'Magh Krishna Amavasya'], ['2025-08-09', 'Shravan Shukla Purnima'],
  ['2025-08-16', 'Bhadrapad Krishna Ashtami'], ['2025-08-27', 'Bhadrapad Shukla Chaturthi'],
  ['2025-09-21', 'Ashwin Krishna Amavasya'], ['2025-10-21', 'Kartik Krishna Amavasya'],
  ['2025-12-19', 'Paush Krishna Amavasya'], ['2026-01-18', 'Magh Krishna Amavasya'],
  ['2026-03-03', 'Phalgun Shukla Purnima'], ['2026-03-19', 'Chaitra Krishna Amavasya'],
  ['2026-03-27', 'Chaitra Shukla Navami'], ['2026-04-02', 'Chaitra Shukla Purnima'],
  ['2026-05-16', 'Jyeshtha Krishna Amavasya'], ['2026-05-17', 'Adhik Jyeshtha Shukla Pratipada'],
  ['2026-05-31', 'Adhik Jyeshtha Shukla Purnima'], ['2026-06-15', 'Adhik Jyeshtha Krishna Amavasya'],
  ['2026-06-16', 'Jyeshtha Shukla Dwitiya'], ['2026-06-29', 'Jyeshtha Shukla Purnima'],
  ['2026-08-28', 'Shravan Shukla Purnima'], ['2026-11-09', 'Kartik Krishna Amavasya'],
  ['2026-12-08', 'Margashirsha Krishna Amavasya'], ['2027-03-08', 'Phalgun Krishna Amavasya'],
  ['2027-04-06', 'Chaitra Krishna Amavasya'], ['2027-06-04', 'Jyeshtha Krishna Amavasya'],
  ['2027-10-29', 'Kartik Krishna Amavasya'],
  // Known 06:00-vs-real-sunrise boundary cases (Drik shows the next tithi):
  ['2025-02-28', 'Phalgun Krishna Amavasya'], ['2026-12-09', 'Margashirsha Krishna Amavasya'],
];
const NEXT = [
  [[8, 'K', 15, '2024-06-01'], '2024-11-01'], [[8, 'K', 15, '2025-01-01'], '2025-10-21'],
  [[5, 'S', 15, '2025-01-01'], '2025-08-09'], [[6, 'K', 8, '2025-01-01'], '2025-08-16'],
  [[6, 'S', 4, '2025-01-01'], '2025-08-27'], [[7, 'K', 15, '2025-01-01'], '2025-09-21'],
  [[1, 'S', 9, '2026-01-01'], '2026-03-27'], [[3, 'S', 15, '2026-05-01'], '2026-06-29'],
  [[3, 'S', 15, '2026-05-01', { adhik: true }], '2026-05-31'], [[3, 'K', 15, '2026-05-20'], '2027-06-04'],
  [[3, 'K', 15, '2026-05-20', { adhik: true }], '2026-06-15'],
  [[7, 'K', 15, '2026-01-01', { system: 'amanta' }], '2026-11-09'], [[8, 'K', 15, '2026-01-01'], '2026-11-09'],
  [[8, 'K', 15, '2027-01-01'], '2027-10-29'], [[12, 'S', 15, '2026-01-01'], '2026-03-03'],
];
const FROM = [
  [[2082, 8, 'K', 15], '2025-10-21'], [[2083, 1, 'S', 9], '2026-03-27'], [[2082, 12, 'K', 15], '2026-02-17'],
  [[2082, 1, 'K', 15], '2026-03-19'], [[2081, 8, 'K', 15], '2024-11-01'],
];

let pass = 0;
const fail = [];
const check = (ok, what) => (ok ? pass++ : fail.push(what));

for (const [d, want] of SUNRISE) { const got = P.tithiOf(d).label; check(got === want, `tithiOf(${d}) = ${got}, want ${want}`); }
for (const [a, want] of NEXT) { const got = P.nextTithiDate(...a); check(got === want, `nextTithiDate(${JSON.stringify(a)}) = ${got}, want ${want}`); }
for (const [a, want] of FROM) { const got = P.dateFromTithi(...a); check(got === want, `dateFromTithi(${JSON.stringify(a)}) = ${got}, want ${want}`); }
check(P.vsYear('2026-03-19') === 2082 && P.vsYear('2026-03-20') === 2083, 'VS changes 20 Mar 2026');
check(P.tithiOf('2025-10-21', { system: 'amanta' }).label === 'Ashwin Krishna Amavasya', 'amanta Diwali');
check(typeof globalThis.FTPanchang === 'object', 'attached to global FTPanchang');

// Parity with PHP on random dates (both systems) plus a few nextTithiDate calls.
let php = true;
try { execFileSync('php', ['-v'], { stdio: 'ignore' }); } catch { php = false; }
if (php) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const dates = [];
  for (let i = 0; i < 300; i++) dates.push(new Date(Date.UTC(1900, 0, 1) + Math.floor(rnd() * 200 * 365.25) * 864e5).toISOString().slice(0, 10));
  const nexts = dates.slice(0, 20).map((d, i) => [1 + (i % 12), i % 2 ? 'K' : 'S', 1 + (i % 15), d]);
  const code = `require ${JSON.stringify(path.join(here, '../public_html/includes/panchang.php'))};
    $in = json_decode(stream_get_contents(STDIN), true); $out = [];
    foreach ($in['dates'] as $d) $out[] = [Panchang::tithiOf($d), Panchang::tithiOf($d, ['system' => 'amanta'])];
    foreach ($in['nexts'] as $a) $out[] = Panchang::nextTithiDate(...$a);
    echo json_encode($out);`;
  const res = JSON.parse(execFileSync('php', ['-r', code], { input: JSON.stringify({ dates, nexts }) }).toString());
  let same = 0;
  dates.forEach((d, i) => {
    const js = [P.tithiOf(d), P.tithiOf(d, { system: 'amanta' })];
    const ok = JSON.stringify(js) === JSON.stringify(res[i]);
    ok ? same++ : fail.push(`PHP/JS differ on ${d}: ${JSON.stringify(res[i])} vs ${JSON.stringify(js)}`);
  });
  nexts.forEach((a, i) => {
    const ok = P.nextTithiDate(...a) === res[dates.length + i];
    ok ? same++ : fail.push(`PHP/JS nextTithiDate differ on ${JSON.stringify(a)}`);
  });
  pass += same;
  console.log(`PHP parity: ${same}/${dates.length + nexts.length} identical`);
} else {
  console.log('php not on PATH; skipped PHP parity check');
}

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
