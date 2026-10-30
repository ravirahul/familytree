<?php
/**
 * og-image.php — 1200×630 share card for a tree (WhatsApp / social previews).
 * GET ?tree={slug}   Cached on disk per tree; regenerated when older than a day.
 */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';

$slug   = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['tree'] ?? '');
$tenant = $slug !== '' ? getPublicTenantBySlug($pdo, $slug) : null;
if (!$tenant || ($tenant['visibility'] ?? 'public') === 'private') {
    header('Location: /assets/og-home.png', true, 302);
    exit;
}

$cacheDir = __DIR__ . '/admin/uploads/og';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = $cacheDir . '/' . $slug . '.png';

if (!is_file($cacheFile) || filemtime($cacheFile) < time() - 86400) {
    require_once __DIR__ . '/includes/store.php';
    try { $count = ft_store($pdo, $tenant)->countMembers(); } catch (Throwable $e) { $count = 0; }
    $name  = $tenant['name'] ?? $tenant['display_name'] ?? 'Family Tree';

    $im = imagecreatetruecolor(1200, 630);
    $bg = imagecolorallocate($im, 14, 36, 27);
    $gold = imagecolorallocate($im, 201, 163, 94);
    $goldDark = imagecolorallocate($im, 59, 94, 79);
    $cream = imagecolorallocate($im, 247, 244, 236);
    $muted = imagecolorallocate($im, 201, 217, 208);
    imagefill($im, 0, 0, $bg);
    imagesetthickness($im, 2);
    imagerectangle($im, 28, 28, 1171, 601, $gold);
    imagesetthickness($im, 1);
    imagerectangle($im, 40, 40, 1159, 589, $goldDark);

    $serif = __DIR__ . '/assets/fonts/PlayfairDisplay-Bold.ttf';
    $sans  = __DIR__ . '/assets/fonts/PlusJakartaSans-Medium.ttf';
    $ttf   = function_exists('imagettftext') && is_file($serif) && is_file($sans);

    if ($ttf) {
        imagettftext($im, 30, 0, 90, 130, $gold, $serif, 'FamilyTree');
        // Shrink the name until it fits the card width
        $size = 64;
        do {
            $box = imagettfbbox($size, 0, $serif, $name);
            $w = $box[2] - $box[0];
            if ($w <= 1020) break;
            $size -= 4;
        } while ($size > 28);
        // Wrap to two lines if still too wide at the minimum
        $lines = [$name];
        if ($w > 1020) {
            $lines = explode("\n", wordwrap($name, 34, "\n", true));
            $lines = array_slice($lines, 0, 2);
        }
        $y = 290;
        foreach ($lines as $ln) { imagettftext($im, $size, 0, 90, $y, $cream, $serif, $ln); $y += $size + 24; }
        imagettftext($im, 24, 0, 90, $y + 30, $muted, $sans,
            ($count ? $count . ' family members · ' : '') . 'photos, stories, events and a memory book');
        imagettftext($im, 20, 0, 90, 560, $gold, $sans, (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'familytree')) . '/tree/' . $slug);
    } else {
        imagestring($im, 5, 90, 120, 'FamilyTree', $gold);
        imagestring($im, 5, 90, 280, $name, $cream);
        imagestring($im, 3, 90, 540, (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'familytree')) . '/tree/' . $slug, $gold);
    }
    // the family's emblem, top right, when it has one
    $emb = ft_tenant_settings($tenant)['emblem'];
    if ($emb['kind'] !== 'none') {
        $png = null;
        if ($emb['kind'] === 'upload' && $emb['url']) { $p = __DIR__ . parse_url($emb['url'], PHP_URL_PATH); if (is_file($p) && !str_ends_with($p, '.svg')) $png = @imagecreatefromstring((string)file_get_contents($p)); }
        else {
            $base = __DIR__ . '/assets/emblems/' . preg_replace('/[^a-z]/', '', $emb['id']) . '.png';
            if (is_file($base)) {
                $png = imagecreatefrompng($base); imagealphablending($png, false); imagesavealpha($png, true);
                [$r, $g, $b] = sscanf($emb['color'], '#%02x%02x%02x');
                for ($y = 0, $h = imagesy($png); $y < $h; $y++) for ($x = 0, $w = imagesx($png); $x < $w; $x++) {
                    $c = imagecolorat($png, $x, $y); $a = ($c >> 24) & 0x7F; if ($a === 127) continue;
                    $lum = (($c >> 16) & 0xFF) / 255;
                    imagesetpixel($png, $x, $y, imagecolorallocatealpha($png, (int)($r * $lum), (int)($g * $lum), (int)($b * $lum), $a));
                }
            }
        }
        if ($png) { $sw = imagesx($png); $sh = imagesy($png); $side = min($sw, $sh); imagealphablending($im, true); imagecopyresampled($im, $png, 930, 90, (int)(($sw - $side) / 2), (int)(($sh - $side) / 2), 180, 180, $side, $side); imagedestroy($png); }
    }
    imagepng($im, $cacheFile, 6);
    imagedestroy($im);
}

header('Content-Type: image/png');
header('Cache-Control: public, max-age=86400');
readfile($cacheFile);
