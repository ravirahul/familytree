<?php
/**
 * admin/backup-export.php - the whole tree as one JSON file (familytree/1): people, photos and
 * their tags, the tree's settings. Import it into any FamilyTree with Members > Import.
 */
if (!defined('FT_APP')) define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/events.php';
if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); header('Content-Type: application/json'); echo json_encode(['error' => 'Unauthorized']); exit; }

$tenantId = getAdminTenantId();
$tenant = loadTenant($pdo, $tenantId);

// the weekly backups cron.php keeps (owner only): ?list=1 lists them, ?file=YYYY-MM-DD downloads one
if (isset($_GET['list']) || isset($_GET['file'])) {
    if (($_SESSION['admin_user']['role'] ?? '') !== 'owner') { http_response_code(403); header('Content-Type: application/json'); echo json_encode(['error' => 'Only the tree owner can download backups']); exit; }
    $dir = ft_storage_dir() . '/backups/' . $tenantId;
    if (isset($_GET['list'])) {
        $files = glob("$dir/*.json.gz") ?: []; rsort($files);
        header('Content-Type: application/json');
        echo json_encode(['backups' => array_map(fn($f) => ['date' => basename($f, '.json.gz'), 'kb' => (int)round(filesize($f) / 1024)], $files)]); exit;
    }
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$_GET['file']) ? $_GET['file'] : '';
    $path = "$dir/$d.json.gz";
    if (!$d || !is_file($path)) { http_response_code(404); exit('No backup for that date'); }
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9-]/', '', $tenant['slug']) . '-backup-' . $d . '.json"');
    echo gzdecode((string)file_get_contents($path)); exit;
}
$store = ft_store($pdo, $tenant);
$doc = [
    'format' => 'familytree/1', 'name' => $tenant['display_name'], 'slug' => $tenant['slug'],
    'exported_at' => date('c'), 'settings' => ft_tenant_settings($tenant),
    'members' => $store->members(), 'media' => $store->media(),
    'family_events' => ft_family_events($pdo, $tenantId),
];
logActivityWithTenant($pdo, 'backup_export', 'tree', null, ['members' => count($doc['members'])], $tenantId);
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9-]/', '', $tenant['slug']) . '-backup-' . date('Y-m-d') . '.json"');
echo json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
