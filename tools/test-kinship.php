<?php
/**
 * tools/test-kinship.php - the relationship namer's one check.
 *
 *   php -d zend.assertions=1 -d assert.exception=1 tools/test-kinship.php
 */
$pub = dirname(__DIR__) . '/public_html';
require $pub . '/includes/store.php';
require $pub . '/includes/kinship.php';

//            Dada(1) = Dadi(2)
//               |          \
//          Papa(3) = Mummy(4)   Chacha(5) = Chachi(9)
//           /     \                 |
//       Ravi(6)  Nitu(7)       Cousin(8)
//          |                        |
//      Beta(10)               CousinKid(11)
//  Step: Papa also married Second(12); HalfBro(13) is their son
$p = fn($id, $name, $g, $f = null, $m = null, $pids = []) => ['id' => $id, 'name' => $name, 'gender' => $g, 'fid' => $f, 'mid' => $m, 'pids' => $pids];
$t = [
    $p(1, 'Dada', 'male', null, null, [2]), $p(2, 'Dadi', 'female', null, null, [1]),
    $p(3, 'Papa', 'male', 1, 2, [4, 12]), $p(4, 'Mummy', 'female', null, null, [3]),
    $p(5, 'Chacha', 'male', 1, 2, [9]), $p(9, 'Chachi', 'female', null, null, [5]),
    $p(6, 'Ravi', 'male', 3, 4), $p(7, 'Nitu', 'female', 3, 4), $p(8, 'Cousin', 'male', 5, 9),
    $p(10, 'Beta', 'male', 6), $p(11, 'CousinKid', 'female', 8),
    $p(12, 'Second', 'female', null, null, [3]), $p(13, 'HalfBro', 'male', 3, 12),
];
$r = fn($a, $b) => ft_relationship($t, $a, $b);
$checks = [
    [1, 6, "Dada is Ravi's grandfather."],
    [1, 10, "Dada is Beta's great-grandfather."],
    [6, 1, "Ravi is Dada's grandson."],
    [6, 7, "Ravi is Nitu's brother."],
    [7, 6, "Nitu is Ravi's sister."],
    [5, 6, "Chacha is Ravi's uncle."],
    [6, 5, "Ravi is Chacha's nephew."],
    [6, 8, "Ravi is Cousin's first cousin."],
    [6, 11, "Ravi is CousinKid's first cousin once removed."],
    [10, 11, "Beta is CousinKid's second cousin."],
    [5, 10, "Chacha is Beta's granduncle."],
    [13, 6, "HalfBro is Ravi's half-brother."],
    [3, 4, "Papa is Mummy's husband."],
];
foreach ($checks as [$a, $b, $want]) assert($r($a, $b) === $want, "$a,$b: got \"" . $r($a, $b) . "\", want \"$want\"");
assert(str_starts_with($r(9, 6), "Chachi is Ravi's aunt by marriage"), 'an aunt by marriage: ' . $r(9, 6));
assert(str_starts_with($r(12, 6), "Second is Ravi's stepmother"), 'a stepmother: ' . $r(12, 6));
assert(str_contains($r(4, 1), 'daughter-in-law'), 'a daughter-in-law is named: ' . $r(4, 1));
assert(str_contains($r(1, 4), 'father-in-law'), 'a father-in-law is named: ' . $r(1, 4));
echo "kinship: ok\n";
