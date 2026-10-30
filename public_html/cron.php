<?php
/**
 * cron.php - the weekly jobs. Run once a week (Monday morning is good):
 *   php /path/to/public_html/cron.php weekly          (a hosting cron job)
 *   https://your-site/cron.php?key=CRON_KEY           (or a web cron, with CRON_KEY set in .env)
 *
 *   1. the email digest of the coming week, to everyone with an account who hasn't turned it off
 *   2. a backup of every tree into storage/backups/{tree}/, the last 8 kept
 *   3. the people index for linking trees between families
 *   4. clean-up: unconfirmed sign-ups after 30 days, IP addresses in logs after 90 days,
 *      log lines after 2 years, old rate-limit files
 * Add "dry" (CLI) or &dry=1 to see what would happen without sending or writing.
 */
define('FT_APP', 1);
$cli = PHP_SAPI === 'cli';
if (!$cli) {
    require_once __DIR__ . '/config.php';
    $key = (string)getenv('CRON_KEY');
    if ($key === '' || !hash_equals($key, (string)($_GET['key'] ?? ''))) { http_response_code(403); exit('Set CRON_KEY in .env and pass it as ?key='); }
    header('Content-Type: text/plain; charset=utf-8');
} else {
    $_SERVER['HTTP_HOST'] ??= getenv('APP_DOMAIN') ?: 'localhost';
    require_once __DIR__ . '/config.php';
}
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/store.php';
require_once __DIR__ . '/includes/mailer.php';
require_once __DIR__ . '/includes/digest.php';
set_time_limit(600);
$dry = $cli ? in_array('dry', $argv, true) : !empty($_GET['dry']);
$only = $cli ? ($argv[1] ?? 'weekly') : ($_GET['job'] ?? 'weekly');
$say = function (string $s) { echo $s . "\n"; };
ft_actor(['id' => null, 'name' => 'Weekly job']);
$base = rtrim(getenv('APP_URL') ?: ('https://' . (getenv('APP_DOMAIN') ?: 'localhost')), '/');

$tenants = $pdo->query("SELECT * FROM tenants WHERE is_active = 1")->fetchAll(PDO::FETCH_ASSOC);

// 1. digest ---------------------------------------------------------------
if (in_array($only, ['weekly', 'digest'], true)) {
    $sent = 0;
    foreach ($tenants as $t) {
        $settings = ft_tenant_settings($t);
        if (!empty($settings['demo'])) continue;
        try { $members = ft_store($pdo, $t)->members(); } catch (Throwable $e) { $say("digest: {$t['slug']} unreachable: " . $e->getMessage()); continue; }
        $events = ft_week_events($members, $settings, date('Y-m-d'), 7, ft_family_events($pdo, $t['id']));
        if (!$events) continue;
        // everyone with an account on this tree, once
        $st = $pdo->prepare("SELECT DISTINCT u.id, u.email, u.display_name, u.digest FROM family_users u
                             LEFT JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
                             WHERE (tu.id IS NOT NULL OR u.tenant_id = ?) AND u.email <> ''");
        $st->execute([$t['id'], $t['id']]);
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $u) {
            if (isset($u['digest']) && !(int)$u['digest']) continue;
            $unsub = $base . '/unsubscribe.php?u=' . (int)$u['id'] . '&t=' . ft_unsub_token((int)$u['id']);
            $html = ft_digest_html($t['display_name'], $base . '/tree/' . rawurlencode($t['slug']) . '/events', $events, $unsub);
            if ($dry) { $say("digest (dry): {$u['email']} ← {$t['slug']}, " . count($events) . ' events'); continue; }
            if (sendEmail($u['email'], (string)$u['display_name'], 'This week in the ' . $t['display_name'], $html)) $sent++;
        }
    }
    $say("digest: $sent emails sent");
}

// 2. backups --------------------------------------------------------------
if (in_array($only, ['weekly', 'backup'], true)) {
    $made = 0;
    foreach ($tenants as $t) {
        if (!empty(ft_tenant_settings($t)['demo'])) continue;
        try { $s = ft_store($pdo, $t); $doc = ['format' => 'familytree/1', 'name' => $t['display_name'], 'slug' => $t['slug'], 'exported_at' => date('c'),
                'settings' => ft_tenant_settings($t), 'members' => $s->members(), 'media' => $s->media(), 'family_events' => ft_family_events($pdo, $t['id'])]; }
        catch (Throwable $e) { $say("backup: {$t['slug']} unreachable: " . $e->getMessage()); continue; }
        $dir = ft_storage_dir() . '/backups/' . $t['id'];
        if ($dry) { $say("backup (dry): {$t['slug']}, " . count($doc['members']) . ' people'); continue; }
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        file_put_contents("$dir/" . date('Y-m-d') . '.json.gz', gzencode(json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 6), LOCK_EX);
        $files = glob("$dir/*.json.gz") ?: []; rsort($files);
        foreach (array_slice($files, 8) as $old) @unlink($old);          // keep 8 weeks
        $made++;
    }
    $say("backup: $made trees");
}

// 4. clean-up -------------------------------------------------------------
if (in_array($only, ['weekly', 'cleanup'], true) && !$dry) {
    $n = 0;
    $q = function (string $sql, array $p = []) use ($pdo, &$n, $say) { try { $st = $pdo->prepare($sql); $st->execute($p); $n += $st->rowCount(); } catch (Throwable $e) { $say('cleanup: ' . $e->getMessage()); } };
    $q("UPDATE family_activity_logs SET ip_address = NULL, user_agent = NULL WHERE created_at < ? AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)", [date('Y-m-d H:i:s', strtotime('-90 days'))]);
    $q("DELETE FROM family_activity_logs WHERE created_at < ?", [date('Y-m-d H:i:s', strtotime('-2 years'))]);
    foreach (glob(sys_get_temp_dir() . '/ft_rl_*') ?: [] as $f) if (filemtime($f) < time() - 86400) { @unlink($f); $n++; }
    $say("cleanup: $n rows and files");
}
