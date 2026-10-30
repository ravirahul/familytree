<?php
/**
 * includes/store.php - where a family's data lives ("data home").
 *
 * Accounts, plans and tree names always live in the app's own database. The
 * family data of a tree (members, photos and their tags) goes through a
 * FamilyStore, and each tree chooses its own:
 *
 *   here      the app's database (default)
 *   mysql     the family's own MySQL / MariaDB
 *   pgsql     the family's own Postgres
 *   sqlite    a SQLite file (desktop app, small self-hosts)
 *   sheets    a Google Sheet (free), via a service account
 *   airtable  an Airtable base (free tier), via a personal access token
 *   json      a JSON file on this server (a Drive / Dropbox / OneDrive folder on the desktop)
 *
 * The choice is kept in tenants.data_source as encrypted JSON (APP_KEY).
 *
 *   $store = ft_store($pdo, $tenant);          // $tenant from loadTenant / getPublicTenantBySlug
 *   $store->members();  $store->insertMember([...]);  $store->media(); ...
 *
 * Member rows use the family_tree_data column names; pids is always an array.
 * Media rows are family_media columns plus member_ids (array of tagged members).
 */
require_once __DIR__ . '/db.php';

interface FamilyStore {
    /** @return array<int,array> every member, ordered by id */
    public function members(): array;
    public function member(int $id): ?array;
    public function insertMember(array $data): int;
    /** full update of the editable columns */
    public function updateMember(int $id, array $data): void;
    /** update only the given columns */
    public function patchMember(int $id, array $fields): void;
    public function deleteMember(int $id): void;
    public function countMembers(): int;

    /** @return array<int,array> every media row, newest first, each with member_ids */
    public function media(): array;
    public function mediaItem(int $id): ?array;
    public function insertMedia(array $data, array $memberIds): int;
    public function updateMedia(int $id, array $data, ?array $memberIds): void;
    public function deleteMedia(int $id): void;
    public function countMedia(): int;

    /** replace everything with these rows (moving a tree between homes); returns old member id => new member id */
    public function importAll(array $members, array $media): array;

    /** 'here' | 'mysql' | 'pgsql' | 'sqlite' | 'sheets' | 'airtable' | 'json' */
    public function kind(): string;
    /** true when reads go over the network and should be cached */
    public function remote(): bool;
    /** throws with a human message when the store cannot be used */
    public function check(): void;
}

const FT_MEMBER_COLS = ['name', 'nickname', 'birth_date', 'birth_location', 'gender', 'img', 'fid', 'mid', 'pids', 'is_alive',
    'current_location', 'insta_url', 'fb_url', 'anniversary_date', 'death_date', 'death_location', 'wiki', 'is_private', 'privacy_override', 'extra'];
const FT_MEDIA_COLS  = ['url', 'type', 'title', 'description', 'uploaded_by_user_id', 'created_at'];

/** a member column's value from a row, with the defaults the schema expects (flags are NOT NULL) */
function ft_member_val(array $row, string $col): mixed {
    if ($col === 'extra') return ft_extra_db($row['extra'] ?? null);
    $v = $row[$col] ?? null;
    if ($v === null || $v === '') return match ($col) { 'is_alive' => 1, 'is_private', 'privacy_override' => 0, default => null };
    return $v;
}

/**
 * extra: one JSON column for the details that came after the original columns, so a data home
 * (Sheets, Airtable, the family's own database) only ever needs this one column. Keys:
 *   name_local, native_place, gotra                     text
 *   birth_approx, death_approx  {q: abt|bef|aft|bet|year, y, y2}   when the exact date isn't known
 *   birth_tithi, death_tithi    {m: 1-12, p: S|K, t: 1-15, vs?}   Hindu lunar date, if given by hand
 *   sources   [{fact, title, url, page, note}]           where a fact comes from
 *   father_kind, mother_kind    birth|adoptive|step|foster
 *   partners  {"<id>": {married, ended, end: divorce|separated|widowed}}
 */
function ft_extra(mixed $raw): array {
    if (is_array($raw)) return $raw;
    $d = ($raw === null || $raw === '') ? null : json_decode((string)$raw, true);
    return is_array($d) ? $d : [];
}
function ft_extra_db(mixed $raw): ?string {
    $e = array_filter(ft_extra($raw), fn($v) => $v !== null && $v !== '' && $v !== []);
    return $e ? json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
}
/** extra as sent by an editor: known keys only, trimmed, bounded; anything else is dropped */
function ft_extra_clean(mixed $in): array {
    $in = ft_extra($in); $out = [];
    $txt = fn($v, $n = 120) => is_scalar($v) ? mb_substr(trim((string)$v), 0, $n) : '';
    $date = fn($v) => (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) ? $v : null;
    foreach (['name_local' => 255, 'native_place' => 255, 'gotra' => 80] as $k => $n) if (isset($in[$k]) && ($v = $txt($in[$k], $n)) !== '') $out[$k] = $v;
    foreach (['birth_approx', 'death_approx'] as $k) {
        $a = $in[$k] ?? null;
        if (is_array($a) && in_array($a['q'] ?? '', ['abt', 'bef', 'aft', 'bet', 'year'], true) && ($y = (int)($a['y'] ?? 0)) > 0 && $y < 3000) {
            $out[$k] = ['q' => $a['q'], 'y' => $y] + (($a['q'] === 'bet' && ($y2 = (int)($a['y2'] ?? 0)) > $y) ? ['y2' => $y2] : []);
        }
    }
    foreach (['birth_tithi', 'death_tithi'] as $k) {
        $t = $in[$k] ?? null;
        if (is_array($t) && ($m = (int)($t['m'] ?? 0)) >= 1 && $m <= 12 && in_array($t['p'] ?? '', ['S', 'K'], true) && ($d = (int)($t['t'] ?? 0)) >= 1 && $d <= 15) {
            $out[$k] = ['m' => $m, 'p' => $t['p'], 't' => $d] + (($vs = (int)($t['vs'] ?? 0)) > 1000 ? ['vs' => $vs] : []);
        }
    }
    foreach (['father_kind', 'mother_kind'] as $k) if (in_array($in[$k] ?? '', ['adoptive', 'step', 'foster'], true)) $out[$k] = $in[$k];
    if (is_array($in['sources'] ?? null)) {
        $src = [];
        foreach (array_slice($in['sources'], 0, 40) as $s) {
            if (!is_array($s)) continue;
            $r = ['fact' => in_array($s['fact'] ?? '', ['birth', 'death', 'marriage', 'name', 'place', 'parents', 'other'], true) ? $s['fact'] : 'other',
                  'title' => $txt($s['title'] ?? '', 200), 'url' => $txt($s['url'] ?? '', 500), 'page' => $txt($s['page'] ?? '', 120), 'note' => $txt($s['note'] ?? '', 500)];
            if ($r['url'] !== '' && !preg_match('~^https?://~i', $r['url'])) $r['url'] = '';
            $r = array_filter($r, fn($v) => $v !== '');
            if (isset($r['title']) || isset($r['url']) || isset($r['note'])) $src[] = $r;
        }
        if ($src) $out['sources'] = $src;
    }
    if (is_array($in['partners'] ?? null)) {
        $p = [];
        foreach ($in['partners'] as $pid => $v) {
            if ((int)$pid <= 0 || !is_array($v)) continue;
            $r = array_filter(['married' => $date($v['married'] ?? null), 'ended' => $date($v['ended'] ?? null),
                               'end' => in_array($v['end'] ?? '', ['divorce', 'separated', 'widowed'], true) ? $v['end'] : null], fn($x) => $x !== null);
            if ($r) $p[(string)(int)$pid] = $r;
        }
        if ($p) $out['partners'] = $p;
    }
    return $out;
}

/** a member value as a row store (Sheets, Airtable, JSON) keeps it: text, '' for empty */
function ft_row_val(array $d, string $c): mixed {
    return match ($c) { 'pids' => ft_pids_db($d['pids'] ?? null) ?? '', 'extra' => ft_extra_db($d['extra'] ?? null) ?? '', 'is_alive' => $d[$c] ?? 1, default => $d[$c] ?? '' };
}

/** pids as the app wants them: a list of positive ints */
function ft_pids(mixed $raw): array {
    if (is_array($raw)) return array_values(array_filter(array_map('intval', $raw), fn($v) => $v > 0));
    if ($raw === null || $raw === '') return [];
    $d = json_decode((string)$raw, true);
    if (is_array($d)) return array_values(array_filter(array_map('intval', $d), fn($v) => $v > 0));
    return array_values(array_filter(array_map('intval', explode(',', (string)$raw)), fn($v) => $v > 0));
}
/** pids as stored: JSON list or null */
function ft_pids_db(mixed $raw): ?string { $p = ft_pids($raw); return $p ? json_encode($p) : null; }

/** a member row normalised the same way whichever store it came from */
function ft_norm_member(array $r): array {
    $r['id']   = (int)$r['id'];
    $r['pids'] = ft_pids($r['pids'] ?? null);
    foreach (['fid', 'mid'] as $k) $r[$k] = isset($r[$k]) && $r[$k] !== '' ? (int)$r[$k] : null;
    foreach (['is_alive'] as $k) $r[$k] = isset($r[$k]) && $r[$k] !== '' ? (int)$r[$k] : 1;
    foreach (['is_private', 'privacy_override'] as $k) $r[$k] = (int)($r[$k] ?? 0);
    foreach (['birth_date', 'death_date', 'anniversary_date'] as $k) if (($r[$k] ?? '') === '0000-00-00') $r[$k] = null;
    foreach (FT_MEMBER_COLS as $k) if (!array_key_exists($k, $r)) $r[$k] = null;
    $r['extra'] = ft_extra($r['extra']);
    if (!isset($r['wiki_preview'])) { $w = (string)($r['wiki'] ?? ''); $r['wiki_preview'] = mb_strlen($w) > 100 ? mb_substr($w, 0, 100) . '...' : $w; }
    return $r;
}

/* ── secrets at rest ─────────────────────────────────────────────────────── */
/** APP_KEY from .env, or a key made once and kept in storage/app.key (so older installs need no .env edit). */
function ft_app_key(): string {
    $k = getenv('APP_KEY') ?: '';
    if ($k === '') {
        $f = ft_storage_dir() . '/app.key';
        if (is_file($f)) $k = trim((string)file_get_contents($f));
        if ($k === '') { $k = bin2hex(random_bytes(32)); if (!is_dir(dirname($f))) @mkdir(dirname($f), 0750, true); @file_put_contents($f, $k, LOCK_EX); }
    }
    return hash('sha256', $k, true);
}
function ft_encrypt(string $plain): string {
    $iv = random_bytes(12);
    $ct = openssl_encrypt($plain, 'aes-256-gcm', ft_app_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return 'v1:' . base64_encode($iv . $tag . $ct);
}
function ft_decrypt(string $blob): ?string {
    if (!str_starts_with($blob, 'v1:')) return $blob === '' ? null : $blob;       // plain JSON from before encryption
    $raw = base64_decode(substr($blob, 3), true);
    if ($raw === false || strlen($raw) < 29) return null;
    $out = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', ft_app_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $out === false ? null : $out;
}

/* ── the data source of a tree ───────────────────────────────────────────── */
function ft_data_source(array $tenant): array {
    $raw = $tenant['data_source'] ?? null;
    if (!$raw) return ['type' => 'here'];
    $json = ft_decrypt((string)$raw);
    $cfg  = $json ? json_decode($json, true) : null;
    return is_array($cfg) && !empty($cfg['type']) ? $cfg : ['type' => 'here'];
}
function ft_save_data_source(PDO $pdo, string $tenantId, ?array $cfg): void {
    $blob = ($cfg && ($cfg['type'] ?? 'here') !== 'here') ? ft_encrypt(json_encode($cfg)) : null;
    $pdo->prepare("UPDATE tenants SET data_source = ? WHERE id = ?")->execute([$blob, $tenantId]);
    ft_cache_forget($tenantId);
}

/** Build the store for a tenant from its saved data source (or from $cfg when testing one). */
function ft_store(PDO $pdo, array $tenant, ?array $cfg = null): FamilyStore {
    $cfg ??= ft_data_source($tenant);
    $tid  = (string)$tenant['id'];
    $store = match ($cfg['type'] ?? 'here') {
        'mysql', 'pgsql', 'sqlite' => new PdoFamilyStore(ft_connect(['driver' => $cfg['type']] + $cfg), $tid, $cfg['type']),
        'sheets'   => (require_once __DIR__ . '/stores/sheets.php')   ? new SheetsFamilyStore($cfg, $tid) : null,
        'airtable' => (require_once __DIR__ . '/stores/airtable.php') ? new AirtableFamilyStore($cfg, $tid) : null,
        'json'     => (require_once __DIR__ . '/stores/json.php')     ? new JsonFamilyStore($cfg, $tid) : null,
        default    => new PdoFamilyStore($pdo, $tid, 'here'),
    };
    $store = $store->remote() ? new CachedFamilyStore($store, $tid) : $store;
    return new HistoryFamilyStore($store, $pdo, $tid);           // every change is recorded (includes/history.php)
}

/* ── the schema a family's own database needs (just the family tables) ───── */
function ft_family_schema(string $driver): array {
    $id = $driver === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : ($driver === 'pgsql' ? 'SERIAL PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY');
    $txt = $driver === 'pgsql' ? 'TEXT' : 'TEXT';
    $vc  = 'VARCHAR(255)';
    $ts  = $driver === 'pgsql' ? 'TIMESTAMP' : 'DATETIME';
    $tbl = $driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    return [
        "CREATE TABLE IF NOT EXISTS family_tree_data (id $id, tenant_id CHAR(36) NOT NULL, name $vc NOT NULL, nickname $vc, birth_date $vc, birth_location $vc, gender VARCHAR(50), img $vc, fid INT, mid INT, pids $txt, current_location $vc, insta_url $vc, fb_url $vc, anniversary_date $vc, death_date $vc, death_location $vc, is_alive INT DEFAULT 1, wiki $txt, is_private INT DEFAULT 0, privacy_override INT DEFAULT 0, extra $txt)$tbl",
        "CREATE TABLE IF NOT EXISTS family_media (id $id, tenant_id CHAR(36) NOT NULL, url $vc NOT NULL, type VARCHAR(10) DEFAULT 'image', title $vc, description $txt, uploaded_by_user_id INT, created_at $ts)$tbl",
        "CREATE TABLE IF NOT EXISTS family_media_tags (tenant_id CHAR(36) NOT NULL, media_id INT NOT NULL, member_id INT NOT NULL, PRIMARY KEY (tenant_id, media_id, member_id))$tbl",
    ];
}

/* ── PDO store: the app's own database, or the family's own SQL database ─── */
class PdoFamilyStore implements FamilyStore {
    public function __construct(private PDO $pdo, private string $tid, private string $type = 'here') {}
    public function kind(): string { return $this->type; }
    public function remote(): bool { return false; }
    public function check(): void {
        try { $this->pdo->query("SELECT 1 FROM family_tree_data LIMIT 1"); }
        catch (PDOException $e) { throw new RuntimeException('Tables missing: ' . $e->getMessage()); }
    }
    public function createTables(): void {
        $driver = $this->type === 'here' ? $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) : $this->type;
        foreach (ft_family_schema($driver) as $sql) $this->pdo->exec($sql);
    }
    private function cols(): string { return 'id, ' . implode(', ', FT_MEMBER_COLS); }

    /** databases made before the extra column get it the first time they are read */
    private function ensureExtra(): void {
        static $done = [];
        $k = spl_object_id($this->pdo); if (isset($done[$k])) return; $done[$k] = true;
        try { $this->pdo->query("SELECT extra FROM family_tree_data LIMIT 1"); }
        catch (PDOException $e) { $this->pdo->exec("ALTER TABLE family_tree_data ADD COLUMN extra TEXT"); }
    }
    public function members(): array {
        $this->ensureExtra();
        $st = $this->pdo->prepare("SELECT {$this->cols()} FROM family_tree_data WHERE tenant_id = ? ORDER BY id");
        $st->execute([$this->tid]);
        return array_map('ft_norm_member', $st->fetchAll());
    }
    public function member(int $id): ?array {
        $this->ensureExtra();
        $st = $this->pdo->prepare("SELECT {$this->cols()} FROM family_tree_data WHERE id = ? AND tenant_id = ?");
        $st->execute([$id, $this->tid]);
        $r = $st->fetch();
        return $r ? ft_norm_member($r) : null;
    }
    public function insertMember(array $d): int {
        $this->ensureExtra();
        $vals = []; foreach (FT_MEMBER_COLS as $c) $vals[] = $c === 'pids' ? ft_pids_db($d['pids'] ?? null) : ft_member_val($d, $c);
        $vals[] = $this->tid;
        $this->pdo->prepare("INSERT INTO family_tree_data (" . implode(', ', FT_MEMBER_COLS) . ", tenant_id) VALUES (" . rtrim(str_repeat('?, ', count(FT_MEMBER_COLS) + 1), ', ') . ")")->execute($vals);
        return (int)$this->pdo->lastInsertId();
    }
    /** put a person back under their old id (restoring from the bin) */
    public function insertMemberWithId(int $id, array $d): void {
        $this->ensureExtra();
        $vals = [$id]; foreach (FT_MEMBER_COLS as $c) $vals[] = $c === 'pids' ? ft_pids_db($d['pids'] ?? null) : ft_member_val($d, $c);
        $vals[] = $this->tid;
        $this->pdo->prepare("INSERT INTO family_tree_data (id, " . implode(', ', FT_MEMBER_COLS) . ", tenant_id) VALUES (" . rtrim(str_repeat('?, ', count(FT_MEMBER_COLS) + 2), ', ') . ")")->execute($vals);
    }
    public function updateMember(int $id, array $d): void { $this->patchMember($id, array_intersect_key($d, array_flip(FT_MEMBER_COLS)) + ['pids' => $d['pids'] ?? []]); }
    public function patchMember(int $id, array $f): void {
        $f = array_intersect_key($f, array_flip(FT_MEMBER_COLS));
        if (!$f) return;
        $set = []; $vals = [];
        foreach ($f as $c => $v) { $set[] = "$c = ?"; $vals[] = match ($c) { 'pids' => ft_pids_db($v), 'extra' => ft_extra_db($v), default => $v }; }
        $vals[] = $id; $vals[] = $this->tid;
        $this->pdo->prepare("UPDATE family_tree_data SET " . implode(', ', $set) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    }
    public function deleteMember(int $id): void {
        $this->pdo->prepare("DELETE FROM family_media_tags WHERE member_id = ? AND tenant_id = ?")->execute([$id, $this->tid]);
        $this->pdo->prepare("DELETE FROM family_tree_data WHERE id = ? AND tenant_id = ?")->execute([$id, $this->tid]);
    }
    public function countMembers(): int {
        $st = $this->pdo->prepare("SELECT COUNT(*) FROM family_tree_data WHERE tenant_id = ?"); $st->execute([$this->tid]); return (int)$st->fetchColumn();
    }

    public function media(): array {
        $st = $this->pdo->prepare("SELECT id, " . implode(', ', FT_MEDIA_COLS) . " FROM family_media WHERE tenant_id = ? ORDER BY created_at DESC, id DESC");
        $st->execute([$this->tid]);
        $rows = []; foreach ($st->fetchAll() as $r) { $r['id'] = (int)$r['id']; $r['type'] = $r['type'] ?: 'image'; $r['member_ids'] = []; $rows[$r['id']] = $r; }
        if ($rows) {
            $t = $this->pdo->prepare("SELECT media_id, member_id FROM family_media_tags WHERE tenant_id = ?"); $t->execute([$this->tid]);
            foreach ($t->fetchAll() as $x) if (isset($rows[(int)$x['media_id']])) $rows[(int)$x['media_id']]['member_ids'][] = (int)$x['member_id'];
        }
        return array_values($rows);
    }
    public function mediaItem(int $id): ?array { foreach ($this->media() as $m) if ($m['id'] === $id) return $m; return null; }
    public function insertMedia(array $d, array $memberIds): int {
        $this->pdo->prepare("INSERT INTO family_media (url, type, title, description, uploaded_by_user_id, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([$d['url'], $d['type'] ?? 'image', $d['title'] ?? null, $d['description'] ?? null, $d['uploaded_by_user_id'] ?? null, $d['created_at'] ?? date('Y-m-d H:i:s'), $this->tid]);
        $id = (int)$this->pdo->lastInsertId();
        $this->setTags($id, $memberIds);
        return $id;
    }
    public function updateMedia(int $id, array $d, ?array $memberIds): void {
        $set = []; $vals = [];
        foreach (['url', 'type', 'title', 'description'] as $c) if (array_key_exists($c, $d)) { $set[] = "$c = ?"; $vals[] = $d[$c]; }
        if ($set) { $vals[] = $id; $vals[] = $this->tid; $this->pdo->prepare("UPDATE family_media SET " . implode(', ', $set) . " WHERE id = ? AND tenant_id = ?")->execute($vals); }
        if ($memberIds !== null) { $this->pdo->prepare("DELETE FROM family_media_tags WHERE media_id = ? AND tenant_id = ?")->execute([$id, $this->tid]); $this->setTags($id, $memberIds); }
    }
    private function setTags(int $mediaId, array $memberIds): void {
        $ins = $this->pdo->prepare("INSERT IGNORE INTO family_media_tags (tenant_id, media_id, member_id) VALUES (?, ?, ?)");
        foreach (array_unique(array_filter(array_map('intval', $memberIds))) as $mid) $ins->execute([$this->tid, $mediaId, $mid]);
    }
    public function deleteMedia(int $id): void {
        $this->pdo->prepare("DELETE FROM family_media_tags WHERE media_id = ? AND tenant_id = ?")->execute([$id, $this->tid]);
        $this->pdo->prepare("DELETE FROM family_media WHERE id = ? AND tenant_id = ?")->execute([$id, $this->tid]);
    }
    public function countMedia(): int {
        $st = $this->pdo->prepare("SELECT COUNT(*) FROM family_media WHERE tenant_id = ?"); $st->execute([$this->tid]); return (int)$st->fetchColumn();
    }
    /**
     * Ids are kept when they are free. In a database shared by many trees (the app's own) another
     * tree may already use them; then rows get new ids and every link (fid, mid, pids, media tags)
     * is rewritten. Returns old member id => new member id.
     */
    public function importAll(array $members, array $media): array {
        $this->ensureExtra();
        $this->pdo->beginTransaction();
        try {
            foreach (['family_media_tags', 'family_media', 'family_tree_data'] as $t) $this->pdo->prepare("DELETE FROM $t WHERE tenant_id = ?")->execute([$this->tid]);
            $taken = function (string $table, array $ids): bool {
                foreach (array_chunk(array_values(array_unique(array_map('intval', $ids))), 500) as $chunk) {
                    $st = $this->pdo->prepare("SELECT 1 FROM $table WHERE id IN (" . rtrim(str_repeat('?,', count($chunk)), ',') . ") LIMIT 1");
                    $st->execute($chunk);
                    if ($st->fetchColumn()) return true;
                }
                return false;
            };
            $keepM = !$members || !$taken('family_tree_data', array_column($members, 'id'));
            $keepX = !$media || !$taken('family_media', array_column($media, 'id'));

            // members: insert (with their ids when free), then point the links at the final ids
            $map = [];
            $cols = array_merge($keepM ? ['id'] : [], FT_MEMBER_COLS, ['tenant_id']);
            $ins = $this->pdo->prepare("INSERT INTO family_tree_data (" . implode(', ', $cols) . ") VALUES (" . rtrim(str_repeat('?, ', count($cols)), ', ') . ")");
            foreach ($members as $m) {
                $vals = $keepM ? [(int)$m['id']] : [];
                foreach (FT_MEMBER_COLS as $c) $vals[] = in_array($c, ['pids', 'fid', 'mid'], true) ? null : ft_member_val($m, $c);
                $vals[] = $this->tid; $ins->execute($vals);
                $map[(int)$m['id']] = $keepM ? (int)$m['id'] : (int)$this->pdo->lastInsertId();
            }
            $link = $this->pdo->prepare("UPDATE family_tree_data SET fid = ?, mid = ?, pids = ?, extra = ? WHERE id = ? AND tenant_id = ?");
            foreach ($members as $m) {
                $f = $m['fid'] ?? null; $mo = $m['mid'] ?? null;
                $p = array_values(array_filter(array_map(fn($x) => $map[$x] ?? null, ft_pids($m['pids'] ?? null))));
                $x = ft_extra($m['extra'] ?? null);              // partnership details are keyed by the partner's id
                if (!empty($x['partners'])) { $np = []; foreach ($x['partners'] as $pid => $v) if (isset($map[(int)$pid])) $np[(string)$map[(int)$pid]] = $v; $x['partners'] = $np; }
                $link->execute([$f && isset($map[(int)$f]) ? $map[(int)$f] : null, $mo && isset($map[(int)$mo]) ? $map[(int)$mo] : null, $p ? json_encode($p) : null, ft_extra_db($x), $map[(int)$m['id']], $this->tid]);
            }
            // media, tagged with the final member ids
            $colsX = ($keepX ? 'id, ' : '') . 'url, type, title, description, uploaded_by_user_id, created_at, tenant_id';
            $insM = $this->pdo->prepare("INSERT INTO family_media ($colsX) VALUES (" . rtrim(str_repeat('?, ', $keepX ? 8 : 7), ', ') . ")");
            foreach ($media as $x) {
                $vals = [$x['url'], $x['type'] ?? 'image', $x['title'] ?? null, $x['description'] ?? null, $x['uploaded_by_user_id'] ?? null, $x['created_at'] ?? date('Y-m-d H:i:s'), $this->tid];
                if ($keepX) array_unshift($vals, (int)$x['id']);
                $insM->execute($vals);
                $newId = $keepX ? (int)$x['id'] : (int)$this->pdo->lastInsertId();
                $this->setTags($newId, array_values(array_filter(array_map(fn($x) => $map[(int)$x] ?? null, $x['member_ids'] ?? []))));
            }
            $this->pdo->commit();
            return $map;
        } catch (Throwable $e) { $this->pdo->rollBack(); throw $e; }
    }
}

/* ── a one-minute file cache in front of a remote store ──────────────────── */
function ft_cache_dir(): string { $d = ft_storage_dir() . '/cache'; if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
function ft_cache_forget(string $tid): void { foreach (glob(ft_cache_dir() . "/$tid.*.json") ?: [] as $f) @unlink($f); }

class CachedFamilyStore implements FamilyStore {
    public const TTL = 60;
    public function __construct(private FamilyStore $inner, private string $tid) {}
    private function file(string $what): string { return ft_cache_dir() . "/{$this->tid}.$what.json"; }
    private function cached(string $what, callable $load): array {
        $f = $this->file($what);
        if (is_file($f) && time() - filemtime($f) < self::TTL) { $d = json_decode((string)file_get_contents($f), true); if (is_array($d)) return $d; }
        $d = $load(); file_put_contents($f, json_encode($d), LOCK_EX); return $d;
    }
    private function bust(): void { ft_cache_forget($this->tid); }
    public function members(): array { return $this->cached('members', fn() => $this->inner->members()); }
    public function member(int $id): ?array { foreach ($this->members() as $m) if ($m['id'] === $id) return $m; return null; }
    public function insertMember(array $d): int { $id = $this->inner->insertMember($d); $this->bust(); return $id; }
    public function updateMember(int $id, array $d): void { $this->inner->updateMember($id, $d); $this->bust(); }
    public function patchMember(int $id, array $f): void { $this->inner->patchMember($id, $f); $this->bust(); }
    public function deleteMember(int $id): void { $this->inner->deleteMember($id); $this->bust(); }
    public function countMembers(): int { return count($this->members()); }
    public function media(): array { return $this->cached('media', fn() => $this->inner->media()); }
    public function mediaItem(int $id): ?array { foreach ($this->media() as $m) if ($m['id'] === $id) return $m; return null; }
    public function insertMedia(array $d, array $ids): int { $id = $this->inner->insertMedia($d, $ids); $this->bust(); return $id; }
    public function updateMedia(int $id, array $d, ?array $ids): void { $this->inner->updateMedia($id, $d, $ids); $this->bust(); }
    public function deleteMedia(int $id): void { $this->inner->deleteMedia($id); $this->bust(); }
    public function countMedia(): int { return count($this->media()); }
    public function importAll(array $members, array $media): array { $map = $this->inner->importAll($members, $media); $this->bust(); return $map; }
    public function kind(): string { return $this->inner->kind(); }
    public function remote(): bool { return true; }
    public function check(): void { $this->inner->check(); }
    public function inner(): FamilyStore { return $this->inner; }
}
/** the real store under the history and cache wrappers */
function ft_store_inner(FamilyStore $s): FamilyStore {
    while ($s instanceof CachedFamilyStore || $s instanceof HistoryFamilyStore) $s = $s->inner();
    return $s;
}

/* ── shared base for table-like remote stores (Sheets, Airtable, JSON) ───── */
abstract class RowFamilyStore implements FamilyStore {
    public function remote(): bool { return true; }
    /** @return array<int,array> raw member rows (string values) */
    abstract protected function readRows(string $table): array;
    abstract protected function writeRow(string $table, ?int $id, array $row): int;    // null id => insert, returns id
    abstract protected function removeRow(string $table, int $id): void;

    public function members(): array {
        $rows = array_map('ft_norm_member', array_filter($this->readRows('members'), fn($r) => !empty($r['id'])));
        usort($rows, fn($a, $b) => $a['id'] <=> $b['id']);
        return array_values($rows);
    }
    public function member(int $id): ?array { foreach ($this->members() as $m) if ($m['id'] === $id) return $m; return null; }
    public function insertMember(array $d): int {
        $row = []; foreach (FT_MEMBER_COLS as $c) $row[$c] = ft_row_val($d, $c);
        return $this->writeRow('members', !empty($d['id']) ? (int)$d['id'] : null, $row);     // an id is given only when restoring
    }
    public function updateMember(int $id, array $d): void { $this->patchMember($id, array_intersect_key($d, array_flip(FT_MEMBER_COLS)) + ['pids' => $d['pids'] ?? []]); }
    public function patchMember(int $id, array $f): void {
        $cur = $this->member($id); if (!$cur) return;
        foreach (array_intersect_key($f, array_flip(FT_MEMBER_COLS)) as $c => $v) $cur[$c] = $v;
        $row = []; foreach (FT_MEMBER_COLS as $c) $row[$c] = ft_row_val($cur, $c);
        $this->writeRow('members', $id, $row);
    }
    public function deleteMember(int $id): void {
        $this->removeRow('members', $id);
        foreach ($this->media() as $m) if (in_array($id, $m['member_ids'], true)) $this->updateMedia($m['id'], [], array_values(array_diff($m['member_ids'], [$id])));
    }
    public function countMembers(): int { return count($this->members()); }

    public function media(): array {
        $out = [];
        foreach ($this->readRows('media') as $r) {
            if (empty($r['id'])) continue;
            $out[] = ['id' => (int)$r['id'], 'url' => $r['url'] ?? '', 'type' => ($r['type'] ?? '') ?: 'image', 'title' => $r['title'] ?? null,
                      'description' => $r['description'] ?? null, 'uploaded_by_user_id' => isset($r['uploaded_by_user_id']) && $r['uploaded_by_user_id'] !== '' ? (int)$r['uploaded_by_user_id'] : null,
                      'created_at' => $r['created_at'] ?? null, 'member_ids' => ft_pids($r['member_ids'] ?? '')];
        }
        usort($out, fn($a, $b) => strcmp((string)$b['created_at'], (string)$a['created_at']) ?: $b['id'] <=> $a['id']);
        return $out;
    }
    public function mediaItem(int $id): ?array { foreach ($this->media() as $m) if ($m['id'] === $id) return $m; return null; }
    public function insertMedia(array $d, array $ids): int {
        return $this->writeRow('media', null, ['url' => $d['url'], 'type' => $d['type'] ?? 'image', 'title' => $d['title'] ?? '', 'description' => $d['description'] ?? '',
            'uploaded_by_user_id' => $d['uploaded_by_user_id'] ?? '', 'created_at' => $d['created_at'] ?? date('Y-m-d H:i:s'), 'member_ids' => implode(',', ft_pids($ids))]);
    }
    public function updateMedia(int $id, array $d, ?array $ids): void {
        $cur = $this->mediaItem($id); if (!$cur) return;
        foreach (['url', 'type', 'title', 'description'] as $c) if (array_key_exists($c, $d)) $cur[$c] = $d[$c];
        if ($ids !== null) $cur['member_ids'] = ft_pids($ids);
        $this->writeRow('media', $id, ['url' => $cur['url'], 'type' => $cur['type'], 'title' => $cur['title'] ?? '', 'description' => $cur['description'] ?? '',
            'uploaded_by_user_id' => $cur['uploaded_by_user_id'] ?? '', 'created_at' => $cur['created_at'] ?? '', 'member_ids' => implode(',', $cur['member_ids'])]);
    }
    public function deleteMedia(int $id): void { $this->removeRow('media', $id); }
    public function countMedia(): int { return count($this->media()); }
    public function importAll(array $members, array $media): array {
        foreach ($this->members() as $m) $this->removeRow('members', $m['id']);
        foreach ($this->media() as $x) $this->removeRow('media', $x['id']);
        foreach ($members as $m) { $row = []; foreach (FT_MEMBER_COLS as $c) $row[$c] = ft_row_val($m, $c); $this->writeRow('members', (int)$m['id'], $row); }
        foreach ($media as $x) $this->writeRow('media', (int)$x['id'], ['url' => $x['url'], 'type' => $x['type'] ?? 'image', 'title' => $x['title'] ?? '', 'description' => $x['description'] ?? '',
            'uploaded_by_user_id' => $x['uploaded_by_user_id'] ?? '', 'created_at' => $x['created_at'] ?? '', 'member_ids' => implode(',', ft_pids($x['member_ids'] ?? []))]);
        $ids = array_map(fn($m) => (int)$m['id'], $members);
        return $ids ? array_combine($ids, $ids) : [];          // ids are per tree here, so they are kept
    }
}

/** column order of the two sheets / tables a row store keeps */
const FT_ROW_TABLES = [
    'members' => ['id', 'name', 'nickname', 'gender', 'birth_date', 'birth_location', 'death_date', 'death_location', 'is_alive', 'fid', 'mid', 'pids', 'anniversary_date', 'current_location', 'img', 'insta_url', 'fb_url', 'wiki', 'is_private', 'privacy_override', 'extra'],
    'media'   => ['id', 'url', 'type', 'title', 'description', 'member_ids', 'uploaded_by_user_id', 'created_at'],
];

/** after a move gave members new ids, keep each account's link to "this is me" pointing at the right person */
function ft_remap_accounts(PDO $pdo, string $tenantId, array $map): void {
    foreach ($map as $old => $new) {
        if ($old === $new) continue;
        $pdo->prepare("UPDATE family_users SET member_id = ? WHERE tenant_id = ? AND member_id = ?")->execute([$new, $tenantId, $old]);
        try { $pdo->prepare("UPDATE tenant_users SET member_id = ? WHERE tenant_id = ? AND member_id = ?")->execute([$new, $tenantId, $old]); } catch (Throwable $e) {}
    }
}

require_once __DIR__ . '/history.php';
