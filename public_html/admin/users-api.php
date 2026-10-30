<?php
// admin/users-api.php – Phase 2: tenant-scoped user management
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Validate CSRF token for mutating requests
validateCsrf();

global $pdo;

$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
$tenantId = getAdminTenantId();   // Phase 2: tenant scope

function sanitizePermissions($value) {
    if ($value === null) return null;
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }
        return null;
    }
    if (is_array($value)) return $value;
    return null;
}

if ($method === 'GET') {
    if ($id) {
        // Single user – must belong to the same tenant
        $stmt = $pdo->prepare("
            SELECT u.*, m.name AS member_name, m.nickname AS member_nickname, m.img AS member_img
            FROM family_users u
            LEFT JOIN family_tree_data m ON u.member_id = m.id AND m.tenant_id = ?
            WHERE u.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$tenantId, $id, $tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $row['permissions'] = $row['permissions'] ? json_decode($row['permissions'], true) : null;
        }
        echo json_encode($row ?: ['error' => 'Not found']);
    } else {
        // All users for this tenant.
        // Multi-tree: memberships live in tenant_users (role/permissions per tree).
        // Falls back to the legacy single-tenant query if the junction table
        // hasn't been migrated yet.
        try {
            $stmt = $pdo->prepare("
                SELECT u.id, u.email, u.display_name, u.created_at, u.last_login_at,
                       tu.role, tu.permissions, tu.member_id,
                       m.name AS member_name, m.nickname AS member_nickname, m.img AS member_img
                FROM tenant_users tu
                JOIN family_users u ON u.id = tu.user_id
                LEFT JOIN family_tree_data m ON m.id = tu.member_id AND m.tenant_id = ?
                WHERE tu.tenant_id = ?
                ORDER BY u.id
            ");
            $stmt->execute([$tenantId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            // Legacy fallback (pre-migration)
            $stmt = $pdo->prepare("
                SELECT u.*, m.name AS member_name, m.nickname AS member_nickname, m.img AS member_img
                FROM family_users u
                LEFT JOIN family_tree_data m ON u.member_id = m.id AND m.tenant_id = ?
                WHERE u.tenant_id = ?
                ORDER BY u.id
            ");
            $stmt->execute([$tenantId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        foreach ($rows as &$row) {
            $row['permissions'] = $row['permissions'] ? json_decode($row['permissions'], true) : null;
        }
        unset($row);
        echo json_encode($rows);
    }
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'POST') {
    $email       = trim($input['email']        ?? '');
    $displayName = trim($input['display_name'] ?? '');
    $password    = $input['password']          ?? '';
    $role        = $input['role']              ?? 'viewer';
    $memberId    = !empty($input['member_id']) ? (int)$input['member_id'] : null;
    $permissions = sanitizePermissions($input['permissions'] ?? null);

    $allowedRoles = ['owner', 'editor', 'viewer'];
    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid role. Must be one of: owner, editor, viewer']);
        exit;
    }

    if ($email === '' || $displayName === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Email, display_name and password are required']);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if (!$passwordHash) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to hash password']);
        exit;
    }

    $permJson = $permissions ? json_encode($permissions) : null;

    // INSERT with tenant_id so user is scoped to the correct tenant
    $stmt = $pdo->prepare("
        INSERT INTO family_users (member_id, email, password_hash, display_name, role, permissions, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    try {
        $stmt->execute([$memberId, $email, $passwordHash, $displayName, $role, $permJson, $tenantId]);
        $newId = (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            // Multi-tree: the email already has an account — add them to THIS
            // tree instead of failing (their existing password stays valid).
            $find = $pdo->prepare("SELECT id FROM family_users WHERE email = ? LIMIT 1");
            $find->execute([$email]);
            $existing = $find->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                try {
                    $pdo->prepare("INSERT INTO tenant_users (tenant_id, user_id, role, permissions, member_id)
                                   VALUES (?, ?, ?, ?, ?)")
                        ->execute([$tenantId, (int)$existing['id'], $role, $permJson, $memberId]);
                    echo json_encode(['ok' => true, 'id' => (int)$existing['id'],
                                      'message' => 'Existing account added to this tree.']);
                } catch (PDOException $e2) {
                    http_response_code(400);
                    echo json_encode(['error' => 'That user is already a member of this tree.']);
                }
                exit;
            }
            http_response_code(400);
            echo json_encode(['error' => 'Email already exists']);
            exit;
        }
        http_response_code(500);
        echo json_encode(['error' => 'DB error']);
        exit;
    }

    // Multi-tree: mirror the membership into the junction table
    try {
        $pdo->prepare("INSERT IGNORE INTO tenant_users (tenant_id, user_id, role, permissions, member_id)
                       VALUES (?, ?, ?, ?, ?)")
            ->execute([$tenantId, $newId, $role, $permJson, $memberId]);
    } catch (PDOException $e) { /* pre-migration — ignore */ }
    $stmt = $pdo->prepare("SELECT * FROM family_users WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$newId, $tenantId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $row['permissions'] = $row['permissions'] ? json_decode($row['permissions'], true) : null;
    }
    echo json_encode($row);
    exit;

} elseif ($method === 'PUT' && $id) {

    $email       = isset($input['email'])        ? trim($input['email'])        : null;
    $displayName = isset($input['display_name']) ? trim($input['display_name']) : null;
    $password    = $input['password']            ?? null;
    $role        = $input['role']                ?? null;
    $memberId    = array_key_exists('member_id', $input) ? (int)$input['member_id'] : null;
    $permissions = array_key_exists('permissions', $input) ? sanitizePermissions($input['permissions']) : null;

    $fields = [];
    $params = [];

    if ($email !== null) {
        $fields[] = 'email = ?';
        $params[] = $email;
    }
    if ($displayName !== null) {
        $fields[] = 'display_name = ?';
        $params[] = $displayName;
    }
    if ($role !== null) {
        $allowedRoles = ['owner', 'editor', 'viewer'];
        if (!in_array($role, $allowedRoles, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid role. Must be one of: owner, editor, viewer']);
            exit;
        }
        $fields[] = 'role = ?';
        $params[] = $role;
    }
    if ($memberId !== null) {
        $fields[] = 'member_id = ?';
        $params[] = $memberId ?: null;
    }
    if ($permissions !== null) {
        $fields[] = 'permissions = ?';
        $params[] = $permissions ? json_encode($permissions) : null;
    }
    if ($password !== null && $password !== '') {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if (!$passwordHash) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to hash password']);
            exit;
        }
        $fields[] = 'password_hash = ?';
        $params[] = $passwordHash;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }

    // WHERE includes tenant_id – cannot edit a user outside your tenant
    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE family_users SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
    $stmt = $pdo->prepare($sql);

    try {
        $stmt->execute($params);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(400);
            echo json_encode(['error' => 'Email already exists']);
            exit;
        }
        http_response_code(500);
        echo json_encode(['error' => 'DB error']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM family_users WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $row['permissions'] = $row['permissions'] ? json_decode($row['permissions'], true) : null;
    }
    echo json_encode($row);
    exit;

} elseif ($method === 'DELETE' && $id) {

    // Scoped delete – cannot delete a user from another tenant
    $stmt = $pdo->prepare("DELETE FROM family_users WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    http_response_code(204);
    exit;

}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
