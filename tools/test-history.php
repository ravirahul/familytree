<?php
/**
 * tools/test-history.php - history, undo and the bin, plus the extra column.
 *
 *   php tools/test-history.php      (needs pdo_sqlite)
 *
 * Deleting a parent the way the admin does (unlink children and partner, then delete) is one
 * batch; undoing it must bring the person back with the same id and every link restored.
 */
$root = dirname(__DIR__) . '/public_html';
putenv('FT_STORAGE_DIR=' . sys_get_temp_dir() . '/ft-test-' . getmypid());
require $root . '/includes/db.php';
require $root . '/includes/store.php';
require $root . '/includes/stores/json.php';

$pdo = ft_connect(['driver' => 'sqlite', 'file' => ':memory:']);
ft_run_sql_file($pdo, $root . '/install/schema-sqlite.sql');
ft_actor(['id' => 7, 'name' => 'Tester']);

foreach (['sql' => new PdoFamilyStore($pdo, 'tree-h', 'here'), 'json' => new JsonFamilyStore(['type' => 'json', 'file' => ft_storage_dir() . '/h.json'], 'tree-j')] as $kind => $inner) {
    $tid = $kind === 'sql' ? 'tree-h' : 'tree-j';
    $s = new HistoryFamilyStore($inner, $pdo, $tid);

    // extra round-trips, empty values are dropped
    ft_batch('b-create-' . $kind);
    $dad = $s->insertMember(['name' => 'Dad', 'extra' => ['name_local' => 'पिता', 'gotra' => 'Kashyap', 'native_place' => '', 'sources' => [['fact' => 'birth', 'title' => 'School certificate']]]]);
    $mum = $s->insertMember(['name' => 'Mum', 'pids' => [$dad]]);
    $s->patchMember($dad, ['pids' => [$mum]]);
    $kid = $s->insertMember(['name' => 'Kid', 'fid' => $dad, 'mid' => $mum, 'extra' => ['birth_approx' => ['q' => 'abt', 'y' => 1990]]]);
    $d = $s->member($dad);
    assert($d['extra']['name_local'] === 'पिता' && $d['extra']['gotra'] === 'Kashyap', "$kind: extra kept");
    assert(!isset($d['extra']['native_place']), "$kind: empty extra values dropped");
    assert($s->member($kid)['extra']['birth_approx']['y'] === 1990, "$kind: nested extra kept");

    // delete Dad the way admin-api does: unlink, then delete (one batch)
    ft_batch('b-delete-' . $kind);
    $s->patchMember($kid, ['fid' => null]);
    $s->patchMember($mum, ['pids' => []]);
    $s->deleteMember($dad);
    assert($s->member($dad) === null, "$kind: deleted");
    $bin = ft_bin($pdo, $tid, $s);
    assert(count($bin) === 1 && $bin[0]['member_id'] === $dad && $bin[0]['deleted_by'] === 'Tester', "$kind: in the bin");

    $n = ft_undo_batch($pdo, $tid, $s, 'b-delete-' . $kind);
    assert($n === 3, "$kind: three changes reverted, got $n");
    $back = $s->member($dad);
    assert($back && $back['name'] === 'Dad' && $back['extra']['gotra'] === 'Kashyap', "$kind: restored with the same id and details");
    assert($s->member($kid)['fid'] === $dad, "$kind: child relinked");
    assert($s->member($mum)['pids'] === [$dad], "$kind: partner relinked");
    assert(ft_bin($pdo, $tid, $s) === [], "$kind: bin empty after restore");

    // history lists changes with field diffs; an edit with no change isn't logged
    $before = count(ft_history($pdo, $tid));
    $s->patchMember($kid, ['name' => 'Kid']);
    assert(count(ft_history($pdo, $tid)) === $before, "$kind: no-op edit not logged");
    $s->patchMember($kid, ['name' => 'Kiddo']);
    $h = ft_history($pdo, $tid, $kid)[0];
    assert($h['action'] === 'update' && $h['changes']['name'] === ['Kid', 'Kiddo'], "$kind: diff recorded");
    try { ft_undo_batch($pdo, $tid, $s, 'b-delete-' . $kind); assert(false, 'undoing twice must fail'); } catch (RuntimeException $e) {}
}
echo "history: ok\n";
