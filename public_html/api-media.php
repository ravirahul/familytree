<?php
/**
 * api-media.php - Public read-only media list for the Memory Book view.
 * GET ?tree={slug}  ->  [{id,url,type,title,description,created_at,members:[{id,name}]}]
 * Honours the tenant's "photos" privacy setting for guests; the logged-in
 * owner of the tree always gets everything. Data comes from the tree's data home.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json');

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Read-only API']); exit; }

try {
    $slug   = trim($_GET['tree'] ?? '');
    $tenant = $slug !== '' ? getPublicTenantBySlug($pdo, $slug) : loadTenant($pdo, getPublicTenantId());
    if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
    $tenantId = $tenant['id'];

    $isOwner = !empty($_SESSION['admin_logged_in']) && !empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenantId;
    enforceTreeVisibility($tenant['visibility'], $isOwner);
    if (!$isOwner) {
        $settings = loadPrivacySettings($pdo, $tenantId);
        if (($settings['photos'] ?? 'members') !== 'public') { echo '[]'; exit; }
    }

    $store = ft_store($pdo, $tenant);
    $members = []; foreach ($store->members() as $m) $members[$m['id']] = $m;
    $out = [];
    foreach ($store->media() as $m) {
        $tagged = [];
        foreach ($m['member_ids'] as $mid) {
            $p = $members[$mid] ?? null; if (!$p) continue;
            $tagged[] = ['id' => $mid, 'name' => (!$isOwner && !empty($p['is_private'])) ? 'Private Member' : ($p['name'] ?? '')];
        }
        $out[] = ['id' => $m['id'], 'url' => $m['url'], 'type' => $m['type'] ?: 'image', 'title' => $m['title'] ?? '', 'description' => $m['description'] ?? '', 'created_at' => $m['created_at'], 'members' => $tagged];
    }
    echo json_encode($out);
} catch (Throwable $e) {
    error_log('api-media.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
