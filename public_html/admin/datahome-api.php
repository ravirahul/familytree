<?php
if (!defined('FT_APP')) define('FT_APP', 1);
/**
 * admin/datahome-api.php - where this tree's family data lives.
 *
 *   GET                       current data home (secrets masked), its status and counts
 *   POST {action:'test',  config}            try a configuration, report counts it can see
 *   POST {action:'setup', config}            create tables / tabs / fields in it
 *   POST {action:'save',  config, copy:bool} switch the tree to it, optionally copying the data across (ids kept)
 *   POST {action:'reset', copy:bool}         back to the app's database
 *
 * Owner only. Secrets (passwords, keys, tokens) are stored encrypted with APP_KEY
 * and never sent back; a saved config can be re-used by leaving them blank.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/privacy.php';

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
if (($_SESSION['admin_user']['role'] ?? '') !== 'owner') { http_response_code(403); echo json_encode(['error' => 'Only the tree owner can change where its data lives']); exit; }
validateCsrf();

$tenantId = getAdminTenantId();
$tenant   = loadTenant($pdo, $tenantId);
if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
$current  = ft_data_source($tenant);

const FT_SECRET_KEYS = ['pass', 'token', 'service_account'];
function ft_mask(array $cfg): array { foreach (FT_SECRET_KEYS as $k) if (!empty($cfg[$k])) $cfg[$k] = '••••••'; return $cfg; }
/** blank secrets in a submitted config mean "keep the saved one" */
function ft_merge_secrets(array $cfg, array $saved): array {
    if (($cfg['type'] ?? '') === ($saved['type'] ?? '')) foreach (FT_SECRET_KEYS as $k) if (empty($cfg[$k]) && !empty($saved[$k])) $cfg[$k] = $saved[$k];
    return $cfg;
}
function ft_clean_config(array $in): array {
    $type = $in['type'] ?? 'here';
    $allowed = ['here', 'mysql', 'pgsql', 'sqlite', 'sheets', 'airtable', 'json'];
    if (!in_array($type, $allowed, true)) throw new InvalidArgumentException('Unknown data home');
    $c = ['type' => $type];
    foreach (['host', 'port', 'name', 'user', 'pass', 'ssl', 'file', 'sheet_id', 'service_account', 'base_id', 'token'] as $k) if (isset($in[$k]) && $in[$k] !== '') $c[$k] = is_bool($in[$k]) ? $in[$k] : trim((string)$in[$k]);
    if (isset($c['ssl'])) $c['ssl'] = in_array($c['ssl'], [true, 1, '1', 'true', 'on'], true);
    if ($type === 'sqlite' || $type === 'json') {
        // a server lets a file live only inside storage/; the desktop app anywhere
        $f = (string)($c['file'] ?? '');
        if ($f === '') $f = ft_storage_dir() . '/tree-' . preg_replace('/[^a-z0-9-]/', '', $GLOBALS['tenantId']) . ($type === 'json' ? '.json' : '.sqlite');
        if (!getenv('FT_DESKTOP')) {
            $base = realpath(ft_storage_dir());
            $dir  = realpath(dirname($f));
            if (!$base || !$dir || !str_starts_with($dir, $base)) throw new InvalidArgumentException('On a server the file must be inside the storage folder');
        }
        $c['file'] = $f;
    }
    if ($type === 'sheets' && !empty($c['sheet_id']) && preg_match('~/spreadsheets/d/([A-Za-z0-9_-]+)~', $c['sheet_id'], $m)) $c['sheet_id'] = $m[1];   // a pasted URL is fine
    return $c;
}
function ft_counts(FamilyStore $s): array { return ['members' => $s->countMembers(), 'media' => $s->countMedia()]; }

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $out = ['config' => ft_mask($current), 'kind' => $current['type'], 'here' => ft_counts(new PdoFamilyStore($pdo, $tenantId, 'here')), 'has_app_key' => (bool)getenv('APP_KEY'), 'desktop' => (bool)getenv('FT_DESKTOP')];
        try { $s = ft_store($pdo, $tenant); $s->check(); $out['status'] = 'ok'; $out['counts'] = ft_counts($s); }
        catch (Throwable $e) { $out['status'] = 'error'; $out['message'] = $e->getMessage(); }
        echo json_encode($out); exit;
    }
    $body   = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $body['action'] ?? '';
    $cfg    = isset($body['config']) ? ft_merge_secrets(ft_clean_config($body['config']), $current) : null;

    if ($action === 'test' && $cfg) {
        $s = ft_store($pdo, $tenant, $cfg);
        try { $s->check(); echo json_encode(['ok' => true, 'counts' => ft_counts($s)]); }
        catch (Throwable $e) { echo json_encode(['ok' => false, 'message' => $e->getMessage(), 'needs_setup' => true]); }
        exit;
    }
    if ($action === 'setup' && $cfg) {
        $s = ft_store($pdo, $tenant, $cfg);
        $inner = ft_store_inner($s);
        if ($inner instanceof PdoFamilyStore) $inner->createTables();
        elseif ($inner instanceof AirtableFamilyStore) $inner->setup();
        else $inner->check();                              // sheets makes its tabs, json its file, on first touch
        $s->check();
        echo json_encode(['ok' => true, 'counts' => ft_counts($s)]); exit;
    }
    if ($action === 'save' && $cfg) {
        $from = ft_store($pdo, $tenant);
        $to   = ft_store($pdo, $tenant, $cfg);
        $to->check();
        if (!empty($body['copy'])) ft_remap_accounts($pdo, $tenantId, $to->importAll($from->members(), $from->media()));
        ft_save_data_source($pdo, $tenantId, $cfg);
        logActivityWithTenant($pdo, 'datahome_change', 'tenant', null, ['type' => $cfg['type']], $tenantId);
        echo json_encode(['ok' => true, 'kind' => $cfg['type'], 'counts' => ft_counts(ft_store($pdo, $tenant + ['data_source' => ft_encrypt(json_encode($cfg))]))]); exit;
    }
    if ($action === 'reset') {
        $from = ft_store($pdo, $tenant);
        $to   = new PdoFamilyStore($pdo, $tenantId, 'here');
        if (!empty($body['copy']) && $current['type'] !== 'here') ft_remap_accounts($pdo, $tenantId, $to->importAll($from->members(), $from->media()));
        ft_save_data_source($pdo, $tenantId, null);
        logActivityWithTenant($pdo, 'datahome_change', 'tenant', null, ['type' => 'here'], $tenantId);
        echo json_encode(['ok' => true, 'kind' => 'here', 'counts' => ft_counts($to)]); exit;
    }
    http_response_code(400); echo json_encode(['error' => 'Bad request']);
} catch (Throwable $e) {
    error_log('datahome-api: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
