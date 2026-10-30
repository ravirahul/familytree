<?php
/**
 * api-geo.php — Resolve member location strings to coordinates for the map.
 * GET ?tree={slug}  →  { places: { "Ayodhya": [26.79, 82.20], ... }, pending: n }
 *
 * Coordinates come from the shared geo_cache table. Cache misses are looked up
 * on OpenStreetMap Nominatim (max GEO_BATCH per request, 1 req/s per their
 * policy) and stored, so repeat page loads never hit the network. When
 * `pending` > 0 the client re-requests after a short delay.
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json');

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';

const GEO_BATCH = 6;   // ponytail: Nominatim allows 1 req/s; 6 keeps a request under ~8s

try {
    $slug   = trim($_GET['tree'] ?? '');
    $tenant = $slug !== '' ? getPublicTenantBySlug($pdo, $slug) : loadTenant($pdo, getPublicTenantId());
    if (!$tenant) { http_response_code(404); echo json_encode(['error' => 'Tree not found']); exit; }
    $tenantId = $tenant['id'];

    $isOwner = !empty($_SESSION['admin_logged_in'])
            && !empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenantId;
    enforceTreeVisibility($tenant['visibility'], $isOwner);

    // Distinct places this tree references (from its data home)
    require_once __DIR__ . '/includes/store.php';
    $places = [];
    foreach (ft_store($pdo, $tenant)->members() as $m)
        foreach (['birth_location', 'current_location', 'death_location'] as $k) { $v = trim((string)($m[$k] ?? '')); if ($v !== '') $places[$v] = true; }
    $places = array_keys($places);
    if (!$places) { echo json_encode(['places' => new stdClass, 'pending' => 0]); exit; }

    // Cached
    $in = implode(',', array_fill(0, count($places), '?'));
    $c  = $pdo->prepare("SELECT place, lat, lng FROM geo_cache WHERE place IN ($in)");
    $c->execute($places);
    $out = [];
    $cached = [];
    foreach ($c->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $cached[$r['place']] = true;
        if ($r['lat'] !== null) $out[$r['place']] = [(float)$r['lat'], (float)$r['lng']];
    }

    // Misses → Nominatim (bounded)
    $missing = array_values(array_filter($places, fn($p) => !isset($cached[$p])));
    $batch   = array_slice($missing, 0, GEO_BATCH);
    $ins     = $pdo->prepare("INSERT IGNORE INTO geo_cache (place, lat, lng) VALUES (?, ?, ?)");
    foreach ($batch as $i => $place) {
        if ($i > 0) sleep(1);
        $coords = geocode($place);
        $ins->execute([$place, $coords[0] ?? null, $coords[1] ?? null]);
        if ($coords) $out[$place] = $coords;
    }

    echo json_encode([
        'places'  => $out ?: new stdClass,
        'pending' => max(0, count($missing) - count($batch)),
    ]);

} catch (Throwable $e) {
    error_log('api-geo.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

/** Look a place up on Nominatim. Returns [lat, lng] or null. */
function geocode(string $place): ?array {
    $url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' . rawurlencode($place);
    $ctx = stream_context_create(['http' => [
        'timeout' => 6,
        'header'  => "User-Agent: FamilyTree/1.0 (" . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost')) . ")\r\n",
    ]]);
    $json = @file_get_contents($url, false, $ctx);
    if ($json === false) return null;
    $data = json_decode($json, true);
    if (!is_array($data) || empty($data[0]['lat'])) return null;
    return [round((float)$data[0]['lat'], 6), round((float)$data[0]['lon'], 6)];
}
