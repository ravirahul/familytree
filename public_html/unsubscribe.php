<?php
/** unsubscribe.php - the "Stop these emails" link in the weekly email: no sign-in needed, the link is signed. */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/store.php';
require_once __DIR__ . '/includes/digest.php';
require_once __DIR__ . '/includes/brand.php';
$uid = (int)($_GET['u'] ?? 0);
$ok = $uid > 0 && hash_equals(ft_unsub_token($uid), (string)($_GET['t'] ?? ''));
if ($ok) $pdo->prepare("UPDATE family_users SET digest = 0 WHERE id = ?")->execute([$uid]);
header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Weekly email · FamilyTree</title>
<?= ft_brand_head() ?>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--ft-paper);color:var(--ft-ink);font:16px/1.6 var(--ft-sans);padding:24px 16px;-webkit-font-smoothing:antialiased}
main{max-width:440px;width:100%;text-align:center;background:var(--ft-surface);border:1px solid var(--ft-line);border-radius:16px;padding:32px 24px;box-shadow:var(--ft-shadow)}
.ft-brand{margin-bottom:18px}h1{font:600 26px/1.2 var(--ft-serif);letter-spacing:-.01em;margin:0 0 10px}p{color:var(--ft-ink2)}
.acts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:22px 0 0}
:focus-visible{outline:3px solid var(--ft-focus);outline-offset:2px;border-radius:6px}</style></head>
<body><main>
  <?= ft_brand('/') ?>
<?php if ($ok): ?>
  <h1>You won't get the weekly email</h1>
  <p>You can turn it back on any time in your Profile, under Weekly email.</p>
<?php else: ?>
  <h1>That link didn't work</h1>
  <p>Sign in and turn the weekly email off in your Profile instead.</p>
<?php endif; ?>
  <p class="acts"><a class="ft-btn ft-btn-primary" href="/admin/">Sign in</a><a class="ft-btn ft-btn-line" href="/">FamilyTree home</a></p>
</main></body></html>
