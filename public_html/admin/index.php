<?php
// session_start() intentionally removed - config.php handles it
// with the correct session name ('family_tree_session') and cookie params
require_once 'config.php';

// Login using family_users table
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $tok = $_POST['csrf_token'] ?? '';
    $exp = $_SESSION['csrf_token'] ?? '';
    if (!$exp || !hash_equals($exp, $tok)) {
        $loginError = 'Invalid form session. Please refresh and try again.';
    } else {
        checkRateLimit('admin_login', 10, 900);
        $email    = trim($_POST['username'] ?? '');   // login field called "username" but holds email
        $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $loginError = 'Email and password are required';
    } else {
        $stmt = $pdo->prepare("
            SELECT u.*, m.name AS member_name, m.nickname AS member_nickname, m.img AS member_img
            FROM family_users u
            LEFT JOIN family_tree_data m ON u.member_id = m.id
            WHERE u.email = ?
            LIMIT 1
        ");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (
            !$user ||
            empty($user['password_hash']) ||
            !password_verify($password, $user['password_hash'])
        ) {
            $loginError = 'Invalid credentials';
        } else {
            $upd = $pdo->prepare("UPDATE family_users SET last_login_at = NOW() WHERE id = ?");
            $upd->execute([$user['id']]);

            $tenantId = !empty($user['tenant_id'])
                ? $user['tenant_id']
                : (getenv('APP_TENANT_ID') ?: '');

            $_SESSION['admin_logged_in'] = true;
            $_SESSION['tenant_id']       = $tenantId;
            $_SESSION['admin_user'] = [
                'id'           => (int)$user['id'],
                'display_name' => $user['display_name'],
                'email'        => $user['email'],
                'role'         => $user['role'],
                'permissions'  => $user['permissions'] ? json_decode($user['permissions'], true) : null,
                'member_id'    => $user['member_id'] ? (int)$user['member_id'] : null,
                'avatar_url'   => $user['member_img'] ?: null,
                'tenant_id'    => $tenantId,
            ];

            $redirect = !empty($_GET['welcome']) ? 'index.php?welcome=1' : 'index.php';
            header('Location: ' . $redirect);
            exit;
        }
    }
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// User data for JS
$adminUserJson = '';
if (!empty($_SESSION['admin_user'])) {
    $adminUserJson = json_encode([
        'id'           => $_SESSION['admin_user']['id'],
        'display_name' => $_SESSION['admin_user']['display_name'],
        'email'        => $_SESSION['admin_user']['email'],
        'role'         => $_SESSION['admin_user']['role'],
        'member_id'    => $_SESSION['admin_user']['member_id'],
        'avatar_url'   => $_SESSION['admin_user']['avatar_url'],
        'tenant_id'    => $_SESSION['admin_user']['tenant_id'] ?? ($_SESSION['tenant_id'] ?? null),
    ]);
}

// Resolve live family tree URL for current tenant
$curTenantSlug = '';
$curTenantName = '';
$adminTenantId = $_SESSION['admin_user']['tenant_id'] ?? ($_SESSION['tenant_id'] ?? null);
if (!empty($adminTenantId)) {
    try {
        $tStmt = $pdo->prepare("SELECT slug, display_name FROM tenants WHERE id = ? LIMIT 1");
        $tStmt->execute([$adminTenantId]);
        $tRow = $tStmt->fetch(PDO::FETCH_ASSOC);
        if ($tRow) {
            $curTenantSlug = $tRow['slug'];
            $curTenantName = $tRow['display_name'];
        }
    } catch (Throwable $e) {}
}
$liveTreeUrl = $curTenantSlug ? ('/tree/' . urlencode($curTenantSlug)) : '/';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php if (!empty($_SESSION['admin_logged_in'])): ?><title>Admin · FamilyTree</title><?php endif; ?>
<?php if (empty($_SESSION['admin_logged_in'])): ?>
<title>Log in · FamilyTree</title>
<script>try { document.documentElement.setAttribute('data-theme', localStorage.getItem('family_tree_theme') === 'dark' ? 'dark' : 'light'); } catch (e) {}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/auth.css?v=<?= FT_VERSION ?>">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<?php else:
    if (!defined('FT_APP')) define('FT_APP', 1);
    require_once __DIR__ . '/../includes/brand.php';
    echo ft_brand_head(); ?>
<script>try { document.documentElement.setAttribute('data-theme', localStorage.getItem('familyAdminTheme') === 'dark' ? 'dark' : 'light'); } catch (e) {}</script>
<link rel="stylesheet" href="css/admin.css?v=<?= FT_VERSION ?>">
<?php endif; ?>
<?php if (!empty($_SESSION['csrf_token'])): ?>
<meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token']) ?>">
<?php endif; ?>
</head>
<body<?php if (empty($_SESSION['admin_logged_in'])): ?> class="auth"<?php endif; ?>>

<?php if (empty($_SESSION['admin_logged_in'])): ?>
<!-- ═══════════════════════════════════════════════════════
     LOGIN SCREEN
═══════════════════════════════════════════════════════════ -->
<?php if (!defined('FT_APP')) define('FT_APP', 1);
      $authHeadline = 'Welcome back to your family.';
      $authLede = 'Pick up where you left off: new photos, birthdays this week, and the relatives still waiting to be added.';
      $eye = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g></svg>'; ?>
<div class="auth-shell">
  <?php require __DIR__ . '/../includes/auth-side.php'; ?>
  <main class="auth-main">
    <div class="auth-top">
      <a href="/" class="auth-brand"><svg width="26" height="26" viewBox="3 3 22 23.5" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25V15.5M14 21l-5.2-5.2M14 18.5l5.2-5.2M14 15.5V9.6M9.5 25h9"/><circle cx="7.2" cy="14.2" r="2.4"/><circle cx="20.8" cy="11.7" r="2.4"/><circle cx="14" cy="7" r="2.4"/></g></svg>FamilyTree</a>
    </div>
    <div class="auth-box">
      <h1>Log in</h1>
      <p class="auth-sub">Use the email your family tree account was made with.</p>

      <?php if (isset($loginError)): ?>
        <div class="alert" role="alert"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></g></svg><span><?= htmlspecialchars($loginError === 'Invalid credentials' ? "That email and password don't match. Check them, or reset your password." : $loginError) ?></span></div>
      <?php endif; ?>

      <form method="post" id="loginForm">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'] ?? '') ?>">
        <div class="f">
          <label for="username">Email</label>
          <input type="email" id="username" name="username" class="in" value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
                 placeholder="you@example.com" autocomplete="email" inputmode="email" required autofocus>
        </div>
        <div class="f">
          <div class="f-head"><label for="password">Password</label><a href="forgot-password.php">Forgot password?</a></div>
          <div class="pw">
            <input type="password" id="password" name="password" class="in" autocomplete="current-password" required>
            <button type="button" class="pw-btn" data-pw="password" aria-label="Show password" aria-pressed="false"><?= $eye ?></button>
          </div>
        </div>
        <input type="hidden" name="login" value="1">
        <button type="submit" class="btn-main">Log in</button>
      </form>

    </div>
  </main>
</div>
<script>
document.querySelectorAll('.pw-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    var i = document.getElementById(b.dataset.pw), show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', show ? 'true' : 'false');
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});
document.getElementById('loginForm').addEventListener('submit', function () {
  var btn = this.querySelector('.btn-main'); setTimeout(function () { btn.disabled = true; btn.textContent = 'Logging in…'; }, 0);
});
</script>

<?php else: ?>
<!-- ═══════════════════════════════════════════════════════
     MAIN ADMIN PANEL
═══════════════════════════════════════════════════════════ -->
<div class="app-shell">

    <!-- ── Sidebar ─────────────────────────────────────────────── -->
    <aside class="sidebar" id="sidebar">

        <!-- Logo -->
        <a href="#" class="sb-logo" aria-label="FamilyTree Admin, go to dashboard" onclick="showPage('dashboard');return false;">
            <span class="sb-logo-icon"><?= ft_logo(30) ?></span>
            <div>
                <span class="sb-logo-text">FamilyTree</span>
                <span class="sb-logo-sub">Admin</span>
            </div>
        </a>

        <!-- Direct Live Tree Link -->
        <div style="padding: 10px 14px 4px 14px;">
            <a href="<?= htmlspecialchars($liveTreeUrl) ?>" target="_blank" class="sb-tree-jump-link" title="Open your live family tree in a new tab">
                <span class="sb-tree-jump-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M12 15a7 7 0 0 0 7-7c0-2-1.5-3.5-3.5-3.5A6 6 0 0 0 4 8c0 3.87 3.58 7 8 7z"/></svg></span>
                <span class="sb-tree-jump-text">View Family Tree</span>
                <span class="sb-tree-jump-arrow">↗</span>
            </a>
        </div>

        <!-- Navigation -->
        <nav class="sb-nav">

            <span class="sb-section-label">Overview</span>

            <button class="sb-item active" id="navDashboard" onclick="showPage('dashboard')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                </span>
                Dashboard
            </button>

            <span class="sb-section-label">Manage</span>

            <button class="sb-item" id="navMembers" onclick="showPage('members')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </span>
                Members
            </button>

            <button class="sb-item" id="navUsers" onclick="showPage('users')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </span>
                Users
            </button>

            <button class="sb-item" id="navPhotos" onclick="showPage('photos')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="M21 15l-5-5L5 21"/>
                    </svg>
                </span>
                Photos
            </button>

            <button class="sb-item" id="navTidy" onclick="showPage('tidy')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>
                    </svg>
                </span>
                Tidy up
            </button>

            <span class="sb-section-label">Settings</span>

            <button class="sb-item" id="navSettings" onclick="showPage('settings')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/>
                    </svg>
                </span>
                Tree Settings
            </button>

            <span class="sb-section-label">Account</span>

            <button class="sb-item" id="navActivity" onclick="showPage('activity')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                </span>
                Activity Log
            </button>

            <button class="sb-item" id="navAccount" onclick="showPage('account')">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </span>
                Profile
            </button>
            <a class="sb-item" href="/guide" target="_blank" rel="noopener" style="text-decoration:none">
                <span class="sb-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>
                </span>
                Guide
            </a>

        </nav>

        <!-- User + Logout -->
        <div class="sb-bottom">
            <!-- User info row -->
            <div class="sb-user-row">
                <div class="sb-user-avatar">
                    <?php
                    $avatarUrl = $_SESSION['admin_user']['avatar_url'] ?? null;
                    $displayName = $_SESSION['admin_user']['display_name'] ?? 'User';
                    if ($avatarUrl): ?>
                        <img src="<?= htmlspecialchars($avatarUrl) ?>" alt="">
                    <?php else:
                        echo htmlspecialchars(strtoupper(substr($displayName, 0, 1)));
                    endif; ?>
                </div>
                <div class="sb-user-info">
                    <div class="sb-user-name"><?= htmlspecialchars($displayName) ?></div>
                    <div class="sb-user-role"><?= htmlspecialchars($_SESSION['admin_user']['role'] ?? 'admin') ?></div>
                </div>
            </div>
            <!-- Action buttons always visible — no popup needed -->
            <div class="sb-bottom-actions">
                <button class="sb-action-btn" onclick="showPage('account')" title="My Profile">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    Profile
                </button>
                <a class="sb-action-btn sb-logout" href="?logout=1" title="Log Out">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Log Out
                </a>
            </div>
        </div>
    </aside>

    <!-- ── Main Content ─────────────────────────────────────────── -->
    <div class="main-content">

        <!-- Top Bar -->
        <div class="top-bar">
            <!-- Mobile sidebar toggle -->
            <button class="sb-mobile-toggle" onclick="document.getElementById('sidebar').classList.toggle('sb-open')">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>
            <span class="top-bar-title" id="topBarTitle">Dashboard</span>
            <div class="top-bar-actions">
                <a href="<?= htmlspecialchars($liveTreeUrl) ?>" target="_blank" class="btn-topbar-tree" title="Open your live family tree in a new tab">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><path d="M12 22v-7"/><path d="M12 15a7 7 0 0 0 7-7c0-2-1.5-3.5-3.5-3.5A6 6 0 0 0 4 8c0 3.87 3.58 7 8 7z"/></svg><span>View Live Tree</span> ↗
                </a>
                <button class="theme-toggle" onclick="toggleTheme()" id="themeToggle" title="Toggle theme">
                    <svg id="themeIcon" viewBox="0 0 24 24" width="16" height="16"></svg>
                </button>
            </div>
        </div>

        <!-- Page Body -->
        <div class="page-body">

            <?php if (!empty($_GET['welcome'])): ?>
            <div class="welcome-banner" id="welcomeBanner">
                <div class="wb-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M12 15a7 7 0 0 0 7-7c0-2-1.5-3.5-3.5-3.5A6 6 0 0 0 4 8c0 3.87 3.58 7 8 7z"/></svg></div>
                <div style="flex:1;">
                    <h2>Welcome, <?= htmlspecialchars($displayName) ?>! Your family tree is ready.</h2>
                    <p>Get started by adding your first family member below.</p>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button class="btn btn-primary"
                                onclick="document.getElementById('welcomeBanner').style.display='none'; showPage('members'); setTimeout(()=>document.getElementById('newMemberBtn')?.click(),200);">
                            + Add First Member
                        </button>
                        <button class="btn btn-ghost"
                                onclick="document.getElementById('welcomeBanner').style.display='none';">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <!-- ── DASHBOARD PAGE ─────────────────────────────────── -->
            <div class="admin-page active" id="pageDashboard">
                <div class="page-header">
                    <h2>Dashboard</h2>
                    <p>Overview of your family tree</p>
                </div>

                <!-- Stats -->
                <div class="stats-grid" id="dashStats" aria-busy="true">
                    <div class="stat-card">
                        <div class="stat-card-top">
                            <div class="stat-icon indigo">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </div>
                        </div>
                        <div class="stat-value" id="statMembers"><span class="sk" aria-hidden="true"></span></div>
                        <div class="stat-label">Total Members</div>
                        <div class="stat-sublabel" id="statMembersLimit"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-top">
                            <div class="stat-icon green">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                        </div>
                        <div class="stat-value" id="statUsers"><span class="sk" aria-hidden="true"></span></div>
                        <div class="stat-label">Registered Users</div>
                        <div class="stat-sublabel" id="statUsersLimit"></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-top">
                            <div class="stat-icon blue">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                            </div>
                        </div>
                        <div class="stat-value" id="statMedia"><span class="sk" aria-hidden="true"></span></div>
                        <div class="stat-label">Photos &amp; Media</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-top">
                            <div class="stat-icon orange">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                        </div>
                        <div class="stat-value" id="statEvents"><span class="sk" aria-hidden="true"></span></div>
                        <div class="stat-label">Upcoming Events</div>
                        <div class="stat-sublabel">next 30 days</div>
                    </div>
                </div>

                <!-- Dash grid: Activity + Events -->
                <div class="dash-grid">
                    <!-- Recent Activity -->
                    <div class="card">
                        <div class="card-header">
                            <h3>Recent Activity</h3>
                            <button class="btn btn-ghost btn-sm" onclick="showPage('activity')">View all</button>
                        </div>
                        <div class="card-body">
                            <div id="dashActivity" data-sk="rows" data-n="5"></div>
                        </div>
                    </div>

                    <!-- Upcoming Events + Usage -->
                    <div style="display:flex;flex-direction:column;gap:20px;">
                        <div class="card">
                            <div class="card-header"><h3>Upcoming Events</h3></div>
                            <div class="card-body">
                                <div id="dashEvents" data-sk="rows" data-n="3"></div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3>Usage</h3>
                            </div>
                            <div class="card-body">
                                <div id="dashUsage" data-sk="lines" data-n="2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── MEMBERS PAGE ───────────────────────────────────── -->
            <div class="admin-page" id="pageMembers">
                <?php require __DIR__ . '/members.php'; ?>
            </div>

            <!-- ── USERS PAGE ─────────────────────────────────────── -->
            <div class="admin-page" id="pageUsers">
                <?php require __DIR__ . '/users.php'; ?>
            </div>

            <!-- ── PHOTOS PAGE ────────────────────────────────────── -->
            <div class="admin-page" id="pagePhotos">
                <?php require __DIR__ . '/photos.php'; ?>
            </div>

            <!-- ── TIDY UP PAGE: duplicates, bin, history ─────────── -->
            <div class="admin-page" id="pageTidy">
                <?php require __DIR__ . '/tidy.php'; ?>
            </div>

            <!-- ── TREE SETTINGS PAGE ─────────────────────────────── -->
            <div class="admin-page" id="pageSettings">
                <?php require __DIR__ . '/settings.php'; ?>
            </div>

            <!-- ── ACTIVITY LOG PAGE ──────────────────────────────── -->
            <div class="admin-page" id="pageActivity">
                <div class="page-header-row">
                    <h2>Activity Log</h2>
                </div>
                <div class="card">
                    <div class="card-header" style="padding-bottom:14px;">
                        <h3>All Actions</h3>
                        <div class="toolbar" style="margin:0;">
                            <div class="search-box" style="max-width:240px;">
                                <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/></svg>
                                <input type="text" id="activitySearch" placeholder="Filter by action..." oninput="filterActivity()">
                            </div>
                            <select class="form-control" id="activityFilter" style="width:150px;" onchange="filterActivity()">
                                <option value="">All types</option>
                                <option value="member_add">Member added</option>
                                <option value="member_update">Member updated</option>
                                <option value="member_delete">Member deleted</option>
                                <option value="user_add">User added</option>
                                <option value="media_upload">Media upload</option>
                            </select>
                        </div>
                    </div>
                    <div class="card-body" style="padding-top:0;">
                        <div id="activityList" data-sk="rows" data-n="6"></div>
                        <div id="activityPager" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;"></div>
                    </div>
                </div>
            </div>

            <!-- ── ACCOUNT / PROFILE PAGE ─────────────────────────── -->
            <div class="admin-page" id="pageAccount">
                <?php require __DIR__ . '/account.php'; ?>
            </div>

        </div><!-- /.page-body -->
    </div><!-- /.main-content -->
</div><!-- /.app-shell -->

<!-- Toast -->
<div id="toast"></div>

<!-- Scripts -->
<script src="js/common.js?v=<?= FT_VERSION ?>"></script>
<script src="js/members.js?v=<?= FT_VERSION ?>"></script>
<script src="js/users.js?v=<?= FT_VERSION ?>"></script>
<script src="js/media.js?v=<?= FT_VERSION ?>"></script>
<script src="js/settings.js?v=<?= FT_VERSION ?>"></script>
<script src="js/datahome.js?v=<?= FT_VERSION ?>"></script>
<script src="/assets/emblems.js?v=<?= FT_VERSION ?>"></script>
<script src="/assets/tree-themes.js?v=<?= FT_VERSION ?>"></script>
<script src="js/emblem.js?v=<?= FT_VERSION ?>"></script>
<script src="js/import.js?v=<?= FT_VERSION ?>"></script>
<script src="js/connect.js?v=<?= FT_VERSION ?>"></script>
<script src="js/dashboard.js?v=<?= FT_VERSION ?>"></script>
<script src="js/activity.js?v=<?= FT_VERSION ?>"></script>
<script src="js/tidy.js?v=<?= FT_VERSION ?>"></script>
<script src="js/account.js?v=<?= FT_VERSION ?>"></script>
<script src="js/onboarding.js?v=<?= FT_VERSION ?>"></script>

<script>
// ── Session data ──────────────────────────────────────────
const ADMIN_USER = <?= $adminUserJson ?: 'null' ?>;

// ── Toast helper (global) ─────────────────────────────────
function showToast(msg, type) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'show' + (type ? ' toast-' + type : '');
    clearTimeout(t._tid);
    t._tid = setTimeout(function() { t.className = ''; }, 3200);
}

// ── Close mobile sidebar on outside click ─────────────────
document.addEventListener('click', function(e) {
    var sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('sb-open')) {
        var toggle = document.querySelector('.sb-mobile-toggle');
        if (!sb.contains(e.target) && toggle && !toggle.contains(e.target)) {
            sb.classList.remove('sb-open');
        }
    }
});

// ── Page navigation ───────────────────────────────────────
var _pageInitDone = {};

function showPage(page) {
    var pages = ['dashboard','members','users','photos','tidy','settings','activity','account'];
    var titles = {
        dashboard: 'Dashboard',
        members:   'Members',
        users:     'Users',
        photos:    'Photos & Media',
        tidy:      'Tidy up',
        settings:  'Tree Settings',
        activity:  'Activity Log',
        account:   'My Profile'
    };

    pages.forEach(function(p) {
        var el = document.getElementById('page' + capitalize(p));
        var nav = document.getElementById('nav' + capitalize(p));
        if (el)  el.classList.toggle('active', p === page);
        if (nav) nav.classList.toggle('active', p === page);
    });

    var titleEl = document.getElementById('topBarTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('sb-open');

    // Lazy load page data
    if (!_pageInitDone[page]) {
        _pageInitDone[page] = true;
        switch (page) {
            case 'dashboard': loadDashboard(); break;
            case 'members':
                if (typeof fetchMembers === 'function') fetchMembers();
                if (typeof toggleDeathFields === 'function') toggleDeathFields();
                if (typeof toggleMarriageUI === 'function') toggleMarriageUI();
                if (typeof updateWikiCharCount === 'function') updateWikiCharCount();
                if (typeof setFormHeader === 'function') setFormHeader(null);
                break;
            case 'users':
                if (typeof fetchUsers === 'function') fetchUsers();
                break;
            case 'photos':
                if (typeof fetchMedia === 'function' && mediaItems.length === 0) fetchMedia();
                break;
            case 'settings':
                if (typeof loadPrivacySettings === 'function') loadPrivacySettings();
                if (typeof loadDataHome === 'function') loadDataHome();
                if (typeof loadEmblem === 'function') loadEmblem();
                break;
            case 'tidy':
                if (typeof loadTidy === 'function') loadTidy(window._adminHashMember || null);
                break;
            case 'activity':
                if (typeof loadActivity === 'function') loadActivity();
                break;
            case 'account':
                if (typeof loadAccount === 'function') loadAccount();
                if (typeof loadKeys === 'function') loadKeys();
                break;
        }
    }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Self-profile shortcut (kept from old code) ─────────────
function openSelfProfile() { showPage('account'); }

// ── Legacy showTab() shim for any JS still calling it ─────
function showTab(tab) {
    var map = { members:'members', users:'users', photos:'photos', settings:'settings' };
    showPage(map[tab] || tab);
}

// ── Init: #page or #tidy/member/12 opens that page ───────
(function () {
    var m = location.hash.match(/^#(\w+)(?:\/member\/(\d+))?/);
    window._adminHashMember = m && m[2] ? Number(m[2]) : null;
    showPage(m && document.getElementById('page' + capitalize(m[1])) ? m[1] : 'dashboard');
})();
</script>
<?php endif; ?>

</body>
</html>
