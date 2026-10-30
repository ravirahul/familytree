<?php
// Tests for public_html/includes/panchang.php against Drik Panchang (New Delhi, purnimanta).
// Run: php -d zend.assertions=1 -d assert.exception=1 tools/test-panchang.php
// Same cases live in tools/test-panchang.mjs; keep the two lists in step.
require __DIR__ . '/../public_html/includes/panchang.php';

// Sunrise tithi on a date. Source: drikpanchang.com festival + amavasya/purnima pages.
const SUNRISE = [
    ['2024-04-08', 'Chaitra Krishna Amavasya'],        // amavasya 03:21 - 23:50
    ['2024-07-05', 'Ashadh Krishna Amavasya'],          // 04:57 Jul 5 - 04:26 Jul 6
    ['2024-11-01', 'Kartik Krishna Amavasya'],          // Diwali 2024, ends 18:16
    ['2024-12-30', 'Paush Krishna Amavasya'],           // 04:01 Dec 30 - 03:56 Dec 31
    ['2025-01-29', 'Magh Krishna Amavasya'],            // Mauni Amavasya
    ['2025-08-09', 'Shravan Shukla Purnima'],           // Raksha Bandhan, ends 13:24
    ['2025-08-16', 'Bhadrapad Krishna Ashtami'],        // Janmashtami
    ['2025-08-27', 'Bhadrapad Shukla Chaturthi'],       // Ganesh Chaturthi, 13:54 Aug 26 - 15:44
    ['2025-09-21', 'Ashwin Krishna Amavasya'],          // Sarva Pitru Amavasya
    ['2025-10-21', 'Kartik Krishna Amavasya'],          // Diwali 2025 (amavasya at sunrise)
    ['2025-12-19', 'Paush Krishna Amavasya'],
    ['2026-01-18', 'Magh Krishna Amavasya'],
    ['2026-03-03', 'Phalgun Shukla Purnima'],           // Holika Dahan 2026
    ['2026-03-19', 'Chaitra Krishna Amavasya'],         // ends 06:52, just after 06:00
    ['2026-03-27', 'Chaitra Shukla Navami'],            // Ram Navami tithi at sunrise (festival kept 26th, madhyahna rule)
    ['2026-04-02', 'Chaitra Shukla Purnima'],           // ends 07:41
    ['2026-05-16', 'Jyeshtha Krishna Amavasya'],        // nija Jyeshtha Krishna, just before adhik
    ['2026-05-17', 'Adhik Jyeshtha Shukla Pratipada'],  // adhik masa starts (amavasya ended 01:30)
    ['2026-05-31', 'Adhik Jyeshtha Shukla Purnima'],
    ['2026-06-15', 'Adhik Jyeshtha Krishna Amavasya'],  // adhik masa ends 08:23
    ['2026-06-16', 'Jyeshtha Shukla Dwitiya'],          // nija Jyeshtha; pratipada ends ~04:33 (computed), before sunrise
    ['2026-06-29', 'Jyeshtha Shukla Purnima'],
    ['2026-08-28', 'Shravan Shukla Purnima'],           // Raksha Bandhan 2026, ends 09:48
    ['2026-11-09', 'Kartik Krishna Amavasya'],          // amavasya 11:27 Nov 8 - 12:31 Nov 9
    ['2026-12-08', 'Margashirsha Krishna Amavasya'],
    ['2027-03-08', 'Phalgun Krishna Amavasya'],
    ['2027-04-06', 'Chaitra Krishna Amavasya'],         // begins 05:40
    ['2027-06-04', 'Jyeshtha Krishna Amavasya'],
    ['2027-10-29', 'Kartik Krishna Amavasya'],          // Diwali 2027
];

// Known boundary cases: tithi ends between 06:00 IST and real Delhi sunrise, so
// we (06:00) still see the old tithi while Drik (real sunrise) shows the next.
const BOUNDARY = [
    ['2025-02-28', 'Phalgun Krishna Amavasya', 'Drik: Phalgun Shukla Pratipada (amavasya ends 06:14, sunrise 06:48)'],
    ['2026-12-09', 'Margashirsha Krishna Amavasya', 'Drik: Paush Shukla Pratipada (amavasya ends 06:21, sunrise 07:05)'],
];

// nextTithiDate(masa, paksha, tithi, from, opts) => expected date (sunrise rule).
const NEXT = [
    [[8, 'K', 15, '2024-06-01'], '2024-11-01'],                 // Diwali 2024
    [[8, 'K', 15, '2025-01-01'], '2025-10-21'],                 // Diwali 2025
    [[5, 'S', 15, '2025-01-01'], '2025-08-09'],                 // Raksha Bandhan 2025
    [[6, 'K', 8, '2025-01-01'], '2025-08-16'],                  // Janmashtami 2025
    [[6, 'S', 4, '2025-01-01'], '2025-08-27'],                  // Ganesh Chaturthi 2025
    [[7, 'K', 15, '2025-01-01'], '2025-09-21'],                 // Sarva Pitru Amavasya 2025
    [[1, 'S', 9, '2026-01-01'], '2026-03-27'],                  // Ram Navami tithi at sunrise
    [[3, 'S', 15, '2026-05-01'], '2026-06-29'],                 // skips Adhik Jyeshtha Purnima
    [[3, 'S', 15, '2026-05-01', ['adhik' => true]], '2026-05-31'],
    [[3, 'K', 15, '2026-05-20'], '2027-06-04'],                 // nija only: next year
    [[3, 'K', 15, '2026-05-20', ['adhik' => true]], '2026-06-15'],
    [[7, 'K', 15, '2026-01-01', ['system' => 'amanta']], '2026-11-09'], // Diwali 2026, amanta name
    [[8, 'K', 15, '2026-01-01'], '2026-11-09'],                 // same day, purnimanta name
    [[8, 'K', 15, '2027-01-01'], '2027-10-29'],                 // Diwali 2027
    [[12, 'S', 15, '2026-01-01'], '2026-03-03'],                // Holika Dahan 2026
];

// dateFromTithi(vs, masa, paksha, tithi) => expected date.
const FROM = [
    [[2082, 8, 'K', 15], '2025-10-21'],   // Diwali VS 2082
    [[2083, 1, 'S', 9], '2026-03-27'],    // Ram Navami VS 2083
    [[2082, 12, 'K', 15], '2026-02-17'],  // Phalgun Amavasya, end of VS 2082
    [[2082, 1, 'K', 15], '2026-03-19'],   // purnimanta Chaitra Krishna = last fortnight of VS 2082
    [[2081, 8, 'K', 15], '2024-11-01'],   // Diwali VS 2081
];

// Tithi transition times (IST) from Drik, checked to within 3 minutes.
// [Y, M, D, h, m, elongation degrees at that moment]
const ENDS = [
    [2025, 8, 9, 13, 24, 180], [2025, 8, 8, 14, 12, 168], [2025, 8, 27, 15, 44, 48],
    [2025, 10, 21, 17, 54, 0], [2026, 5, 17, 1, 30, 0], [2026, 6, 15, 8, 23, 0],
    [2026, 3, 27, 10, 6, 108], [2027, 3, 8, 14, 58, 0], [2024, 11, 1, 18, 16, 0],
];

$pass = 0; $fail = [];
$check = function (bool $ok, string $what) use (&$pass, &$fail) { $ok ? $pass++ : $fail[] = $what; };

foreach (SUNRISE as [$d, $want]) {
    $got = Panchang::tithiOf($d)['label'];
    $check($got === $want, "tithiOf($d) = $got, want $want");
}
foreach (BOUNDARY as [$d, $ours]) {
    $got = Panchang::tithiOf($d)['label'];
    $check($got === $ours, "boundary tithiOf($d) = $got, expected our 06:00 answer $ours");
}
foreach (NEXT as [$a, $want]) {
    $got = Panchang::nextTithiDate($a[0], $a[1], $a[2], $a[3], $a[4] ?? []);
    $check($got === $want, 'nextTithiDate(' . json_encode($a) . ") = $got, want $want");
}
foreach (FROM as [$a, $want]) {
    $got = Panchang::dateFromTithi(...$a);
    $check($got === $want, 'dateFromTithi(' . json_encode($a) . ") = $got, want $want");
}
foreach (ENDS as [$y, $mo, $d, $h, $mi, $deg]) {
    // Find when elongation crosses $deg near the given time (bisection over +-3 h).
    $jd0 = gmmktime(0, 0, 0, $mo, $d, $y) / 86400 + 2440587.5 + ($h * 60 + $mi - 330) / 1440;
    $f = fn($jd) => fmod(Panchang::elongation($jd) - $deg + 540, 360) - 180;
    [$lo, $hi] = [$jd0 - 0.125, $jd0 + 0.125];
    for ($i = 0; $i < 40; $i++) { $mid = ($lo + $hi) / 2; if ($f($mid) < 0) $lo = $mid; else $hi = $mid; }
    $diff = ($lo - $jd0) * 1440;
    $check(abs($diff) <= 3, sprintf('transition %04d-%02d-%02d %02d:%02d (%d deg) off by %.1f min', $y, $mo, $d, $h, $mi, $deg, $diff));
}

// Other properties: VS year, Diwali month in both systems, round trips, kshaya days, speed.
$check(Panchang::vsYear('2026-03-19') === 2082 && Panchang::vsYear('2026-03-20') === 2083, 'VS changes at Chaitra Shukla 1 (20 Mar 2026)');
$check(Panchang::vsYear('2025-12-31') === 2082, 'VS 2082 in Dec 2025');
$a = Panchang::tithiOf('2025-10-21', ['system' => 'amanta']);
$check($a['label'] === 'Ashwin Krishna Amavasya' && $a['masa'] === 7, 'Diwali 2025 is Ashwin Amavasya in amanta');
$check(count(Panchang::MASA_NAMES) === 12 && count(Panchang::TITHI_NAMES) === 15, 'name lists');

mt_srand(7);
$kshaya = 0;
for ($i = 0; $i < 60; $i++) {
    $d = date('Y-m-d', mt_rand(strtotime('1950-01-01'), strtotime('2040-12-31')));
    $t = Panchang::tithiOf($d);
    $back = Panchang::dateFromTithi($t['vs'], $t['masa'], $t['paksha'], $t['tithi'], ['adhik' => $t['adhik']]);
    // A vriddhi tithi maps back to its first day, so allow one day earlier.
    $ok = $back === $d || ($back !== null && (strtotime($d) - strtotime($back)) === 86400);
    $check($ok, "round trip $d ({$t['label']} VS {$t['vs']}) -> $back");
}
// Kshaya: the skipped tithi must resolve to the day whose sunrise tithi follows it.
for ($day = strtotime('2025-01-01'); $day < strtotime('2026-01-01') && $kshaya < 3; $day += 86400) {
    $p = Panchang::tithiOf(date('Y-m-d', $day - 86400));
    $c = Panchang::tithiOf(date('Y-m-d', $day));
    $tp = ($p['paksha'] === 'K' ? 15 : 0) + $p['tithi'];
    $tc = ($c['paksha'] === 'K' ? 15 : 0) + $c['tithi'];
    if (($tc - $tp + 30) % 30 !== 2) continue;
    $kshaya++;
    $skip = $tp % 30 + 1;
    $paksha = $skip > 15 ? 'K' : 'S';
    $masa = $paksha === $c['paksha'] ? $c['masa'] : $p['masa'];  // month of the skipped tithi's paksha
    $got = Panchang::nextTithiDate($masa, $paksha, $skip > 15 ? $skip - 15 : $skip, date('Y-m-d', $day - 5 * 86400), ['adhik' => true]);
    $check($got === date('Y-m-d', $day), "kshaya tithi $skip before " . date('Y-m-d', $day) . " -> $got");
}
$check($kshaya > 0, 'found kshaya tithis in 2025');

$t0 = microtime(true);
Panchang::nextTithiDate(8, 'K', 15, '2026-11-10');
$ms = (microtime(true) - $t0) * 1000;
$check($ms < 50, sprintf('nextTithiDate took %.1f ms', $ms));

foreach ($fail as $f) echo "FAIL $f\n";
echo "$pass passed, " . count($fail) . " failed\n";
assert(!$fail, 'panchang tests failed');
exit($fail ? 1 : 0);
