<?php
// sitemap.php — served as /sitemap.xml (rewrite in .htaccess). Lists the
// homepage and every public tree with its four views.
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');

$host = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
$urls = [[$host . '/', 'weekly', '1.0'], [$host . '/guide', 'monthly', '0.7']];
require_once __DIR__ . '/includes/guides.php';
foreach (array_keys(ft_guides()) as $gs) $urls[] = [$host . '/guide/' . $gs, 'monthly', '0.6'];
try {
    $stmt = $pdo->query("SELECT slug FROM tenants WHERE is_active = 1 AND visibility = 'public' AND slug IS NOT NULL AND slug <> ''");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $slug) {
        $base = $host . '/tree/' . rawurlencode($slug);
        $urls[] = [$base, 'weekly', '0.8'];
        foreach (['events', 'map', 'memories'] as $v) $urls[] = [$base . '/' . $v, 'monthly', '0.5'];
    }
} catch (PDOException $e) {
    error_log('sitemap.php: ' . $e->getMessage());
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as [$loc, $freq, $pri]) {
    echo "  <url><loc>" . htmlspecialchars($loc, ENT_XML1) . "</loc><changefreq>$freq</changefreq><priority>$pri</priority></url>\n";
}
echo "</urlset>\n";
