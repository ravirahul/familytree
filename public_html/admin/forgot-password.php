<?php
/**
 * admin/forgot-password.php – Request a password reset link
 * Phase 2 P2.3: Authentication Redesign
 */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../includes/mailer.php';

// Already logged in? No need to be here
if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: index.php');
    exit;
}

$submitted = false;
$error     = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // ── CSRF ──────────────────────────────────────────────────────────────
    $token    = $_POST['csrf_token'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!$expected || !hash_equals($expected, $token)) {
        $error = 'Invalid form submission. Please refresh and try again.';
    }

    if (!$error) {
        checkRateLimit('forgot_password', 5, 900); // 5 requests per 15 min per IP

        $email = strtolower(trim($_POST['email'] ?? ''));

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Please enter a valid email address.';
        }
    }

    if (!$error) {
        // ── Look up the user (don't reveal whether email exists) ──────────
        $stmt = $pdo->prepare("SELECT id, display_name, email FROM family_users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            // Generate reset token (expires in 1 hour)
            $resetToken = bin2hex(random_bytes(32));
            $expires    = date('Y-m-d H:i:s', time() + 3600);

            $pdo->prepare("
                UPDATE family_users
                SET password_reset_token = ?, password_reset_expires_at = ?
                WHERE id = ?
            ")->execute([$resetToken, $expires, $user['id']]);

            sendPasswordResetEmail($user['email'], $user['display_name'], $resetToken);
        }

        // Always show success – don't reveal whether email exists
        $submitted = true;
    }
}

$appName = getenv('MAIL_FROM_NAME') ?: 'FamilyTree';
$authHeadline = 'Welcome back to your family.';
$authLede = 'Pick up where you left off: new photos, birthdays this week, and the relatives still waiting to be added.';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Forgot password · <?= htmlspecialchars($appName) ?></title>
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

<?php if ($submitted): ?>
    <div class="auth-box done" role="status">
      <div class="done-ico"><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></g></svg></div>
      <h1>Check your email</h1>
      <p>If an account exists for that email address, we've sent a password reset link. It expires in <strong>1 hour</strong>.</p>
      <p class="hint">Didn't get it? Check your spam folder.</p>
      <p class="alt"><a href="index.php">Back to log in</a></p>
    </div>
<?php else: ?>
    <div class="auth-box">
      <h1>Forgot password</h1>
      <p class="auth-sub">Enter your email and we'll send you a reset link.</p>

      <?php if ($error): ?>
        <div class="alert" role="alert"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></g></svg><span><?= htmlspecialchars($error) ?></span></div>
      <?php endif; ?>

      <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'] ?? '') ?>">
        <div class="f">
          <label for="f_email">Email</label>
          <input type="email" id="f_email" name="email" class="in" placeholder="you@example.com" required autofocus autocomplete="email" inputmode="email">
        </div>
        <button type="submit" class="btn-main">Send reset link</button>
      </form>
      <p class="alt"><a href="index.php">Back to log in</a></p>
    </div>
<?php endif; ?>
  </main>
</div>
</body>
</html>
