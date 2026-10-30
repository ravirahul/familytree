<?php
/**
 * install/index.php - first-run installer.
 *
 * Three screens: checks -> database -> first account. Writes ../.env, creates the
 * tables and the owner's account and the family tree, then locks itself (../.env exists and
 * the tables are there => 404). Works for MySQL/MariaDB and SQLite. The desktop app
 * runs the same installer silently with SQLite.
 */
define('FT_APP', 1);
define('FT_INSTALLER', 1);
$root = dirname(__DIR__);
require_once $root . '/includes/db.php';
require_once $root . '/includes/brand.php';

$envFile  = getenv('FT_ENV_FILE') ?: ($root . '/.env');
$hasEnv   = file_exists($envFile);
$installed = false;
if ($hasEnv) {
    // already installed? (env + tenants table present)
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $l) { if ($l !== '' && $l[0] !== '#' && str_contains($l, '=')) { [$k, $v] = explode('=', $l, 2); putenv(trim($k) . '=' . trim($v)); } }
    try { $t = ft_connect(ft_db_config_from_env()); $t->query('SELECT 1 FROM tenants LIMIT 1'); $installed = true; } catch (Throwable $e) {}
}
if ($installed && empty($_GET['force'])) { http_response_code(404); echo 'FamilyTree is already installed. Remove .env to run the installer again.'; exit; }

session_start();
$step  = $_POST['step'] ?? ($_GET['step'] ?? '1');
$err   = '';
$h     = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

// ── checks ───────────────────────────────────────────────────────────────────
$checks = [
    ['PHP 8.1 or newer', version_compare(PHP_VERSION, '8.1.0', '>='), PHP_VERSION],
    ['PDO', extension_loaded('pdo'), ''],
    ['MySQL driver (pdo_mysql)', extension_loaded('pdo_mysql'), 'needed only for MySQL / MariaDB'],
    ['SQLite driver (pdo_sqlite)', extension_loaded('pdo_sqlite'), 'needed only for SQLite'],
    ['cURL (Google Sheets, Airtable, geocoding)', extension_loaded('curl'), ''],
    ['GD (image thumbnails, share cards)', extension_loaded('gd'), ''],
    ['mbstring', extension_loaded('mbstring'), ''],
    ['OpenSSL', extension_loaded('openssl'), ''],
    ['Writable: ' . $root, is_writable($root), 'to write .env'],
    ['Writable: admin/uploads', is_writable($root . '/admin/uploads') || @mkdir($root . '/admin/uploads', 0755, true), 'photos'],
    ['Writable: storage', is_writable(ft_storage_dir()), 'cache, SQLite file'],
];
$hard = ['PHP 8.1 or newer', 'PDO', 'mbstring', 'Writable: ' . $root];
$okToGo = true;
foreach ($checks as [$name, $ok]) if (!$ok && in_array($name, $hard, true)) $okToGo = false;

// ── step 2: database ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $step === '2') {
    $driver = $_POST['driver'] === 'sqlite' ? 'sqlite' : 'mysql';
    $cfg = $driver === 'sqlite'
        ? ['driver' => 'sqlite', 'file' => trim($_POST['db_file'] ?? '') ?: (ft_storage_dir() . '/familytree.sqlite')]
        : ['driver' => 'mysql', 'host' => trim($_POST['db_host'] ?? 'localhost'), 'port' => (int)($_POST['db_port'] ?: 3306),
           'name' => trim($_POST['db_name'] ?? ''), 'user' => trim($_POST['db_user'] ?? ''), 'pass' => (string)($_POST['db_pass'] ?? ''),
           'ssl' => !empty($_POST['db_ssl'])];
    try {
        $pdo = ft_connect($cfg);
        ft_run_sql_file($pdo, ft_schema_file($driver));
        $_SESSION['ft_install_db'] = $cfg;
        $step = '3';
    } catch (Throwable $e) {
        $err = 'Could not connect or create tables: ' . $e->getMessage();
        $step = '2';
    }
}

// ── step 3: first account, write .env ────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $step === '3' && !empty($_POST['admin_email'])) {
    $cfg = $_SESSION['ft_install_db'] ?? null;
    $email = strtolower(trim($_POST['admin_email']));
    $name  = trim($_POST['admin_name'] ?? '') ?: 'Admin';
    $pass  = (string)($_POST['admin_pass'] ?? '');
    $treeName = trim($_POST['tree_name'] ?? '') ?: ($name . "'s family");
    $slug  = strtolower(trim($_POST['tree_slug'] ?? '')) ?: preg_replace('/[^a-z0-9]+/', '-', strtolower($treeName));
    $slug  = trim(preg_replace('/-+/', '-', $slug), '-') ?: 'family';
    $domain = trim($_POST['app_domain'] ?? '') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost');
    if (!$cfg) { $err = 'Database step missing, start again.'; $step = '2'; }
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $err = 'A valid email, please.'; }
    elseif (strlen($pass) < 8) { $err = 'Password: at least 8 characters.'; }
    else {
        try {
            $pdo = ft_connect($cfg);
            $tenantId = ft_uuid();
            $pdo->prepare("INSERT INTO tenants (id, slug, display_name, is_active, visibility, created_at) VALUES (?, ?, ?, 1, 'private', NOW())")
                ->execute([$tenantId, $slug, $treeName]);
            $pdo->prepare("INSERT INTO family_users (tenant_id, email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, 'owner', NOW())")
                ->execute([$tenantId, $email, password_hash($pass, PASSWORD_DEFAULT), $name]);
            $userId = (int)$pdo->lastInsertId();
            $pdo->prepare("UPDATE tenants SET owner_user_id = ? WHERE id = ?")->execute([$userId, $tenantId]);
            try { $pdo->prepare("INSERT IGNORE INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'owner')")->execute([$tenantId, $userId]); } catch (Throwable $e) {}
            $appKey = bin2hex(random_bytes(32));
            $env = "# FamilyTree configuration, written by the installer. Keep this file private.\n"
                 . "APP_ENV=production\nAPP_DOMAIN=$domain\nAPP_URL=" . ((($_SERVER['HTTPS'] ?? 'off') !== 'off') ? 'https' : 'http') . "://$domain\n"
                 . "APP_KEY=$appKey\nAPP_TENANT_ID=$tenantId\n\n";
            if ($cfg['driver'] === 'sqlite') $env .= "DB_DRIVER=sqlite\nDB_FILE={$cfg['file']}\n";
            else $env .= "DB_DRIVER=mysql\nDB_HOST={$cfg['host']}\nDB_PORT={$cfg['port']}\nDB_NAME={$cfg['name']}\nDB_USER={$cfg['user']}\nDB_PASS={$cfg['pass']}\nDB_SSL=" . ($cfg['ssl'] ? '1' : '0') . "\n";
            $env .= "\n# mail (optional; without SMTP the app uses PHP mail())\nMAIL_FROM_NAME=FamilyTree\nMAIL_FROM_EMAIL=noreply@" . preg_replace('/:\\d+$/', '', $domain) . "\n";
            if (file_put_contents($envFile, $env, LOCK_EX) === false) throw new RuntimeException('could not write .env');
            unset($_SESSION['ft_install_db']);
            $step = 'done';
        } catch (Throwable $e) { $err = 'Could not finish: ' . $e->getMessage(); }
    }
}
$slugSuggest = 'family';
?><!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install FamilyTree</title>
<?= ft_brand_head() ?>
<style>
:root{--bg:var(--ft-paper);--card:var(--ft-surface);--ink:var(--ft-ink);--dim:var(--ft-ink2);--line:var(--ft-line);--accent:var(--ft-green);--bad:var(--ft-danger);--ok:var(--ft-ok)}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 var(--ft-sans);background:var(--bg);color:var(--ink);display:flex;justify-content:center;padding:32px 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:560px;width:100%;padding:28px 28px 24px;box-shadow:var(--ft-shadow)}
h1{margin:0 0 4px}h1 .ft-brand{font-size:26px}h3{font-family:var(--ft-serif);font-weight:600}.sub{color:var(--dim);margin:0 0 20px}
a{color:var(--accent)}:focus-visible{outline:3px solid var(--ft-focus);outline-offset:2px;border-radius:4px}
input,select{color:var(--ink)}
.steps{display:flex;gap:6px;margin:0 0 22px}.steps span{flex:1;height:4px;border-radius:2px;background:var(--line)}.steps span.on{background:var(--accent)}
label{display:block;font-size:13px;color:var(--dim);margin:12px 0 4px}input[type=text],input[type=email],input[type=password],input[type=number]{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--card)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn{display:inline-block;margin-top:18px;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:11px 22px;font:600 14px inherit;cursor:pointer}
.chk{list-style:none;padding:0;margin:0}.chk li{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:14px}.chk b{font-weight:600}.ok{color:var(--ok)}.bad{color:var(--bad)}
.err{background:var(--ft-danger-soft);color:var(--bad);border-radius:10px;padding:10px 12px;margin:0 0 10px;font-size:14px}
.opt{display:flex;gap:10px;margin-top:6px}.opt label{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer;margin:0;color:var(--ink)}.opt input{margin-right:6px}.opt small{display:block;color:var(--dim);font-size:12px;margin-top:2px}
.hide{display:none}code{background:var(--ft-sunk);padding:1px 5px;border-radius:5px;font-size:13px}
</style></head><body><div class="card">
<h1><?= ft_brand('/', '', 30) ?></h1>
<p class="sub">Set it up in three short steps.</p>
<div class="steps"><span class="<?= $step >= '1' ? 'on' : '' ?>"></span><span class="<?= in_array($step, ['2','3','done']) ? 'on' : '' ?>"></span><span class="<?= in_array($step, ['3','done']) ? 'on' : '' ?>"></span></div>
<?php if ($err): ?><div class="err"><?= $h($err) ?></div><?php endif; ?>

<?php if ($step === '1'): ?>
  <h3 style="margin:0 0 8px">1. This server</h3>
  <ul class="chk"><?php foreach ($checks as [$n, $ok, $note]): ?>
    <li><span><?= $h($n) ?><?= $note ? ' <small style="color:var(--dim)">' . $h($note) . '</small>' : '' ?></span><b class="<?= $ok ? 'ok' : 'bad' ?>"><?= $ok ? 'yes' : 'no' ?></b></li>
  <?php endforeach; ?></ul>
  <?php if ($okToGo): ?><form method="get"><input type="hidden" name="step" value="2"><button class="btn">Next: the database</button></form>
  <?php else: ?><p class="err" style="margin-top:14px">Fix the items marked no, then reload.</p><?php endif; ?>

<?php elseif ($step === '2'): ?>
  <h3 style="margin:0 0 8px">2. Where FamilyTree keeps its own records</h3>
  <p class="sub" style="font-size:14px">Accounts and tree names live here. Each family can later point its own tree at any database it likes.</p>
  <form method="post"><input type="hidden" name="step" value="2">
    <div class="opt">
      <label><input type="radio" name="driver" value="mysql" <?= extension_loaded('pdo_mysql') ? 'checked' : '' ?> onchange="sw()"> MySQL / MariaDB<small>shared hosts, Docker, managed databases</small></label>
      <label><input type="radio" name="driver" value="sqlite" <?= !extension_loaded('pdo_mysql') ? 'checked' : '' ?> onchange="sw()"> SQLite file<small>nothing to install, one file, perfect for one family</small></label>
    </div>
    <div id="my">
      <div class="row"><div><label>Host</label><input type="text" name="db_host" value="localhost"></div><div><label>Port</label><input type="number" name="db_port" value="3306"></div></div>
      <label>Database name</label><input type="text" name="db_name" required>
      <div class="row"><div><label>User</label><input type="text" name="db_user"></div><div><label>Password</label><input type="password" name="db_pass"></div></div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input type="checkbox" name="db_ssl" value="1"> Connect over TLS (managed hosts such as Aiven)</label>
    </div>
    <div id="sq" class="hide">
      <label>File</label><input type="text" name="db_file" value="<?= $h(ft_storage_dir() . '/familytree.sqlite') ?>">
    </div>
    <button class="btn">Connect and create the tables</button>
  </form>
  <script>function sw(){const s=document.querySelector('input[name=driver]:checked').value==='sqlite';document.getElementById('my').classList.toggle('hide',s);document.getElementById('sq').classList.toggle('hide',!s);document.querySelector('[name=db_name]').required=!s;}sw();</script>

<?php elseif ($step === '3'): ?>
  <h3 style="margin:0 0 8px">3. You, and your first tree</h3>
  <form method="post"><input type="hidden" name="step" value="3">
    <div class="row"><div><label>Your name</label><input type="text" name="admin_name" required></div><div><label>Email (you log in with this)</label><input type="email" name="admin_email" required></div></div>
    <label>Password (8+ characters)</label><input type="password" name="admin_pass" minlength="8" required>
    <div class="row"><div><label>Family tree name</label><input type="text" name="tree_name" placeholder="The Sharma family" required></div><div><label>Link name</label><input type="text" name="tree_slug" placeholder="sharma"></div></div>
    <label>This site's domain</label><input type="text" name="app_domain" value="<?= $h($_SERVER['HTTP_HOST'] ?? 'localhost') ?>">
    <button class="btn">Finish</button>
  </form>

<?php else: ?>
  <h3 style="margin:0 0 8px">Done</h3>
  <p>FamilyTree is installed. Your tree is private until you change that in Settings.</p>
  <p><a class="btn" href="/admin/">Open the admin</a></p>
  <p class="sub" style="font-size:13px;margin-top:16px">For safety, delete the <code>install/</code> folder on a public server, or leave it: it answers 404 now that <code>.env</code> exists.</p>
<?php endif; ?>
</div></body></html>
