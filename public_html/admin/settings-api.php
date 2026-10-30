<?php
/**
 * admin/settings-api.php
 * Tree settings: visibility, per-field privacy, and the tree's own settings
 * (family emblem, colours, cover picture). GET loads, POST saves. POST {emblem_upload: dataURL}
 * stores a custom emblem image and returns its URL; {cover_upload: dataURL} does the same for the
 * cover picture on member cards, and {cover_remove: true} takes it away.
 */

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../includes/privacy.php';

header('Content-Type: application/json');

if (empty($_SESSION['admin_logged_in'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
header('Access-Control-Allow-Origin: ' . (getenv('APP_URL') ?: ''));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$tenantId = getAdminTenantId();
$method   = $_SERVER['REQUEST_METHOD'];

const FIELD_LABELS_API = [
    'birth_date' => 'Date of Birth', 'birth_location' => 'Birth Location', 'death_date' => 'Death Date', 'death_location' => 'Death Location',
    'current_location' => 'Current Location', 'social_media' => 'Social Media (Instagram / Facebook)', 'photos' => 'Photos', 'bio' => 'Biography / Wiki', 'anniversary_date' => 'Marriage Anniversary',
];

if ($method === 'GET') {
    try {
        $tenant = loadTenant($pdo, $tenantId);
        echo json_encode([
            'visibility'     => $tenant['visibility'] ?? 'private',
            'field_settings' => loadPrivacySettings($pdo, $tenantId),
            'field_labels'   => FIELD_LABELS_API,
            'settings'       => ft_tenant_settings($tenant),
            'slug'           => $tenant['slug'] ?? '',
        ]);
    } catch (PDOException $e) {
        error_log('settings-api GET: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'DB error']);
    }
    exit;
}

if ($method === 'POST') {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!$token || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) { http_response_code(403); echo json_encode(['error' => 'Invalid CSRF token']); exit; }

    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) $body = $_POST;

    // ── an emblem image: PNG / JPEG / WebP / SVG as a data URL, at most 400 KB ─
    if (!empty($body['emblem_upload'])) {
        if (!preg_match('~^data:(image/(png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$~', $body['emblem_upload'], $m)) { http_response_code(400); echo json_encode(['error' => 'Send a PNG, JPEG, WebP or SVG']); exit; }
        $bin = base64_decode($m[3], true);
        if ($bin === false || strlen($bin) > 400 * 1024) { http_response_code(400); echo json_encode(['error' => 'Emblem must be under 400 KB']); exit; }
        $ext = ['png' => 'png', 'jpeg' => 'jpg', 'webp' => 'webp', 'svg+xml' => 'svg'][$m[2]];
        if ($ext === 'svg') {
            if (preg_match('/<script|onload=|onerror=|javascript:|<foreignObject/i', $bin)) { http_response_code(400); echo json_encode(['error' => 'That SVG contains script, which is not allowed']); exit; }
        } elseif (!@getimagesizefromstring($bin)) { http_response_code(400); echo json_encode(['error' => 'Not a readable image']); exit; }
        $dir = __DIR__ . '/uploads/emblems';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        foreach (glob($dir . '/' . $tenantId . '.*') ?: [] as $old) @unlink($old);
        $file = $dir . '/' . $tenantId . '.' . $ext;
        if (file_put_contents($file, $bin, LOCK_EX) === false) { http_response_code(500); echo json_encode(['error' => 'Could not save the emblem']); exit; }
        $url = '/admin/uploads/emblems/' . $tenantId . '.' . $ext . '?v=' . time();
        // remember it straight away, so a later Save of other settings keeps it
        $tenant = loadTenant($pdo, $tenantId);
        $s = ft_tenant_settings($tenant);
        $s['emblem']['kind'] = 'upload'; $s['emblem']['url'] = $url;
        $pdo->prepare("UPDATE tenants SET settings = ? WHERE id = ?")->execute([json_encode($s), $tenantId]);
        ft_forget_emblem_cache($tenant['slug'] ?? '');
        echo json_encode(['ok' => true, 'url' => $url, 'settings' => $s]);
        exit;
    }

    // ── the cover picture on member cards: JPEG / PNG / WebP, at most 1.5 MB (the page shrinks it first) ─
    if (!empty($body['cover_upload']) || !empty($body['cover_remove'])) {
        $dir = __DIR__ . '/uploads/covers';
        $url = null;
        if (!empty($body['cover_upload'])) {
            if (!preg_match('~^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$~', $body['cover_upload'], $m)) { http_response_code(400); echo json_encode(['error' => 'Send a JPEG, PNG or WebP picture']); exit; }
            $bin = base64_decode($m[2], true);
            if ($bin === false || strlen($bin) > 1536 * 1024) { http_response_code(400); echo json_encode(['error' => 'The picture must be under 1.5 MB']); exit; }
            $info = @getimagesizefromstring($bin);
            if (!$info || $info[0] < 400) { http_response_code(400); echo json_encode(['error' => 'Use a picture at least 400 pixels wide']); exit; }
            $ext = ['png' => 'png', 'jpeg' => 'jpg', 'webp' => 'webp'][$m[1]];
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
        }
        foreach (glob($dir . '/' . $tenantId . '.*') ?: [] as $old) @unlink($old);
        if (!empty($body['cover_upload'])) {
            if (file_put_contents($dir . '/' . $tenantId . '.' . $ext, $bin, LOCK_EX) === false) { http_response_code(500); echo json_encode(['error' => 'Could not save the picture']); exit; }
            $url = '/admin/uploads/covers/' . $tenantId . '.' . $ext . '?v=' . time();
        }
        $tenant = loadTenant($pdo, $tenantId);
        $s = ft_tenant_settings($tenant);
        $s['cover'] = $url;
        $pdo->prepare("UPDATE tenants SET settings = ? WHERE id = ?")->execute([json_encode($s), $tenantId]);
        echo json_encode(['ok' => true, 'url' => $url, 'settings' => $s]);
        exit;
    }

    // ── visibility ─────────────────────────────────────────────────────────
    $allowed = ['public', 'unlisted', 'private'];
    if (isset($body['visibility'])) {
        $newVis = in_array($body['visibility'], $allowed, true) ? $body['visibility'] : 'private';
        $pdo->prepare("UPDATE tenants SET visibility = ? WHERE id = ?")->execute([$newVis, $tenantId]);
    }

    // ── per-field privacy (upsert) ──────────────────────────────────────────
    $validFields = array_keys(PRIVACY_FIELD_DEFAULTS);
    $validVis    = ['public', 'members', 'private'];
    $upsert = $pdo->prepare("INSERT INTO privacy_settings (tenant_id, field_key, visibility) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE visibility = VALUES(visibility)");
    foreach (($body['field_settings'] ?? []) as $fieldKey => $vis) {
        if (!in_array($fieldKey, $validFields, true) || !in_array($vis, $validVis, true)) continue;
        $upsert->execute([$tenantId, $fieldKey, $vis]);
    }

    // ── tree settings: emblem + accent ──────────────────────────────────────
    $tenant = loadTenant($pdo, $tenantId);
    $s = ft_tenant_settings($tenant);
    if (isset($body['settings']) && is_array($body['settings'])) {
        $in = $body['settings'];
        if (isset($in['emblem']) && is_array($in['emblem'])) {
            $e = $in['emblem'];
            if (isset($e['kind']) && in_array($e['kind'], ['none', 'builtin', 'upload'], true)) $s['emblem']['kind'] = $e['kind'];
            if (isset($e['id']) && preg_match('/^[a-z]{2,20}$/', $e['id'])) $s['emblem']['id'] = $e['id'];
            if (isset($e['color']) && preg_match('/^#[0-9a-fA-F]{6}$/', $e['color'])) $s['emblem']['color'] = strtoupper($e['color']);
            if ($s['emblem']['kind'] === 'upload' && empty($s['emblem']['url'])) $s['emblem']['kind'] = 'none';
        }
        if (isset($in['theme']) && in_array($in['theme'], FT_TREE_LOOKS, true)) $s['theme'] = $in['theme'];
        if (array_key_exists('hindu_calendar', $in)) $s['hindu_calendar'] = (bool)$in['hindu_calendar'];
        if (array_key_exists('accent', $in)) $s['accent'] = (is_string($in['accent']) && preg_match('/^#[0-9a-fA-F]{6}$/', $in['accent'])) ? strtoupper($in['accent']) : null;
        $pdo->prepare("UPDATE tenants SET settings = ? WHERE id = ?")->execute([json_encode($s), $tenantId]);
        ft_forget_emblem_cache($tenant['slug'] ?? '');
    }

    echo json_encode(['ok' => true, 'visibility' => $newVis ?? ($tenant['visibility'] ?? 'private'), 'settings' => $s]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

/** rendered emblem PNGs and the share card are cached per slug; drop them when the emblem changes */
function ft_forget_emblem_cache(string $slug): void {
    if ($slug === '') return;
    $dir = __DIR__ . '/uploads/og';
    foreach (array_merge(glob("$dir/$slug.png") ?: [], glob("$dir/emblem-$slug-*.png") ?: []) as $f) @unlink($f);
}
