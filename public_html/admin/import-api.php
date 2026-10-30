<?php
/**
 * admin/import-api.php - bring a family tree in from another builder.
 *
 * POST multipart: file (.ged, .json, or a .zip holding one; at most 20 MB), mode = preview | replace | add
 *   preview  what the file holds, nothing is saved
 *   replace  the file becomes the tree (people and photos of the tree are replaced)
 *   add      the file's people join the tree, beside the people already there
 * Owner only. Works with every data home: it goes through the tree's store.
 */
if (!defined('FT_APP')) define('FT_APP', 1);
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/gedcom.php';
require_once dirname(__DIR__) . '/includes/events.php';

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
if (($_SESSION['admin_user']['role'] ?? '') !== 'owner') { http_response_code(403); echo json_encode(['error' => 'Only the tree owner can import']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'POST a file']); exit; }
$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
if (!hash_equals($_SESSION['csrf_token'] ?? '', (string)$token)) { http_response_code(403); echo json_encode(['error' => 'Invalid CSRF token']); exit; }

$tenantId = getAdminTenantId();
$tenant = loadTenant($pdo, $tenantId);
$mode = $_POST['mode'] ?? 'preview';
try {
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) throw new RuntimeException($f && $f['error'] === UPLOAD_ERR_INI_SIZE ? 'The file is larger than this server accepts.' : 'Choose a .ged, .json or .zip file.');
    if ($f['size'] > 20 * 1024 * 1024) throw new RuntimeException('The file is over 20 MB.');
    $raw = (string)file_get_contents($f['tmp_name']);
    if (substr($raw, 0, 4) === "PK" . chr(3) . chr(4)) {   // Ancestry and Geneanet hand out the .ged inside a .zip
        if (!class_exists('ZipArchive')) throw new RuntimeException('This server cannot open .zip files; unzip it and choose the .ged inside.');
        $zip = new ZipArchive();
        if ($zip->open($f['tmp_name']) !== true) throw new RuntimeException('Could not open that .zip file.');
        $pick = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $st = $zip->statIndex($i);
            if (preg_match('/\.(ged|gedcom|json)$/i', $st['name']) && !str_starts_with(basename($st['name']), '.') && (!$pick || $st['size'] > $pick['size'])) $pick = $st;
        }
        if (!$pick) { $zip->close(); throw new RuntimeException('No .ged or .json file inside that .zip.'); }
        if ($pick['size'] > 60 * 1024 * 1024) { $zip->close(); throw new RuntimeException('The file inside the .zip is too large.'); }
        $raw = (string)$zip->getFromIndex($pick['index']);
        $f['name'] = $pick['name'];
        $zip->close();
    }
    $isJson = preg_match('/\.json$/i', $f['name']) || preg_match('/^\s*[\[{]/', ltrim($raw, "\xEF\xBB\xBF"));
    $data = $isJson ? ft_json_read($raw) : ft_gedcom_read($raw);
    $store = ft_store($pdo, $tenant);
    $existing = $store->members();

    if ($mode === 'preview') {
        echo json_encode(['ok' => true, 'format' => $isJson ? 'FamilyTree JSON' : 'GEDCOM', 'stats' => $data['stats'],
            'sample' => array_slice(array_column($data['members'], 'name'), 0, 8), 'existing' => count($existing)]);
        exit;
    }
    if (!in_array($mode, ['replace', 'add'], true)) throw new RuntimeException('Unknown mode.');

    if ($mode === 'replace') {
        $map = $store->importAll($data['members'], $data['media']);
        ft_events_restore($pdo, $tenantId, $data['family_events'] ?? [], $map, true);
        // the old people are gone: accounts that pointed at one of them point at nobody now
        $pdo->prepare("UPDATE family_users SET member_id = NULL WHERE tenant_id = ?")->execute([$tenantId]);
        try { $pdo->prepare("UPDATE tenant_users SET member_id = NULL WHERE tenant_id = ?")->execute([$tenantId]); } catch (Throwable $e) {}
    } else {
        // add: the file's ids move past the tree's, then everything is written back together
        $shift = $existing ? max(array_column($existing, 'id')) : 0;
        $sh = fn($v) => $v ? (int)$v + $shift : null;
        $new = array_map(function ($m) use ($sh) {
            $m['id'] = $sh($m['id']); $m['fid'] = $sh($m['fid']); $m['mid'] = $sh($m['mid']);
            $m['pids'] = array_map($sh, ft_pids($m['pids'])); return $m;
        }, $data['members']);
        $oldMedia = $store->media();
        $mShift = $oldMedia ? max(array_column($oldMedia, 'id')) : 0;
        $newMedia = array_map(function ($x) use ($sh, $mShift) { $x['id'] = (int)$x['id'] + $mShift; $x['member_ids'] = array_map($sh, $x['member_ids'] ?? []); return $x; }, $data['media']);
        $map = $store->importAll(array_merge($existing, $new), array_merge($oldMedia, $newMedia));
        ft_remap_accounts($pdo, $tenantId, $map);
        ft_events_restore($pdo, $tenantId, $data['family_events'] ?? [], $map, false, $shift);
    }
    logActivityWithTenant($pdo, 'tree_import', 'tree', null, ['mode' => $mode, 'people' => count($data['members']), 'format' => $isJson ? 'json' : 'gedcom'], $tenantId);
    @unlink(ft_cache_dir() . '/featured.json');
    echo json_encode(['ok' => true, 'mode' => $mode, 'imported' => count($data['members']), 'total' => $store->countMembers(), 'stats' => $data['stats']]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
