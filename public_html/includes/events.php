<?php
/**
 * includes/events.php - family events: dates the family adds by hand (a puja every Diwali, a reunion,
 * a wedding), shown beside the birthdays. They live in our own database (family_events), whatever the
 * tree's data home is; `people` holds member ids of the tree.
 *
 * date: YYYY-MM-DD, or --MM-DD for a yearly date whose year is not known.
 */
const FT_EVENT_KINDS = ['celebration', 'remembrance', 'milestone', 'gathering', 'other'];

/** a tree's family events, oldest first ([] before the upgrade has been run) */
function ft_family_events(PDO $pdo, string $tid): array {
    try {
        $st = $pdo->prepare("SELECT id, title, kind, event_date, yearly, people, place, note FROM family_events WHERE tenant_id = ? ORDER BY event_date, id");
        $st->execute([$tid]);
    } catch (PDOException $e) { error_log('family_events: ' . $e->getMessage()); return []; }
    return array_map('ft_event_shape', $st->fetchAll(PDO::FETCH_ASSOC));
}

function ft_event_shape(array $r): array {
    $p = json_decode((string)($r['people'] ?? ''), true);
    return ['id' => (int)$r['id'], 'title' => (string)$r['title'], 'kind' => (string)$r['kind'], 'date' => (string)$r['event_date'],
            'yearly' => (bool)(int)$r['yearly'], 'people' => is_array($p) ? array_values(array_map('intval', $p)) : [],
            'place' => (string)($r['place'] ?? ''), 'note' => (string)($r['note'] ?? '')];
}

/**
 * checks one event from the form or a backup against the tree's member ids.
 * returns [row for the table, null] or [null, ['field' => ..., 'error' => plain message]]
 */
function ft_event_clean(array $in, array $memberIds): array {
    $bad = fn(string $field, string $msg) => [null, ['field' => $field, 'error' => $msg]];
    $title = trim(preg_replace('/\s+/u', ' ', (string)($in['title'] ?? '')));
    if ($title === '') return $bad('title', 'Give the event a name.');
    if (mb_strlen($title) > 120) return $bad('title', 'Keep the name under 120 letters.');
    $kind = (string)($in['kind'] ?? 'other');
    if (!in_array($kind, FT_EVENT_KINDS, true)) return $bad('kind', 'Choose what kind of event this is.');
    $yearly = !empty($in['yearly']) ? 1 : 0;
    $date = trim((string)($in['date'] ?? ''));
    if (!preg_match('/^(\d{4}|-)-(\d{2})-(\d{2})$/', $date, $d)) return $bad('date', 'Choose a date.');
    $noYear = $d[1] === '-';
    if (!checkdate((int)$d[2], (int)$d[3], $noYear ? 2000 : (int)$d[1]) || (!$noYear && ((int)$d[1] < 1000 || (int)$d[1] > 2200))) return $bad('date', 'That date does not exist.');
    if ($noYear && !$yearly) return $bad('date', 'A date without a year has to repeat every year.');
    if (!is_array($in['people'] ?? [])) return $bad('people', 'Choose people from the family.');
    $people = array_values(array_unique(array_map('intval', $in['people'] ?? [])));
    if (count($people) > 50) return $bad('people', 'Choose at most 50 people.');
    $known = array_flip(array_map('intval', $memberIds));
    foreach ($people as $p) if (!isset($known[$p])) return $bad('people', 'Someone you chose is not in this tree any more. Choose again.');
    $place = trim((string)($in['place'] ?? ''));
    if (mb_strlen($place) > 255) return $bad('place', 'Keep the place under 255 letters.');
    $note = trim((string)($in['note'] ?? ''));
    if (mb_strlen($note) > 2000) return $bad('note', 'Keep the note under 2000 letters.');
    return [['title' => $title, 'kind' => $kind, 'event_date' => $date, 'yearly' => $yearly, 'people' => $people ? json_encode($people) : null,
             'place' => $place !== '' ? $place : null, 'note' => $note !== '' ? $note : null], null];
}

function ft_event_insert(PDO $pdo, string $tid, array $row, ?int $by): int {
    $pdo->prepare("INSERT INTO family_events (tenant_id, title, kind, event_date, yearly, people, place, note, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$tid, $row['title'], $row['kind'], $row['event_date'], $row['yearly'], $row['people'], $row['place'], $row['note'], $by, date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
    return (int)$pdo->lastInsertId();
}

/**
 * after an import: $map turns the file's (and, for add, the tree's old) person ids into the tree's new ids.
 * replace: the tree's events become the file's. add: the tree keeps its events (people re-pointed) and gets the file's too.
 * $shift moves the file's ids first, the way the add import does. Returns how many events came in.
 */
function ft_events_restore(PDO $pdo, string $tid, array $events, array $map, bool $replace, int $shift = 0): int {
    try {
        if ($replace) $pdo->prepare("DELETE FROM family_events WHERE tenant_id = ?")->execute([$tid]);
        else foreach (ft_family_events($pdo, $tid) as $e) {
            $p = array_values(array_filter(array_map(fn($x) => $map[$x] ?? null, $e['people'])));
            if ($p !== $e['people']) $pdo->prepare("UPDATE family_events SET people = ? WHERE id = ? AND tenant_id = ?")->execute([$p ? json_encode($p) : null, $e['id'], $tid]);
        }
        $ids = array_values($map); $n = 0;
        foreach ($events as $e) {
            if (!is_array($e)) continue;
            $e['people'] = array_values(array_filter(array_map(fn($x) => $map[(int)$x + $shift] ?? null, is_array($e['people'] ?? null) ? $e['people'] : [])));
            [$row] = ft_event_clean($e, $ids);
            if ($row) { ft_event_insert($pdo, $tid, $row, null); $n++; }
        }
        return $n;
    } catch (PDOException $e) { error_log('family_events restore: ' . $e->getMessage()); return 0; }
}
