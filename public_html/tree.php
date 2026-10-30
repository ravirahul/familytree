<?php
/**
 * tree.php — Public family tree viewer (Phase 4 multi-tenant)
 *
 * Handles:  /tree/{slug}  →  tree.php?slug={slug}  (via .htaccess rewrite)
 * Backward: /custom/  and  /d3/  still work via env APP_TENANT_ID
 */

define('FT_APP', 1);
define('FT_EMBEDDABLE', !empty($_GET['embed']));      // /embed/{slug}: config.php lets other sites frame this page
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/brand.php';

// ── 1. Resolve slug ──────────────────────────────────────────────────────────
$slug = trim($_GET['slug'] ?? '');

if ($slug === '') {
    // No slug – fall back to default tenant (backward compat)
    $tenantId = getPublicTenantId();
    $tenant   = loadTenant($pdo, $tenantId);
} else {
    $tenant = getPublicTenantBySlug($pdo, $slug);
}

if (!$tenant) {
    http_response_code(404);
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title>Tree Not Found — FamilyTree</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
  <div>
    <div style="display:flex;justify-content:center;margin-bottom:14px;color:var(--ft-green);"><?= ft_logo(60) ?></div>
    <h2 style="margin:.5rem 0;">Family Tree Not Found</h2>
    <p style="opacity:.6;">The tree you're looking for doesn't exist or has been removed.</p>
    <a href="/" style="display:inline-block;margin-top:16px;color:var(--accent);text-decoration:none;">← Return to FamilyTree</a>
  </div>
</body>
</html>
<?php
    exit;
}

// ── 2. Visibility enforcement ────────────────────────────────────────────────
$visibility = $tenant['visibility'] ?? 'public';

// For private trees, show a friendly locked page, except to the tree's own logged-in family
$isMember = !empty($_SESSION['admin_logged_in']) && !empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenant['id'];
if ($visibility === 'private' && !$isMember) {
    http_response_code(403);
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($tenant['name'] ?? $tenant['display_name'] ?? 'Family Tree', ENT_QUOTES) ?> — Private</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
  <div>
    <div style="display:flex;justify-content:center;margin-bottom:14px;color:var(--accent);">
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>
    <h2 style="margin:.5rem 0;">This Family Tree is Private</h2>
    <p style="opacity:.6;">Please contact the family administrator for access.</p>
    <a href="/admin/" style="display:inline-block;margin-top:16px;color:var(--accent);text-decoration:none;">Log in as Admin →</a>
  </div>
</body>
</html>
<?php
    exit;
}

// ── 3. Prepare display values ────────────────────────────────────────────────
$treeName    = htmlspecialchars($tenant['name'] ?? $tenant['display_name'] ?? 'Family Tree', ENT_QUOTES);
$treeSlugJs  = htmlspecialchars($tenant['slug'] ?? '', ENT_QUOTES);

// Sub-view: tree (default) | events | map | memories | relation  (via /tree/{slug}/{view})
$viewNames = ['events' => 'Events', 'map' => 'World Map', 'memories' => 'Memory Book', 'relation' => 'How are we related?'];
$view      = $_GET['view'] ?? '';
if (!isset($viewNames[$view])) $view = 'custom';
$viewLabel = $view === 'custom' ? 'Family Tree' : $viewNames[$view];

$pageTitle   = $treeName . ' — ' . $viewLabel;
$ogDesc      = $view === 'custom'
    ? 'Explore the ' . $treeName . ' family tree — view generations, photos, and bios.'
    : $viewLabel . ' of the ' . $treeName . ' family — ' . ($view === 'events' ? 'birthdays, anniversaries and remembrance days.' : ($view === 'map' ? 'where every member was born and lives today.' : ($view === 'relation' ? 'find how any two people are related.' : 'photos, videos and voice notes.')));

// Noindex for unlisted trees
if ($visibility === 'unlisted') {
    header('X-Robots-Tag: noindex, nofollow');
}
// Check if visitor is logged in and authorized to edit this tree
$settings = ft_tenant_settings($tenant);
$embed    = !empty($_GET['embed']);
$embedTheme  = in_array($_GET['theme'] ?? '', ['light', 'dark'], true) ? $_GET['theme'] : null;
$embedAccent = preg_match('/^[0-9a-fA-F]{6}$/', $_GET['accent'] ?? '') ? '#' . $_GET['accent'] : null;
$emblemOn = $settings['emblem']['kind'] !== 'none';
$canEdit = (!empty($_SESSION['admin_logged_in']) &&
            (!empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenant['id']));
$csrfToken = $_SESSION['csrf_token'] ?? '';
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title><?= $pageTitle ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="<?= $ogDesc ?>">
  <?php if ($emblemOn): ?>
  <link rel="icon" href="/emblem.php?tree=<?= $treeSlugJs ?>&size=64" type="image/png">
  <link rel="apple-touch-icon" href="/emblem.php?tree=<?= $treeSlugJs ?>&size=180">
  <?php else: ?>
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <?php endif; ?>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.ico" sizes="32x32">

  <!-- Curated Luxury Typography: Cinzel (Royalty), Playfair Display (Heritage), Plus Jakarta Sans (Modern) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Open Graph / WhatsApp / social previews -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="<?= $pageTitle ?>">
  <meta property="og:description" content="<?= $ogDesc ?>">
  <meta property="og:url"         content="<?= 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . '/tree/' . $treeSlugJs . ($view === 'custom' ? '' : '/' . $view) ?>">
  <meta property="og:image"       content="<?= 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . '/og-image.php?tree=' . $treeSlugJs ?>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card"       content="summary_large_image">
  <link rel="canonical" href="<?= 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . '/tree/' . $treeSlugJs . ($view === 'custom' ? '' : '/' . $view) ?>">

  <?php if ($visibility === 'unlisted' || $embed): ?>
  <meta name="robots" content="noindex, nofollow">
  <?php endif; ?>

  <link rel="stylesheet" href="/assets/style.css?v=<?= FT_VERSION ?>">

  <!-- D3 v7 — tree renderer + events timeline -->
  <script defer src="https://d3js.org/d3.v7.min.js" integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i" crossorigin="anonymous"></script>
  <?php if ($view === 'map'): ?>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous">
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin="anonymous"></script>
  <?php endif; ?>
  <?php if ($view === 'relation'): ?>
  <link rel="stylesheet" href="/assets/relation.css?v=<?= FT_VERSION ?>">
  <?php endif; ?>

  <!-- Inject tenant vars for JS layers -->
  <script>
    window.FT_TREE_SLUG  = "<?= $treeSlugJs ?>";
    window.FT_TREE_NAME  = "<?= $treeName ?>";
    window.FT_CAN_EDIT   = <?= $canEdit ? 'true' : 'false' ?>;
    window.FT_CSRF_TOKEN = "<?= htmlspecialchars($csrfToken, ENT_QUOTES) ?>";
    window.FT_VIEW       = "<?= $view ?>";
    window.FT_SETTINGS   = <?= json_encode($settings, JSON_HEX_TAG | JSON_HEX_AMP) ?>;
    window.FT_EMBED      = <?= $embed ? 'true' : 'false' ?>;
    <?php if ($embedTheme): ?>document.documentElement.setAttribute("data-theme", "<?= $embedTheme ?>"); window.FT_FORCE_THEME = "<?= $embedTheme ?>";<?php else: ?>
    // the saved light/dark choice before first paint, so the loading skeleton is already the right colour
    try { if (localStorage.getItem("family_tree_theme") === "dark") document.documentElement.setAttribute("data-theme", "dark"); } catch (e) {}<?php endif; ?>
  </script>
  <script src="/assets/tree-themes.js?v=<?= FT_VERSION ?>"></script>
</head>
<body<?= $embed ? ' class="ft-embed"' : '' ?><?= $embedAccent ? ' style="--accent:' . $embedAccent . '"' : '' ?>>
  <div id="app-shell" data-view="<?= $view ?>"></div>

  <!-- Load order: config → utils → controller → shell → member-card → view -->
  <script defer src="/assets/emblems.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/config.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/utils.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/controller.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/shell/shell.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/assets/panchang.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/shell/member-extra.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/assets/kinship-hi.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/shell/member-card.js?v=<?= FT_VERSION ?>"></script>
  <?php if ($view === 'custom'): ?>
  <script defer src="/custom/custom-tree.js?v=<?= FT_VERSION ?>"></script>
  <!-- PNG/PDF export libraries load on first use (see loadExportLibs in member-card.js) -->
  <?php else: ?>
  <script defer src="/views/<?= $view ?>.js?v=<?= FT_VERSION ?>"></script>
  <?php endif; ?>
</body>
</html>
