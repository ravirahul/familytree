<?php
if (!defined('FT_APP')) define('FT_APP', 1);
/**
 * gedcom-export.php — Export the current tenant's tree as GEDCOM 5.5.1
 * Phase 5 Tier 1: data portability.
 *
 * GET only. Requires an authenticated admin session.
 * Individuals  → INDI records (name, sex, birth, death)
 * Families     → FAM records built from (fid, mid) parent pairs and pids couples
 */

require_once __DIR__ . '/config.php';

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$tenantId = getAdminTenantId();

// ── Load all members for this tenant ────────────────────────────────────────
require_once dirname(__DIR__) . '/includes/privacy.php';
require_once dirname(__DIR__) . '/includes/store.php';
$members = ft_store($pdo, loadTenant($pdo, $tenantId) ?? ['id' => $tenantId])->members();

// Tenant name for the header / filename
$tn = $pdo->prepare("SELECT slug, display_name FROM tenants WHERE id = ? LIMIT 1");
$tn->execute([$tenantId]);
$tenant   = $tn->fetch(PDO::FETCH_ASSOC) ?: [];
$treeName = $tenant['display_name'] ?? 'Family Tree';
$slug     = $tenant['slug'] ?? 'family-tree';

// ── Helpers ─────────────────────────────────────────────────────────────────
function gedDate(?string $ymd): ?string {
    if (!$ymd || $ymd === '0000-00-00') return null;
    $ts = strtotime($ymd);
    if ($ts === false) return null;
    return strtoupper(date('j M Y', $ts)); // e.g. 14 AUG 1996
}

function gedEscape(string $s): string {
    // GEDCOM lines must not contain leading level numbers or @; keep it simple
    return trim(preg_replace('/\s+/', ' ', str_replace('@', '', $s)));
}

// ── Build family units ──────────────────────────────────────────────────────
// A family = a parent pair (or single parent) with children, and/or a couple.
$byId     = [];
foreach ($members as $m) $byId[(int)$m['id']] = $m;

$families = [];  // key => ['husb' => id|null, 'wife' => id|null, 'chil' => [ids]]

function famKey(?int $f, ?int $m): string { return ($f ?: 0) . ':' . ($m ?: 0); }

// 1. From parent links
foreach ($members as $m) {
    $fid = $m['fid'] ? (int)$m['fid'] : null;
    $mid = $m['mid'] ? (int)$m['mid'] : null;
    if (!$fid && !$mid) continue;
    $key = famKey($fid, $mid);
    if (!isset($families[$key])) {
        $families[$key] = ['husb' => $fid, 'wife' => $mid, 'chil' => []];
    }
    $families[$key]['chil'][] = (int)$m['id'];
}

// 2. From couples (pids) that have no children yet; a member may have several spouses
$couples = [];
foreach ($members as $m) foreach (ft_pids($m['pids']) as $pid) $couples[] = [(int)$m['id'], $pid, $m];
foreach ($couples as [$a, $b, $m]) {
    if (!$b || !isset($byId[$b])) continue;
    // Assign husband/wife by gender; fall back to lower-id-as-husband
    $gA = strtolower((string)($m['gender'] ?? ''));
    if ($gA === 'male')        { $h = $a; $w = $b; }
    elseif ($gA === 'female')  { $h = $b; $w = $a; }
    else                       { $h = min($a, $b); $w = max($a, $b); }

    $key = famKey($h, $w);
    if (!isset($families[$key])) {
        $families[$key] = ['husb' => $h, 'wife' => $w, 'chil' => []];
    }
}

// Assign FAM ids and reverse indexes
$famIds = [];   // key => F{n}
$n = 1;
foreach ($families as $key => $f) { $famIds[$key] = 'F' . $n++; }

$famsAsSpouse = [];  // member id => [famId, ...]
$famAsChild   = [];  // member id => famId
foreach ($families as $key => $f) {
    $fid = $famIds[$key];
    if ($f['husb'] && isset($byId[$f['husb']])) $famsAsSpouse[$f['husb']][] = $fid;
    if ($f['wife'] && isset($byId[$f['wife']])) $famsAsSpouse[$f['wife']][] = $fid;
    foreach ($f['chil'] as $c) $famAsChild[$c] = $fid;
}

// ── Emit GEDCOM ─────────────────────────────────────────────────────────────
$out   = [];
$out[] = '0 HEAD';
$out[] = '1 SOUR FamilyTreePortal';
$out[] = '2 NAME ' . gedEscape($treeName);
$out[] = '1 GEDC';
$out[] = '2 VERS 5.5.1';
$out[] = '2 FORM LINEAGE-LINKED';
$out[] = '1 CHAR UTF-8';
$out[] = '1 DATE ' . strtoupper(date('j M Y'));

/** an approximate date as GEDCOM: ABT 1890, BEF 1902, BET 1880 AND 1885, 1890 */
function gedApprox(?array $a): ?string {
    if (!$a || empty($a['y'])) return null;
    return match ($a['q'] ?? '') { 'abt' => 'ABT ' . $a['y'], 'bef' => 'BEF ' . $a['y'], 'aft' => 'AFT ' . $a['y'],
        'bet' => 'BET ' . $a['y'] . ' AND ' . ($a['y2'] ?? $a['y']), default => (string)$a['y'] };
}
/** sources for one fact, as citations at the given level */
function gedSources(array $x, string $fact, int $lvl): array {
    $out = [];
    foreach ($x['sources'] ?? [] as $s) {
        if (($s['fact'] ?? 'other') !== $fact) continue;
        $out[] = $lvl . ' SOUR ' . gedEscape($s['title'] ?? ($s['url'] ?? 'Source'));
        if (!empty($s['page'])) $out[] = ($lvl + 1) . ' PAGE ' . gedEscape($s['page']);
        if (!empty($s['url']))  $out[] = ($lvl + 1) . ' NOTE ' . gedEscape($s['url']);
        if (!empty($s['note'])) $out[] = ($lvl + 1) . ' NOTE ' . gedEscape($s['note']);
    }
    return $out;
}

foreach ($members as $m) {
    $id  = (int)$m['id'];
    $x   = ft_extra($m['extra'] ?? null);
    $out[] = "0 @I{$id}@ INDI";

    $name = gedEscape($m['name'] ?? 'Unknown');
    // GEDCOM surname convention: last word as /Surname/
    $parts = explode(' ', $name);
    if (count($parts) > 1) {
        $last  = array_pop($parts);
        $out[] = '1 NAME ' . implode(' ', $parts) . ' /' . $last . '/';
    } else {
        $out[] = '1 NAME ' . $name;
    }
    if (!empty($m['nickname'])) {
        $out[] = '2 NICK ' . gedEscape($m['nickname']);
    }

    $g = strtolower((string)($m['gender'] ?? ''));
    if ($g === 'male')   $out[] = '1 SEX M';
    if ($g === 'female') $out[] = '1 SEX F';

    $bd = gedDate($m['birth_date'] ?? null) ?? gedApprox($x['birth_approx'] ?? null);
    $bs = gedSources($x, 'birth', 2);
    if ($bd || !empty($m['birth_location']) || $bs) {
        $out[] = '1 BIRT';
        if ($bd) $out[] = '2 DATE ' . $bd;
        if (!empty($m['birth_location'])) $out[] = '2 PLAC ' . gedEscape($m['birth_location']);
        array_push($out, ...$bs);
    }

    $isDead = isset($m['is_alive']) && (int)$m['is_alive'] === 0;
    $dd = gedDate($m['death_date'] ?? null) ?? gedApprox($x['death_approx'] ?? null);
    if ($isDead || $dd || !empty($m['death_location'])) {
        $out[] = '1 DEAT' . (($isDead && !$dd) ? ' Y' : '');
        if ($dd) $out[] = '2 DATE ' . $dd;
        if (!empty($m['death_location'])) $out[] = '2 PLAC ' . gedEscape($m['death_location']);
        array_push($out, ...gedSources($x, 'death', 2));
    }
    foreach (['name', 'place', 'parents', 'other'] as $fact) array_push($out, ...gedSources($x, $fact, 1));

    if (!empty($m['wiki'])) {
        // NOTE with CONT lines, ~200 chars per line
        $note = gedEscape($m['wiki']);
        $chunks = str_split($note, 200);
        $out[] = '1 NOTE ' . array_shift($chunks);
        foreach ($chunks as $c) $out[] = '2 CONT ' . $c;
    }

    if (isset($famAsChild[$id])) {
        $out[] = '1 FAMC @' . $famAsChild[$id] . '@';
        $kind = $x['father_kind'] ?? ($x['mother_kind'] ?? null);
        if ($kind) $out[] = '2 PEDI ' . ['adoptive' => 'adopted', 'foster' => 'foster', 'step' => 'step'][$kind];
    }
    foreach ($famsAsSpouse[$id] ?? [] as $fs) $out[] = '1 FAMS @' . $fs . '@';
}

foreach ($families as $key => $f) {
    $out[] = '0 @' . $famIds[$key] . '@ FAM';
    if ($f['husb'] && isset($byId[$f['husb']])) $out[] = '1 HUSB @I' . $f['husb'] . '@';
    if ($f['wife'] && isset($byId[$f['wife']])) $out[] = '1 WIFE @I' . $f['wife'] . '@';
    foreach ($f['chil'] as $c) $out[] = '1 CHIL @I' . $c . '@';

    // Marriage date from either spouse's anniversary
    $anniv = null;
    if ($f['husb'] && !empty($byId[$f['husb']]['anniversary_date'])) $anniv = $byId[$f['husb']]['anniversary_date'];
    if (!$anniv && $f['wife'] && !empty($byId[$f['wife']]['anniversary_date'])) $anniv = $byId[$f['wife']]['anniversary_date'];
    // the partnership's own dates win: wedding, and a divorce or separation
    $pp = ($f['husb'] && $f['wife'] && isset($byId[$f['husb']])) ? (ft_extra($byId[$f['husb']]['extra'] ?? null)['partners'][(string)$f['wife']] ?? []) : [];
    $md = gedDate($pp['married'] ?? null) ?? gedDate($anniv);
    $ms = ($f['husb'] && isset($byId[$f['husb']])) ? gedSources(ft_extra($byId[$f['husb']]['extra'] ?? null), 'marriage', 2) : [];
    if ($md || $ms) {
        $out[] = '1 MARR';
        if ($md) $out[] = '2 DATE ' . $md;
        array_push($out, ...$ms);
    }
    if (in_array($pp['end'] ?? '', ['divorce', 'separated'], true)) {
        $out[] = '1 DIV';
        if ($e = gedDate($pp['ended'] ?? null)) $out[] = '2 DATE ' . $e;
    }
}

$out[] = '0 TRLR';

$gedcom = implode("\r\n", $out) . "\r\n";

logActivityWithTenant($pdo, 'gedcom_export', 'tree', null, ['members' => count($members)], $tenantId);

header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9-]/', '', $slug) . '-' . date('Y-m-d') . '.ged"');
header('Content-Length: ' . strlen($gedcom));
echo $gedcom;
