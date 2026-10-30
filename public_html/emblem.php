<?php
/**
 * emblem.php - a tree's emblem as a PNG: the tab icon, the touch icon, and a
 * piece of the share card. GET ?tree={slug}&size=64 (16..512).
 *
 * Built-in emblems ship as white-on-transparent PNGs in assets/emblems/ (made by
 * tools/render-emblems.mjs); here they are tinted to the family's colour with GD.
 * Uploaded emblems are scaled to size. Results are cached per slug and size.
 */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';

$slug = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['tree'] ?? '');
$size = max(16, min(512, (int)($_GET['size'] ?? 64)));
$tenant = $slug !== '' ? getPublicTenantBySlug($pdo, $slug) : null;
if (!$tenant) { header('Location: /icon-192.png', true, 302); exit; }
$e = ft_tenant_settings($tenant)['emblem'];
if ($e['kind'] === 'none') { header('Location: /icon-192.png', true, 302); exit; }

$cacheDir = __DIR__ . '/admin/uploads/og';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheFile = "$cacheDir/emblem-$slug-$size.png";

if (!is_file($cacheFile) || filemtime($cacheFile) < time() - 86400) {
    $out = imagecreatetruecolor($size, $size);
    imagesavealpha($out, true); imagealphablending($out, false);
    imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
    imagealphablending($out, true);
    $src = null;
    if ($e['kind'] === 'upload' && $e['url']) {
        $path = __DIR__ . parse_url($e['url'], PHP_URL_PATH);
        if (is_file($path)) {
            if (str_ends_with($path, '.svg')) { /* GD cannot read SVG; the browser gets the file itself */ header('Location: ' . $e['url'], true, 302); exit; }
            $src = @imagecreatefromstring((string)file_get_contents($path));
        }
    } else {
        $base = __DIR__ . '/assets/emblems/' . preg_replace('/[^a-z]/', '', $e['id']) . '.png';
        if (is_file($base)) {
            $src = imagecreatefrompng($base);
            // tint: the base is white with alpha; multiply by the family colour
            [$r, $g, $b] = sscanf($e['color'], '#%02x%02x%02x');
            $w = imagesx($src); $h = imagesy($src);
            imagealphablending($src, false); imagesavealpha($src, true);
            for ($y = 0; $y < $h; $y++) for ($x = 0; $x < $w; $x++) {
                $c = imagecolorat($src, $x, $y); $a = ($c >> 24) & 0x7F;
                if ($a === 127) continue;
                $lum = (($c >> 16) & 0xFF) / 255;
                imagesetpixel($src, $x, $y, imagecolorallocatealpha($src, (int)($r * $lum), (int)($g * $lum), (int)($b * $lum), $a));
            }
        }
    }
    if ($src) {
        $sw = imagesx($src); $sh = imagesy($src); $side = min($sw, $sh);
        imagecopyresampled($out, $src, 0, 0, (int)(($sw - $side) / 2), (int)(($sh - $side) / 2), $size, $size, $side, $side);
        imagedestroy($src);
    }
    imagepng($out, $cacheFile, 6);
    imagedestroy($out);
}
header('Content-Type: image/png');
header('Cache-Control: public, max-age=86400');
readfile($cacheFile);
