<?php
/**
 * guide.php - the help pages: /guide (index) and /guide/{slug} (one page). Content: includes/guides.php.
 */
define('FT_APP', 1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/guides.php';
require_once __DIR__ . '/includes/brand.php';

$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$guides = ft_guides();
$sections = ft_guide_sections();
$slug = preg_replace('/[^a-z0-9-]/', '', (string)($_GET['p'] ?? ''));
if ($slug !== '' && !isset($guides[$slug])) { http_response_code(404); $slug = ''; $missing = true; }
$g = $slug ? $guides[$slug] : null;
$order = array_keys($guides);
$i = $slug ? array_search($slug, $order, true) : false;
$prev = ($i !== false && $i > 0) ? $order[$i - 1] : null;
$next = ($i !== false && $i < count($order) - 1) ? $order[$i + 1] : null;
$host = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$title = $g ? $g['title'] . ' · FamilyTree guide' : 'Guide · FamilyTree';
$desc = $g ? $g['summary'] : 'How to build, share and look after your family tree on FamilyTree, step by step.';
// the article's h2s, for the "On this page" list
$toc = [];
if ($g) { preg_match_all('~<h2 id="([^"]+)">(.*?)</h2>~', $g['body'], $m, PREG_SET_ORDER); foreach ($m as $x) $toc[] = [$x[1], strip_tags($x[2])]; }
$icons = [
  'Start here' => '<path d="M12 22V12M12 12C12 7 8 4 4 4c0 5 3 8 8 8zM12 12c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
  'Explore' => '<circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  'Share and show' => '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  'Your data' => '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  'Bring and connect' => '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  'Run it yourself' => '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
];
$icon = fn($sec, $s = 20) => '<svg viewBox="0 0 24 24" width="' . $s . '" height="' . $s . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . ($icons[$sec] ?? '') . '</svg>';
?><!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $h($title) ?></title>
  <meta name="description" content="<?= $h($desc) ?>">
  <link rel="canonical" href="<?= $h($host . '/guide' . ($slug ? '/' . $slug : '')) ?>">
  <meta property="og:title" content="<?= $h($g ? $g['title'] : 'FamilyTree guide') ?>">
  <meta property="og:description" content="<?= $h($desc) ?>">
  <meta property="og:image" content="<?= $h($host . '/assets/og-home.png') ?>">
  <?= ft_brand_head() ?>
  <style>
    :root {
      --bg:var(--ft-paper); --surface:var(--ft-surface); --surface-2:var(--ft-sunk); --line:var(--ft-line); --line-strong:var(--ft-edge);
      --gold:var(--ft-brass); --ink:var(--ft-ink); --muted:var(--ft-ink2); --faint:var(--ft-ink2); --code:var(--ft-sunk);
      --link:var(--ft-green); --link-hover:var(--ft-green-ink);
      --tip:var(--ft-green-soft); --tip-line:var(--ft-green); --info:var(--ft-sunk); --info-line:var(--ft-edge); --warn:var(--ft-brass-soft); --warn-line:var(--ft-brass);
      --shadow:0 1px 2px rgba(28,27,24,.05),0 10px 28px rgba(28,27,24,.07);
    }
    html[data-theme="dark"] { --link:var(--ft-green-ink); --link-hover:#B5E3CB; }
    *{box-sizing:border-box} html{-webkit-text-size-adjust:100%;scroll-padding-top:84px}
    body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 var(--ft-sans);min-height:100dvh;-webkit-font-smoothing:antialiased}
    a{color:var(--link)} a:hover{color:var(--link-hover)} :focus-visible{outline:3px solid var(--ft-focus);outline-offset:2px;border-radius:6px}
    .skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:12px;background:var(--surface);color:var(--ink);padding:8px 14px;border-radius:8px;z-index:10}
    .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
    /* the green band header, same as the homepage */
    header.top{position:sticky;top:0;z-index:5;background:var(--ft-band);color:#fff;border-bottom:1px solid var(--ft-band-edge)}
    header.top .wrap{display:flex;align-items:center;gap:12px;min-height:64px}
    header.top .ft-brand,header.top .ft-brand:hover{color:#fff}
    header.top .ft-brand small{color:var(--ft-band-sub)}
    header.top :focus-visible{outline-color:#D9BC85}
    .top nav{margin-left:auto;display:flex;align-items:center;gap:4px}
    .top nav a:not(.ft-btn),.top nav button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 12px;border-radius:8px;text-decoration:none;white-space:nowrap;font-weight:600;font-size:14px;color:var(--ft-band-sub);background:none;border:0;cursor:pointer}
    .top nav a:not(.ft-btn):hover,.top nav button:hover,.top nav a[aria-current]{color:#fff;background:rgba(255,255,255,.08)}
    .top nav .ft-btn{margin-left:4px;white-space:nowrap}
    .top nav .ft-btn-ivory,.top nav .ft-btn-ivory:hover{color:var(--ft-band)}
    .eyebrow{font:700 13px var(--ft-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--link)}
    h1{font:600 clamp(30px,5vw,46px)/1.12 var(--ft-serif);letter-spacing:-.01em;margin:10px 0 12px;text-wrap:balance}
    .lede{color:var(--muted);max-width:62ch;font-size:17px;margin:0}
    /* index */
    .hero{padding:52px 0 22px;text-align:center}.hero h1,.hero .lede{margin-left:auto;margin-right:auto}
    .search{display:flex;max-width:520px;margin:24px auto 0;position:relative}
    .search input{width:100%;min-height:50px;border-radius:999px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;padding:0 20px 0 46px}
    .search svg{position:absolute;left:16px;top:15px;color:var(--faint)}
    .sec{padding:22px 0 8px}.sec h2{display:flex;align-items:center;gap:10px;font:600 22px var(--ft-serif);margin:0 0 14px}.sec h2 svg{color:var(--gold)}
    .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:14px;list-style:none;margin:0;padding:0}
    .gcard a{display:flex;flex-direction:column;gap:6px;height:100%;padding:18px 18px 16px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-decoration:none;color:var(--ink);box-shadow:var(--shadow);transition:border-color .2s ease,transform .2s ease}
    .gcard a:hover{border-color:var(--line-strong);transform:translateY(-2px);color:var(--ink)}
    .gcard b{font-size:16px}.gcard p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}.gcard small{color:var(--faint);font-size:12px;margin-top:auto;padding-top:6px}
    .none{display:none;text-align:center;color:var(--muted);padding:30px 0}
    /* article */
    .doc{display:grid;grid-template-columns:240px minmax(0,1fr) 200px;gap:40px;padding-top:36px;padding-bottom:64px}
    .side{position:sticky;top:84px;align-self:start;max-height:calc(100dvh - 100px);overflow:auto;font-size:14px}
    .side details{border:0}.side summary{display:none}
    .side h3{font:700 11px var(--ft-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:18px 0 6px}
    .side ul{list-style:none;margin:0;padding:0}.side a{display:block;padding:5px 10px;border-radius:8px;text-decoration:none;color:var(--muted);line-height:1.35}
    .side a:hover{background:var(--surface-2);color:var(--ink)}.side a[aria-current]{background:var(--surface-2);color:var(--ink);font-weight:600;box-shadow:inset 2px 0 0 var(--gold)}
    article{min-width:0;max-width:72ch}
    .crumbs{font-size:14px;color:var(--faint);margin-bottom:6px}.crumbs a{color:var(--faint)}
    .meta{color:var(--faint);font-size:14px;margin:0 0 26px}
    article h2{font:600 25px/1.3 var(--ft-serif);margin:38px 0 10px}
    article h3{font-size:18px;margin:28px 0 6px}
    article p,article li{color:var(--ink)} article ul{padding-left:22px} article li{margin:4px 0}
    article code{font:14px ui-monospace,Consolas,monospace;background:var(--code);padding:2px 6px;border-radius:6px;overflow-wrap:anywhere}
    article pre{background:var(--code);border:1px solid var(--line);border-radius:12px;padding:14px 16px;overflow:auto}
    article pre code{padding:0;background:none;font-size:13px;line-height:1.6}
    .g-steps{counter-reset:s;list-style:none;padding:0!important;margin:14px 0}
    .g-steps>li{counter-increment:s;position:relative;padding:2px 0 10px 44px;margin:0}
    .g-steps>li::before{content:counter(s);position:absolute;left:0;top:1px;width:30px;height:30px;border-radius:50%;background:var(--ft-green);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}
    .g-steps>li:not(:last-child)::after{content:"";position:absolute;left:14.5px;top:34px;bottom:2px;width:1px;background:var(--line-strong)}
    .g-steps ul{margin-top:6px}
    .g-fig{margin:22px 0}.g-fig img,.g-fig video{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);box-shadow:var(--shadow);background:var(--surface-2)}
    .g-fig figcaption{font-size:14px;color:var(--faint);margin-top:8px}
    .g-clip{position:relative}.g-play{position:absolute;right:12px;top:12px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(0,0,0,.55);cursor:pointer}
    .g-play::before{content:"";position:absolute;left:17px;top:14px;border-style:solid;border-width:8px 0 8px 13px;border-color:transparent transparent transparent #fff}
    .g-clip.playing .g-play::before{left:15px;top:15px;width:5px;height:14px;border:0;border-left:4px solid #fff;border-right:4px solid #fff;box-sizing:content-box;width:4px}
    .g-note{border:1px solid var(--tip-line);border-left-width:4px;background:var(--tip);border-radius:12px;padding:12px 16px;margin:20px 0;font-size:15px}
    .g-info{background:var(--info);border-color:var(--info-line)}.g-warn{background:var(--warn);border-color:var(--warn-line)}
    .g-table{width:100%;border-collapse:collapse;font-size:15px;margin:18px 0;display:block;overflow-x:auto}
    .g-table th,.g-table td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}.g-table th{color:var(--faint);font-size:13px}
    .pager{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:44px}
    .pager a{display:block;padding:14px 16px;border:1px solid var(--line);border-radius:14px;text-decoration:none;color:var(--ink);background:var(--surface)}
    .pager a:hover{border-color:var(--line-strong)}.pager small{display:block;color:var(--faint);font-size:12px}.pager .nx{text-align:right;grid-column:2}
    .otp{position:sticky;top:84px;align-self:start;font-size:13px}.otp h3{font:700 11px var(--ft-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:4px 0 8px}
    .otp ul{list-style:none;margin:0;padding:0;border-left:1px solid var(--line)}.otp a{display:block;padding:4px 12px;color:var(--muted);text-decoration:none}.otp a:hover{color:var(--ink)}
    footer.bottom{border-top:1px solid var(--line);padding:26px 0 40px;color:var(--faint);font-size:14px}
    @media (max-width:1100px){.doc{grid-template-columns:220px minmax(0,1fr)}.otp{display:none}}
    @media (max-width:800px){
      .doc{grid-template-columns:1fr;gap:12px;padding-top:16px}
      .side{position:static;max-height:none}.side summary{display:flex;align-items:center;min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);cursor:pointer;font-weight:600}
      .side details[open] summary{margin-bottom:6px}header.top .hide-sm{display:none!important}
    }
    @media (prefers-reduced-motion:reduce){.gcard a{transition:none}.gcard a:hover{transform:none}}
  </style>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="top">
  <div class="wrap">
    <?= ft_brand('/', 'Guide') ?>
    <nav aria-label="Main">
      <a class="hide-sm" href="/guide"<?= $slug ? '' : ' aria-current="page"' ?>><?= $slug ? 'All guides' : 'Guide' ?></a>
      <button type="button" id="theme" aria-label="Switch light or dark theme"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>
      <a class="ft-btn ft-btn-ivory" href="/admin/">Log in</a>
    </nav>
  </div>
</header>

<?php if (!$g): ?>
<main class="wrap" id="main">
  <section class="hero">
    <div class="eyebrow">The guide</div>
    <h1><?= !empty($missing) ? 'That page has moved' : 'Build your family tree, step by step' ?></h1>
    <p class="lede">From the first person to a tree your whole family can explore: adding people, photos, privacy, emblems and looks, moving from other sites, and keeping the data wherever you like.</p>
    <label class="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <span class="skip">Search the guide</span><input type="search" id="q" placeholder="Search the guide, e.g. Ancestry, privacy, Google Sheet" autocomplete="off"></label>
  </section>
  <?php foreach ($sections as $sec => $pages): ?>
  <section class="sec">
    <h2><?= $icon($sec) ?><?= $h($sec) ?></h2>
    <ul class="cards">
      <?php foreach ($pages as $s => $p): ?>
      <li class="gcard" data-q="<?= $h(mb_strtolower($p['title'] . ' ' . $p['summary'] . ' ' . strip_tags($p['body']))) ?>"><a href="/guide/<?= $h($s) ?>"><b><?= $h($p['title']) ?></b><p><?= $h($p['summary']) ?></p><small><?= (int)$p['mins'] ?> min read</small></a></li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endforeach; ?>
  <p class="none" id="none" role="status">Nothing matches that. Try another word, or <a href="https://github.com/ravirahul/familytree/issues" rel="noopener">ask on GitHub</a>.</p>
</main>
<?php else: ?>
<div class="wrap doc">
  <nav class="side" aria-label="Guide pages">
    <details id="sideNav"><summary>All guide pages</summary>
    <?php foreach ($sections as $sec => $pages): ?>
      <h3><?= $h($sec) ?></h3>
      <ul><?php foreach ($pages as $s => $p): ?><li><a href="/guide/<?= $h($s) ?>"<?= $s === $slug ? ' aria-current="page"' : '' ?>><?= $h($p['title']) ?></a></li><?php endforeach; ?></ul>
    <?php endforeach; ?>
    </details>
  </nav>
  <article id="main">
    <div class="crumbs"><a href="/guide">Guide</a> · <?= $h($g['section']) ?></div>
    <h1><?= $h($g['title']) ?></h1>
    <p class="meta"><?= $h($g['summary']) ?> · <?= (int)$g['mins'] ?> min read</p>
    <?= $g['body'] ?>
    <nav class="pager" aria-label="Previous and next">
      <?php if ($prev): ?><a href="/guide/<?= $h($prev) ?>"><small>Previous</small><?= $h($guides[$prev]['title']) ?></a><?php endif; ?>
      <?php if ($next): ?><a class="nx" href="/guide/<?= $h($next) ?>"><small>Next</small><?= $h($guides[$next]['title']) ?></a><?php endif; ?>
    </nav>
  </article>
  <?php if (count($toc) > 1): ?>
  <aside class="otp" aria-label="On this page"><h3>On this page</h3><ul><?php foreach ($toc as [$id, $t]): ?><li><a href="#<?= $h($id) ?>"><?= $h($t) ?></a></li><?php endforeach; ?></ul></aside>
  <?php endif; ?>
</div>
<?php endif; ?>

<footer class="bottom"><div class="wrap">FamilyTree is free and open source. Something missing or wrong in this guide? <a href="https://github.com/ravirahul/familytree/issues" rel="noopener">Tell us on GitHub</a>. · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></div></footer>
<script>
  document.getElementById('theme').addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('family_tree_theme', t); } catch (e) {}
  });
  // the side list starts open on wide screens, folded on phones
  const sn = document.getElementById('sideNav'); if (sn) sn.open = matchMedia('(min-width:801px)').matches;
  // search on the index
  const q = document.getElementById('q');
  if (q) q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase(); let any = false;
    document.querySelectorAll('.gcard').forEach(c => { const hit = !v || c.dataset.q.includes(v); c.hidden = !hit; any = any || hit; });
    document.querySelectorAll('.sec').forEach(s => s.hidden = !s.querySelector('.gcard:not([hidden])'));
    document.getElementById('none').style.display = any ? 'none' : 'block';
  });
  // clips play while on screen, unless the visitor prefers less motion; the button toggles them
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.g-clip').forEach(f => {
    const v = f.querySelector('video'), b = f.querySelector('.g-play');
    const play = () => { v.play().then(() => f.classList.add('playing')).catch(() => {}); };
    const stop = () => { v.pause(); f.classList.remove('playing'); };
    b.addEventListener('click', () => v.paused ? (f.dataset.user = 'on', play()) : (f.dataset.user = 'off', stop()));
    if (!still && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => {
      if (f.dataset.user === 'off') return;
      e.isIntersecting ? play() : stop();
    }), { threshold: .5 }).observe(v);
  });
</script>
</body>
</html>
