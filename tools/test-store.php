<?php
/**
 * tools/test-store.php - the store layer's one check.
 *
 *   php tools/test-store.php        (needs pdo_sqlite)
 *
 * Two trees share one database. The second is imported with member and media ids
 * the first already uses, so the import must give them new ids and rewrite every
 * link (father, mother, spouses, photo tags). A JSON home must keep ids as they are.
 */
$root = dirname(__DIR__) . '/public_html';
putenv('FT_STORAGE_DIR=' . sys_get_temp_dir() . '/ft-test-' . getmypid());
require $root . '/includes/db.php';
require $root . '/includes/store.php';
require $root . '/includes/stores/json.php';

$pdo = ft_connect(['driver' => 'sqlite', 'file' => ':memory:']);
ft_run_sql_file($pdo, $root . '/install/schema-sqlite.sql');

$tree = fn() => [
    [['id' => 1, 'name' => 'Father', 'pids' => [2]], ['id' => 2, 'name' => 'Mother', 'pids' => [1]], ['id' => 3, 'name' => 'Child', 'fid' => 1, 'mid' => 2]],
    [['id' => 1, 'url' => '/x.jpg', 'title' => 'Wedding', 'member_ids' => [1, 2]]],
];
[$m, $x] = $tree();

$a = new PdoFamilyStore($pdo, 'tree-a', 'here');
$mapA = $a->importAll($m, $x);
assert($mapA === [1 => 1, 2 => 2, 3 => 3], 'free ids are kept');

$b = new PdoFamilyStore($pdo, 'tree-b', 'here');
$mapB = $b->importAll($m, $x);
assert(count(array_unique($mapB)) === 3 && !array_intersect($mapB, [1, 2, 3]), 'taken ids are replaced');
$byName = []; foreach ($b->members() as $p) $byName[$p['name']] = $p;
assert($byName['Child']['fid'] === $byName['Father']['id'] && $byName['Child']['mid'] === $byName['Mother']['id'], 'parents relinked');
assert($byName['Father']['pids'] === [$byName['Mother']['id']], 'spouse relinked');
$photo = $b->media()[0];
sort($photo['member_ids']);
assert($photo['member_ids'] === [$byName['Father']['id'], $byName['Mother']['id']], 'photo tags relinked');
assert(count($a->members()) === 3 && $a->members()[2]['fid'] === 1, 'the first tree is untouched');

$j = new JsonFamilyStore(['type' => 'json', 'file' => ft_storage_dir() . '/t.json'], 'tree-c');
assert($j->importAll($m, $x) === [1 => 1, 2 => 2, 3 => 3], 'a JSON home keeps ids');
assert($j->members()[2]['fid'] === 1, 'JSON links intact');

echo "store: ok\n";
