<?php
if (!defined('FT_APP')) define('FT_APP', 1);
// admin/dashboard-api.php — stats, upcoming events, recent activity, usage

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

try {
    // ── Stats (family data from the tree's data home) ─────────────
    require_once dirname(__DIR__) . '/includes/privacy.php';
    require_once dirname(__DIR__) . '/includes/store.php';
    $tenantRow = loadTenant($pdo, $tenantId);
    $store = $tenantRow ? ft_store($pdo, $tenantRow) : null;
    $memberCount = 0; $mediaCount = 0; $storeError = null; $storeMembers = [];
    try { if ($store) { $storeMembers = $store->members(); $memberCount = count($storeMembers); $mediaCount = $store->countMedia(); } }
    catch (Throwable $e) { $storeError = $e->getMessage(); }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM family_users WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    $userCount = (int)$stmt->fetchColumn();

    // ── Upcoming events (birthdays + anniversaries next 30 days) ──
    $today = new DateTime('today');
    $events = [];

    $rows = array_values(array_filter($storeMembers, fn($m) => empty($m['is_private']) && (!empty($m['birth_date']) || !empty($m['anniversary_date']))));

    foreach ($rows as $row) {
        foreach (['birth_date' => 'Birthday', 'anniversary_date' => 'Anniversary'] as $field => $label) {
            if (empty($row[$field])) continue;
            try {
                $orig = new DateTime($row[$field]);
                // Next occurrence this year or next
                $next = new DateTime($today->format('Y') . '-' . $orig->format('m-d'));
                if ($next < $today) {
                    $next->modify('+1 year');
                }
                $diff = (int)$today->diff($next)->days;
                if ($diff <= 30) {
                    $events[] = [
                        'member_id'  => (int)$row['id'],
                        'name'       => $row['name'],
                        'nickname'   => $row['nickname'],
                        'type'       => $label,
                        'date'       => $next->format('Y-m-d'),
                        'day'        => (int)$next->format('j'),
                        'month'      => $next->format('M'),
                        'days_left'  => $diff,
                    ];
                }
            } catch (Throwable $e) { /* bad date, skip */ }
        }
    }

    usort($events, fn($a, $b) => $a['days_left'] <=> $b['days_left']);
    $events = array_slice($events, 0, 10);

    // ── Recent Activity ───────────────────────────────────────────
    $activity = [];
    try {
        // Check if tenant_id column exists in activity logs
        $hasTenant = false;
        $cols = $pdo->query("DESCRIBE family_activity_logs")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('tenant_id', $cols)) $hasTenant = true;

        if ($hasTenant) {
            $stmt = $pdo->prepare("
                SELECT l.*, u.display_name, u.email
                FROM family_activity_logs l
                LEFT JOIN family_users u ON l.user_id = u.id
                WHERE l.tenant_id = ?
                ORDER BY l.created_at DESC
                LIMIT 10
            ");
            $stmt->execute([$tenantId]);
        } else {
            // Fallback: join via user's tenant
            $stmt = $pdo->prepare("
                SELECT l.*, u.display_name, u.email
                FROM family_activity_logs l
                LEFT JOIN family_users u ON l.user_id = u.id AND u.tenant_id = ?
                ORDER BY l.created_at DESC
                LIMIT 10
            ");
            $stmt->execute([$tenantId]);
        }
        $activity = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        // table may not exist yet
    }

    echo json_encode([
        'stats' => [
            'members'  => $memberCount,
            'users'    => $userCount,
            'media'    => $mediaCount,
            'events'   => count($events),
        ],
        'datahome' => ['kind' => $store ? $store->kind() : 'here', 'error' => $storeError],
        'events'   => $events,
        'activity' => $activity,
    ]);

} catch (Throwable $e) {
    error_log('dashboard-api error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
