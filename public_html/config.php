<?php
/**
 * config.php  –  Single shared configuration for all PHP files
 * Phase 0 hardened version: credentials via .env, CSRF, security headers
 *
 * IMPORTANT: After rotating your DB password on Hostinger, update .env only.
 * Never put credentials directly in this file.
 */

// The release, stamped on every script and style URL so browsers and CDNs refetch after an update
define('FT_VERSION', '8.6.0');

// ── 1. Load .env (pure-PHP, no Composer required) ──────────────────────────
function loadEnv(string $path): void {
    if (!file_exists($path)) {
        error_log('.env file not found at: ' . $path);
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;   // skip comments
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}
define('FT_ENV_FILE', getenv('FT_ENV_FILE') ?: __DIR__ . '/.env');
loadEnv(FT_ENV_FILE);

// ── 2. Session (secure, single start) ─────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    $https  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 7200,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name('family_tree_session');
    session_start();

    // Regenerate session ID every 30 minutes
    if (!isset($_SESSION['created_at'])) {
        $_SESSION['created_at'] = time();
    } elseif (time() - $_SESSION['created_at'] > 1800) {
        session_regenerate_id(true);
        $_SESSION['created_at'] = time();
    }

    // Generate CSRF token once per session
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

// ── 3. Database connection ─────────────────────────────────────────────────
// MySQL / MariaDB by default; DB_DRIVER=sqlite (DB_FILE=...) for the desktop app and
// small self-hosts. See includes/db.php. With no .env at all, the installer takes over.
require_once __DIR__ . '/includes/db.php';
if (!file_exists(FT_ENV_FILE) && !defined('FT_INSTALLER')) {
    $isInstall = str_contains($_SERVER['SCRIPT_NAME'] ?? '', '/install/');
    if (!$isInstall) { header('Location: /install/'); exit; }
}
try {
    $pdo = ft_connect(ft_db_config_from_env());
    // SQLite installs (and the desktop app) upgrade themselves: the schema file is safe to re-run,
    // so run it once per version. MySQL installs use install/upgrades/ by hand.
    if (file_exists(FT_ENV_FILE) && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $mark = ft_storage_dir() . '/schema-version';
        if (@file_get_contents($mark) !== FT_VERSION) {
            ft_run_sql_file($pdo, ft_schema_file('sqlite'));
            @file_put_contents($mark, FT_VERSION, LOCK_EX);
        }
    }
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    if (!defined('FT_INSTALLER')) {
        http_response_code(503);
        die(json_encode(['error' => 'Service temporarily unavailable']));
    }
    $pdo = null;
}

// ── 4. Security headers ────────────────────────────────────────────────────
header('X-Content-Type-Options: nosniff');
// an embedded tree (/embed/{slug}) may be framed by any site; everything else only by this one
if (defined('FT_EMBEDDABLE') && FT_EMBEDDABLE) header('Content-Security-Policy: frame-ancestors *');
else header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// ── 5. CSRF validation helper ──────────────────────────────────────────────
/**
 * Call at the top of any admin endpoint that mutates data (POST/PUT/DELETE).
 * Reads the token from the X-CSRF-Token request header and compares it to the
 * session token. Exits with 403 on mismatch.
 */
function validateCsrf(): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['GET', 'OPTIONS', 'HEAD'], true)) {
        return; // read-only requests do not need CSRF validation
    }
    $token    = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token']       ?? '';
    if (!$expected || !hash_equals($expected, $token)) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid or missing CSRF token']);
        exit;
    }
}

// ── 6. Activity logging ────────────────────────────────────────────────────
function logActivity(PDO $pdo, string $action, ?string $entity_type = null, ?int $entity_id = null, ?array $changes = null): void {
    if (!isset($_SESSION['admin_user']['id'])) return;
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO family_activity_logs
             (user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $_SESSION['admin_user']['id'],
            $action,
            $entity_type,
            $entity_id,
            $changes ? json_encode($changes) : null,
            $_SERVER['REMOTE_ADDR']      ?? null,
            $_SERVER['HTTP_USER_AGENT']  ?? null,
        ]);
    } catch (PDOException $e) {
        error_log('logActivity failed: ' . $e->getMessage());
    }
}

// ── 7. Permission check ────────────────────────────────────────────────────
function hasPermission(string $permission): bool {
    if (empty($_SESSION['admin_user'])) return false;
    $user = $_SESSION['admin_user'];
    if ($user['role'] === 'owner') return true;
    $perms = $user['permissions'] ?? [];
    return isset($perms[$permission]) && $perms[$permission] === true;
}

// ── 8. Rate limiting (file-based, Hostinger-safe) ─────────────────────────
function checkRateLimit(string $key, int $limit = 100, int $window = 3600): void {
    $ip         = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $identifier = md5($ip . $key);
    $file       = sys_get_temp_dir() . '/ft_rl_' . $identifier;
    $now        = time();
    $cutoff     = $now - $window;

    $attempts = [];
    if (file_exists($file)) {
        $attempts = json_decode(file_get_contents($file), true) ?: [];
        $attempts = array_values(array_filter($attempts, fn($t) => $t > $cutoff));
    }

    if (count($attempts) >= $limit) {
        http_response_code(429);
        header('Retry-After: ' . $window);
        echo json_encode(['error' => 'Too many requests. Please try again later.']);
        exit;
    }

    $attempts[] = $now;
    file_put_contents($file, json_encode($attempts), LOCK_EX);
}

// ── 9. Input sanitisation ──────────────────────────────────────────────────
function sanitizeInput($input, string $type = 'string') {
    if (is_array($input)) {
        return array_map(fn($i) => sanitizeInput($i, $type), $input);
    }
    return match ($type) {
        'int'   => filter_var($input, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE),
        'email' => filter_var($input, FILTER_SANITIZE_EMAIL),
        'url'   => filter_var($input, FILTER_SANITIZE_URL),
        default => htmlspecialchars(trim((string)$input), ENT_QUOTES, 'UTF-8'),
    };
}

// ── 10. Tenant resolution ─────────────────────────────────────────────────
/**
 * Returns the tenant_id for the current ADMIN session.
 * Exits with 403 if the session has no tenant_id (shouldn't happen after login).
 */
function getAdminTenantId(): string {
    if (!empty($_SESSION['tenant_id'])) {
        return (string)$_SESSION['tenant_id'];
    }
    // Fallback: if old session predates Phase 2, derive from env / hardcoded default
    $envTenant = getenv('APP_TENANT_ID') ?: '';
    return $envTenant;
}

/**
 * Returns the tenant_id for PUBLIC (unauthenticated) requests.
 * Reads APP_TENANT_ID from .env; empty when there is no default tree.
 * Future: resolve from subdomain or request header for full multi-tenancy.
 */
function getPublicTenantId(): string {
    return getenv('APP_TENANT_ID') ?: '';
}

/**
 * Updates the activity log helper to also record the tenant.
 * Overrides the function defined above – this version adds tenant_id.
 */
function logActivityWithTenant(PDO $pdo, string $action, ?string $entity_type = null, ?int $entity_id = null, ?array $changes = null, ?string $tenant_id = null): void {
    if (!isset($_SESSION['admin_user']['id'])) return;
    $tid = $tenant_id ?? getAdminTenantId();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO family_activity_logs
             (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $_SESSION['admin_user']['id'],
            $action,
            $entity_type,
            $entity_id,
            $changes ? json_encode($changes) : null,
            $_SERVER['REMOTE_ADDR']     ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $tid,
        ]);
    } catch (PDOException $e) {
        error_log('logActivityWithTenant failed: ' . $e->getMessage());
    }
}
