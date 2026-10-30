<?php
/**
 * includes/gedcom.php - read a GEDCOM file (5.5 / 5.5.1, and the 7.0 basics) into FamilyTree members.
 *
 * Every major builder exports GEDCOM: Ancestry, MyHeritage, FamilySearch, Geni, Gramps,
 * webtrees, Family Echo, RootsMagic, Legacy, MacFamilyTree. This is how families move in.
 *
 *   $r = ft_gedcom_read($text);
 *   $r['members']  // FamilyTree member rows with ids 1..n (fid, mid, pids point inside)
 *   $r['media']    // online photos found in OBJE records, tagged to their people
 *   $r['stats']    // counts for a preview, and warnings
 *
 * Exact dates fill the date fields; approximate ones (ABT, BEF, BET...AND, a year alone)
 * are written into the biography instead, so nobody gets a false 1 January birthday.
 */

const FT_GED_MONTHS = ['JAN' => 1, 'FEB' => 2, 'MAR' => 3, 'APR' => 4, 'MAY' => 5, 'JUN' => 6, 'JUL' => 7, 'AUG' => 8, 'SEP' => 9, 'OCT' => 10, 'NOV' => 11, 'DEC' => 12];

/** bytes as UTF-8, whatever the file used (UTF-8 with or without BOM, UTF-16, ANSEL/ANSI as Windows-1252) */
function ft_gedcom_utf8(string $raw): string {
    if (str_starts_with($raw, "\xEF\xBB\xBF")) return substr($raw, 3);
    if (str_starts_with($raw, "\xFF\xFE")) return mb_convert_encoding(substr($raw, 2), 'UTF-8', 'UTF-16LE');
    if (str_starts_with($raw, "\xFE\xFF")) return mb_convert_encoding(substr($raw, 2), 'UTF-8', 'UTF-16BE');
    if (mb_check_encoding($raw, 'UTF-8')) return $raw;
    return mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');     // ponytail: ANSEL read as Windows-1252; accents may be off in very old files
}

/** '12 JAN 1900' -> ['1900-01-12', 1900, '']; 'ABT 1900' -> [null, 1900, 'about 1900'] */
function ft_gedcom_date(?string $s): array {
    $s = strtoupper(trim((string)$s));
    if ($s === '') return [null, null, '', null];
    $s = preg_replace('/@#D[A-Z ]+@\s*/', '', $s);                 // calendar escapes
    $s = preg_replace('/(\d{3,4})\/\d{1,2}\b/', '$1', $s);         // dual years 1750/51
    $words = ['ABT' => 'about', 'EST' => 'about', 'CAL' => 'about', 'BEF' => 'before', 'AFT' => 'after'];
    $q = ['ABT' => 'abt', 'EST' => 'abt', 'CAL' => 'abt', 'BEF' => 'bef', 'AFT' => 'aft'];
    if (preg_match('/^(ABT|EST|CAL|BEF|AFT)\.?\s+(.+)$/', $s, $m)) {
        [, $y] = ft_gedcom_date($m[2]);
        return [null, $y, $y ? $words[$m[1]] . ' ' . $y : '', $y ? ['q' => $q[$m[1]], 'y' => $y] : null];
    }
    if (preg_match('/^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+(.+)$/', $s, $m)) {
        [, $a] = ft_gedcom_date($m[1]); [, $b] = ft_gedcom_date($m[2]);
        return [null, $a, $a && $b ? "between $a and $b" : ($a ? "about $a" : ''), $a ? ($b && $b > $a ? ['q' => 'bet', 'y' => $a, 'y2' => $b] : ['q' => 'abt', 'y' => $a]) : null];
    }
    if (preg_match('/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/', $s, $m) && isset(FT_GED_MONTHS[$m[2]]) && checkdate(FT_GED_MONTHS[$m[2]], (int)$m[1], (int)$m[3]) && (int)$m[3] >= 1000) {
        return [sprintf('%04d-%02d-%02d', $m[3], FT_GED_MONTHS[$m[2]], $m[1]), (int)$m[3], '', null];
    }
    if (preg_match('/^(?:([A-Z]{3})\s+)?(\d{3,4})$/', $s, $m)) {
        $y = (int)$m[2];
        return [null, $y, ($m[1] ? ucfirst(strtolower($m[1])) . ' ' : '') . $y, ['q' => 'year', 'y' => $y]];
    }
    if (preg_match('/(\d{3,4})/', $s, $m)) return [null, (int)$m[1], 'about ' . $m[1], ['q' => 'abt', 'y' => (int)$m[1]]];
    return [null, null, '', null];
}

/** the text of a line plus its CONT / CONC continuations */
function ft_gedcom_text(array $node): string {
    $t = $node['value'];
    foreach ($node['kids'] as $k) {
        if ($k['tag'] === 'CONT') $t .= "\n" . $k['value'];
        elseif ($k['tag'] === 'CONC') $t .= $k['value'];
    }
    return trim($t);
}

function ft_gedcom_first(array $node, string $tag): ?array {
    foreach ($node['kids'] as $k) if ($k['tag'] === $tag) return $k;
    return null;
}

function ft_gedcom_all(array $node, string $tag): array {
    return array_values(array_filter($node['kids'], fn($k) => $k['tag'] === $tag));
}

/** parse the lines into records: [xref => node], node = [tag, value, kids] */
function ft_gedcom_records(string $text): array {
    $records = []; $stack = []; $order = [];
    foreach (preg_split('/\r\n|\r|\n/', $text) as $line) {
        if (!preg_match('/^\s*(\d{1,2})\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/', $line, $m)) continue;
        $lvl = (int)$m[1];
        $node = ['tag' => strtoupper($m[3]), 'xref' => $m[2] ?: null, 'value' => $m[4] ?? '', 'kids' => []];
        if ($lvl === 0) {
            $stack = [];
            $key = $node['xref'] ?: ('_' . count($order));
            $records[$key] = $node; $order[] = $key;
            $stack[0] = &$records[$key];
            continue;
        }
        if (!isset($stack[$lvl - 1])) continue;                    // a broken level jump: skip the line
        $parent = &$stack[$lvl - 1];
        $parent['kids'][] = $node;
        $stack[$lvl] = &$parent['kids'][count($parent['kids']) - 1];
        foreach (array_keys($stack) as $l) if ($l > $lvl) unset($stack[$l]);
        unset($parent);
    }
    unset($stack);
    return $records;
}

function ft_gedcom_read(string $raw, int $maxPeople = 20000): array {
    $text = ft_gedcom_utf8($raw);
    if (!preg_match('/^\s*0\s+HEAD/m', $text)) throw new RuntimeException('This does not look like a GEDCOM file (no HEAD record).');
    $records = ft_gedcom_records($text);
    $indis = []; $fams = []; $notes = []; $sources = [];
    foreach ($records as $x => $r) {
        if ($r['tag'] === 'INDI') $indis[$x] = $r;
        elseif ($r['tag'] === 'FAM') $fams[$x] = $r;
        elseif ($r['tag'] === 'NOTE' && $r['xref']) $notes[$x] = ft_gedcom_text($r);
        elseif ($r['tag'] === 'SOUR' && $r['xref']) {
            $t = ft_gedcom_first($r, 'TITL') ?? ft_gedcom_first($r, 'ABBR');
            $who = trim(implode(', ', array_filter([ft_gedcom_first($r, 'AUTH')['value'] ?? '', ft_gedcom_first($r, 'PUBL')['value'] ?? ''])));
            $sources[$x] = ['title' => $t ? ft_gedcom_text($t) : trim($r['value']), 'note' => $who];
        }
    }
    // citations under a node (an event, a name, the person): [{fact, title, page, note}]
    $cite = function (?array $node, string $fact) use (&$sources): array {
        $out = [];
        foreach ($node ? ft_gedcom_all($node, 'SOUR') : [] as $c) {
            $ref = trim($c['value']);
            $src = preg_match('/^@[^@]+@$/', $ref) ? ($sources[$ref] ?? null) : ['title' => ft_gedcom_text($c), 'note' => ''];
            if (!$src || ($src['title'] === '' && $src['note'] === '')) continue;
            $page = ft_gedcom_first($c, 'PAGE')['value'] ?? '';
            $out[] = array_filter(['fact' => $fact, 'title' => mb_substr($src['title'], 0, 200), 'page' => mb_substr(trim($page), 0, 120), 'note' => mb_substr($src['note'], 0, 500)], fn($v) => $v !== '');
        }
        return $out;
    };
    if (!$indis) throw new RuntimeException('No people found in this file.');
    if (count($indis) > $maxPeople) throw new RuntimeException('This file has ' . count($indis) . " people; the limit for one import is $maxPeople.");

    $id = []; $n = 0;
    foreach (array_keys($indis) as $x) $id[$x] = ++$n;
    $members = []; $media = []; $warnings = [];
    $stats = ['people' => count($indis), 'families' => count($fams), 'exact_births' => 0, 'places' => 0, 'notes' => 0, 'photos' => 0, 'approximate_dates' => 0];
    $places = [];
    $thisYear = (int)date('Y');

    foreach ($indis as $x => $r) {
        // name: "Given /Surname/ Suffix"; the first NAME is the primary one
        $nameNode = ft_gedcom_first($r, 'NAME');
        $raw = $nameNode ? $nameNode['value'] : '';
        $name = trim(preg_replace('/\s+/', ' ', str_replace('/', ' ', $raw)));
        if ($name === '' && $nameNode) {
            $g = ft_gedcom_first($nameNode, 'GIVN'); $s = ft_gedcom_first($nameNode, 'SURN');
            $name = trim(($g['value'] ?? '') . ' ' . ($s['value'] ?? ''));
        }
        $nick = $nameNode ? (ft_gedcom_first($nameNode, 'NICK')['value'] ?? null) : null;
        $nick = $nick ?: (ft_gedcom_first($r, 'NICK')['value'] ?? null);
        $sex = strtoupper(ft_gedcom_first($r, 'SEX')['value'] ?? '');
        $bio = [];

        $event = function (string $tag) use ($r, &$bio, &$stats) {
            $e = ft_gedcom_first($r, $tag);
            if (!$e) return [null, null, null, false];
            $d = ft_gedcom_first($e, 'DATE'); $p = ft_gedcom_first($e, 'PLAC');
            [$exact, $year, $words] = ft_gedcom_date($d['value'] ?? null);
            if (!$exact && $words) $stats['approximate_dates']++;
            $place = $p ? trim(preg_replace('/\s*,\s*/', ', ', preg_replace('/(,\s*)+/', ', ', $p['value'])), ', ') : null;
            return [$exact, $year, $words, true, $place ?: null];
        };
        [$bd, $by, $bw, , $bp] = $event('BIRT') + [4 => null];
        if (!$bd && !$by) { [$bd, $by, $bw, , $bpc] = $event('CHR') + [4 => null]; $bp = $bp ?: $bpc; if ($bw) $bw = 'christened ' . $bw; }
        [$dd, $dy, $dw, $hasDeat, $dp] = $event('DEAT') + [4 => null];
        if (!$hasDeat) { [$dd2, $dy2, $dw2, $hasBuri, $buri] = $event('BURI') + [4 => null]; if ($hasBuri) { $hasDeat = true; $dy = $dy ?: $dy2; $dp = $dp ?: $buri; if (!$dw && $dw2) $dw = 'buried ' . $dw2; } }
        if ($bd) $stats['exact_births']++;
        foreach ([$bp, $dp] as $pl) if ($pl) $places[$pl] = true;
        $extra = [];
        $approx = function (string ...$tags) use ($r): ?array {
            foreach ($tags as $t) { $e = ft_gedcom_first($r, $t); if ($e) { $a = ft_gedcom_date(ft_gedcom_first($e, 'DATE')['value'] ?? null); if ($a[0]) return null; if ($a[3]) return $a[3]; } }
            return null;
        };
        if (!$bd && ($a = $approx('BIRT', 'CHR'))) $extra['birth_approx'] = $a;
        if (!$dd && ($a = $approx('DEAT', 'BURI'))) $extra['death_approx'] = $a;
        // christened and buried stay as words in the biography: they say more than the year
        if ($bw && str_starts_with($bw, 'christened')) $bio[] = 'Born ' . $bw . '.';
        elseif ($bw && !isset($extra['birth_approx'])) $bio[] = 'Born ' . $bw . ($bp && !$bd ? ' in ' . $bp : '') . '.';
        if ($dw && str_starts_with($dw, 'buried')) $bio[] = 'Died ' . $dw . '.';
        elseif ($dw && !isset($extra['death_approx'])) $bio[] = 'Died ' . $dw . '.';
        $src = array_merge($cite(ft_gedcom_first($r, 'BIRT') ?? ft_gedcom_first($r, 'CHR'), 'birth'), $cite(ft_gedcom_first($r, 'DEAT') ?? ft_gedcom_first($r, 'BURI'), 'death'),
                           $cite($nameNode, 'name'), $cite($r, 'other'));
        if ($src) { $extra['sources'] = array_slice(array_values(array_unique($src, SORT_REGULAR)), 0, 40); $stats['sources'] = ($stats['sources'] ?? 0) + count($extra['sources']); }

        // occupations, titles, education, residences
        $occ = array_filter(array_map(fn($o) => trim($o['value']), ft_gedcom_all($r, 'OCCU')));
        if ($occ) $bio[] = 'Occupation: ' . implode(', ', array_slice(array_unique($occ), 0, 3)) . '.';
        $titl = array_filter(array_map(fn($o) => trim($o['value']), ft_gedcom_all($r, 'TITL')));
        if ($titl) $bio[] = 'Title: ' . implode(', ', array_slice(array_unique($titl), 0, 2)) . '.';
        $resi = ft_gedcom_all($r, 'RESI');
        $current = null;
        if ($resi) { $last = end($resi); $current = ft_gedcom_first($last, 'PLAC')['value'] ?? (trim($last['value']) ?: null); }
        // notes: inline, or a pointer to a NOTE record
        foreach (ft_gedcom_all($r, 'NOTE') as $nn) {
            $t = preg_match('/^@[^@]+@$/', trim($nn['value'])) ? ($notes[trim($nn['value'])] ?? '') : ft_gedcom_text($nn);
            if ($t !== '') { $bio[] = $t; $stats['notes']++; }
        }
        // photos: only ones online (a file path on someone's computer is no use here)
        $img = null;
        foreach (ft_gedcom_all($r, 'OBJE') as $o) {
            $obj = preg_match('/^@[^@]+@$/', trim($o['value'])) ? ($records[trim($o['value'])] ?? null) : $o;
            if (!$obj) continue;
            foreach (ft_gedcom_all($obj, 'FILE') as $f) {
                $url = trim($f['value']);
                if (!preg_match('~^https?://~i', $url)) continue;
                $title = ft_gedcom_first($obj, 'TITL')['value'] ?? (ft_gedcom_first($f, 'TITL')['value'] ?? null);
                $media[] = ['id' => count($media) + 1, 'url' => $url, 'type' => 'image', 'title' => $title ?: $name, 'description' => null, 'member_ids' => [$id[$x]], 'created_at' => $bd ? "$bd 12:00:00" : date('Y-m-d H:i:s')];
                $img ??= $url; $stats['photos']++;
            }
        }
        $dead = $hasDeat || ($by !== null && $by < $thisYear - 110);
        $wiki = trim(implode(' ', $bio));
        $members[$x] = [
            'id' => $id[$x], 'name' => $name !== '' ? $name : 'Unknown', 'nickname' => $nick ?: null,
            'gender' => $sex === 'M' ? 'male' : ($sex === 'F' ? 'female' : null),
            'birth_date' => $bd, 'birth_location' => $bp, 'death_date' => $dd, 'death_location' => $dp,
            'is_alive' => $dead ? 0 : 1, 'fid' => null, 'mid' => null, 'pids' => [], 'anniversary_date' => null,
            'img' => $img, 'current_location' => $dead ? null : $current, 'insta_url' => null, 'fb_url' => null,
            'wiki' => $wiki !== '' ? mb_substr($wiki, 0, 750) : null, 'is_private' => 0, 'privacy_override' => 0, 'extra' => $extra,
        ];
    }

    // families: parents of each child (the first family a child belongs to), and couples
    $parentOf = [];
    foreach ($fams as $f) {
        $h = trim(ft_gedcom_first($f, 'HUSB')['value'] ?? ''); $w = trim(ft_gedcom_first($f, 'WIFE')['value'] ?? '');
        $h = isset($members[$h]) ? $h : null; $w = isset($members[$w]) ? $w : null;
        if ($h && $w) {
            $members[$h]['pids'][] = $id[$w]; $members[$w]['pids'][] = $id[$h];
            $marr = ft_gedcom_first($f, 'MARR'); $div = ft_gedcom_first($f, 'DIV');
            $p = [];
            if ($marr) {
                [$md] = ft_gedcom_date(ft_gedcom_first($marr, 'DATE')['value'] ?? null);
                if ($md) { $members[$h]['anniversary_date'] ??= $md; $members[$w]['anniversary_date'] ??= $md; $p['married'] = $md; }
                foreach ($cite($marr, 'marriage') as $c) { $members[$h]['extra']['sources'][] = $c; $members[$w]['extra']['sources'][] = $c; }
            }
            if ($div) { [$dvd] = ft_gedcom_date(ft_gedcom_first($div, 'DATE')['value'] ?? null); $p['end'] = 'divorce'; if ($dvd) $p['ended'] = $dvd; }
            if ($p) { $members[$h]['extra']['partners'][(string)$id[$w]] = $p; $members[$w]['extra']['partners'][(string)$id[$h]] = $p; }
        }
        foreach (ft_gedcom_all($f, 'CHIL') as $c) {
            $c = trim($c['value']);
            if (!isset($members[$c]) || isset($parentOf[$c])) continue;
            $parentOf[$c] = true;
            if ($h) $members[$c]['fid'] = $id[$h];
            if ($w) $members[$c]['mid'] = $id[$w];
            // FAMC ... PEDI adopted / foster / step: how the child belongs to this family
            foreach (ft_gedcom_all($indis[$c], 'FAMC') as $fc) {
                if (trim($fc['value']) !== ($f['xref'] ?? '')) continue;
                $kind = ['ADOPTED' => 'adoptive', 'FOSTER' => 'foster', 'STEP' => 'step'][strtoupper(trim(ft_gedcom_first($fc, 'PEDI')['value'] ?? ''))] ?? null;
                if ($kind) { if ($h) $members[$c]['extra']['father_kind'] = $kind; if ($w) $members[$c]['extra']['mother_kind'] = $kind; }
            }
        }
    }
    foreach ($members as &$m) $m['pids'] = array_values(array_unique($m['pids']));
    unset($m);
    $stats['places'] = count($places);
    if ($stats['photos'] === 0) $warnings[] = 'Photos are not carried in GEDCOM files unless they are online links; add pictures in Photos after importing.';
    $orphans = count(array_filter($members, fn($m) => !$m['fid'] && !$m['mid'] && !$m['pids']));
    if ($orphans > 0 && $orphans < count($members)) $warnings[] = "$orphans people have no recorded parent or partner in the file and will stand on their own.";
    $stats['warnings'] = $warnings;
    return ['members' => array_values($members), 'media' => $media, 'stats' => $stats];
}

/** FamilyTree's own JSON: {members, media} (familytree/1, a full backup) or a plain list of members (the Members page export) */
function ft_json_read(string $raw): array {
    $d = json_decode(ft_gedcom_utf8($raw), true);
    if (!is_array($d)) throw new RuntimeException('This JSON file could not be read.');
    $members = isset($d['members']) ? $d['members'] : (array_is_list($d) ? $d : null);
    if (!is_array($members) || !$members) throw new RuntimeException('No people found in this JSON file.');
    $media = is_array($d['media'] ?? null) ? $d['media'] : [];
    $out = [];
    foreach ($members as $m) {
        if (!isset($m['id'], $m['name'])) throw new RuntimeException('Every person needs an id and a name.');
        $row = ['id' => (int)$m['id']];
        foreach (FT_MEMBER_COLS as $c) $row[$c] = $m[$c] ?? null;
        $row['pids'] = ft_pids($m['pids'] ?? null);
        $out[] = $row;
    }
    $stats = ['people' => count($out), 'families' => null, 'exact_births' => count(array_filter($out, fn($m) => !empty($m['birth_date']))),
              'places' => count(array_unique(array_filter(array_column($out, 'birth_location')))), 'notes' => 0, 'photos' => count($media), 'approximate_dates' => 0, 'warnings' => []];
    return ['members' => $out, 'media' => $media, 'stats' => $stats, 'family_events' => is_array($d['family_events'] ?? null) ? $d['family_events'] : []];
}
