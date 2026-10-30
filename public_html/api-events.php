<?php
/**
 * api-events.php?tree={slug} - the family events of a tree (read only).
 * Same access as api-family.php: the tree's visibility decides who may read.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json');

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/events.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Read-only API']); exit; }

try {
    $treeSlug = trim($_GET['tree'] ?? $_GET['slug'] ?? '');
    $tenant = $treeSlug !== '' ? getPublicTenantBySlug($pdo, $treeSlug) : loadTenant($pdo, getPublicTenantId());
    if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
    $isOwner = !empty($_SESSION['admin_logged_in']) && !empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenant['id'];
    enforceTreeVisibility($tenant['visibility'], $isOwner);
    if (($tenant['visibility'] ?? 'public') === 'public') header('Access-Control-Allow-Origin: *');
    echo json_encode(ft_family_events($pdo, $tenant['id']));
} catch (Throwable $e) {
    error_log('api-events.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
