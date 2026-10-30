<?php
/**
 * admin/config.php
 * Phase 0: Delegates entirely to the main config.
 * All credentials, session setup, CSRF, and helpers live in config.php.
 */
require_once __DIR__ . '/../config.php';

// A signed-in account that has since been deleted (on another device) is signed out here.
// Checked once a minute per session, so it costs one small query now and then.
if (!empty($_SESSION['admin_logged_in']) && !empty($_SESSION['admin_user']['id']) && $pdo
    && (time() - (int)($_SESSION['ft_user_checked'] ?? 0)) > 60) {
    try {
        $chk = $pdo->prepare("SELECT 1 FROM family_users WHERE id = ?");
        $chk->execute([(int)$_SESSION['admin_user']['id']]);
        if ($chk->fetchColumn()) $_SESSION['ft_user_checked'] = time();
        else { $_SESSION = []; session_destroy(); session_start(); }
    } catch (Throwable $e) { /* never lock people out over a failed check */ }
}
