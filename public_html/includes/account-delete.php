<?php
/**
 * includes/account-delete.php - deleting a tree, handing a tree to someone else, deleting an account.
 *
 * Used by admin/account-api.php (delete_account) and tools/test-account-delete.php.
 *
 *   ft_owned_trees($pdo, $uid)                      trees the user owns, with who could take each one over
 *   ft_delete_tree($pdo, $tenant)                   everything of one tree: family data we hold, its files, its rows
 *   ft_transfer_tree($pdo, $tid, $fromUid, $toUid)  make another member of the tree its owner
 *   ft_delete_account($pdo, $uid, $choices)         $choices: tenant_id => 'delete' | <user id to hand it to>
 *
 * Family data kept in a family's own data home (their Google Sheet, Airtable base or database) is theirs
 * and is left alone: we only forget how to reach it. Data in the app's database or a JSON file on this
 * server is wiped.
 */
require_once __DIR__ . '/store.php';

/** demo and featured trees are only ever deleted by their own owner */
function ft_tree_is_demo(array $tenant): bool {
    $s = json_decode((string)($tenant['settings'] ?? ''), true) ?: [];
    return !empty($s['demo']) || !empty($s['featured']);
}

/** Trees this user owns. Each: id, slug, display_name, demo, other_owner (user id or null), candidates [{id, display_name, email, role}], can_delete, needs_choice. */
function ft_owned_trees(PDO $pdo, int $uid): array {
    $st = $pdo->prepare("SELECT DISTINCT t.id, t.slug, t.display_name, t.settings, t.owner_user_id FROM tenants t
                         LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.user_id = ? AND tu.role = 'owner'
                         WHERE t.owner_user_id = ? OR tu.id IS NOT NULL ORDER BY t.display_name");
    $st->execute([$uid, $uid]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $t) {
        $c = $pdo->prepare("SELECT u.id, u.display_name, u.email, tu.role FROM tenant_users tu JOIN family_users u ON u.id = tu.user_id
                            WHERE tu.tenant_id = ? AND tu.user_id <> ? AND tu.role IN ('owner','editor') ORDER BY tu.role = 'owner' DESC, u.display_name");
        $c->execute([$t['id'], $uid]);
        $cands = array_map(fn($r) => ['id' => (int)$r['id'], 'display_name' => $r['display_name'], 'email' => $r['email'], 'role' => $r['role']], $c->fetchAll(PDO::FETCH_ASSOC));
        $otherOwner = null; foreach ($cands as $x) if ($x['role'] === 'owner') { $otherOwner = $x['id']; break; }
        $demo = ft_tree_is_demo($t);
        $isMainOwner = (int)$t['owner_user_id'] === $uid;
        if (!$isMainOwner && $t['owner_user_id']) {             // someone else is the tree's main owner: it stays theirs
            $o = $pdo->prepare("SELECT 1 FROM family_users WHERE id = ?"); $o->execute([(int)$t['owner_user_id']]);
            if ($o->fetchColumn()) $otherOwner ??= (int)$t['owner_user_id'];
        }
        $out[] = [
            'id' => $t['id'], 'slug' => $t['slug'], 'display_name' => $t['display_name'], 'demo' => $demo, 'main_owner' => $isMainOwner,
            'other_owner' => $otherOwner, 'candidates' => $cands,
            'can_delete' => !$demo || $isMainOwner,
            // another owner stays, or it is a demo tree someone else owns: the user just leaves it
            'needs_choice' => $otherOwner === null && (!$demo || $isMainOwner),
        ];
    }
    return $out;
}

/** files under admin/uploads that this tree's people and media point at (demo images are never touched) */
function ft_tree_upload_urls(FamilyStore $store): array {
    $urls = [];
    foreach ($store->members() as $m) if (!empty($m['img'])) $urls[] = $m['img'];
    foreach ($store->media() as $x) if (!empty($x['url'])) $urls[] = $x['url'];
    $out = [];
    foreach ($urls as $u) {
        $p = (string)parse_url((string)$u, PHP_URL_PATH);
        if (preg_match('~^/admin/uploads/([A-Za-z0-9_.-]+)$~', $p, $m)) $out[$p] = $m[1];   // top-level files only: not demo/, og/, emblems/
    }
    return $out;
}

/** Delete one tree completely. Returns ['files' => n, 'external_home' => bool]. Never call for a tree the caller may not delete. */
function ft_delete_tree(PDO $pdo, array $tenant): array {
    $tid = (string)$tenant['id'];
    $full = $pdo->prepare("SELECT * FROM tenants WHERE id = ?"); $full->execute([$tid]);
    $tenant = $full->fetch(PDO::FETCH_ASSOC) ?: $tenant;
    $slug = (string)($tenant['slug'] ?? '');

    // 1. family data, through the tree's data home
    $files = []; $external = false;
    try {
        $store = ft_store($pdo, $tenant);
        $files = ft_tree_upload_urls($store);
        $inner = ft_store_inner($store);                        // under the history wrapper: no history rows for a wipe
        if (in_array($inner->kind(), ['here', 'json'], true)) $inner->importAll([], []);
        else $external = true;                                  // the family's own copy: leave it
    } catch (Throwable $e) {
        error_log("ft_delete_tree $tid store: " . $e->getMessage());
        $external = ft_data_source($tenant)['type'] !== 'here';
        if (!$external) throw $e;                               // our own database failing is not something to skip past
    }

    // 2. rows in the app's database
    $pdo->beginTransaction();
    try {
        // member_history holds copies of people (the bin), so it goes even when the family keeps its own data home
        foreach (['family_activity_logs', 'member_history', 'privacy_settings', 'feature_flags', 'tenant_users', 'family_events'] as $tbl) {
            try { $pdo->prepare("DELETE FROM $tbl WHERE tenant_id = ?")->execute([$tid]); }
            catch (PDOException $e) { if (!preg_match('/no such table|doesn\'t exist/i', $e->getMessage())) throw $e; }
        }
        // accounts whose last-open tree this was move to another tree they belong to
        $u = $pdo->prepare("SELECT id FROM family_users WHERE tenant_id = ?"); $u->execute([$tid]);
        foreach ($u->fetchAll(PDO::FETCH_COLUMN) as $id) {
            $n = $pdo->prepare("SELECT tenant_id, role FROM tenant_users WHERE user_id = ? ORDER BY created_at LIMIT 1"); $n->execute([$id]);
            if ($r = $n->fetch(PDO::FETCH_ASSOC)) $pdo->prepare("UPDATE family_users SET tenant_id = ?, role = ? WHERE id = ?")->execute([$r['tenant_id'], $r['role'], $id]);
        }
        $pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$tid]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }

    // 3. files: photos, videos and voice notes no other tree in this database still uses, plus the tree's emblem and share images
    $dir = getenv('FT_UPLOADS_DIR') ?: dirname(__DIR__) . '/admin/uploads';      // the env override is for tools/test-account-delete.php
    $gone = 0;
    $used = function (string $url) use ($pdo): bool {
        foreach (["SELECT 1 FROM family_tree_data WHERE img = ? LIMIT 1", "SELECT 1 FROM family_media WHERE url = ? LIMIT 1"] as $q) {
            $s = $pdo->prepare($q); $s->execute([$url]); if ($s->fetchColumn()) return true;
        }
        return false;
    };
    foreach ($files as $url => $name) {
        if ($used($url)) continue;                              // ponytail: only other trees in this database are checked, not other trees' own data homes
        foreach ([$name, 'thumb_' . pathinfo($name, PATHINFO_FILENAME) . '.webp'] as $f) if (is_file("$dir/$f") && @unlink("$dir/$f")) $gone++;
    }
    $extra = array_merge(glob("$dir/emblems/$tid.*") ?: [], glob("$dir/covers/$tid.*") ?: []);
    if ($slug !== '' && preg_match('/^[A-Za-z0-9_-]+$/', $slug)) $extra = array_merge($extra, glob("$dir/og/$slug.png") ?: [], glob("$dir/og/emblem-$slug-*.png") ?: []);
    foreach ($extra as $f) @unlink($f);
    ft_cache_forget($tid);
    return ['files' => $gone, 'external_home' => $external];
}

/** Hand a tree to another owner or editor of it. Throws when $toUid is not one. */
function ft_transfer_tree(PDO $pdo, string $tid, int $fromUid, int $toUid): void {
    $c = $pdo->prepare("SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ? AND role IN ('owner','editor')");
    $c->execute([$tid, $toUid]);
    if ($toUid === $fromUid || !$c->fetchColumn()) throw new InvalidArgumentException('The new owner must already be an editor or owner of that tree.');
    $pdo->prepare("UPDATE tenant_users SET role = 'owner' WHERE tenant_id = ? AND user_id = ?")->execute([$tid, $toUid]);
    $pdo->prepare("UPDATE family_users SET role = 'owner' WHERE id = ? AND tenant_id = ?")->execute([$toUid, $tid]);
    $pdo->prepare("UPDATE tenants SET owner_user_id = ? WHERE id = ?")->execute([$toUid, $tid]);
    $pdo->prepare("DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?")->execute([$tid, $fromUid]);
}

/**
 * Delete an account. $choices maps each owned tree that needs one (ft_owned_trees needs_choice) to 'delete'
 * or the id of the member who takes it over. Throws InvalidArgumentException, before changing anything,
 * when a choice is missing or not allowed. Returns ['deleted' => [slugs], 'transferred' => [slugs]].
 */
function ft_delete_account(PDO $pdo, int $uid, array $choices): array {
    $owned = ft_owned_trees($pdo, $uid);
    foreach ($owned as $t) {
        if (!$t['needs_choice']) continue;
        $ch = $choices[$t['id']] ?? null;
        if ($ch === 'delete') { if (!$t['can_delete']) throw new InvalidArgumentException("\"{$t['display_name']}\" can't be deleted."); continue; }
        if (!in_array((int)$ch, array_column($t['candidates'], 'id'), true)) throw new InvalidArgumentException("Choose what happens to \"{$t['display_name']}\": delete it or hand it to one of its editors.");
    }

    $done = ['deleted' => [], 'transferred' => []];
    foreach ($owned as $t) {
        if ($t['needs_choice'] && $choices[$t['id']] === 'delete') { ft_delete_tree($pdo, $t); $done['deleted'][] = $t['slug']; continue; }
        // no choice needed: the main owner hands it to the co-owner; anyone else just leaves (membership removed below)
        $to = $t['needs_choice'] ? (int)$choices[$t['id']] : ($t['main_owner'] ? $t['other_owner'] : null);
        if ($to) { ft_transfer_tree($pdo, $t['id'], $uid, $to); if ($t['needs_choice']) $done['transferred'][] = $t['slug']; }
    }

    $pdo->beginTransaction();
    try {
        // what is left of this person in trees they leave: memberships and their name on log lines
        $pdo->prepare("DELETE FROM tenant_users WHERE user_id = ?")->execute([$uid]);
        $pdo->prepare("UPDATE tenants SET owner_user_id = NULL WHERE owner_user_id = ?")->execute([$uid]);   // demo trees owned by nobody stay so
        $pdo->prepare("UPDATE family_activity_logs SET user_id = NULL, ip_address = NULL, user_agent = NULL WHERE user_id = ?")->execute([$uid]);
        try { $pdo->prepare("UPDATE member_history SET user_id = NULL, user_name = 'A former member' WHERE user_id = ?")->execute([$uid]); } catch (PDOException $e) {}
        try { $pdo->prepare("DELETE FROM api_keys WHERE user_id = ?")->execute([$uid]); } catch (PDOException $e) {}
        $pdo->prepare("DELETE FROM family_users WHERE id = ?")->execute([$uid]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    error_log("account deleted: user $uid, trees deleted " . count($done['deleted']) . ', handed over ' . count($done['transferred']));
    return $done;
}
