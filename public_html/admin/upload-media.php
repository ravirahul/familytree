<?php
// admin/upload-media.php — video / audio upload for the Memory Book
// (images keep using upload-image.php, which also makes thumbnails)
require_once __DIR__ . '/config.php';
header('Content-Type: application/json');

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
$token    = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
$expected = $_SESSION['csrf_token'] ?? '';
if (!$expected || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid or missing CSRF token']);
    exit;
}
if (empty($_FILES['media']) || $_FILES['media']['error'] !== UPLOAD_ERR_OK) {
    $code = $_FILES['media']['error'] ?? -1;
    http_response_code(400);
    echo json_encode(['error' => in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
        ? 'File is larger than the server allows' : 'No file uploaded']);
    exit;
}

// MIME → [extension, type]; detected from file bytes, never from the filename
$allowed = [
    'video/mp4'       => ['mp4',  'video'],
    'video/webm'      => ['webm', 'video'],
    'video/quicktime' => ['mov',  'video'],
    'audio/mpeg'      => ['mp3',  'audio'],
    'audio/mp4'       => ['m4a',  'audio'],
    'audio/x-m4a'     => ['m4a',  'audio'],
    'audio/aac'       => ['aac',  'audio'],
    'audio/ogg'       => ['ogg',  'audio'],
    'audio/webm'      => ['webm', 'audio'],
    'audio/wav'       => ['wav',  'audio'],
    'audio/x-wav'     => ['wav',  'audio'],
];
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['media']['tmp_name']) ?: '';
if (!isset($allowed[$mime])) {
    http_response_code(400);
    echo json_encode(['error' => 'Unsupported file type (' . $mime . '). Use MP4/WebM/MOV video or MP3/M4A/OGG/WAV audio.']);
    exit;
}
[$ext, $type] = $allowed[$mime];
$max = $type === 'video' ? 200 * 1024 * 1024 : 30 * 1024 * 1024;   // ponytail: hard caps; raise with plan limits later
if ($_FILES['media']['size'] > $max) {
    http_response_code(400);
    echo json_encode(['error' => ($type === 'video' ? 'Videos' : 'Voice notes') . ' must be under ' . ($max / 1048576) . ' MB']);
    exit;
}

// the tree's storage cap (includes/media-tools.php); a data home we can't reach doesn't block the upload
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
require_once dirname(__DIR__) . '/includes/media-tools.php';
try {
    $qTenant = loadTenant($pdo, getAdminTenantId());
    if ($qTenant && ($qErr = ft_quota_error(ft_store($pdo, $qTenant), (int)$_FILES['media']['size']))) { http_response_code(413); echo json_encode(['error' => $qErr, 'code' => 'storage_full']); exit; }
} catch (Throwable $e) { error_log('storage cap check: ' . $e->getMessage()); }

$filename  = ($type === 'video' ? 'vid_' : 'aud_') . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$targetDir = __DIR__ . '/uploads';
if (!is_dir($targetDir)) mkdir($targetDir, 0755, true);
if (!move_uploaded_file($_FILES['media']['tmp_name'], $targetDir . '/' . $filename)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}
echo json_encode(['url' => '/admin/uploads/' . $filename, 'type' => $type]);
