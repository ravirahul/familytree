<?php
/**
 * tools/test-account-delete.php - deleting an account must remove exactly what it should.
 *
 *   php tools/test-account-delete.php        (needs pdo_sqlite)
 *
 * Asha owns "alpha" and "beta"; Bina is an editor of both and owns "gamma", where Asha is a co-owner.
 * Asha also edits a demo tree nobody owns. Asha deletes her account: alpha goes to Bina, beta is deleted.
 */
$root = dirname(__DIR__) . '/public_html';
$tmp = sys_get_temp_dir() . '/ft-del-test-' . getmypid();
@mkdir("$tmp/uploads", 0777, true);
putenv("FT_STORAGE_DIR=$tmp");
putenv("FT_UPLOADS_DIR=$tmp/uploads");
require $root . '/includes/db.php';
require $root . '/includes/store.php';
require $root . '/includes/account-delete.php';

$pdo = ft_connect(['driver' => 'sqlite', 'file' => "$tmp/ft.sqlite"]);
ft_run_sql_file($pdo, $root . '/install/schema-sqlite.sql');
$q = fn(string $sql, array $a = []) => (function () use ($pdo, $sql, $a) { $s = $pdo->prepare($sql); $s->execute($a); return $s; })();
$n = fn(string $sql, array $a = []) => (int)$q($sql, $a)->fetchColumn();

// accounts (as verify-email.php / users-api.php make them)
$user = function (string $email, string $name, string $tid) use ($q, $pdo): int {
    $q("INSERT INTO family_users (email, password_hash, display_name, role, tenant_id) VALUES (?, ?, ?, 'owner', ?)", [$email, password_hash('pw', PASSWORD_DEFAULT), $name, $tid]);
    return (int)$pdo->lastInsertId();
};
$tree = function (string $tid, string $slug, ?int $owner, array $settings = []) use ($q): array {
    $q("INSERT INTO tenants (id, slug, display_name, owner_user_id, settings) VALUES (?, ?, ?, ?, ?)", [$tid, $slug, ucfirst($slug), $owner, json_encode($settings)]);
    return ['id' => $tid, 'slug' => $slug];
};
$asha = $user('asha@example.test', 'Asha', 'T-alpha');
$bina = $user('bina@example.test', 'Bina', 'T-gamma');
$alpha = $tree('T-alpha', 'alpha', $asha);
$beta  = $tree('T-beta', 'beta', $asha);
$gamma = $tree('T-gamma', 'gamma', $bina);
$demo  = $tree('T-demo', 'demo', null, ['demo' => true, 'featured' => true]);
foreach ([['T-alpha', $asha, 'owner'], ['T-beta', $asha, 'owner'], ['T-alpha', $bina, 'editor'], ['T-beta', $bina, 'viewer'],
          ['T-gamma', $bina, 'owner'], ['T-gamma', $asha, 'owner'], ['T-demo', $asha, 'editor']] as [$t, $u, $r])
    $q("INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, ?)", [$t, $u, $r]);

// family data, photos on disk (one shared with gamma), keys, logs, settings
ft_actor(['id' => $asha, 'name' => 'Asha']);
file_put_contents("$tmp/uploads/beta.jpg", 'x'); file_put_contents("$tmp/uploads/thumb_beta.webp", 'x');
file_put_contents("$tmp/uploads/shared.jpg", 'x'); file_put_contents("$tmp/uploads/gamma.jpg", 'x'); file_put_contents("$tmp/uploads/alpha.jpg", 'x');
foreach ([$alpha, $beta, $gamma, $demo] as $t) {
    $s = ft_store($pdo, $t);
    $id = $s->insertMember(['name' => "Grandma of {$t['slug']}", 'img' => "/admin/uploads/{$t['slug']}.jpg"]);
    $s->insertMedia(['url' => $t['slug'] === 'alpha' ? '/admin/uploads/alpha.jpg' : '/admin/uploads/shared.jpg'], [$id]);
    $q("INSERT INTO privacy_settings (tenant_id, field_key, visibility) VALUES (?, 'birth_date', 'private')", [$t['id']]);
    $q("INSERT INTO family_activity_logs (tenant_id, user_id, action, ip_address) VALUES (?, ?, 'edit', '10.0.0.1')", [$t['id'], $asha]);
}
$q("INSERT INTO api_keys (user_id, key_hash) VALUES (?, ?)", [$asha, str_repeat('a', 64)]);
$q("INSERT INTO api_keys (user_id, key_hash) VALUES (?, ?)", [$bina, str_repeat('b', 64)]);

// what the account page is offered
$plan = []; foreach (ft_owned_trees($pdo, $asha) as $t) $plan[$t['slug']] = $t;
assert(array_keys($plan) === ['alpha', 'beta', 'gamma'], 'owned trees: alpha, beta, gamma');
assert($plan['alpha']['needs_choice'] && $plan['beta']['needs_choice'], 'alpha and beta need a choice');
assert(!$plan['gamma']['needs_choice'], 'gamma has another owner: no choice');
assert(array_column($plan['alpha']['candidates'], 'id') === [$bina], 'Bina can take alpha');
assert($plan['beta']['candidates'] === [], 'a viewer cannot take a tree');

// bad choices change nothing
foreach ([[], ['T-alpha' => $bina], ['T-alpha' => $bina, 'T-beta' => $bina], ['T-alpha' => 999, 'T-beta' => 'delete']] as $bad) {
    try { ft_delete_account($pdo, $asha, $bad); assert(false, 'bad choices must throw'); } catch (InvalidArgumentException $e) {}
}
assert($n("SELECT COUNT(*) FROM tenants") === 4 && $n("SELECT COUNT(*) FROM family_users") === 2, 'nothing changed after refused choices');

// a co-owner cannot delete a tree someone else owns 
assert(!$plan['gamma']['main_owner'] && $plan['gamma']['other_owner'] === $bina, 'gamma is Bina-owned, not Asha-deletable');

$done = ft_delete_account($pdo, $asha, ['T-alpha' => $bina, 'T-beta' => 'delete']);
assert($done === ['deleted' => ['beta'], 'transferred' => ['alpha']], 'reported what happened');

// Asha is gone
assert($n("SELECT COUNT(*) FROM family_users WHERE id = ?", [$asha]) === 0, 'account row gone');
assert($n("SELECT COUNT(*) FROM tenant_users WHERE user_id = ?", [$asha]) === 0, 'memberships gone');
assert($n("SELECT COUNT(*) FROM api_keys WHERE user_id = ?", [$asha]) === 0, 'her keys gone');
assert($n("SELECT COUNT(*) FROM family_activity_logs WHERE user_id = ? OR ip_address IS NOT NULL", [$asha]) === 0, 'her log lines anonymised');
assert($n("SELECT COUNT(*) FROM member_history WHERE user_id = ?", [$asha]) === 0, 'her name is off the history');

// beta is gone, with everything in it
foreach (['tenants' => 'id', 'family_tree_data' => 'tenant_id', 'family_media' => 'tenant_id', 'family_media_tags' => 'tenant_id', 'privacy_settings' => 'tenant_id',
          'family_activity_logs' => 'tenant_id', 'tenant_users' => 'tenant_id', 'member_history' => 'tenant_id'] as $tbl => $col)
    assert($n("SELECT COUNT(*) FROM $tbl WHERE $col = 'T-beta'") === 0, "beta rows gone from $tbl");
assert(!is_file("$tmp/uploads/beta.jpg") && !is_file("$tmp/uploads/thumb_beta.webp"), 'beta photo and thumbnail deleted');
assert(is_file("$tmp/uploads/shared.jpg"), 'a photo another tree uses is kept');

// alpha now belongs to Bina, intact
assert($n("SELECT owner_user_id FROM tenants WHERE id = 'T-alpha'") === $bina, 'alpha owned by Bina');
assert($q("SELECT role FROM tenant_users WHERE tenant_id = 'T-alpha' AND user_id = ?", [$bina])->fetchColumn() === 'owner', 'Bina is owner of alpha');
assert(count(ft_store($pdo, $alpha)->members()) === 1 && is_file("$tmp/uploads/alpha.jpg"), 'alpha people and photos kept');

// Bina's tree, the demo tree and Bina's account are untouched
assert($n("SELECT owner_user_id FROM tenants WHERE id = 'T-gamma'") === $bina && count(ft_store($pdo, $gamma)->members()) === 1, 'gamma untouched');
assert($n("SELECT COUNT(*) FROM tenants WHERE id = 'T-demo'") === 1 && count(ft_store($pdo, $demo)->members()) === 1, 'demo tree untouched');
assert($n("SELECT COUNT(*) FROM api_keys WHERE user_id = ?", [$bina]) === 1, 'Bina\'s key kept');
assert($n("SELECT COUNT(*) FROM tenant_users WHERE user_id = ?", [$bina]) === 2, 'Bina keeps alpha and gamma (beta went)');

// a single tree delete: gamma by its owner
$r = ft_delete_tree($pdo, $gamma);
assert($n("SELECT COUNT(*) FROM tenants WHERE id = 'T-gamma'") === 0 && !$r['external_home'], 'gamma deleted');
assert(!is_file("$tmp/uploads/gamma.jpg"), 'gamma photo deleted');
assert($q("SELECT tenant_id FROM family_users WHERE id = ?", [$bina])->fetchColumn() === 'T-alpha', 'Bina\'s open tree moved to alpha');

array_map('unlink', glob("$tmp/uploads/*") ?: []);
echo "account delete: ok\n";
