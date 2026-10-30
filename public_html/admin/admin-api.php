<?php
if (!defined('FT_APP')) define('FT_APP', 1);
// admin/admin-api.php - member CRUD, scoped to the admin's tree and routed to its data home

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
validateCsrf();

$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
$tenantId = getAdminTenantId();
$tenant   = loadTenant($pdo, $tenantId);
if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }

try { $store = ft_store($pdo, $tenant); }
catch (Throwable $e) { http_response_code(503); echo json_encode(['error' => 'The data home of this tree is not reachable: ' . $e->getMessage(), 'code' => 'datahome']); exit; }

/** the shape the admin JS has always received (snake_case plus the old flat aliases) */
function legacyShape(array $row): array {
    $row['currentlocation'] = $row['current_location'] ?? null;
    $row['instaurl']        = $row['insta_url'] ?? null;
    $row['fburl']           = $row['fb_url'] ?? null;
    $row['anniversarydate'] = $row['anniversary_date'] ?? null;
    $row['deathdate']       = $row['death_date'] ?? null;
    $row['deathlocation']   = $row['death_location'] ?? null;
    return $row;
}

try {
    if ($method === 'GET') {
        if ($id) { $row = $store->member($id); echo json_encode($row ? legacyShape($row) : ['error' => 'Not found']); }
        else echo json_encode(array_map('legacyShape', $store->members()));
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $data = [
        'name'             => $input['name'] ?? '',
        'nickname'         => $input['nickname'] ?? null,
        'birth_date'       => $input['birthdate'] ?? ($input['birth_date'] ?? null),
        'birth_location'   => $input['birthlocation'] ?? ($input['birth_location'] ?? null),
        'gender'           => $input['gender'] ?? null,
        'img'              => $input['img'] ?? null,
        'fid'              => $input['fid'] ?? null,
        'mid'              => $input['mid'] ?? null,
        'pids'             => ft_pids($input['pids'] ?? []),
        'is_alive'         => $input['isalive'] ?? ($input['is_alive'] ?? 1),
        'current_location' => $input['currentlocation'] ?? ($input['current_location'] ?? null),
        'insta_url'        => $input['instaurl'] ?? ($input['insta_url'] ?? null),
        'fb_url'           => $input['fburl'] ?? ($input['fb_url'] ?? null),
        'anniversary_date' => $input['anniversarydate'] ?? ($input['anniversary_date'] ?? null),
        'death_date'       => $input['deathdate'] ?? ($input['death_date'] ?? null),
        'death_location'   => $input['deathlocation'] ?? ($input['death_location'] ?? null),
        'wiki'             => isset($input['wiki']) ? substr($input['wiki'], 0, 750) : null,
        'is_private'       => isset($input['is_private']) ? (int)(bool)$input['is_private'] : 0,
        'privacy_override' => isset($input['privacy_override']) ? (int)(bool)$input['privacy_override'] : 0,
    ];
    if (array_key_exists('extra', $input)) $data['extra'] = ft_extra_clean($input['extra']);   // only when the editor sends it
    foreach (['fid', 'mid'] as $k) $data[$k] = $data[$k] ? (int)$data[$k] : null;
    foreach (['birth_date', 'death_date', 'anniversary_date'] as $k) if ($data[$k] === '') $data[$k] = null;

    if ($method === 'POST') {
        $newId = $store->insertMember($data);
        $oldSpouses = [];
        logActivityWithTenant($pdo, 'member_add', 'member', $newId, ['name' => $data['name']], $tenantId);

    } elseif ($method === 'PUT' && $id) {
        $old = $store->member($id);
        if (!$old) { http_response_code(404); echo json_encode(['error' => 'Not found']); exit; }
        $oldSpouses = $old['pids'];
        $store->updateMember($id, $data);
        $newId = $id;
        logActivityWithTenant($pdo, 'member_update', 'member', $newId, ['name' => $data['name']], $tenantId);

    } elseif ($method === 'DELETE' && $id) {
        // unlink from spouses and children first, so the tree never points at a missing person
        foreach ($store->members() as $m) {
            $patch = [];
            if (in_array($id, $m['pids'], true)) $patch['pids'] = array_values(array_diff($m['pids'], [$id]));
            if ($m['fid'] === $id) $patch['fid'] = null;
            if ($m['mid'] === $id) $patch['mid'] = null;
            if ($patch) $store->patchMember($m['id'], $patch);
        }
        $store->deleteMember($id);
        logActivityWithTenant($pdo, 'member_delete', 'member', $id, null, $tenantId);
        http_response_code(204);
        exit;

    } else { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

    // Mirror the spouse link (and anniversary, and partnership dates) both ways, multi-spouse safe
    $newSpouseIds = $data['pids'];
    $myPartners = isset($data['extra']) ? ($data['extra']['partners'] ?? []) : null;
    foreach ($newSpouseIds as $sId) {
        if ($sId === $newId) continue;
        $s = $store->member($sId);
        if (!$s) continue;
        $patch = [];
        if (!in_array($newId, $s['pids'], true)) {
            $patch['pids'] = array_merge($s['pids'], [$newId]);
            if (empty($s['anniversary_date']) && !empty($data['anniversary_date'])) $patch['anniversary_date'] = $data['anniversary_date'];
        }
        if ($myPartners !== null) {
            $sx = $s['extra']; $mine = $myPartners[(string)$sId] ?? null;
            if (($sx['partners'][(string)$newId] ?? null) !== $mine) {
                if ($mine) $sx['partners'][(string)$newId] = $mine; else unset($sx['partners'][(string)$newId]);
                $patch['extra'] = $sx;
            }
        }
        if ($patch) $store->patchMember($sId, $patch);
    }
    foreach (array_diff($oldSpouses, $newSpouseIds) as $rId) {        // unlinked former spouses
        if ($rId === $newId) continue;
        $r = $store->member($rId);
        if ($r) $store->patchMember($rId, ['pids' => array_values(array_diff($r['pids'], [$newId]))]);
    }

    $row = $store->member($newId);
    if ($method === 'POST') http_response_code(201);
    echo json_encode($row ? legacyShape($row) : ['error' => 'Not found']);

} catch (Throwable $e) {
    error_log('admin-api: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save member: ' . $e->getMessage()]);
}
