<?php
// admin/upload-image.php
require_once __DIR__ . '/config.php';

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

// CSRF: csrfFetch sends the token as X-CSRF-Token header;
// fall back to POST field for any direct form submissions
$token    = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
$expected = $_SESSION['csrf_token'] ?? '';
if (!$expected || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid or missing CSRF token']);
    exit;
}

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$allowed     = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
$info        = getimagesize($_FILES['image']['tmp_name']);
if ($info === false || !array_key_exists($info['mime'], $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid image file']);
    exit;
}

if ($_FILES['image']['size'] > 25 * 1048576) { http_response_code(400); echo json_encode(['error' => 'Photos must be under 25 MB']); exit; }

// the tree's storage cap (includes/media-tools.php); a data home we can't reach doesn't block the upload
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/media-tools.php';
try {
    $qTenant = loadTenant($pdo, getAdminTenantId());
    if ($qTenant && ($qErr = ft_quota_error(ft_store($pdo, $qTenant), (int)$_FILES['image']['size']))) { http_response_code(413); echo json_encode(['error' => $qErr, 'code' => 'storage_full']); exit; }
} catch (Throwable $e) { error_log('storage cap check: ' . $e->getMessage()); }

// Use MIME-derived extension (safer than trusting filename)
$ext = $allowed[$info['mime']];
$filename = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;

$targetDir = __DIR__ . '/uploads';
if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}
$targetPath = $targetDir . '/' . $filename;

if (!move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save image']);
    exit;
}

// at most 2000 px, right way up, camera data (GPS, device) removed
ft_shrink_image($targetPath, $info['mime']);
$publicUrl = '/admin/uploads/' . $filename;

// Generate a lightweight 160x160 square thumbnail if GD is available
$thumbUrl = null;
if (extension_loaded('gd') && function_exists('imagecreatetruecolor')) {
    try {
        $srcImg = match ($info['mime']) {
            'image/jpeg' => @imagecreatefromjpeg($targetPath),
            'image/png'  => @imagecreatefrompng($targetPath),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($targetPath) : null,
            'image/gif'  => @imagecreatefromgif($targetPath),
            default      => null,
        };

        if ($srcImg) {
            $origW = imagesx($srcImg);
            $origH = imagesy($srcImg);
            $cropSize = min($origW, $origH);
            $srcX = (int)(($origW - $cropSize) / 2);
            $srcY = (int)(($origH - $cropSize) / 2);

            $thumbSize = 160;
            $thumbImg = imagecreatetruecolor($thumbSize, $thumbSize);

            imagealphablending($thumbImg, false);
            imagesavealpha($thumbImg, true);

            imagecopyresampled(
                $thumbImg, $srcImg,
                0, 0, $srcX, $srcY,
                $thumbSize, $thumbSize,
                $cropSize, $cropSize
            );

            $thumbFilename = 'thumb_' . pathinfo($filename, PATHINFO_FILENAME) . '.webp';
            $thumbPath = $targetDir . '/' . $thumbFilename;
            if (function_exists('imagewebp') && imagewebp($thumbImg, $thumbPath, 85)) {
                $thumbUrl = '/admin/uploads/' . $thumbFilename;
            }
            imagedestroy($thumbImg);
            imagedestroy($srcImg);
        }
    } catch (\Throwable $t) {
        error_log('Thumbnail generation failed: ' . $t->getMessage());
    }
}

echo json_encode([
    'url'       => $publicUrl,
    'thumb_url' => $thumbUrl ?: $publicUrl,
]);
