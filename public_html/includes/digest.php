<?php
/**
 * includes/digest.php - the weekly email: birthdays, anniversaries, remembrance days and tithi days
 * in the coming week, for everyone with an account on a tree (turned off per person on Profile,
 * or with the link in the email).
 */
require_once __DIR__ . '/panchang.php';
require_once __DIR__ . '/events.php';

/** what happens in [$from, $from + $days) for one tree: [['date' => 'Y-m-d', 'kind' => ..., 'text' => ...], ...]
 *  $custom: the tree's family events (ft_family_events) */
function ft_week_events(array $members, array $settings, string $from, int $days = 7, array $custom = []): array {
    $start = new DateTimeImmutable($from); $end = $start->modify("+$days days");
    $byId = array_column($members, null, 'id');
    $out = [];
    $within = function (int $m, int $d) use ($start, $end): ?DateTimeImmutable {
        foreach ([(int)$start->format('Y'), (int)$start->format('Y') + 1] as $y) {
            if (!checkdate($m, $d, $y)) continue;
            $x = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $y, $m, $d));
            if ($x >= $start && $x < $end) return $x;
        }
        return null;
    };
    $ymd = fn($s) => is_string($s) && preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $x) ? [(int)$x[1], (int)$x[2], (int)$x[3]] : null;
    $first = fn($n) => explode(' ', trim((string)$n))[0];
    $seenCouple = [];
    foreach ($members as $m) {
        $alive = (int)($m['is_alive'] ?? 1) === 1;
        if ($b = $ymd($m['birth_date'] ?? null)) if ($d = $within($b[1], $b[2])) {
            $age = (int)$d->format('Y') - $b[0];
            $out[] = ['date' => $d->format('Y-m-d'), 'kind' => 'birthday', 'text' => $alive ? "{$m['name']} turns $age" : "{$m['name']} would have been $age"];
        }
        if (!$alive && ($x = $ymd($m['death_date'] ?? null))) if ($d = $within($x[1], $x[2])) {
            $yrs = (int)$d->format('Y') - $x[0];
            $out[] = ['date' => $d->format('Y-m-d'), 'kind' => 'remembrance', 'text' => "Remembering {$m['name']}, $yrs year" . ($yrs === 1 ? '' : 's') . ' since they passed'];
        }
        // anniversaries: the wedding date of each partnership that hasn't ended (or the old single field)
        $extra = ft_extra($m['extra'] ?? null);
        $partners = $extra['partners'] ?? [];
        foreach (ft_pids($m['pids'] ?? []) as $pid) {
            $key = min($m['id'], $pid) . '-' . max($m['id'], $pid);
            if (isset($seenCouple[$key]) || !isset($byId[$pid])) continue;
            $p = $partners[(string)$pid] ?? null;
            if ($p && !empty($p['end'])) continue;
            $date = $p['married'] ?? ($m['anniversary_date'] ?? null);
            if (!($a = $ymd($date)) || !($d = $within($a[1], $a[2]))) continue;
            $seenCouple[$key] = true;
            $yrs = (int)$d->format('Y') - $a[0];
            $out[] = ['date' => $d->format('Y-m-d'), 'kind' => 'anniversary', 'text' => "{$first($m['name'])} and {$first($byId[$pid]['name'])}: $yrs year" . ($yrs === 1 ? '' : 's') . ' married'];
        }
        // tithi days: typed by hand, or from the death date when the tree shows Hindu dates
        $auto = array_key_exists('hindu_calendar', $settings) ? (bool)$settings['hindu_calendar'] : empty($settings['demo']);
        $tithis = [];
        if (!empty($extra['death_tithi'])) $tithis[] = ['shraddh', $extra['death_tithi']];
        elseif ($auto && !$alive && $ymd($m['death_date'] ?? null)) {
            try { $t = Panchang::tithiOf(substr($m['death_date'], 0, 10)); $tithis[] = ['shraddh', ['m' => $t['masa'], 'p' => $t['paksha'], 't' => $t['tithi']]]; } catch (Throwable $e) {}
        }
        if (!empty($extra['birth_tithi'])) $tithis[] = ['tithi birthday', $extra['birth_tithi']];
        foreach ($tithis as [$what, $t]) {
            try { $next = Panchang::nextTithiDate((int)$t['m'], (string)$t['p'], (int)$t['t'], $start->format('Y-m-d')); } catch (Throwable $e) { $next = null; }
            if (!$next || new DateTimeImmutable($next) >= $end) continue;
            $label = Panchang::MASA_NAMES[$t['m'] - 1] . ' ' . ($t['p'] === 'S' ? 'Shukla' : 'Krishna') . ' ' . ((int)$t['t'] === 15 ? ($t['p'] === 'S' ? 'Purnima' : 'Amavasya') : Panchang::TITHI_NAMES[$t['t'] - 1]);
            $out[] = ['date' => $next, 'kind' => 'tithi', 'text' => ($what === 'shraddh' ? "Shraddh of {$m['name']}" : "{$m['name']}'s birthday by tithi") . " ($label)"];
        }
    }
    // family events: yearly ones by month and day, one-off ones on their own date
    foreach ($custom as $e) {
        if (!preg_match('/^(\d{4}|-)-(\d{2})-(\d{2})$/', $e['date'] ?? '', $x)) continue;
        if ($e['yearly']) $d = $within((int)$x[2], (int)$x[3]);
        else { $d = new DateTimeImmutable($e['date']); if ($d < $start || $d >= $end) $d = null; }
        if (!$d) continue;
        $who = array_values(array_filter(array_map(fn($id) => isset($byId[$id]) ? $first($byId[$id]['name']) : null, $e['people'] ?? [])));
        $yrs = $e['yearly'] && $x[1] !== '-' ? (int)$d->format('Y') - (int)$x[1] : 0;
        $text = $e['title'] . ($yrs > 0 ? " ($yrs year" . ($yrs === 1 ? '' : 's') . ')' : '') . ($who ? ' · ' . implode(', ', array_slice($who, 0, 4)) . (count($who) > 4 ? ' and others' : '') : '')
              . (($e['place'] ?? '') !== '' ? ' · ' . $e['place'] : '');
        $out[] = ['date' => $d->format('Y-m-d'), 'kind' => 'event:' . $e['kind'], 'text' => $text];
    }
    usort($out, fn($a, $b) => strcmp($a['date'], $b['date']) ?: strcmp($a['text'], $b['text']));
    return $out;
}

/** the email for one person and one tree */
function ft_digest_html(string $treeName, string $treeUrl, array $events, string $unsubUrl): string {
    $h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $dot = ['birthday' => '#4d7c0f', 'anniversary' => '#c26d8c', 'remembrance' => '#8a7f68', 'tithi' => '#a16207',
            'event:celebration' => '#c2410c', 'event:remembrance' => '#6b5b95', 'event:milestone' => '#0f766e', 'event:gathering' => '#1d4ed8', 'event:other' => '#a16207'];
    $rows = '';
    foreach ($events as $e) {
        $day = (new DateTimeImmutable($e['date']))->format('D j M');
        $rows .= '<tr><td style="padding:8px 12px 8px 0;color:#8a7f68;white-space:nowrap;vertical-align:top">' . $day . '</td><td style="padding:8px 0;font-size:15px">'
               . '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:' . ($dot[$e['kind']] ?? '#a16207') . '"></span>' . $h($e['text']) . '</td></tr>';
    }
    return '<div style="font-family:Georgia,serif;background:#fbf8f2;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fffdf6;border:1px solid #e6dcc4;border-radius:14px;padding:24px">'
        . '<div style="font:700 12px Arial,sans-serif;letter-spacing:.2em;color:#a16207;text-transform:uppercase">This week in the family</div>'
        . '<h1 style="font-size:24px;margin:8px 0 16px;color:#261f16">' . $h($treeName) . '</h1>'
        . '<table style="border-collapse:collapse;font-family:Arial,sans-serif;color:#261f16">' . $rows . '</table>'
        . '<p style="margin:20px 0 0"><a href="' . $h($treeUrl) . '" style="background:#a16207;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px">Open the family tree</a></p>'
        . '<p style="font:12px Arial,sans-serif;color:#8a7f68;margin:24px 0 0">You get this because you have an account on this tree. <a href="' . $h($unsubUrl) . '" style="color:#8a7f68">Stop these emails</a>.</p>'
        . '</div></div>';
}

/** a link that turns the email off without signing in */
function ft_unsub_token(int $uid): string { return substr(hash_hmac('sha256', 'digest-off:' . $uid, ft_app_key()), 0, 32); }
