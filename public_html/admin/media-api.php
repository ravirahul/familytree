<?php
if (!defined('FT_APP')) define('FT_APP', 1);
// admin/media-api.php - media (photos, videos, audio) of the admin's tree, from its data home

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';

header('Content-Type: application/json');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
validateCsrf();

$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
$memberId = isset($_GET['member_id']) ? (int)$_GET['member_id'] : null;
$tenantId = getAdminTenantId();
$tenant   = loadTenant($pdo, $tenantId);
if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }

try {
    $store = ft_store($pdo, $tenant);

    /** media rows as the admin JS expects: tags with member names, uploader name */
    $members = null; $users = null;
    $decorate = function (array $rows) use (&$members, &$users, $store, $pdo, $tenantId) {
        if ($members === null) { $members = []; foreach ($store->members() as $m) $members[$m['id']] = $m; }
        if ($users === null) {
            $users = [];
            $st = $pdo->prepare("SELECT id, display_name, member_id FROM family_users WHERE tenant_id = ?"); $st->execute([$tenantId]);
            foreach ($st->fetchAll() as $u) $users[(int)$u['id']] = $u;
        }
        $out = [];
        foreach ($rows as $m) {
            $u = $m['uploaded_by_user_id'] ? ($users[$m['uploaded_by_user_id']] ?? null) : null;
            $tags = [];
            foreach ($m['member_ids'] as $mid) {
                $p = $members[$mid] ?? null;
                $tags[] = ['member_id' => $mid, 'member_name' => $p['name'] ?? null, 'member_nickname' => $p['nickname'] ?? null, 'member_avatar' => $p['img'] ?? null];
            }
            $out[] = ['id' => $m['id'], 'url' => $m['url'], 'type' => $m['type'] ?: 'image', 'title' => $m['title'], 'description' => $m['description'],
                      'uploaded_by_user_id' => $m['uploaded_by_user_id'], 'uploaded_by_display_name' => $u['display_name'] ?? null,
                      'uploaded_by_avatar' => ($u && $u['member_id'] && isset($members[(int)$u['member_id']])) ? $members[(int)$u['member_id']]['img'] : null,
                      'created_at' => $m['created_at'], 'tags' => $tags];
        }
        return $out;
    };

    if ($method === 'GET') {
        $all = $store->media();
        if ($memberId) { echo json_encode($decorate(array_values(array_filter($all, fn($m) => in_array($memberId, $m['member_ids'], true))))); exit; }
        $q = trim($_GET['q'] ?? ''); $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 50; $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
        if ($q !== '') $all = array_values(array_filter($all, fn($m) => stripos((string)$m['title'], $q) !== false || stripos((string)$m['description'], $q) !== false));
        echo json_encode($decorate(array_slice($all, $offset, $limit)));
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    if ($method === 'POST') {
        $url = trim((string)($input['url'] ?? ''));
        if ($url === '') { http_response_code(400); echo json_encode(['error' => 'url is required']); exit; }
        $title = trim((string)($input['title'] ?? '')); $desc = trim((string)($input['description'] ?? ''));
        $type  = in_array($input['type'] ?? '', ['image', 'video', 'audio'], true) ? $input['type'] : 'image';
        $tags  = isset($input['tags']) && is_array($input['tags']) ? $input['tags'] : [];
        $mediaId = $store->insertMedia(['url' => $url, 'type' => $type, 'title' => $title !== '' ? $title : null, 'description' => $desc !== '' ? $desc : null,
            'uploaded_by_user_id' => !empty($_SESSION['admin_user']['id']) ? (int)$_SESSION['admin_user']['id'] : null, 'created_at' => date('Y-m-d H:i:s')], $tags);
        logActivityWithTenant($pdo, 'media_add', 'media', $mediaId, ['title' => $title], $tenantId);
        http_response_code(201);
        echo json_encode($decorate([$store->mediaItem($mediaId)])[0] ?? null);
        exit;
    }

    if ($method === 'PUT') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'id is required']); exit; }
        $d = [];
        if (array_key_exists('title', $input)) { $t = trim((string)$input['title']); $d['title'] = $t !== '' ? $t : null; }
        if (array_key_exists('description', $input)) { $t = trim((string)$input['description']); $d['description'] = $t !== '' ? $t : null; }
        $tags = isset($input['tags']) && is_array($input['tags']) ? $input['tags'] : null;
        $store->updateMedia($id, $d, $tags);
        echo json_encode($decorate([$store->mediaItem($id)])[0] ?? null);
        exit;
    }

    if ($method === 'DELETE') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'id is required']); exit; }
        $store->deleteMedia($id);
        logActivityWithTenant($pdo, 'media_delete', 'media', $id, null, $tenantId);
        http_response_code(204);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);

} catch (Throwable $e) {
    error_log('media-api error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
