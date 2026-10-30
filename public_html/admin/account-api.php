<?php
// admin/account-api.php — update profile (display_name, email) and password

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

validateCsrf();

$tenantId = getAdminTenantId();
$userId   = (int)($_SESSION['admin_user']['id'] ?? 0);
$method   = $_SERVER['REQUEST_METHOD'];
$input    = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET' && isset($_GET['delete_plan'])) {
    // what deleting this account would touch: the trees it owns, and who could take each one over
    require_once __DIR__ . '/../includes/account-delete.php';
    $trees = array_map(fn($t) => ['id' => $t['id'], 'slug' => $t['slug'], 'display_name' => $t['display_name'],
        'needs_choice' => $t['needs_choice'],                 // deleting the account must decide this tree's fate
        'can_delete' => $t['can_delete'] && ($t['main_owner'] || $t['other_owner'] === null),
        'candidates' => array_map(fn($c) => ['id' => $c['id'], 'display_name' => $c['display_name'], 'role' => $c['role']], $t['candidates'])], ft_owned_trees($pdo, $userId));
    echo json_encode(['trees' => $trees]);
    exit;
}

if ($method === 'GET' && isset($_GET['digest'])) {
    try { $st = $pdo->prepare("SELECT digest FROM family_users WHERE id = ?"); $st->execute([$userId]); $on = (int)$st->fetchColumn() === 1; }
    catch (Throwable $e) { $on = false; }
    echo json_encode(['digest' => $on]); exit;
}

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT id, display_name, email, role FROM family_users WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$userId, $tenantId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($user ?: ['error' => 'Not found']);
    exit;
}

if ($method === 'POST') {
    $action = $input['action'] ?? '';

    if ($action === 'digest') {
        $pdo->prepare("UPDATE family_users SET digest = ? WHERE id = ?")->execute([!empty($input['on']) ? 1 : 0, $userId]);
        echo json_encode(['ok' => true, 'digest' => !empty($input['on'])]); exit;
    }

    if ($action === 'update_profile') {
        $name  = trim($input['display_name'] ?? '');
        $email = trim($input['email'] ?? '');

        if ($name === '' || $email === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Name and email are required']);
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email address']);
            exit;
        }

        // Check email uniqueness (not self)
        $stmt = $pdo->prepare("SELECT id FROM family_users WHERE email = ? AND id != ? AND tenant_id = ?");
        $stmt->execute([$email, $userId, $tenantId]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Email already in use']);
            exit;
        }

        $pdo->prepare("UPDATE family_users SET display_name = ?, email = ? WHERE id = ? AND tenant_id = ?")
            ->execute([$name, $email, $userId, $tenantId]);

        // Update session
        $_SESSION['admin_user']['display_name'] = $name;
        $_SESSION['admin_user']['email']        = $email;

        echo json_encode(['ok' => true, 'display_name' => $name, 'email' => $email]);
        exit;
    }

    if ($action === 'change_password') {
        $currentPw = $input['current_password'] ?? '';
        $newPw     = $input['new_password']     ?? '';
        $confirmPw = $input['confirm_password'] ?? '';

        if ($currentPw === '' || $newPw === '') {
            http_response_code(400);
            echo json_encode(['error' => 'All password fields are required']);
            exit;
        }
        if (strlen($newPw) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters']);
            exit;
        }
        if ($newPw !== $confirmPw) {
            http_response_code(400);
            echo json_encode(['error' => 'New passwords do not match']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT password_hash FROM family_users WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$userId, $tenantId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($currentPw, $user['password_hash'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Current password is incorrect']);
            exit;
        }

        $hash = password_hash($newPw, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE family_users SET password_hash = ? WHERE id = ? AND tenant_id = ?")
            ->execute([$hash, $userId, $tenantId]);

        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'delete_account') {
        checkRateLimit('account_delete', 5, 3600);
        if (($input['confirm'] ?? '') !== 'DELETE') {
            http_response_code(400);
            echo json_encode(['error' => 'Type DELETE to confirm']);
            exit;
        }
        $stmt = $pdo->prepare("SELECT password_hash FROM family_users WHERE id = ?");
        $stmt->execute([$userId]);
        $hash = $stmt->fetchColumn();
        if (!$hash || !password_verify((string)($input['password'] ?? ''), $hash)) {
            http_response_code(403);
            echo json_encode(['error' => 'That password is not right']);
            exit;
        }
        require_once __DIR__ . '/../includes/account-delete.php';
        try {
            $done = ft_delete_account($pdo, $userId, is_array($input['choices'] ?? null) ? $input['choices'] : []);
        } catch (InvalidArgumentException $e) {
            http_response_code(422);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        } catch (Throwable $e) {
            error_log('delete_account: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Something went wrong part-way through. Write to us and we will finish deleting it by hand.']);
            exit;
        }
        $_SESSION = [];
        session_destroy();
        echo json_encode(['ok' => true] + $done);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
