<?php
/**
 * admin/reset-password.php – Set a new password via reset token
 * Phase 2 P2.3: Authentication Redesign
 */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';

if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: index.php');
    exit;
}

$token   = trim($_GET['token'] ?? $_POST['token'] ?? '');
$error   = '';
$success = false;
$user    = null;

// ── Validate the token ────────────────────────────────────────────────────
if (!$token) {
    $error = 'No reset token provided. Please use the link from your email.';
} else {
    $stmt = $pdo->prepare("
        SELECT id, display_name, email
        FROM family_users
        WHERE password_reset_token = ?
          AND password_reset_expires_at > NOW()
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $error = 'This reset link is invalid or has expired. Please request a new one.';
    }
}

// ── Handle new password submission ────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $user && !$error) {

    // CSRF
    $csrfToken    = $_POST['csrf_token'] ?? '';
    $csrfExpected = $_SESSION['csrf_token'] ?? '';
    if (!$csrfExpected || !hash_equals($csrfExpected, $csrfToken)) {
        $error = 'Invalid form submission. Please refresh and try again.';
    }

    if (!$error) {
        $password  = $_POST['password']  ?? '';
        $password2 = $_POST['password2'] ?? '';

        if (strlen($password) < 8) {
            $error = 'Password must be at least 8 characters.';
        } elseif ($password !== $password2) {
            $error = 'Passwords do not match.';
        }
    }

    if (!$error) {
        $newHash = password_hash($password, PASSWORD_DEFAULT);

        $pdo->prepare("
            UPDATE family_users
            SET password_hash = ?,
                password_reset_token = NULL,
                password_reset_expires_at = NULL
            WHERE id = ?
        ")->execute([$newHash, $user['id']]);

        $success = true;
    }
}

$appName = getenv('MAIL_FROM_NAME') ?: 'FamilyTree';
$authHeadline = 'Welcome back to your family.';
$authLede = 'Pick up where you left off: new photos, birthdays this week, and the relatives still waiting to be added.';
$eye = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g></svg>';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset password · <?= htmlspecialchars($appName) ?></title>
<script>try { document.documentElement.setAttribute('data-theme', localStorage.getItem('family_tree_theme') === 'dark' ? 'dark' : 'light'); } catch (e) {}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/auth.css?v=<?= FT_VERSION ?>">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>a.btn-main { display: grid; place-items: center; margin-top: 8px; color: #fff !important; text-decoration: none; }</style>
</head>
<body class="auth">
<div class="auth-shell">
  <?php require __DIR__ . '/../includes/auth-side.php'; ?>
  <main class="auth-main">
    <div class="auth-top">
      <a href="/" class="auth-brand"><svg width="26" height="26" viewBox="3 3 22 23.5" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25V15.5M14 21l-5.2-5.2M14 18.5l5.2-5.2M14 15.5V9.6M9.5 25h9"/><circle cx="7.2" cy="14.2" r="2.4"/><circle cx="20.8" cy="11.7" r="2.4"/><circle cx="14" cy="7" r="2.4"/></g></svg>FamilyTree</a>
      <span class="auth-top-link">Remembered it? <a href="index.php">Log in</a></span>
    </div>

<?php if ($success): ?>
    <div class="auth-box done" role="status">
      <div class="done-ico"><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g></svg></div>
      <h1>Password updated</h1>
      <p>Your password has been changed.<br>You can now log in with your new password.</p>
      <a href="index.php" class="btn-main">Go to log in</a>
    </div>

<?php elseif (!$user): ?>
    <div class="auth-box">
      <h1>Link expired</h1>
      <p class="auth-sub">This reset link can't be used any more.</p>
      <div class="alert" role="alert"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></g></svg><span><?= htmlspecialchars($error) ?></span></div>
      <a href="forgot-password.php" class="btn-main">Request a new reset link</a>
      <p class="alt"><a href="index.php">Back to log in</a></p>
    </div>

<?php else: ?>
    <div class="auth-box">
      <h1>Set a new password</h1>
      <p class="auth-sub">Hi <?= htmlspecialchars($user['display_name']) ?>, choose a new password below.</p>

      <?php if ($error): ?>
        <div class="alert" role="alert"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></g></svg><span><?= htmlspecialchars($error) ?></span></div>
      <?php endif; ?>

      <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'] ?? '') ?>">
        <input type="hidden" name="token"      value="<?= htmlspecialchars($token) ?>">
        <div class="f">
          <label for="f_pw">New password</label>
          <div class="pw">
            <input type="password" id="f_pw" name="password" class="in" placeholder="At least 8 characters" required autofocus autocomplete="new-password" aria-describedby="pwHint">
            <button type="button" class="pw-btn" data-pw="f_pw" aria-label="Show password" aria-pressed="false"><?= $eye ?></button>
          </div>
          <p class="hint" id="pwHint">Minimum 8 characters.</p>
        </div>
        <div class="f">
          <label for="f_pw2">Confirm new password</label>
          <div class="pw">
            <input type="password" id="f_pw2" name="password2" class="in" placeholder="Repeat password" required autocomplete="new-password">
            <button type="button" class="pw-btn" data-pw="f_pw2" aria-label="Show password" aria-pressed="false"><?= $eye ?></button>
          </div>
        </div>
        <button type="submit" class="btn-main">Save new password</button>
      </form>
      <p class="alt"><a href="index.php">Cancel</a></p>
    </div>
<?php endif; ?>
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
</script>
</body>
</html>
