<?php
/**
 * includes/media-tools.php - photos are resized and stripped of camera data on upload, and each
 * tree has a storage cap (FT_TREE_STORAGE_MB in .env, default 1024).
 */

/** the storage cap of one tree, in bytes */
function ft_tree_quota(): int { return max(50, (int)(getenv('FT_TREE_STORAGE_MB') ?: 1024)) * 1048576; }

/** bytes this tree's uploaded files take: media plus portraits, only files under /admin/uploads/ */
function ft_tree_bytes(FamilyStore $store): int {
    $dir = dirname(__DIR__) . '/admin/uploads/';
    $urls = array_column($store->media(), 'url');
    foreach ($store->members() as $m) if (!empty($m['img'])) $urls[] = $m['img'];
    $seen = []; $n = 0;
    foreach ($urls as $u) {
        $path = parse_url((string)$u, PHP_URL_PATH) ?: '';
        if (!str_starts_with($path, '/admin/uploads/') || isset($seen[$path])) continue;
        $seen[$path] = true;
        $f = $dir . basename($path);
        if (is_file($f)) $n += filesize($f);
    }
    return $n;
}

/** refuse an upload that would take the tree over its cap; returns an error message or null */
function ft_quota_error(FamilyStore $store, int $incoming): ?string {
    $used = ft_tree_bytes($store); $cap = ft_tree_quota();
    if ($used + $incoming <= $cap) return null;
    $mb = fn($b) => number_format($b / 1048576, $b < 10 * 1048576 ? 1 : 0);
    return "This tree has used {$mb($used)} MB of its {$mb($cap)} MB. Remove some photos or videos to add more.";
}

/**
 * Shrink a photo in place: at most $max px on the long side, turned the right way up (EXIF),
 * re-encoded so camera data (GPS, device) is dropped. GIFs are left alone (they may move).
 * Returns the mime of the saved file.
 */
function ft_shrink_image(string $path, string $mime, int $max = 2000): string {
    if ($mime === 'image/gif' || !function_exists('imagecreatetruecolor')) return $mime;
    $src = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($path),
        'image/png'  => @imagecreatefrompng($path),
        'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
        default      => false,
    };
    if (!$src) return $mime;
    // phone photos are often stored sideways with an orientation flag
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $o = (int)(@exif_read_data($path)['Orientation'] ?? 1);
        $rot = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
        if ($rot) { $r = imagerotate($src, $rot, 0); if ($r) { imagedestroy($src); $src = $r; } }
    }
    $w = imagesx($src); $h = imagesy($src);
    $k = min(1, $max / max($w, $h));
    $nw = max(1, (int)round($w * $k)); $nh = max(1, (int)round($h * $k));
    $dst = imagecreatetruecolor($nw, $nh);
    if ($mime !== 'image/jpeg') { imagealphablending($dst, false); imagesavealpha($dst, true); }
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagedestroy($src);
    $ok = match ($mime) {
        'image/jpeg' => imagejpeg($dst, $path, 84),
        'image/png'  => imagepng($dst, $path, 7),
        'image/webp' => imagewebp($dst, $path, 84),
    };
    imagedestroy($dst);
    clearstatcache(true, $path);
    return $mime;
}
