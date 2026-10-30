<?php
if (!defined('FT_APP')) define('FT_APP', 1);
/**
 * admin/events-api.php - add, change and remove family events of the admin's tree.
 *   POST            {title, kind, date, yearly, people[], place, note}  -> the new event
 *   PUT    ?id=N    same body                                         -> the changed event
 *   DELETE ?id=N                                                      -> 204
 * Errors: {error, field} with a plain message for the form.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/events.php';

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Sign in to change events.']); exit; }
validateCsrf();

$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$tenantId = getAdminTenantId();
$tenant   = loadTenant($pdo, $tenantId);
if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
if (($_SESSION['admin_user']['role'] ?? 'viewer') === 'viewer') { http_response_code(403); echo json_encode(['error' => 'Viewers can look at events but not change them. Ask the tree owner to make you an editor.']); exit; }
$uid = (int)($_SESSION['admin_user']['id'] ?? 0) ?: null;

$fail = function (int $code, string $msg, ?string $field = null) { http_response_code($code); echo json_encode(['error' => $msg] + ($field ? ['field' => $field] : [])); exit; };
$load = function (int $id) use ($pdo, $tenantId): ?array {
    $st = $pdo->prepare("SELECT * FROM family_events WHERE id = ? AND tenant_id = ?");
    $st->execute([$id, $tenantId]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ? ft_event_shape($r) : null;
};

try {
    if ($method === 'DELETE') {
        if (!$id || !($old = $load($id))) $fail(404, 'That event is not there any more.');
        $pdo->prepare("DELETE FROM family_events WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
        logActivityWithTenant($pdo, 'event_delete', 'event', $id, ['title' => $old['title']], $tenantId);
        http_response_code(204); exit;
    }
    if (!in_array($method, ['POST', 'PUT'], true)) $fail(405, 'Method not allowed');
    if ($method === 'PUT' && (!$id || !$load($id))) $fail(404, 'That event is not there any more.');

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $fail(400, 'Nothing was sent.');
    try { $memberIds = array_column(ft_store($pdo, $tenant)->members(), 'id'); }
    catch (Throwable $e) { $fail(503, 'The data home of this tree is not reachable: ' . $e->getMessage()); }
    [$row, $err] = ft_event_clean($input, $memberIds);
    if ($err) $fail(422, $err['error'], $err['field']);

    if ($method === 'POST') {
        $id = ft_event_insert($pdo, $tenantId, $row, $uid);
        logActivityWithTenant($pdo, 'event_add', 'event', $id, ['title' => $row['title']], $tenantId);
        http_response_code(201);
    } else {
        $pdo->prepare("UPDATE family_events SET title = ?, kind = ?, event_date = ?, yearly = ?, people = ?, place = ?, note = ?, updated_at = ? WHERE id = ? AND tenant_id = ?")
            ->execute([$row['title'], $row['kind'], $row['event_date'], $row['yearly'], $row['people'], $row['place'], $row['note'], date('Y-m-d H:i:s'), $id, $tenantId]);
        logActivityWithTenant($pdo, 'event_update', 'event', $id, ['title' => $row['title']], $tenantId);
    }
    echo json_encode($load($id));
} catch (Throwable $e) {
    error_log('events-api: ' . $e->getMessage());
    $missing = $e instanceof PDOException && preg_match('/family_events/', $e->getMessage());
    $fail(500, $missing ? 'Family events need install/upgrades/2026-10-31-family-events.sql on this database.' : 'Could not save the event. Please try again.');
}
