<?php
/**
 * includes/kinship.php - how two people in a tree are related, in plain English.
 *
 *   ft_relationship($members, $a, $b)  ->  "Ram is Anjali's grandfather"
 *
 * Blood relations come from the nearest common ancestor (parent, grandparent, sibling,
 * aunt or uncle, niece or nephew, nth cousin k times removed). Spouses, and in-laws one
 * marriage away, are named too. $members are store rows (id, name, gender, fid, mid, pids).
 */

/** id => generations up, for a person and everyone above them */
function ft_ancestors(array $byId, int $id): array {
    $seen = [$id => 0]; $q = [$id];
    while ($q) {
        $x = array_shift($q);
        foreach (['fid', 'mid'] as $k) {
            $p = $byId[$x][$k] ?? null;
            if ($p && isset($byId[$p]) && !isset($seen[$p])) { $seen[$p] = $seen[$x] + 1; $q[] = $p; }
        }
    }
    return $seen;
}

function ft_ordinal(int $n): string {
    return [1 => 'first', 2 => 'second', 3 => 'third', 4 => 'fourth', 5 => 'fifth', 6 => 'sixth', 7 => 'seventh', 8 => 'eighth'][$n] ?? $n . 'th';
}

/** the word for what A is to B, from A's distance (da) and B's distance (db) to their nearest common ancestor */
function ft_kin_word(int $da, int $db, ?string $gender, bool $half = false): string {
    $g = fn(string $m, string $f, string $n) => $gender === 'male' ? $m : ($gender === 'female' ? $f : $n);
    $greats = fn(int $k) => str_repeat('great-', max(0, $k));
    if ($da === 0) {                                                     // A is B's ancestor
        if ($db === 1) return $g('father', 'mother', 'parent');
        return $greats($db - 2) . $g('grandfather', 'grandmother', 'grandparent');
    }
    if ($db === 0) {                                                     // A is B's descendant
        if ($da === 1) return $g('son', 'daughter', 'child');
        return $greats($da - 2) . $g('grandson', 'granddaughter', 'grandchild');
    }
    if ($da === 1 && $db === 1) return ($half ? 'half-' : '') . $g('brother', 'sister', 'sibling');
    if ($da === 1) return ($db === 2 ? '' : $greats($db - 3) . ($db >= 3 ? 'grand' : '')) . $g('uncle', 'aunt', "parent's sibling");
    if ($db === 1) return ($da === 2 ? '' : $greats($da - 3) . ($da >= 3 ? 'grand' : '')) . $g('nephew', 'niece', "sibling's child");
    $degree = min($da, $db) - 1; $removed = abs($da - $db);
    return ft_ordinal($degree) . ' cousin' . ($removed ? ($removed === 1 ? ' once removed' : ($removed === 2 ? ' twice removed' : " $removed times removed")) : '');
}

/** [word, da, db] for blood relatives, or null */
function ft_blood(array $byId, int $a, int $b): ?array {
    $A = ft_ancestors($byId, $a); $B = ft_ancestors($byId, $b);
    $best = null;
    foreach ($A as $anc => $da) if (isset($B[$anc]) && ($best === null || $da + $B[$anc] < $best[1] + $best[2])) $best = [$anc, $da, $B[$anc]];
    if (!$best) return null;
    [$anc, $da, $db] = $best;
    $half = false;
    if ($da === 1 && $db === 1) {                                        // siblings: half when they share only one parent
        $pa = array_filter([$byId[$a]['fid'], $byId[$a]['mid']]); $pb = array_filter([$byId[$b]['fid'], $byId[$b]['mid']]);
        $half = count(array_intersect($pa, $pb)) === 1 && count($pa) === 2 && count($pb) === 2;
    }
    return [ft_kin_word($da, $db, $byId[$a]['gender'] ?? null, $half), $da, $db];
}

function ft_relationship(array $members, int $a, int $b): string {
    $byId = []; foreach ($members as $m) $byId[(int)$m['id']] = $m;
    if (!isset($byId[$a], $byId[$b])) return 'One of those people is not in this tree.';
    $na = $byId[$a]['name']; $nb = $byId[$b]['name'];
    if ($a === $b) return "That is the same person, $na.";
    $g = $byId[$a]['gender'] ?? null;
    if (in_array($b, ft_pids($byId[$a]['pids'] ?? []), true)) return "$na is $nb's " . ($g === 'male' ? 'husband' : ($g === 'female' ? 'wife' : 'spouse')) . '.';
    if ($r = ft_blood($byId, $a, $b)) return "$na is $nb's {$r[0]}.";
    // in-law: A married to a blood relative of B, or A a blood relative of B's spouse
    foreach (ft_pids($byId[$a]['pids'] ?? []) as $s) if (isset($byId[$s]) && ($r = ft_blood($byId, $s, $b)) && $r[1] <= 2 && $r[2] <= 2) {
        $gw = fn(string $m, string $f, string $n) => $g === 'male' ? $m : ($g === 'female' ? $f : $n);
        $word = match (true) {
            in_array($r[0], ['father', 'mother', 'parent'], true)              => $gw('stepfather', 'stepmother', 'step-parent'),
            in_array($r[0], ['son', 'daughter', 'child'], true)                => $gw('son-in-law', 'daughter-in-law', 'child-in-law'),
            in_array($r[0], ['brother', 'sister', 'sibling'], true)            => $gw('brother-in-law', 'sister-in-law', 'sibling-in-law'),
            in_array($r[0], ['uncle', 'aunt', "parent's sibling"], true)       => $gw('uncle', 'aunt', 'aunt or uncle') . ' by marriage',
            in_array($r[0], ['nephew', 'niece', "sibling's child"], true)      => $gw('nephew', 'niece', "sibling's child") . ' by marriage',
            default                                                            => "{$r[0]}'s spouse",
        };
        return "$na is $nb's $word (married to {$byId[$s]['name']}, who is $nb's {$r[0]}).";
    }
    foreach (ft_pids($byId[$b]['pids'] ?? []) as $s) if (isset($byId[$s]) && ($r = ft_blood($byId, $a, $s)) && $r[1] <= 2 && $r[2] <= 2) {
        $in = ['father' => 'father-in-law', 'mother' => 'mother-in-law', 'brother' => 'brother-in-law', 'sister' => 'sister-in-law', 'son' => 'stepson', 'daughter' => 'stepdaughter'][$r[0]] ?? "spouse's {$r[0]}";
        return "$na is $nb's $in ($na is the {$r[0]} of {$byId[$s]['name']}, $nb's spouse).";
    }
    return "No relation between $na and $nb is recorded in this tree.";
}

/**
 * The Indian (Hindi) word for how $b is related to $a: Mama, Bua, Tau, Bhabhi... Same table and
 * rules as assets/kinship-hi.js: shortest path through father/mother, son/daughter, husband/wife,
 * brother/sister (at most 4 steps), elder or younger decided by birth year where Hindi cares.
 * Returns ['roman' => 'Mama', 'hindi' => 'मामा', 'english' => "mother's brother"] or null.
 */
function ft_indian_term(array $members, int $a, int $b): ?array {
    static $T = null;
    $T ??= [
        'F' => ['Pitaji', 'पिताजी'], 'M' => ['Maa', 'माँ'], 'S' => ['Beta', 'बेटा'], 'D' => ['Beti', 'बेटी'], 'H' => ['Pati', 'पति'], 'W' => ['Patni', 'पत्नी'],
        'B' => ['older' => ['Bhaiya', 'भैया'], 'younger' => ['Chhota bhai', 'छोटा भाई'], '' => ['Bhai', 'भाई']],
        'Z' => ['older' => ['Didi', 'दीदी'], 'younger' => ['Chhoti behen', 'छोटी बहन'], '' => ['Behen', 'बहन']],
        'FF' => ['Dada', 'दादा'], 'FM' => ['Dadi', 'दादी'], 'MF' => ['Nana', 'नाना'], 'MM' => ['Nani', 'नानी'],
        'FB' => ['older' => ['Tau', 'ताऊ'], 'younger' => ['Chacha', 'चाचा'], '' => ['Chacha / Tau', 'चाचा / ताऊ']],
        'FBW' => ['older' => ['Tai', 'ताई'], 'younger' => ['Chachi', 'चाची'], '' => ['Chachi / Tai', 'चाची / ताई']],
        'FZ' => ['Bua', 'बुआ'], 'FZH' => ['Fufa', 'फूफा'], 'MB' => ['Mama', 'मामा'], 'MBW' => ['Mami', 'मामी'], 'MZ' => ['Mausi', 'मौसी'], 'MZH' => ['Mausa', 'मौसा'],
        'FBS' => ['Chachera bhai', 'चचेरा भाई'], 'FBD' => ['Chacheri behen', 'चचेरी बहन'], 'FZS' => ['Phuphera bhai', 'फुफेरा भाई'], 'FZD' => ['Phupheri behen', 'फुफेरी बहन'],
        'MBS' => ['Mamera bhai', 'ममेरा भाई'], 'MBD' => ['Mameri behen', 'ममेरी बहन'], 'MZS' => ['Mausera bhai', 'मौसेरा भाई'], 'MZD' => ['Mauseri behen', 'मौसेरी बहन'],
        'BS' => ['Bhatija', 'भतीजा'], 'BD' => ['Bhatiji', 'भतीजी'], 'ZS' => ['Bhanja', 'भांजा'], 'ZD' => ['Bhanji', 'भांजी'],
        'BW' => ['Bhabhi', 'भाभी'], 'ZH' => ['older' => ['Jija', 'जीजा'], 'younger' => ['Behnoi', 'बहनोई'], '' => ['Jija', 'जीजा']],
        'SS' => ['Pota', 'पोता'], 'SD' => ['Poti', 'पोती'], 'DS' => ['Nati', 'नाती'], 'DD' => ['Natin', 'नातिन'], 'SW' => ['Bahu', 'बहू'], 'DH' => ['Damad', 'दामाद'],
        'HF' => ['Sasur', 'ससुर'], 'HM' => ['Saas', 'सास'], 'WF' => ['Sasur', 'ससुर'], 'WM' => ['Saas', 'सास'],
        'HB' => ['older' => ['Jeth', 'जेठ'], 'younger' => ['Devar', 'देवर'], '' => ['Devar / Jeth', 'देवर / जेठ']],
        'HBW' => ['older' => ['Jethani', 'जेठानी'], 'younger' => ['Devrani', 'देवरानी'], '' => ['Devrani / Jethani', 'देवरानी / जेठानी']],
        'HZ' => ['Nanad', 'ननद'], 'HZH' => ['Nandoi', 'ननदोई'], 'WB' => ['Saala', 'साला'], 'WBW' => ['Salhaj', 'सलहज'], 'WZ' => ['Saali', 'साली'], 'WZH' => ['Saadhu', 'साढ़ू'],
        'SWF' => ['Samdhi', 'समधी'], 'SWM' => ['Samdhan', 'समधन'], 'DHF' => ['Samdhi', 'समधी'], 'DHM' => ['Samdhan', 'समधन'],
        'FW' => ['Sauteli maa', 'सौतेली माँ'], 'MH' => ['Sautele pita', 'सौतेले पिता'],
        'BSW' => ['Bahu (bhatije ki patni)', 'बहू'], 'FFB' => ['Dada (dada ke bhai)', 'दादा'], 'FFZ' => ['Dadi (dada ki behen)', 'दादी'],
        'MMB' => ['Nana (nani ke bhai)', 'नाना'], 'MFB' => ['Nana (nana ke bhai)', 'नाना'],
    ];
    $ageRef = ['B' => 0, 'Z' => 0, 'FB' => 1, 'FBW' => 1, 'ZH' => 0, 'HB' => 1, 'HBW' => 1];
    $en = ['F' => 'father', 'M' => 'mother', 'S' => 'son', 'D' => 'daughter', 'H' => 'husband', 'W' => 'wife', 'B' => 'brother', 'Z' => 'sister'];
    if ($a === $b) return null;
    $byId = []; $kids = [];
    foreach ($members as $m) { $byId[(int)$m['id']] = $m; foreach (['fid', 'mid'] as $k) if (!empty($m[$k])) $kids[(int)$m[$k]][] = (int)$m['id']; }
    if (!isset($byId[$a], $byId[$b])) return null;
    $fem = fn($id) => ($byId[$id]['gender'] ?? '') === 'female';
    $next = function (int $id) use ($byId, $kids, $fem): array {
        $m = $byId[$id]; $out = [];
        if (!empty($m['fid']) && isset($byId[(int)$m['fid']])) $out[] = ['F', (int)$m['fid']];
        if (!empty($m['mid']) && isset($byId[(int)$m['mid']])) $out[] = ['M', (int)$m['mid']];
        $sib = [];
        foreach (['fid', 'mid'] as $k) if (!empty($m[$k])) foreach ($kids[(int)$m[$k]] ?? [] as $c) if ($c !== $id) $sib[$c] = true;
        foreach (array_keys($sib) as $c) $out[] = [$fem($c) ? 'Z' : 'B', $c];
        foreach ($kids[$id] ?? [] as $c) $out[] = [$fem($c) ? 'D' : 'S', $c];
        foreach (ft_pids($m['pids'] ?? []) as $p) if (isset($byId[$p])) $out[] = [$fem($p) ? 'W' : 'H', $p];
        return $out;
    };
    $prev = [$a => null]; $frontier = [$a];
    for ($d = 0; $d < 4 && $frontier && !array_key_exists($b, $prev); $d++) {
        $nf = [];
        foreach ($frontier as $id) foreach ($next($id) as [$step, $to]) { if (array_key_exists($to, $prev)) continue; $prev[$to] = [$id, $step]; $nf[] = $to; }
        $frontier = $nf;
    }
    if (!array_key_exists($b, $prev)) return null;
    $steps = []; $ids = [$b];
    for ($c = $b; $prev[$c] !== null; $c = $prev[$c][0]) { array_unshift($steps, $prev[$c][1]); array_unshift($ids, $prev[$c][0]); }
    $key = implode('', $steps);
    $e = $T[$key] ?? null;
    if (!$e && preg_match('/^[FM][FM][FM]$/', $key)) $e = $key[0] === 'F' ? ($key[2] === 'F' ? ['Pardada', 'परदादा'] : ['Pardadi', 'परदादी']) : ($key[2] === 'F' ? ['Parnana', 'परनाना'] : ['Parnani', 'परनानी']);
    if (!$e && preg_match('/^[SD][SD][SD]$/', $key)) $e = $key[0] === 'S' ? ($key[2] === 'S' ? ['Parpota', 'परपोता'] : ['Parpoti', 'परपोती']) : ($key[2] === 'S' ? ['Parnati', 'परनाती'] : ['Parnatin', 'परनातिन']);
    if (!$e) return null;
    if (isset($e['older'])) {
        $r = $ageRef[$key];
        $yr = (int)substr((string)($byId[$ids[$r]]['birth_date'] ?? ''), 0, 4); $yt = (int)substr((string)($byId[$ids[$r + 1]]['birth_date'] ?? ''), 0, 4);
        $e = $e[($yr && $yt && $yr !== $yt) ? ($yt < $yr ? 'older' : 'younger') : ''];
    }
    return ['roman' => $e[0], 'hindi' => $e[1], 'english' => implode("'s ", array_map(fn($s) => $en[$s], $steps))];
}
