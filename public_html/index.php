<?php
// The home page is the family's tree. Before setup, config.php sends visitors to /install/.
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
$t = getPublicTenantId() ? loadTenant($pdo, getPublicTenantId()) : null;
header('Location: ' . ($t ? '/tree/' . rawurlencode($t['slug']) : '/admin/'), true, 302);
