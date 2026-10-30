<?php
/**
 * includes/history.php - every change to a person is recorded in member_history (app database,
 * whatever the tree's data home), so it can be undone, and deleted people can be restored (the bin).
 *
 * HistoryFamilyStore wraps any FamilyStore. Changes made in one request share a "batch"; undoing a
 * batch reverts all of it (deleting someone also unlinks their children and partners: one batch).
 */

/** who is making changes in this request: set by the admin session, the connector, or a script */
function ft_actor(?array $set = null): array {
    static $actor = null;
    if ($set !== null) $actor = $set;
    if ($actor === null) {
        $u = $_SESSION['admin_user'] ?? null;
        $actor = $u ? ['id' => (int)($u['id'] ?? 0) ?: null, 'name' => (string)($u['display_name'] ?? $u['email'] ?? 'Someone')] : ['id' => null, 'name' => 'System'];
    }
    return $actor;
}
/** the batch id for this request (or set one, e.g. for an undo) */
function ft_batch(?string $set = null): string {
    static $b = null;
    if ($set !== null) $b = $set;
    return $b ??= bin2hex(random_bytes(8));
}

class HistoryFamilyStore implements FamilyStore {
    public function __construct(private FamilyStore $inner, private PDO $pdo, private string $tid) {}
    public function inner(): FamilyStore { return $this->inner; }

    private function log(string $action, ?int $memberId, ?array $before, ?array $after): void {
        if ($action === 'update' && $before && $after && ft_hist_diff($before, $after) === []) return;   // nothing changed
        $a = ft_actor();
        try {
            $this->pdo->prepare("INSERT INTO member_history (tenant_id, batch, member_id, action, before_json, after_json, user_id, user_name, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
                ->execute([$this->tid, ft_batch(), $memberId, $action,
                    $before ? json_encode($before, JSON_UNESCAPED_UNICODE) : null, $after ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
                    $a['id'], mb_substr($a['name'], 0, 255), date('Y-m-d H:i:s')]);
        } catch (PDOException $e) { error_log('history: ' . $e->getMessage()); }   // older install without the table: changes still go through
    }

    public function insertMember(array $d): int {
        $id = $this->inner->insertMember($d);
        $this->log('create', $id, null, $this->inner->member($id));
        return $id;
    }
    public function updateMember(int $id, array $d): void {
        $before = $this->inner->member($id);
        $this->inner->updateMember($id, $d);
        $this->log('update', $id, $before, $this->inner->member($id));
    }
    public function patchMember(int $id, array $f): void {
        $before = $this->inner->member($id);
        $this->inner->patchMember($id, $f);
        $this->log('update', $id, $before, $this->inner->member($id));
    }
    public function deleteMember(int $id): void {
        $before = $this->inner->member($id);
        $this->inner->deleteMember($id);
        if ($before) $this->log('delete', $id, $before, null);
    }
    public function importAll(array $members, array $media): array {
        $map = $this->inner->importAll($members, $media);
        $this->log('import', null, null, ['people' => count($members), 'media' => count($media)]);
        return $map;
    }

    public function members(): array { return $this->inner->members(); }
    public function member(int $id): ?array { return $this->inner->member($id); }
    public function countMembers(): int { return $this->inner->countMembers(); }
    public function media(): array { return $this->inner->media(); }
    public function mediaItem(int $id): ?array { return $this->inner->mediaItem($id); }
    public function insertMedia(array $d, array $ids): int { return $this->inner->insertMedia($d, $ids); }
    public function updateMedia(int $id, array $d, ?array $ids): void { $this->inner->updateMedia($id, $d, $ids); }
    public function deleteMedia(int $id): void { $this->inner->deleteMedia($id); }
    public function countMedia(): int { return $this->inner->countMedia(); }
    public function kind(): string { return $this->inner->kind(); }
    public function remote(): bool { return $this->inner->remote(); }
    public function check(): void { $this->inner->check(); }
}

/** the fields that differ between two versions of a person: [field => [old, new]] */
function ft_hist_diff(array $a, array $b): array {
    $out = [];
    foreach (array_merge(FT_MEMBER_COLS) as $k) {
        $x = $a[$k] ?? null; $y = $b[$k] ?? null;
        if ($k === 'pids') { $x = ft_pids($x); $y = ft_pids($y); sort($x); sort($y); }
        if ($k === 'extra') { $x = ft_extra_db($x); $y = ft_extra_db($y); }
        if ((string)json_encode($x) !== (string)json_encode($y) && !(($x === null || $x === '') && ($y === null || $y === ''))) $out[$k] = [$x, $y];
    }
    return $out;
}

/** recent changes for a tree, newest first, grouped by batch */
function ft_history(PDO $pdo, string $tid, ?int $memberId = null, int $limit = 60): array {
    $sql = "SELECT * FROM member_history WHERE tenant_id = ?" . ($memberId ? " AND member_id = ?" : "") . " ORDER BY id DESC LIMIT " . (int)$limit;
    $st = $pdo->prepare($sql); $st->execute($memberId ? [$tid, $memberId] : [$tid]);
    $rows = [];
    foreach ($st->fetchAll() as $r) {
        $before = $r['before_json'] ? json_decode($r['before_json'], true) : null;
        $after  = $r['after_json'] ? json_decode($r['after_json'], true) : null;
        $rows[] = ['id' => (int)$r['id'], 'batch' => $r['batch'], 'member_id' => $r['member_id'] !== null ? (int)$r['member_id'] : null, 'action' => $r['action'],
            'name' => $after['name'] ?? $before['name'] ?? null, 'changes' => ($before && $after && $r['action'] === 'update') ? ft_hist_diff($before, $after) : [],
            'user' => $r['user_name'], 'at' => $r['created_at'], 'undone' => (bool)$r['undone'], 'summary' => $r['action'] === 'import' ? $after : null];
    }
    return $rows;
}

/** people deleted and not restored since: the bin */
function ft_bin(PDO $pdo, string $tid, FamilyStore $store): array {
    $st = $pdo->prepare("SELECT id, member_id, before_json, user_name, created_at, batch FROM member_history WHERE tenant_id = ? AND action = 'delete' AND undone = 0 ORDER BY id DESC LIMIT 200");
    $st->execute([$tid]);
    $alive = array_flip(array_map(fn($m) => $m['id'], $store->members()));
    $out = []; $seen = [];
    foreach ($st->fetchAll() as $r) {
        $mid = (int)$r['member_id'];
        if (isset($alive[$mid]) || isset($seen[$mid])) continue;
        $seen[$mid] = true;
        $b = json_decode((string)$r['before_json'], true) ?: [];
        $out[] = ['history_id' => (int)$r['id'], 'batch' => $r['batch'], 'member_id' => $mid, 'name' => $b['name'] ?? '?', 'img' => $b['img'] ?? null,
            'birth_date' => $b['birth_date'] ?? null, 'deleted_by' => $r['user_name'], 'deleted_at' => $r['created_at']];
    }
    return $out;
}

/**
 * Undo a batch: revert its rows newest first. A create is deleted, an update has its changed fields
 * put back, a delete is re-inserted with the same id. The undo itself is a new batch, so it can be
 * undone too. Returns how many changes were reverted.
 */
function ft_undo_batch(PDO $pdo, string $tid, FamilyStore $store, string $batch): int {
    $st = $pdo->prepare("SELECT * FROM member_history WHERE tenant_id = ? AND batch = ? AND undone = 0 ORDER BY id DESC");
    $st->execute([$tid, $batch]);
    $rows = $st->fetchAll();
    if (!$rows) throw new RuntimeException('Nothing to undo there.');
    ft_batch(bin2hex(random_bytes(8)));                 // the revert is its own batch
    $n = 0;
    foreach ($rows as $r) {
        $mid = $r['member_id'] !== null ? (int)$r['member_id'] : null;
        $before = $r['before_json'] ? json_decode($r['before_json'], true) : null;
        $after  = $r['after_json'] ? json_decode($r['after_json'], true) : null;
        switch ($r['action']) {
            case 'create':
                if ($mid && $store->member($mid)) { $store->deleteMember($mid); $n++; }
                break;
            case 'update':
                if ($mid && $before && $after && $store->member($mid)) {
                    $patch = [];
                    foreach (ft_hist_diff($before, $after) as $k => [$old]) $patch[$k] = $old;
                    if ($patch) { $store->patchMember($mid, $patch); $n++; }
                }
                break;
            case 'delete':
                if ($mid && $before && !$store->member($mid)) { ft_restore_member($store, $before); $n++; }
                break;
        }
    }
    $pdo->prepare("UPDATE member_history SET undone = 1 WHERE tenant_id = ? AND batch = ?")->execute([$tid, $batch]);
    return $n;
}

/** put a deleted person back with their old id (the store keeps ids per tree) */
function ft_restore_member(FamilyStore $store, array $row): int {
    $id = (int)$row['id'];
    $base = ft_store_inner($store);
    if ($base instanceof PdoFamilyStore) $base->insertMemberWithId($id, $row);
    else $base->insertMember(['id' => $id] + $row);
    // drop any cached copy, and record the restore so it shows in history (and can be undone)
    for ($s = $store; $s instanceof HistoryFamilyStore || $s instanceof CachedFamilyStore; $s = $s->inner()) {
        if ($s instanceof CachedFamilyStore) (new ReflectionMethod($s, 'bust'))->invoke($s);
        if ($s instanceof HistoryFamilyStore) (new ReflectionMethod($s, 'log'))->invoke($s, 'create', $id, null, $base->member($id));
    }
    return $id;
}
