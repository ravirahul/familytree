<?php
/**
 * print.php - printable keepsakes for a tree.
 *
 *   /tree/{slug}/poster  ->  print.php?slug={slug}&kind=poster   (one big chart, downloads as a PDF)
 *   /tree/{slug}/book    ->  print.php?slug={slug}&kind=book     (A4 family book, browser "Save as PDF")
 *   /tree/{slug}/poster?what=timeline | ?what=map   (timeline / places map, browser "Save as PDF";
 *   /tree/{slug}/map is already the tree's own map view, so these ride on the poster route)
 *   ?hide=b21,a45 hides everyone below #21 and above #45 on any kind.
 *
 * The page itself carries no family data: assets/print.js reads the same public
 * APIs the tree viewer uses (api-family.php, api-media.php), so privacy is applied
 * exactly as it is everywhere else.
 */

define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/brand.php';

$slug   = trim($_GET['slug'] ?? '');
$what   = $_GET['what'] ?? ($_GET['kind'] ?? '');
$kind   = in_array($what, ['book', 'timeline', 'map'], true) ? $what : 'poster';
$tenant = $slug !== '' ? getPublicTenantBySlug($pdo, $slug) : null;

function ft_print_denied(int $code, string $title, string $heading, string $text, string $link, string $linkText, string $icon): void {
    http_response_code($code);
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title><?= htmlspecialchars($title, ENT_QUOTES) ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
  <div>
    <div style="display:flex;justify-content:center;margin-bottom:14px;color:<?= $code === 404 ? 'var(--ft-green)' : 'var(--accent)' ?>;">
      <?= $icon ?>
    </div>
    <h2 style="margin:.5rem 0;"><?= htmlspecialchars($heading, ENT_QUOTES) ?></h2>
    <p style="opacity:.6;"><?= htmlspecialchars($text, ENT_QUOTES) ?></p>
    <a href="<?= $link ?>" style="display:inline-block;margin-top:16px;color:var(--accent);text-decoration:none;"><?= htmlspecialchars($linkText, ENT_QUOTES) ?></a>
  </div>
</body>
</html>
<?php
    exit;
}

if (!$tenant) {
    ft_print_denied(404, 'Tree Not Found — FamilyTree', 'Family Tree Not Found',
        "The tree you're looking for doesn't exist or has been removed.", '/', '← Return to FamilyTree',
        ft_logo(60));
}

$visibility = $tenant['visibility'] ?? 'public';
// Same rule as the data APIs: a private tree is shown only to its logged-in owner.
$isOwner = !empty($_SESSION['admin_logged_in']) && !empty($_SESSION['tenant_id']) && $_SESSION['tenant_id'] === $tenant['id'];
if ($visibility === 'private' && !$isOwner) {
    ft_print_denied(403, ($tenant['display_name'] ?? 'Family Tree') . ' — Private', 'This Family Tree is Private',
        'Please contact the family administrator for access.', '/admin/', 'Log in as Admin →',
        '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>');
}

$treeName  = htmlspecialchars($tenant['display_name'] ?? 'Family Tree', ENT_QUOTES);
$treeSlug  = htmlspecialchars($tenant['slug'] ?? '', ENT_QUOTES);
$settings  = ft_tenant_settings($tenant);
$emblemOn  = $settings['emblem']['kind'] !== 'none';
$kinds     = ['poster' => ['Tree poster', 'poster'], 'book' => ['Family book', 'book'], 'timeline' => ['Timeline', 'poster?what=timeline'], 'map' => ['Map', 'poster?what=map']];
$label     = $kinds[$kind][0];
// only what the page needs: the look, the emblem and the tagline
$pageSettings = ['theme' => $settings['theme'], 'emblem' => $settings['emblem'], 'tagline' => (string)($settings['tagline'] ?? '')];
header('X-Robots-Tag: noindex, nofollow');
?><!DOCTYPE html>
<html lang="en" data-theme="light" data-kind="<?= $kind ?>">
<head>
  <meta charset="UTF-8">
  <title><?= $treeName ?> — <?= $label ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <?php if ($emblemOn): ?>
  <link rel="icon" href="/emblem.php?tree=<?= $treeSlug ?>&size=64" type="image/png">
  <?php else: ?>
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <?php endif; ?>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/print.css?v=<?= FT_VERSION ?>">
  <script>
    window.FT_TREE_SLUG = "<?= $treeSlug ?>";
    window.FT_TREE_NAME = "<?= $treeName ?>";
    window.FT_SETTINGS  = <?= json_encode($pageSettings, JSON_HEX_TAG | JSON_HEX_AMP) ?>;
    window.FT_PRINT_KIND = "<?= $kind ?>";
  </script>
  <script src="/assets/tree-themes.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/assets/emblems.js?v=<?= FT_VERSION ?>"></script>
  <script defer src="/assets/print.js?v=<?= FT_VERSION ?>"></script>
</head>
<body>
  <header class="pr-bar">
    <a class="pr-back" href="/tree/<?= $treeSlug ?>" aria-label="Back to the tree">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      <span><?= $treeName ?></span>
    </a>
    <nav class="pr-tabs" aria-label="What to print">
      <?php foreach ($kinds as $k => [$text, $path]): ?>
      <a href="/tree/<?= $treeSlug ?>/<?= $path ?>"<?= $kind === $k ? ' aria-current="page"' : '' ?>><?= $text ?></a>
      <?php endforeach; ?>
    </nav>
  </header>
  <main id="pr-root" class="pr-root pr-layout pr-<?= $kind ?>">
    <p class="pr-loading" role="status">Gathering the family…</p>
  </main>
  <noscript><p class="pr-loading">This page needs JavaScript to lay out the tree.</p></noscript>
</body>
</html>
