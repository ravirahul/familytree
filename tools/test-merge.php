<?php
/**
 * tools/test-merge.php - duplicates are found, and merging moves every link to the kept person.
 *   php tools/test-merge.php      (needs pdo_sqlite)
 */
$root = dirname(__DIR__) . '/public_html';
putenv('FT_STORAGE_DIR=' . sys_get_temp_dir() . '/ft-test-' . getmypid());
require $root . '/includes/db.php';
require $root . '/includes/store.php';
require $root . '/includes/merge.php';

$pdo = ft_connect(['driver' => 'sqlite', 'file' => ':memory:']);
ft_run_sql_file($pdo, $root . '/install/schema-sqlite.sql');
$s = new HistoryFamilyStore(new PdoFamilyStore($pdo, 'tree-m', 'here'), $pdo, 'tree-m');

// a tree, then the same grandfather added again by a second import, with a child hanging off the copy
$dada  = $s->insertMember(['name' => 'Ram Prasad Sharma', 'gender' => 'male', 'birth_date' => '1932-04-01']);
$dadi  = $s->insertMember(['name' => 'Sita Devi', 'gender' => 'female', 'pids' => [$dada]]);
$s->patchMember($dada, ['pids' => [$dadi]]);
$papa  = $s->insertMember(['name' => 'Mohan Sharma', 'gender' => 'male', 'fid' => $dada, 'mid' => $dadi]);
$copy  = $s->insertMember(['name' => 'Late Shri Ram Prasad Sharma', 'gender' => 'male', 'birth_date' => '1932-04-01', 'birth_location' => 'Patna', 'wiki' => 'Taught at the village school.',
    'extra' => ['sources' => [['fact' => 'birth', 'title' => 'Family register']], 'gotra' => 'Kashyap']]);
$chacha = $s->insertMember(['name' => 'Shyam Sharma', 'gender' => 'male', 'fid' => $copy]);
$other = $s->insertMember(['name' => 'Ram Prasad Sharma', 'gender' => 'male', 'birth_date' => '1990-01-01']);   // a namesake, born much later
$pdo->exec("INSERT INTO family_media (tenant_id, url, title) VALUES ('tree-m', '/x.jpg', 'Old photo')");
$mediaId = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO family_media_tags (tenant_id, media_id, member_id) VALUES ('tree-m', $mediaId, $copy)");

$dups = ft_duplicates($s->members());
assert(count($dups) === 1, 'one likely pair, the namesake is not suggested: ' . json_encode($dups));
assert(in_array($dada, $dups[0], true) && in_array($copy, $dups[0], true) && $dups[0][2] >= 80, 'the copy is found with a high score');
assert(ft_name_key('Late Shri Ram-Prasad  Sharma') === 'ram prasad sharma', 'titles and punctuation ignored');

$r = ft_merge_members($pdo, 'tree-m', $s, $dada, $copy, ['birth_location' => 'drop']);
$k = $s->member($dada);
assert($s->member($copy) === null, 'the copy is gone');
assert($k['birth_location'] === 'Patna' && $k['wiki'] === 'Taught at the village school.', 'empty fields filled from the copy');
assert($k['extra']['gotra'] === 'Kashyap' && count($k['extra']['sources']) === 1, 'extra details carried over');
assert($k['pids'] === [$dadi], 'partner kept');
assert($s->member($chacha)['fid'] === $dada, "the copy's child now hangs off the kept grandfather");
assert($s->member($papa)['fid'] === $dada, 'existing child untouched');
assert(in_array($dada, $s->mediaItem($mediaId)['member_ids'], true), 'photo tag moved');

// one undo puts it all back
ft_undo_batch($pdo, 'tree-m', $s, $r['batch']);
assert($s->member($copy) !== null && $s->member($chacha)['fid'] === $copy, 'undo restores the copy and its child');
assert($s->member($dada)['birth_location'] === null, 'undo restores the kept person');
echo "merge: ok\n";
