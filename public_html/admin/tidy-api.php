<?php
/**
 * admin/tidy-api.php - the "Tidy up" page: history and undo, the bin, duplicates and merging.
 *   GET  ?what=history[&member=ID]   recent changes (whole tree or one person)
 *   GET  ?what=bin                   people deleted and not restored
 *   GET  ?what=duplicates            likely pairs of the same person
 *   POST {action: undo, batch}       revert a change (restoring from the bin is an undo too)
 *   POST {action: merge, keep, drop, choices}
 */
if (!defined('FT_APP')) define('FT_APP', 1);
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/merge.php';

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
validateCsrf();
$tenantId = getAdminTenantId();
$tenant = loadTenant($pdo, $tenantId);
if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
$role = $_SESSION['admin_user']['role'] ?? 'viewer';

$summary = fn(?array $m) => $m ? ['id' => $m['id'], 'name' => $m['name'], 'img' => $m['img'], 'gender' => $m['gender'], 'birth_date' => $m['birth_date'], 'death_date' => $m['death_date'],
    'birth_location' => $m['birth_location'], 'fid' => $m['fid'], 'mid' => $m['mid'], 'pids' => $m['pids'], 'wiki' => $m['wiki'], 'nickname' => $m['nickname'],
    'current_location' => $m['current_location'], 'death_location' => $m['death_location'], 'is_alive' => $m['is_alive'], 'anniversary_date' => $m['anniversary_date'],
    'insta_url' => $m['insta_url'], 'fb_url' => $m['fb_url']] : null;

try {
    $store = ft_store($pdo, $tenant);
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $what = $_GET['what'] ?? 'history';
        if ($what === 'bin') { echo json_encode(['bin' => ft_bin($pdo, $tenantId, $store)]); exit; }
        if ($what === 'duplicates') {
            $ms = $store->members(); $byId = array_column($ms, null, 'id');
            $name = fn($id) => $id && isset($byId[$id]) ? $byId[$id]['name'] : null;
            $pairs = array_map(fn($p) => ['a' => $summary($byId[$p[0]]) + ['father' => $name($byId[$p[0]]['fid']), 'mother' => $name($byId[$p[0]]['mid'])],
                                          'b' => $summary($byId[$p[1]]) + ['father' => $name($byId[$p[1]]['fid']), 'mother' => $name($byId[$p[1]]['mid'])],
                                          'score' => $p[2], 'why' => $p[3]], ft_duplicates($ms));
            echo json_encode(['pairs' => $pairs, 'people' => count($ms)]); exit;
        }
        $member = isset($_GET['member']) ? (int)$_GET['member'] : null;
        echo json_encode(['history' => ft_history($pdo, $tenantId, $member, $member ? 100 : 80)]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }
    if (!in_array($role, ['owner', 'editor'], true)) { http_response_code(403); echo json_encode(['error' => 'Only editors and owners can change the tree']); exit; }
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    if (($in['action'] ?? '') === 'undo') {
        $batch = preg_replace('/[^a-f0-9]/', '', (string)($in['batch'] ?? ''));
        $n = ft_undo_batch($pdo, $tenantId, $store, $batch);
        logActivityWithTenant($pdo, 'member_update', 'member', null, ['undo' => $batch, 'changes' => $n], $tenantId);
        echo json_encode(['ok' => true, 'reverted' => $n]); exit;
    }
    if (($in['action'] ?? '') === 'merge') {
        $choices = array_intersect_key((array)($in['choices'] ?? []), array_flip(FT_MERGE_FIELDS));
        $r = ft_merge_members($pdo, $tenantId, $store, (int)($in['keep'] ?? 0), (int)($in['drop'] ?? 0), $choices);
        logActivityWithTenant($pdo, 'member_update', 'member', $r['kept'], ['merged' => $r['removed']], $tenantId);
        echo json_encode(['ok' => true] + $r); exit;
    }
    http_response_code(400); echo json_encode(['error' => 'Unknown action']);
} catch (RuntimeException $e) {
    http_response_code(400); echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('tidy-api: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e instanceof PDOException && str_contains($e->getMessage(), 'member_history') ? 'History needs install/upgrades/2026-10-29-family-tools.sql on this database.' : 'Something went wrong: ' . $e->getMessage()]);
}
