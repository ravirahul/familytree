<?php
/**
 * tools/test-digest.php - what the weekly email lists for a week.
 *   php -d zend.assertions=1 -d assert.exception=1 tools/test-digest.php
 */
$root = dirname(__DIR__) . '/public_html';
putenv('FT_STORAGE_DIR=' . sys_get_temp_dir() . '/ft-test-' . getmypid());
require $root . '/includes/db.php';
require $root . '/includes/store.php';
require $root . '/includes/digest.php';

$M = [
    ['id' => 1, 'name' => 'Ram Karn', 'is_alive' => 0, 'birth_date' => '1940-11-03', 'death_date' => '2015-11-05', 'pids' => [2], 'extra' => []],
    ['id' => 2, 'name' => 'Sita Devi', 'is_alive' => 1, 'birth_date' => '1945-08-20', 'pids' => [1], 'anniversary_date' => '1962-11-06', 'extra' => []],
    ['id' => 3, 'name' => 'Mohan Karn', 'is_alive' => 1, 'birth_date' => '1968-12-25', 'pids' => [4], 'extra' => ['partners' => ['4' => ['married' => '1992-11-04', 'end' => 'divorce']]]],
    ['id' => 4, 'name' => 'Rekha', 'is_alive' => 1, 'pids' => [3], 'extra' => []],
    ['id' => 5, 'name' => 'Nani', 'is_alive' => 0, 'extra' => ['death_tithi' => ['m' => 8, 'p' => 'K', 't' => 10]]],   // Kartik Krishna Dashami, 4 Nov 2026
];
$e = ft_week_events($M, [], '2026-11-02');
$texts = array_column($e, 'text');
assert(in_array('Ram Karn would have been 86', $texts, true), 'a birthday of someone who has died: ' . json_encode($texts));
assert(in_array('Remembering Ram Karn, 11 years since they passed', $texts, true), 'death anniversary');
assert(in_array('Sita and Ram: 64 years married', $texts, true) || in_array('Ram and Sita: 64 years married', $texts, true), 'anniversary from the old field');
assert(!array_filter($texts, fn($t) => str_contains($t, 'Mohan and Rekha')), 'a divorced couple gets no anniversary');
assert(!array_filter($texts, fn($t) => str_contains($t, 'Mohan Karn turns')), 'a birthday next month is not in this week');
$tithi = array_values(array_filter($e, fn($x) => $x['kind'] === 'tithi'));
assert($tithi && array_filter($tithi, fn($x) => $x['text'] === 'Shraddh of Nani (Kartik Krishna Dashami)'), 'a hand-typed tithi: ' . json_encode($tithi));
assert(array_filter($tithi, fn($x) => str_contains($x['text'], 'Ram Karn')), 'a tithi worked out from the death date');
assert(!array_filter(ft_week_events($M, ['hindu_calendar' => false], '2026-11-02'), fn($x) => str_contains($x['text'], 'Shraddh of Ram')), 'turned off per tree');
assert(array_column($e, 'date') === array_values(array_unique(array_column($e, 'date'))) || count($e) > 0, 'sorted');
$dates = array_column($e, 'date'); $sorted = $dates; sort($sorted);
assert($dates === $sorted, 'in date order');
foreach ($dates as $d) assert($d >= '2026-11-02' && $d < '2026-11-09', "inside the week: $d");
assert(strlen(ft_unsub_token(7)) === 32 && ft_unsub_token(7) !== ft_unsub_token(8), 'per-person unsubscribe token');
echo "digest: ok (" . count($e) . " events)\n";
