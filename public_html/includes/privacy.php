<?php
/**
 * includes/privacy.php
 * Phase 3: Privacy & Visibility Controls
 *
 * Provides helpers for:
 *   - Loading per-tenant privacy settings
 *   - Checking tree-level visibility
 *   - Applying per-field privacy filters on public output
 *   - Living-person auto-protection (P3.3)
 *   - Private member redaction (P3.4)
 */
if (!defined('FT_APP')) { http_response_code(403); exit; }

// ──────────────────────────────────────────────────────────────
// Field definitions with their defaults
// Visibility levels: 'public' | 'members' | 'private'
// ──────────────────────────────────────────────────────────────
const PRIVACY_FIELD_DEFAULTS = [
    'birth_date'       => 'members',   // DOB – sensitive
    'birth_location'   => 'members',   // birth place
    'death_date'       => 'public',    // death date – generally public
    'death_location'   => 'public',    // death place – generally public
    'current_location' => 'members',   // home/current location
    'social_media'     => 'members',   // instagram + facebook URLs
    'photos'           => 'members',   // photos array + img field
    'bio'              => 'public',    // wiki/bio text
    'anniversary_date' => 'members',   // marriage anniversary
];

// Fields that are ALWAYS hidden for living people (P3.3) unless privacy_override = 1
const LIVING_PERSON_PROTECTED_FIELDS = [
    'birth_date', 'birth_location', 'current_location', 'social_media',
];

/**
 * Load privacy settings for a tenant.
 * Returns an array keyed by field_key with visibility values.
 * Falls back to PRIVACY_FIELD_DEFAULTS for any missing key.
 */
function loadPrivacySettings(PDO $pdo, string $tenantId): array {
    $settings = PRIVACY_FIELD_DEFAULTS; // start with defaults
    try {
        $stmt = $pdo->prepare(
            "SELECT field_key, visibility FROM privacy_settings WHERE tenant_id = ?"
        );
        $stmt->execute([$tenantId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $settings[$row['field_key']] = $row['visibility'];
        }
    } catch (PDOException $e) {
        error_log('privacy.php loadPrivacySettings: ' . $e->getMessage());
    }
    return $settings;
}

/**
 * Load a tenant row (visibility + id) from the DB.
 * Returns null if tenant not found.
 */
function loadTenant(PDO $pdo, string $tenantId): ?array {
    try {
        $stmt = $pdo->prepare(
            "SELECT id, slug, display_name, visibility, settings, data_source FROM tenants WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    } catch (PDOException $e) {
        error_log('privacy.php loadTenant: ' . $e->getMessage());
        return null;
    }
}

/**
 * Load a tenant row by its public URL slug (e.g. /tree/karn → 'karn').
 * Only returns active tenants. Returns null if not found.
 */
function getPublicTenantBySlug(PDO $pdo, string $slug): ?array {
    try {
        $stmt = $pdo->prepare(
            "SELECT id, slug, display_name, visibility, settings, data_source FROM tenants
             WHERE slug = ? AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    } catch (PDOException $e) {
        error_log('privacy.php getPublicTenantBySlug: ' . $e->getMessage());
        return null;
    }
}

/**
 * Check tree-level visibility and abort with 403 if the tree is private
 * and the current request is a public (unauthenticated) call.
 *
 * @param string $visibility  'public' | 'unlisted' | 'private'
 * @param bool   $isAdmin     true when called from an authenticated admin session
 */
function enforceTreeVisibility(string $visibility, bool $isAdmin = false): void {
    if ($isAdmin) return; // admin always has access
    if ($visibility === 'private') {
        http_response_code(403);
        echo json_encode([
            'error'      => 'private_tree',
            'message'    => 'This family tree is private. Please log in to view it.',
        ]);
        exit;
    }
    // 'unlisted' is accessible via direct link — no block, but noindex header
    if ($visibility === 'unlisted') {
        header('X-Robots-Tag: noindex, nofollow');
    }
}

/**
 * Return a redacted placeholder for a private member (P3.4).
 * Structural fields (id, fid, mid, pids, gender) are preserved
 * so tree connections remain intact.
 */
function redactPrivateMember(array $member): array {
    return [
        'id'             => $member['id'],
        'fid'            => $member['fid'],
        'mid'            => $member['mid'],
        'pids'           => $member['pids'] ?? [],
        'gender'         => $member['gender'] ?? '',
        'name'           => 'Private Member',
        'nickname'       => '',
        'img'            => '',
        'photos'         => [],
        'birth_date'     => '',
        'birth_location' => '',
        'death_date'     => '',
        'death_location' => '',
        'current_location' => '',
        'insta_url'      => '',
        'fb_url'         => '',
        'anniversary_date' => '',
        'wiki'           => '',
        'wiki_preview'   => '',
        'is_alive'       => (int)($member['is_alive'] ?? 1),
        'is_private'     => 1,
        'extra'          => [],
        'tenant_id'      => $member['tenant_id'] ?? '',
    ];
}

/**
 * Strip non-public fields from a member for the public-facing API.
 *
 * Rules applied (in order):
 *  1. If is_private = 1 → redact entirely
 *  2. Living-person protection: if is_alive = 1 and privacy_override = 0,
 *     force LIVING_PERSON_PROTECTED_FIELDS to hidden regardless of settings
 *  3. Per-field privacy: if visibility = 'members' or 'private' → strip field
 *
 * @param array  $member    Full member row (with photos[] already attached)
 * @param array  $settings  Output of loadPrivacySettings()
 * @return array            Filtered member safe for public output
 */
function applyPublicPrivacy(array $member, array $settings): array {
    // P3.4 private member redaction
    if (!empty($member['is_private'])) {
        return redactPrivateMember($member);
    }

    $isLiving    = !empty($member['is_alive']);
    $hasOverride = !empty($member['privacy_override']);

    // Helper: should this field be visible publicly?
    $visible = function(string $fieldKey) use ($settings, $isLiving, $hasOverride): bool {
        // Living-person auto-protection (P3.3)
        if ($isLiving && !$hasOverride && in_array($fieldKey, LIVING_PERSON_PROTECTED_FIELDS, true)) {
            return false;
        }
        $vis = $settings[$fieldKey] ?? 'members';
        return $vis === 'public';
    };

    // Apply field-by-field visibility
    if (!$visible('birth_date'))       { $member['birth_date']       = ''; }
    if (!$visible('birth_location'))   { $member['birth_location']   = ''; }
    if (!$visible('death_date'))       { $member['death_date']       = ''; }
    if (!$visible('death_location'))   { $member['death_location']   = ''; }
    if (!$visible('current_location')) { $member['current_location'] = ''; }
    if (!$visible('anniversary_date')) { $member['anniversary_date'] = ''; }

    if (!$visible('social_media')) {
        $member['insta_url'] = '';
        $member['fb_url']    = '';
    }

    if (!$visible('photos')) {
        $member['img']    = '';
        $member['photos'] = [];
    }

    if (!$visible('bio')) {
        $member['wiki']         = '';
        $member['wiki_preview'] = '';
    }

    // extra details follow the field they belong with
    $x = is_array($member['extra'] ?? null) ? $member['extra'] : [];
    if (!$visible('birth_date'))       unset($x['birth_approx'], $x['birth_tithi']);
    if (!$visible('death_date'))       unset($x['death_approx'], $x['death_tithi']);
    if (!$visible('birth_location'))   unset($x['native_place']);
    if (!$visible('anniversary_date')) unset($x['partners']);
    if (!$visible('bio'))              unset($x['sources']);
    $member['extra'] = $x;

    // Strip internal/admin-only fields from public output
    unset($member['privacy_override'], $member['tenant_id']);
    // Keep is_private flag so the frontend can render the placeholder badge
    $member['is_private'] = 0;

    return $member;
}

/* ── per-tree settings (emblem, colours) ──────────────────────────────────── */
const FT_SETTINGS_DEFAULTS = [
    'emblem' => ['kind' => 'none', 'id' => 'banyan', 'color' => '#D4A643', 'url' => null],   // kind: none | builtin | upload
    'accent' => null,
    'theme'  => 'heritage',   // tree look, see assets/tree-themes.js
    'cover'  => null,         // cover picture on member cards: /admin/uploads/covers/{tenant}.jpg
];
const FT_TREE_LOOKS = ['heritage', 'banyan', 'royal', 'minimal', 'parchment', 'marigold'];
/** The tree's settings with defaults filled in. Accepts a tenant row or the raw JSON. */
function ft_tenant_settings(array|string|null $tenant): array {
    $raw = is_array($tenant) ? ($tenant['settings'] ?? null) : $tenant;
    $s = $raw ? json_decode((string)$raw, true) : null;
    $s = is_array($s) ? $s : [];
    $s['emblem'] = array_merge(FT_SETTINGS_DEFAULTS['emblem'], is_array($s['emblem'] ?? null) ? $s['emblem'] : []);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', (string)$s['emblem']['color'])) $s['emblem']['color'] = FT_SETTINGS_DEFAULTS['emblem']['color'];
    if (!in_array($s['emblem']['kind'], ['none', 'builtin', 'upload'], true)) $s['emblem']['kind'] = 'none';
    $s['theme'] = in_array($s['theme'] ?? '', FT_TREE_LOOKS, true) ? $s['theme'] : 'heritage';
    if (isset($s['hindu_calendar'])) $s['hindu_calendar'] = (bool)$s['hindu_calendar'];
    $s['cover'] = (isset($s['cover']) && preg_match('~^/admin/uploads/covers/[A-Za-z0-9-]+\.(jpg|png|webp)(\?v=\d+)?$~', (string)$s['cover'])) ? $s['cover'] : null;
    $s['accent'] = (isset($s['accent']) && preg_match('/^#[0-9a-fA-F]{6}$/', (string)$s['accent'])) ? $s['accent'] : null;
    return $s;
}
