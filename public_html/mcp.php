<?php
/**
 * mcp.php - your family trees as tools for Claude (Model Context Protocol, Streamable HTTP).
 *
 * Make a key in the admin under Profile > Connect Claude, then:
 *   claude.ai / Claude Desktop: Settings > Connectors > Add custom connector > paste the URL
 *   Claude Code:                claude mcp add --transport http familytree "<the URL>"
 *
 * The key (in the URL, or as "Authorization: Bearer <key>") acts as one account and
 * nothing more: Claude sees the trees that account belongs to, with that account's role
 * in each (viewers read, editors also change, owners also delete and replace). Family data
 * goes through the tree's data home, so this works whether the tree lives here, in the
 * family's own database, a Google Sheet or a JSON file. Every change is logged.
 */
define('FT_APP', 1);
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/privacy.php';
require_once __DIR__ . '/includes/store.php';
require_once __DIR__ . '/includes/kinship.php';
require_once __DIR__ . '/includes/gedcom.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['error' => 'This is the FamilyTree connector for Claude. Add this URL as a custom connector; it speaks MCP over POST.']);
    exit;
}

$key = (string)($_GET['key'] ?? '');
if ($key === '' && preg_match('/^Bearer\s+(\S+)$/i', $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''), $m)) $key = $m[1];

$msg = json_decode((string)file_get_contents('php://input'), true);
$id  = $msg['id'] ?? null;
if (!is_array($msg) || ($msg['jsonrpc'] ?? '') !== '2.0' || !is_string($msg['method'] ?? null)) rpc_err(null, -32600, 'Expected one JSON-RPC 2.0 message.');
if (!array_key_exists('id', $msg)) { http_response_code(202); exit; }          // a notification: nothing to answer

$me = $key !== '' ? mcp_user($pdo, $key) : null;
if (!$me) rpc_err($id, -32001, 'This FamilyTree key is not valid. Make a new one in the admin: Profile > Connect Claude.');
$TREES = mcp_trees($pdo, (int)$me['id']);
$tools = mcp_tools();
$p = is_array($msg['params'] ?? null) ? $msg['params'] : [];

switch ($msg['method']) {
    case 'initialize':
        $asked = (string)($p['protocolVersion'] ?? '');
        $names = implode(', ', array_map(fn($t) => "{$t['display_name']} ({$t['slug']}, {$t['role']})", $TREES)) ?: 'none yet';
        rpc_out($id, [
            'protocolVersion' => in_array($asked, ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'], true) ? $asked : '2025-06-18',
            'capabilities'    => ['tools' => new stdClass()],
            'serverInfo'      => ['name' => 'familytree', 'version' => defined('FT_VERSION') ? FT_VERSION : '8'],
            'instructions'    => "Family trees of {$me['display_name']} on " . ($_SERVER['HTTP_HOST'] ?? 'FamilyTree') . ". Trees: $names. "
                               . 'Pass a tree by its link name (slug). Find people with search_people before changing them; person ids come from there. '
                               . 'Dates are YYYY-MM-DD and only for exact dates; put approximate ones ("about 1890") in the bio. '
                               . 'Living people are private by default on the public tree.',
        ]);
    case 'ping':
        rpc_out($id, new stdClass());
    case 'tools/list':
        $list = [];
        foreach ($tools as $name => $t) {
            $list[] = ['name' => $name, 'description' => $t['description'],
                       'inputSchema' => ['type' => 'object', 'properties' => $t['input'] ?: new stdClass(), 'required' => $t['required'] ?? []],
                       'annotations' => ['readOnlyHint' => !empty($t['read']), 'destructiveHint' => !empty($t['destructive'])]];
        }
        rpc_out($id, ['tools' => $list]);
    case 'tools/call':
        $t = $tools[$p['name'] ?? ''] ?? null;
        if (!$t) rpc_err($id, -32602, 'Unknown tool.');
        $args = is_array($p['arguments'] ?? null) ? $p['arguments'] : [];
        foreach ($t['required'] ?? [] as $r) if (!isset($args[$r]) || $args[$r] === '') rpc_out($id, tool_text("Missing $r.", true));
        try {
            rpc_out($id, tool_text(json_encode(($t['run'])($args), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)));
        } catch (RuntimeException $e) {
            rpc_out($id, tool_text($e->getMessage(), true));
        } catch (Throwable $e) {
            error_log('mcp: ' . $e->getMessage());
            rpc_out($id, tool_text('Something went wrong on the server.', true));
        }
    default:
        rpc_err($id, -32601, 'Method not found.');
}

// ── who is calling, and which trees they may touch ─────────────────────────────

function mcp_user(PDO $pdo, string $key): ?array {
    $st = $pdo->prepare("SELECT k.id AS key_id, u.id, u.email, u.display_name FROM api_keys k JOIN family_users u ON u.id = k.user_id WHERE k.key_hash = ? LIMIT 1");
    $st->execute([hash('sha256', $key)]);
    $u = $st->fetch();
    if ($u) $pdo->prepare("UPDATE api_keys SET last_used_at = NOW() WHERE id = ?")->execute([$u['key_id']]);
    return $u ?: null;
}

function mcp_trees(PDO $pdo, int $userId): array {
    $out = [];
    try {
        $st = $pdo->prepare("SELECT t.id, t.slug, t.display_name, t.visibility, t.settings, t.data_source, tu.role FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id WHERE tu.user_id = ? AND t.is_active = 1");
        $st->execute([$userId]);
        foreach ($st->fetchAll() as $r) $out[$r['slug']] = $r;
    } catch (PDOException $e) {}
    // accounts from before multi-tree support belong to one tree through family_users
    $st = $pdo->prepare("SELECT t.id, t.slug, t.display_name, t.visibility, t.settings, t.data_source, u.role FROM family_users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ? AND t.is_active = 1");
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $r) $out[$r['slug']] ??= $r;
    return $out;
}

/** the tree named in the arguments (or the only one), checked against the role an action needs */
function mcp_tree(array $a, string $need = 'viewer'): array {
    global $TREES;
    $slug = trim((string)($a['tree'] ?? ''));
    if ($slug === '') {
        if (count($TREES) === 1) $slug = array_key_first($TREES);
        else throw new RuntimeException('Which tree? Pass tree as one of: ' . implode(', ', array_keys($TREES)));
    }
    $t = $TREES[$slug] ?? null;
    if (!$t) throw new RuntimeException("No tree \"$slug\" for this account. Trees: " . implode(', ', array_keys($TREES)));
    $rank = ['viewer' => 1, 'editor' => 2, 'owner' => 3];
    if (($rank[$t['role']] ?? 0) < $rank[$need]) throw new RuntimeException("Your role in this tree is {$t['role']}; this needs {$need}.");
    return $t;
}

function mcp_store(array $t): FamilyStore { global $pdo; return ft_store($pdo, $t); }

function mcp_log(array $t, string $action, ?int $entity, array $changes): void {
    global $pdo, $me;
    try {
        $pdo->prepare("INSERT INTO family_activity_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, tenant_id) VALUES (?, ?, 'member', ?, ?, ?, 'Claude connector', ?)")
            ->execute([$me['id'], $action, $entity, json_encode($changes + ['via' => 'claude']), $_SERVER['REMOTE_ADDR'] ?? null, $t['id']]);
    } catch (PDOException $e) { error_log('mcp log: ' . $e->getMessage()); }
}

// ── small helpers for answers ───────────────────────────────────────────────────

function mcp_years(array $m): string {
    $b = $m['birth_date'] ? substr($m['birth_date'], 0, 4) : '';
    $d = $m['death_date'] ? substr($m['death_date'], 0, 4) : '';
    if ($b && $d) return "{$b}–{$d}";                         // braces: an en dash is a legal variable-name byte in PHP
    if ($b) return empty($m['is_alive']) ? "{$b}–?" : "b. {$b}";
    return $d ? "d. $d" : '';
}

function mcp_brief(array $m): array {
    return ['id' => $m['id'], 'name' => $m['name'], 'years' => mcp_years($m) ?: null, 'living' => (bool)$m['is_alive']];
}

function mcp_find(array $members, $who): array {
    foreach ($members as $m) if ((string)$m['id'] === (string)$who) return $m;
    $hits = array_values(array_filter($members, fn($m) => mb_strtolower($m['name']) === mb_strtolower(trim((string)$who))));
    if (count($hits) === 1) return $hits[0];
    if (count($hits) > 1) throw new RuntimeException('Several people are called "' . $who . '": ' . implode(', ', array_map(fn($m) => "#{$m['id']} " . mcp_years($m), $hits)) . '. Pass an id.');
    throw new RuntimeException("Nobody \"$who\" in this tree. Use search_people to find the id.");
}

/** the fields a person may have, read from tool arguments */
function mcp_fields(array $a): array {
    $f = [];
    foreach (['name', 'nickname', 'gender', 'birth_date', 'birth_location', 'death_date', 'death_location', 'current_location', 'anniversary_date'] as $k)
        if (array_key_exists($k, $a)) $f[$k] = $a[$k] === '' ? null : trim((string)$a[$k]);
    if (array_key_exists('bio', $a)) $f['wiki'] = $a['bio'] === '' ? null : mb_substr((string)$a['bio'], 0, 750);
    if (array_key_exists('living', $a)) $f['is_alive'] = $a['living'] ? 1 : 0;
    if (isset($f['gender']) && !in_array($f['gender'], ['male', 'female', null], true)) throw new RuntimeException('gender is male, female or empty.');
    foreach (['birth_date', 'death_date', 'anniversary_date'] as $k)
        if (!empty($f[$k]) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $f[$k])) throw new RuntimeException("$k must be YYYY-MM-DD; put an approximate date in the bio instead.");
    if (!empty($f['death_date'])) $f['is_alive'] = 0;
    return $f;
}

/** make A and B spouses of each other (both directions) */
function mcp_marry(FamilyStore $s, array $members, int $a, int $b): void {
    $byId = []; foreach ($members as $m) $byId[$m['id']] = $m;
    foreach ([[$a, $b], [$b, $a]] as [$x, $y]) {
        $p = ft_pids($byId[$x]['pids'] ?? []);
        if (!in_array($y, $p, true)) $s->patchMember($x, ['pids' => array_merge($p, [$y])]);
    }
}

// ── the tools ──────────────────────────────────────────────────────────────────

function mcp_tools(): array {
    $tree = ['type' => 'string', 'description' => 'The tree\'s link name (slug), e.g. "sharma". Optional when the account has one tree.'];
    $who  = ['type' => ['integer', 'string'], 'description' => 'A person\'s id (from search_people) or exact full name.'];
    $person = [
        'name' => ['type' => 'string'], 'nickname' => ['type' => 'string'], 'gender' => ['type' => 'string', 'enum' => ['male', 'female', '']],
        'birth_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD, exact dates only'], 'birth_location' => ['type' => 'string', 'description' => 'Place, as specific as known, e.g. "Darbhanga, Bihar, India"'],
        'death_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD'], 'death_location' => ['type' => 'string'],
        'current_location' => ['type' => 'string', 'description' => 'Where a living person lives now'], 'anniversary_date' => ['type' => 'string', 'description' => 'Wedding date YYYY-MM-DD'],
        'living' => ['type' => 'boolean'], 'bio' => ['type' => 'string', 'description' => 'Up to 750 characters: stories, work, approximate dates'],
    ];
    return [
        'list_trees' => [
            'description' => 'The family trees this account can open, with its role in each, their size and public link.', 'read' => true, 'input' => [],
            'run' => function (array $a): array {
                global $TREES;
                $host = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
                return array_values(array_map(function ($t) use ($host) {
                    try { $n = mcp_store($t)->countMembers(); } catch (Throwable $e) { $n = null; }
                    return ['tree' => $t['slug'], 'name' => $t['display_name'], 'role' => $t['role'], 'people' => $n, 'visibility' => $t['visibility'], 'link' => "$host/tree/{$t['slug']}"];
                }, $TREES));
            },
        ],
        'get_tree' => [
            'description' => 'An overview of one tree: how many people and generations, the years it spans, its oldest ancestors, and where its data lives.', 'read' => true,
            'input' => ['tree' => $tree],
            'run' => function (array $a): array {
                $t = mcp_tree($a); $s = mcp_store($t); $ms = $s->members();
                $byId = []; foreach ($ms as $m) $byId[$m['id']] = $m;
                $depth = []; $gen = function ($id) use (&$gen, &$depth, $byId) { if (isset($depth[$id])) return $depth[$id]; $depth[$id] = 1; $p = 0;
                    foreach (['fid', 'mid'] as $k) if ($byId[$id][$k] && isset($byId[$byId[$id][$k]])) $p = max($p, $gen($byId[$id][$k])); return $depth[$id] = $p + 1; };
                foreach ($byId as $id => $_) $gen($id);
                $years = []; foreach ($ms as $m) foreach (['birth_date', 'death_date'] as $k) if ($m[$k]) $years[] = (int)substr($m[$k], 0, 4);
                $hasKids = []; foreach ($ms as $m) foreach (['fid', 'mid'] as $k) if ($m[$k]) $hasKids[$m[$k]] = true;
                $roots = array_values(array_filter($ms, fn($m) => !$m['fid'] && !$m['mid'] && isset($hasKids[$m['id']])));
                return ['tree' => $t['slug'], 'name' => $t['display_name'], 'people' => count($ms), 'living' => count(array_filter($ms, fn($m) => $m['is_alive'])),
                        'generations' => $depth ? max($depth) : 0, 'years' => $years ? min($years) . '–' . max($years) : null, 'photos' => $s->countMedia(),
                        'oldest_ancestors' => array_map('mcp_brief', array_slice($roots, 0, 12)), 'data_home' => $s->kind(), 'your_role' => $t['role']];
            },
        ],
        'search_people' => [
            'description' => 'Find people by name or nickname (part of a name works). Also matches places when no name matches.', 'read' => true,
            'input' => ['tree' => $tree, 'query' => ['type' => 'string'], 'limit' => ['type' => 'integer', 'description' => 'Default 20']], 'required' => ['query'],
            'run' => function (array $a): array {
                $ms = mcp_store(mcp_tree($a))->members(); $q = mb_strtolower(trim($a['query'])); $lim = max(1, min(100, (int)($a['limit'] ?? 20)));
                $byId = []; foreach ($ms as $m) $byId[$m['id']] = $m;
                $hit = array_filter($ms, fn($m) => str_contains(mb_strtolower($m['name'] . ' ' . ($m['nickname'] ?? '')), $q));
                if (!$hit) $hit = array_filter($ms, fn($m) => str_contains(mb_strtolower(($m['birth_location'] ?? '') . ' ' . ($m['death_location'] ?? '') . ' ' . ($m['current_location'] ?? '')), $q));
                return array_map(fn($m) => mcp_brief($m) + ['father' => $byId[$m['fid']]['name'] ?? null, 'mother' => $byId[$m['mid']]['name'] ?? null, 'born_in' => $m['birth_location']],
                                 array_slice(array_values($hit), 0, $lim));
            },
        ],
        'get_person' => [
            'description' => 'Everything about one person: dates, places, bio, and their parents, spouses, children and siblings, and photos.', 'read' => true,
            'input' => ['tree' => $tree, 'person' => $who], 'required' => ['person'],
            'run' => function (array $a): array {
                $s = mcp_store(mcp_tree($a)); $ms = $s->members(); $m = mcp_find($ms, $a['person']);
                $byId = []; foreach ($ms as $x) $byId[$x['id']] = $x;
                $kids = array_values(array_filter($ms, fn($x) => $x['fid'] === $m['id'] || $x['mid'] === $m['id']));
                $sibs = array_values(array_filter($ms, fn($x) => $x['id'] !== $m['id'] && (($m['fid'] && $x['fid'] === $m['fid']) || ($m['mid'] && $x['mid'] === $m['mid']))));
                $photos = array_values(array_filter($s->media(), fn($x) => in_array($m['id'], $x['member_ids'], true)));
                return ['id' => $m['id'], 'name' => $m['name'], 'nickname' => $m['nickname'], 'gender' => $m['gender'], 'living' => (bool)$m['is_alive'],
                        'born' => ['date' => $m['birth_date'], 'place' => $m['birth_location']], 'died' => ['date' => $m['death_date'], 'place' => $m['death_location']],
                        'lives_in' => $m['current_location'], 'wedding_date' => $m['anniversary_date'], 'bio' => $m['wiki'],
                        'father' => isset($byId[$m['fid']]) ? mcp_brief($byId[$m['fid']]) : null, 'mother' => isset($byId[$m['mid']]) ? mcp_brief($byId[$m['mid']]) : null,
                        'spouses' => array_map(fn($i) => mcp_brief($byId[$i]), array_values(array_filter($m['pids'], fn($i) => isset($byId[$i])))),
                        'children' => array_map('mcp_brief', $kids), 'siblings' => array_map('mcp_brief', $sibs),
                        'photos' => array_map(fn($x) => ['title' => $x['title'], 'url' => $x['url']], $photos)];
            },
        ],
        'relationship' => [
            'description' => 'How two people in the tree are related, in plain words ("Ravi is Kamla\'s grandson").', 'read' => true,
            'input' => ['tree' => $tree, 'person_a' => $who, 'person_b' => $who], 'required' => ['person_a', 'person_b'],
            'run' => function (array $a): array {
                $ms = mcp_store(mcp_tree($a))->members();
                $x = mcp_find($ms, $a['person_a'])['id']; $y = mcp_find($ms, $a['person_b'])['id'];
                $hi = ft_indian_term($ms, $y, $x);   // the word person_b would use for person_a
                return ['answer' => ft_relationship($ms, $x, $y)] + ($hi ? ['in_hindi' => $hi['roman'] . ' (' . $hi['hindi'] . '), ' . $hi['english']] : []);
            },
        ],
        'upcoming_events' => [
            'description' => 'Birthdays, wedding anniversaries and remembrance days coming up.', 'read' => true,
            'input' => ['tree' => $tree, 'days' => ['type' => 'integer', 'description' => 'How far ahead, default 30']],
            'run' => function (array $a): array {
                $ms = mcp_store(mcp_tree($a))->members(); $days = max(1, min(366, (int)($a['days'] ?? 30)));
                $today = new DateTime('today'); $out = [];
                foreach ($ms as $m) {
                    $ev = [];
                    if ($m['birth_date']) $ev[] = [$m['is_alive'] ? 'birthday' : 'born on this day', $m['birth_date']];
                    if ($m['anniversary_date'] && $m['is_alive']) $ev[] = ['wedding anniversary', $m['anniversary_date']];
                    if ($m['death_date']) $ev[] = ['remembrance', $m['death_date']];
                    foreach ($ev as [$kind, $d]) {
                        $next = DateTime::createFromFormat('Y-m-d', $today->format('Y') . substr($d, 4));
                        if (!$next) continue;
                        if ($next < $today) $next->modify('+1 year');
                        $in = (int)$today->diff($next)->days;
                        if ($in <= $days) $out[] = ['date' => $next->format('Y-m-d'), 'in_days' => $in, 'what' => $kind, 'who' => $m['name'], 'id' => $m['id'],
                                                    'years' => (int)$next->format('Y') - (int)substr($d, 0, 4)];
                    }
                }
                usort($out, fn($x, $y) => $x['in_days'] <=> $y['in_days']);
                return array_slice($out, 0, 60);
            },
        ],
        'add_person' => [
            'description' => 'Add a person, optionally linked to their father, mother and spouses already in the tree. Needs editor or owner.',
            'input' => ['tree' => $tree] + $person + ['father' => $who, 'mother' => $who, 'spouses' => ['type' => 'array', 'items' => $who]], 'required' => ['name'],
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'editor'); $s = mcp_store($t); $ms = $s->members();
                $f = mcp_fields($a) + ['is_alive' => 1];
                if (!empty($a['father'])) $f['fid'] = mcp_find($ms, $a['father'])['id'];
                if (!empty($a['mother'])) $f['mid'] = mcp_find($ms, $a['mother'])['id'];
                $sp = array_map(fn($w) => mcp_find($ms, $w)['id'], (array)($a['spouses'] ?? []));
                $id = $s->insertMember($f + ['pids' => []]);
                foreach ($sp as $x) mcp_marry($s, $s->members(), $id, $x);
                mcp_log($t, 'member_add', $id, ['name' => $f['name']]);
                return ['added' => mcp_brief($s->member($id)), 'link' => 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . '/tree/' . $t['slug']];
            },
        ],
        'update_person' => [
            'description' => 'Change some details of a person; only the fields given change. Needs editor or owner.',
            'input' => ['tree' => $tree, 'person' => $who] + $person, 'required' => ['person'],
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'editor'); $s = mcp_store($t); $m = mcp_find($s->members(), $a['person']);
                $f = mcp_fields($a);
                if (!$f) throw new RuntimeException('Nothing to change: pass at least one field.');
                $s->patchMember($m['id'], $f);
                mcp_log($t, 'member_update', $m['id'], array_keys($f));
                return ['updated' => mcp_brief($s->member($m['id'])), 'fields' => array_keys($f)];
            },
        ],
        'link_people' => [
            'description' => 'Record a relationship between two people already in the tree: relation is what "other" is to "person" (father, mother, parent, spouse or child). Needs editor or owner.',
            'input' => ['tree' => $tree, 'person' => $who, 'relation' => ['type' => 'string', 'enum' => ['father', 'mother', 'parent', 'spouse', 'child']], 'other' => $who],
            'required' => ['person', 'relation', 'other'],
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'editor'); $s = mcp_store($t); $ms = $s->members();
                $p = mcp_find($ms, $a['person']); $o = mcp_find($ms, $a['other']);
                if ($p['id'] === $o['id']) throw new RuntimeException('That is the same person.');
                $parentSlot = fn(array $parent) => $parent['gender'] === 'female' ? 'mid' : ($parent['gender'] === 'male' ? 'fid' : null);
                switch ($a['relation']) {
                    case 'father': $s->patchMember($p['id'], ['fid' => $o['id']]); break;
                    case 'mother': $s->patchMember($p['id'], ['mid' => $o['id']]); break;
                    case 'parent':
                        $k = $parentSlot($o) ?? throw new RuntimeException("Set {$o['name']}'s gender first, or say father or mother.");
                        $s->patchMember($p['id'], [$k => $o['id']]); break;
                    case 'child':
                        $k = $parentSlot($p) ?? throw new RuntimeException("Set {$p['name']}'s gender first so the tree knows father or mother.");
                        $s->patchMember($o['id'], [$k => $p['id']]); break;
                    case 'spouse': mcp_marry($s, $ms, $p['id'], $o['id']); break;
                    default: throw new RuntimeException('relation is father, mother, parent, spouse or child.');
                }
                mcp_log($t, 'member_link', $p['id'], ['relation' => $a['relation'], 'other' => $o['id']]);
                return ['answer' => ft_relationship($s->members(), $o['id'], $p['id'])];
            },
        ],
        'add_photo' => [
            'description' => 'Add a photo by its web address (an image already online) and tag the people in it. Needs editor or owner.',
            'input' => ['tree' => $tree, 'url' => ['type' => 'string', 'description' => 'https://... address of the image'], 'title' => ['type' => 'string'],
                        'description' => ['type' => 'string'], 'people' => ['type' => 'array', 'items' => $who]],
            'required' => ['url'],
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'editor'); $s = mcp_store($t); $ms = $s->members();
                if (!preg_match('~^https://~i', $a['url'])) throw new RuntimeException('Give an https:// address of the image.');
                $ids = array_map(fn($w) => mcp_find($ms, $w)['id'], (array)($a['people'] ?? []));
                $mid = $s->insertMedia(['url' => $a['url'], 'type' => 'image', 'title' => $a['title'] ?? null, 'description' => $a['description'] ?? null], $ids);
                mcp_log($t, 'media_add', $mid, ['url' => $a['url']]);
                return ['added_photo' => $mid, 'tagged' => count($ids)];
            },
        ],
        'import_gedcom' => [
            'description' => 'Bring in a GEDCOM file\'s text (from Ancestry, MyHeritage, FamilySearch, Gramps and others). mode "add" puts the people beside the ones already here; "replace" makes the file the whole tree. Needs owner.',
            'input' => ['tree' => $tree, 'gedcom' => ['type' => 'string', 'description' => 'The full text of the .ged file'], 'mode' => ['type' => 'string', 'enum' => ['add', 'replace']]],
            'required' => ['gedcom'], 'destructive' => true,
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'owner'); $s = mcp_store($t);
                if (strlen($a['gedcom']) > 5 * 1024 * 1024) throw new RuntimeException('That GEDCOM is over 5 MB; use Members > Import in the admin instead.');
                $data = ft_gedcom_read($a['gedcom']);
                $mode = ($a['mode'] ?? 'add') === 'replace' ? 'replace' : 'add';
                if ($mode === 'replace') $s->importAll($data['members'], $data['media']);
                else {
                    $ex = $s->members(); $shift = $ex ? max(array_column($ex, 'id')) : 0; $sh = fn($v) => $v ? (int)$v + $shift : null;
                    $new = array_map(function ($m) use ($sh) { $m['id'] = $sh($m['id']); $m['fid'] = $sh($m['fid']); $m['mid'] = $sh($m['mid']); $m['pids'] = array_map($sh, ft_pids($m['pids'])); return $m; }, $data['members']);
                    $old = $s->media(); $ms2 = $old ? max(array_column($old, 'id')) : 0;
                    $nm = array_map(function ($x) use ($sh, $ms2) { $x['id'] = (int)$x['id'] + $ms2; $x['member_ids'] = array_map($sh, $x['member_ids']); return $x; }, $data['media']);
                    global $pdo; ft_remap_accounts($pdo, $t['id'], $s->importAll(array_merge($ex, $new), array_merge($old, $nm)));
                }
                mcp_log($t, 'tree_import', null, ['mode' => $mode, 'people' => count($data['members'])]);
                return ['mode' => $mode, 'imported' => count($data['members']), 'tree_now_has' => $s->countMembers(), 'notes' => $data['stats']['warnings']];
            },
        ],
        'delete_person' => [
            'description' => 'Remove a person from the tree; links to them are cleared. Needs owner. Cannot be undone.',
            'input' => ['tree' => $tree, 'person' => $who], 'required' => ['person'], 'destructive' => true,
            'run' => function (array $a): array {
                $t = mcp_tree($a, 'owner'); $s = mcp_store($t); $ms = $s->members(); $m = mcp_find($ms, $a['person']);
                foreach ($ms as $x) {
                    $patch = [];
                    if (in_array($m['id'], $x['pids'], true)) $patch['pids'] = array_values(array_diff($x['pids'], [$m['id']]));
                    if ($x['fid'] === $m['id']) $patch['fid'] = null;
                    if ($x['mid'] === $m['id']) $patch['mid'] = null;
                    if ($patch) $s->patchMember($x['id'], $patch);
                }
                $s->deleteMember($m['id']);
                mcp_log($t, 'member_delete', $m['id'], ['name' => $m['name']]);
                return ['deleted' => $m['name']];
            },
        ],
    ];
}

function tool_text(string $text, bool $error = false): array { return ['content' => [['type' => 'text', 'text' => $text]], 'isError' => $error]; }
function rpc_out($id, $result): never { echo json_encode(['jsonrpc' => '2.0', 'id' => $id, 'result' => $result], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function rpc_err($id, int $code, string $message): never { echo json_encode(['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]]); exit; }
