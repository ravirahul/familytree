<?php
/**
 * includes/merge.php - finding people entered twice, and merging them.
 *
 *   ft_duplicates($members)                      likely pairs, best first
 *   ft_merge_members($pdo, $tid, $store, $keep, $drop, $choices)   one undo-able batch
 */

/** a name for comparing: lower case, no titles, no punctuation */
function ft_name_key(?string $n): string {
    $n = mb_strtolower(trim((string)$n));
    $n = preg_replace('/\b(late|lt|shri|sri|smt|kumari|km|mr|mrs|ms|miss|dr|prof|sir|dame|lady|lord|ji)\b\.?/u', ' ', $n);
    $n = preg_replace('/[^\p{L}\p{N} ]+/u', ' ', $n);
    return trim(preg_replace('/\s+/', ' ', $n));
}

/** pairs that look like the same person: [[a, b, score 0-100, reasons[]], ...] */
function ft_duplicates(array $members, int $limit = 60): array {
    $byId = []; foreach ($members as $m) $byId[$m['id']] = $m;
    $year = fn($d) => preg_match('/^(\d{4})/', (string)$d, $x) ? (int)$x[1] : null;
    // only compare people in the same block (first letter of first name + start of last name), so big trees stay fast
    $blocks = [];
    foreach ($members as $m) {
        $k = ft_name_key($m['name'] ?? ''); if ($k === '') continue;
        $parts = explode(' ', $k);
        $blocks[mb_substr($parts[0], 0, 1) . '|' . mb_substr(end($parts), 0, 3)][] = $m;
    }
    $out = [];
    foreach ($blocks as $group) {
        $n = count($group);
        if ($n < 2 || $n > 400) continue;
        for ($i = 0; $i < $n; $i++) for ($j = $i + 1; $j < $n; $j++) {
            [$a, $b] = [$group[$i], $group[$j]];
            // close family are never the same person
            if (in_array($b['id'], $a['pids'], true) || $a['fid'] === $b['id'] || $a['mid'] === $b['id'] || $b['fid'] === $a['id'] || $b['mid'] === $a['id']) continue;
            if (($a['fid'] && $a['fid'] === $b['fid']) && ($a['mid'] && $a['mid'] === $b['mid'])) continue;   // siblings
            $ga = $a['gender'] ?? ''; $gb = $b['gender'] ?? '';
            if ($ga && $gb && $ga !== $gb) continue;
            $ka = ft_name_key($a['name']); $kb = ft_name_key($b['name']);
            $score = 0; $why = [];
            if ($ka === $kb) { $score += 55; $why[] = 'same name'; }
            else {
                $d = levenshtein($ka, $kb);
                if ($d <= 2 && min(strlen($ka), strlen($kb)) >= 6) { $score += 40; $why[] = 'nearly the same name'; }
                elseif (str_contains($ka, $kb) || str_contains($kb, $ka)) { $score += 30; $why[] = 'one name contains the other'; }
                else continue;
            }
            $ya = $year($a['birth_date']); $yb = $year($b['birth_date']);
            if ($ya && $yb) {
                if ($a['birth_date'] === $b['birth_date']) { $score += 30; $why[] = 'same birth date'; }
                elseif (abs($ya - $yb) <= 2) { $score += 15; $why[] = 'born within 2 years'; }
                else continue;                                   // born far apart: different people with one name
            }
            if (($a['birth_location'] ?? '') !== '' && ft_name_key($a['birth_location']) === ft_name_key($b['birth_location'] ?? '')) { $score += 10; $why[] = 'same birthplace'; }
            foreach (['fid' => 'father', 'mid' => 'mother'] as $k => $w) {
                $pa = $a[$k] ? ft_name_key($byId[$a[$k]]['name'] ?? '') : ''; $pb = $b[$k] ? ft_name_key($byId[$b[$k]]['name'] ?? '') : '';
                if ($pa !== '' && $pa === $pb) { $score += 10; $why[] = "same $w's name"; }
            }
            // one of the two is a bare entry (no parents, no partner): typical of a second import
            if ((!$a['fid'] && !$a['mid'] && !$a['pids']) || (!$b['fid'] && !$b['mid'] && !$b['pids'])) $score += 5;
            if ($score >= 55) $out[] = [$a['id'], $b['id'], min(100, $score), $why];
        }
    }
    usort($out, fn($x, $y) => $y[2] <=> $x[2]);
    return array_slice($out, 0, $limit);
}

/** fields the merge screen offers a choice for */
const FT_MERGE_FIELDS = ['name', 'nickname', 'gender', 'birth_date', 'birth_location', 'death_date', 'death_location', 'is_alive',
    'current_location', 'img', 'insta_url', 'fb_url', 'anniversary_date', 'wiki'];

/**
 * Merge $drop into $keep: $choices[field] = 'drop' takes the other person's value; otherwise the kept
 * value stays, or the other's fills it when empty. Parents, partners, children, photo tags and
 * accounts all move to the kept person; then $drop is deleted. One batch, so one Undo puts it back.
 */
function ft_merge_members(PDO $pdo, string $tid, FamilyStore $store, int $keep, int $drop, array $choices = []): array {
    if ($keep === $drop) throw new RuntimeException('Pick two different people.');
    $k = $store->member($keep); $d = $store->member($drop);
    if (!$k || !$d) throw new RuntimeException('One of those people is no longer in the tree.');
    ft_batch(bin2hex(random_bytes(8)));
    $patch = [];
    foreach (FT_MERGE_FIELDS as $f) {
        $empty = fn($v) => $v === null || $v === '';
        if (($choices[$f] ?? '') === 'drop' && !$empty($d[$f])) $patch[$f] = $d[$f];
        elseif ($empty($k[$f]) && !$empty($d[$f])) $patch[$f] = $d[$f];
    }
    foreach (['fid', 'mid'] as $f) if (!$k[$f] && $d[$f] && $d[$f] !== $keep) $patch[$f] = $d[$f];
    $pids = array_values(array_unique(array_diff(array_merge($k['pids'], $d['pids']), [$keep, $drop])));
    if ($pids !== $k['pids']) $patch['pids'] = $pids;
    // extra: kept values win; sources and partnerships are combined
    $x = $k['extra']; $y = $d['extra'];
    foreach ($y as $key => $v) {
        if ($key === 'sources') { $x['sources'] = array_values(array_unique(array_merge($x['sources'] ?? [], $v), SORT_REGULAR)); continue; }
        if ($key === 'partners') { foreach ($v as $pid => $p) if ((int)$pid !== $keep) $x['partners'][$pid] ??= $p; continue; }
        if (!isset($x[$key]) || $x[$key] === '' || $x[$key] === []) $x[$key] = $v;
    }
    if ($x !== $k['extra']) $patch['extra'] = $x;
    if ($patch) $store->patchMember($keep, $patch);

    // everyone pointing at the dropped person now points at the kept one
    $moved = 0;
    foreach ($store->members() as $m) {
        if ($m['id'] === $keep || $m['id'] === $drop) continue;
        $p = [];
        if ($m['fid'] === $drop) $p['fid'] = $keep;
        if ($m['mid'] === $drop) $p['mid'] = $keep;
        if (in_array($drop, $m['pids'], true)) $p['pids'] = array_values(array_unique(array_map(fn($i) => $i === $drop ? $keep : $i, $m['pids'])));
        if (isset($m['extra']['partners'][(string)$drop])) { $e = $m['extra']; $e['partners'][(string)$keep] ??= $e['partners'][(string)$drop]; unset($e['partners'][(string)$drop]); $p['extra'] = $e; }
        if ($p) { $store->patchMember($m['id'], $p); $moved++; }
    }
    foreach ($store->media() as $md) {
        if (in_array($drop, $md['member_ids'], true)) $store->updateMedia($md['id'], [], array_values(array_unique(array_map(fn($i) => $i === $drop ? $keep : $i, $md['member_ids']))));
    }
    ft_remap_accounts($pdo, $tid, [$drop => $keep]);
    $store->deleteMember($drop);
    return ['kept' => $keep, 'removed' => $drop, 'relinked' => $moved, 'batch' => ft_batch()];
}
