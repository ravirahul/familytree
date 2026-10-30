<?php
// admin/activity-api.php — paginated activity log for this tenant

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$tenantId = getAdminTenantId();
$limit    = max(1, min(100, (int)($_GET['limit']  ?? 50)));
$offset   = max(0, (int)($_GET['offset'] ?? 0));
$action   = trim($_GET['action'] ?? '');
$q        = trim($_GET['q']      ?? '');

try {
    // Check if tenant_id column exists
    $hasTenant = false;
    try {
        $cols = $pdo->query("DESCRIBE family_activity_logs")->fetchAll(PDO::FETCH_COLUMN);
        $hasTenant = in_array('tenant_id', $cols);
    } catch (Throwable $e) {
        // table might not exist
        echo json_encode(['rows' => [], 'total' => 0]);
        exit;
    }

    $where = [];
    $params = [];

    if ($hasTenant) {
        $where[] = 'l.tenant_id = ?';
        $params[] = $tenantId;
    } else {
        $where[] = 'u.tenant_id = ?';
        $params[] = $tenantId;
    }

    if ($action !== '') {
        $where[] = 'l.action = ?';
        $params[] = $action;
    }
    if ($q !== '') {
        $where[] = '(l.action LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)';
        $like = '%' . $q . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $joinSql = $hasTenant
        ? "LEFT JOIN family_users u ON l.user_id = u.id"
        : "LEFT JOIN family_users u ON l.user_id = u.id AND u.tenant_id = ?";
    // For non-tenant join we already added the tenant param above; re-arrange params
    if (!$hasTenant) {
        // Move tenant param to join position — simpler: just use subquery
        $joinSql = "LEFT JOIN family_users u ON l.user_id = u.id";
    }

    // Count
    $cntSql = "SELECT COUNT(*) FROM family_activity_logs l $joinSql $whereSql";
    $cntStmt = $pdo->prepare($cntSql);
    $cntStmt->execute($params);
    $total = (int)$cntStmt->fetchColumn();

    // Rows
    $rowSql = "SELECT l.*, u.display_name, u.email
               FROM family_activity_logs l
               $joinSql
               $whereSql
               ORDER BY l.created_at DESC
               LIMIT $limit OFFSET $offset";
    $rowStmt = $pdo->prepare($rowSql);
    $rowStmt->execute($params);
    $rows = $rowStmt->fetchAll(PDO::FETCH_ASSOC);

    // Parse changes JSON
    foreach ($rows as &$row) {
        if (!empty($row['changes']) && is_string($row['changes'])) {
            $row['changes'] = json_decode($row['changes'], true);
        }
    }
    unset($row);

    echo json_encode(['rows' => $rows, 'total' => $total]);

} catch (Throwable $e) {
    error_log('activity-api error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
