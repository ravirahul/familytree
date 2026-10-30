<?php
/**
 * admin/apikeys-api.php - keys for the Claude connector (mcp.php), for the signed-in account.
 *   GET            the account's keys (never the key itself: only a hash is stored)
 *   POST {label}   a new key; the connector URL is returned once, here, and never again
 *   DELETE ?id=    revoke a key
 */
if (!defined('FT_APP')) define('FT_APP', 1);
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
if (empty($_SESSION['admin_logged_in']) || empty($_SESSION['admin_user']['id'])) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }
validateCsrf();
$uid = (int)$_SESSION['admin_user']['id'];
try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $st = $pdo->prepare("SELECT id, label, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC");
        $st->execute([$uid]);
        echo json_encode(['keys' => $st->fetchAll()]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $label = mb_substr(trim((string)($body['label'] ?? '')), 0, 100) ?: 'Claude';
        $n = $pdo->prepare("SELECT COUNT(*) FROM api_keys WHERE user_id = ?"); $n->execute([$uid]);
        if ((int)$n->fetchColumn() >= 10) throw new RuntimeException('Ten keys at most; revoke one you no longer use.');
        $key = 'ftk_' . bin2hex(random_bytes(24));
        $pdo->prepare("INSERT INTO api_keys (user_id, key_hash, label, created_at) VALUES (?, ?, ?, NOW())")->execute([$uid, hash('sha256', $key), $label]);
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        echo json_encode(['ok' => true, 'url' => ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/mcp?key=' . $key, 'label' => $label]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $pdo->prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")->execute([(int)($_GET['id'] ?? 0), $uid]);
        echo json_encode(['ok' => true]); exit;
    }
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e instanceof PDOException ? 'The connector keys table is missing; run install/upgrades/2026-10-28-api-keys.sql.' : $e->getMessage()]);
}
