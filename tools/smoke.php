<?php
/**
 * tools/smoke.php - install FamilyTree with SQLite into a temp dir, serve it, check the main pages.
 *
 *   php tools/smoke.php            (needs pdo_sqlite; exits 1 if any page is not 200)
 *
 * Nothing is written into public_html except what the app itself writes there at runtime
 * (caches go to the temp storage dir via FT_STORAGE_DIR, the .env via FT_ENV_FILE).
 */
$root = dirname(__DIR__);
$pub  = "$root/public_html";
$tmp  = sys_get_temp_dir() . '/ft-smoke-' . getmypid();
@mkdir("$tmp/storage", 0777, true);
$env  = "$tmp/.env";
$db   = "$tmp/storage/familytree.sqlite";
putenv("FT_ENV_FILE=$env");
putenv("FT_STORAGE_DIR=$tmp/storage");

// the installer's steps 2 and 3, without the forms
require "$pub/includes/db.php";
$pdo = ft_connect(['driver' => 'sqlite', 'file' => $db]);
ft_run_sql_file($pdo, ft_schema_file('sqlite'));
$tid = ft_uuid();
$pdo->prepare("INSERT INTO tenants (id, slug, display_name, is_active, visibility, created_at) VALUES (?, 'smoke', 'Smoke family', 1, 'public', NOW())")->execute([$tid]);
$pdo->prepare("INSERT INTO family_users (tenant_id, email, password_hash, display_name, role, created_at) VALUES (?, 'owner@example.test', ?, 'Owner', 'owner', NOW())")
    ->execute([$tid, password_hash('testpass123', PASSWORD_DEFAULT)]);
$pdo->prepare("UPDATE tenants SET owner_user_id = ? WHERE id = ?")->execute([(int)$pdo->lastInsertId(), $tid]);
$add = $pdo->prepare("INSERT INTO family_tree_data (tenant_id, name, gender, fid, pids, is_alive) VALUES (?, ?, ?, ?, NULL, 0)");
$add->execute([$tid, 'Ram Sharma', 'male', null]);
$add->execute([$tid, 'Shyam Sharma', 'male', (int)$pdo->lastInsertId()]);
$pdo = null;
$port = (int)(getenv('SMOKE_PORT') ?: 8799);
file_put_contents($env, "APP_ENV=production\nAPP_DOMAIN=127.0.0.1:$port\nAPP_URL=http://127.0.0.1:$port\nAPP_KEY=" . bin2hex(random_bytes(32))
    . "\nAPP_TENANT_ID=$tid\n\nDB_DRIVER=sqlite\nDB_FILE=$db\n");

$php = [PHP_BINARY];
if ($ini = php_ini_loaded_file()) array_push($php, '-c', $ini);

$srv = proc_open([...$php, '-S', "127.0.0.1:$port", '-t', $pub, "$root/tools/router.php"], [1 => ['file', "$tmp/server.log", 'a'], 2 => ['file', "$tmp/server.log", 'a']], $pipes, $pub,
    array_merge(getenv(), ['FT_ENV_FILE' => $env, 'FT_STORAGE_DIR' => "$tmp/storage"]));
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) usleep(100000);

$fail = 0;
foreach (['/', '/guide', '/admin/', '/tree/smoke', '/tree/smoke/events', '/tree/smoke/map', '/api-family.php?slug=smoke', '/install/'] as $path) {
    $body = @file_get_contents("http://127.0.0.1:$port$path", false, stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 20]]));
    $code = (int)(preg_match('~^HTTP/\S+ (\d+)~', $http_response_header[0] ?? '', $m) ? $m[1] : 0);
    $want = ['/install/' => 404, '/' => 302][$path] ?? 200;         // an installed app locks its installer; / opens the tree
    $ok = $code === $want && ($path !== '/api-family.php?slug=smoke' || count(json_decode($body, true)['members'] ?? json_decode($body, true) ?? []) > 0);
    printf("%-4s %3d  %s\n", $ok ? 'ok' : 'FAIL', $code, $path);
    if (!$ok) $fail++;
}
proc_terminate($srv);
if ($fail) { echo "--- server log\n", @file_get_contents("$tmp/server.log"); exit(1); }
echo "smoke: ok\n";
