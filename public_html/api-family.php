<?php
/**
 * api-family.php - Public read-only family tree API
 * Privacy & visibility controls applied; data comes from the tree's data home (includes/store.php).
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
// a big tree is megabytes of JSON; gzip makes it ~10x smaller (ob_gzhandler checks Accept-Encoding itself)
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) ob_start('ob_gzhandler');

header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Read-only API']);
    exit;
}

try {
    $treeSlug = trim($_GET['tree'] ?? $_GET['slug'] ?? '');
    $tenant = $treeSlug !== '' ? getPublicTenantBySlug($pdo, $treeSlug) : loadTenant($pdo, getPublicTenantId());
    if (!$tenant) {
        http_response_code(404);
        echo json_encode(['error' => 'Tree not found']);
        exit;
    }
    $tenantId = $tenant['id'];

    // Logged-in owner/editor of THIS tree sees unfiltered data (their own
    // events / map / memories would otherwise be mostly empty for living people)
    $isOwner = !empty($_SESSION['admin_logged_in'])
            && !empty($_SESSION['tenant_id'])
            && $_SESSION['tenant_id'] === $tenantId;
    enforceTreeVisibility($tenant['visibility'], $isOwner);
    if (($tenant['visibility'] ?? 'public') === 'public') {
        header('Access-Control-Allow-Origin: *');   // embeddable only when the tree itself is public
    }

    $privacySettings = loadPrivacySettings($pdo, $tenantId);
    $store = ft_store($pdo, $tenant);

    $rows = $store->members();
    foreach ($rows as &$row) {
        if (!$row['birth_date']) $row['birth_date'] = '';
        $row['nickname'] = $row['nickname'] ?: '';
        $row['photos']   = [];
    }
    unset($row);

    // Photos, grouped by tagged member (assigned before privacy is applied)
    $photosByMember = [];
    foreach ($store->media() as $m) {
        foreach ($m['member_ids'] as $mid) {
            $photosByMember[$mid][] = [
                'id' => $m['id'], 'url' => $m['url'], 'type' => $m['type'] ?: 'image',
                'title' => $m['title'], 'description' => $m['description'], 'created_at' => $m['created_at'],
            ];
        }
    }
    foreach ($rows as &$row) if (isset($photosByMember[$row['id']])) $row['photos'] = $photosByMember[$row['id']];
    unset($row);

    $output = [];
    foreach ($rows as $row) {
        if ($isOwner) { unset($row['privacy_override'], $row['tenant_id']); $output[] = $row; }
        else $output[] = applyPublicPrivacy($row, $privacySettings);
    }
    echo json_encode($output);

} catch (Throwable $e) {
    error_log('api-family.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
