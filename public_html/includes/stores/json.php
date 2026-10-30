<?php
/**
 * includes/stores/json.php - a family's data as one JSON file.
 *
 *   { "format": "familytree/1", "members": [ {...}, ... ], "media": [ {...}, ... ] }
 *
 * On the desktop app the file sits in any folder, so a Google Drive, Dropbox or
 * OneDrive folder gives sync and backup for free. On a server the path must be
 * inside storage/ (set by the admin, checked here). The same shape is the full
 * export / import of a tree.
 *
 * config: ['type' => 'json', 'file' => '/abs/path/family.json']
 */
class JsonFamilyStore extends RowFamilyStore {
    private ?array $doc = null;
    public function __construct(private array $cfg, private string $tid) {}
    public function kind(): string { return 'json'; }
    public function remote(): bool { return false; }       // local disk; no cache needed

    public static function allowedPath(string $file): bool {
        // the desktop app may point anywhere; a server only inside its storage/ folder
        if (getenv('FT_DESKTOP')) return true;
        $base = realpath(ft_storage_dir()) ?: '';
        $dir  = realpath(dirname($file)) ?: '';
        return $base !== '' && $dir !== '' && str_starts_with($dir, $base);
    }
    private function path(): string {
        $f = (string)($this->cfg['file'] ?? '');
        if ($f === '' || !self::allowedPath($f)) throw new RuntimeException('JSON file must be inside the storage folder');
        return $f;
    }
    public function check(): void {
        $f = $this->path();
        if (is_file($f) && !is_readable($f)) throw new RuntimeException("cannot read $f");
        if (!is_file($f) && !is_writable(dirname($f))) throw new RuntimeException('folder is not writable: ' . dirname($f));
        $this->load();
    }
    private function load(): array {
        if ($this->doc !== null) return $this->doc;
        $f = $this->path();
        if (!is_file($f)) return $this->doc = ['format' => 'familytree/1', 'members' => [], 'media' => []];
        $d = json_decode((string)file_get_contents($f), true);
        if (!is_array($d)) throw new RuntimeException('JSON file is not valid: ' . basename($f));
        $d += ['format' => 'familytree/1', 'members' => [], 'media' => []];
        return $this->doc = $d;
    }
    private function save(): void {
        $f = $this->path();
        $tmp = $f . '.tmp';
        if (file_put_contents($tmp, json_encode($this->doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) throw new RuntimeException("cannot write $f");
        rename($tmp, $f);
    }
    protected function readRows(string $table): array { return $this->load()[$table] ?? []; }
    protected function writeRow(string $table, ?int $id, array $row): int {
        $d = $this->load();
        $rows = $d[$table] ?? [];
        if ($id === null) { $id = 1; foreach ($rows as $r) $id = max($id, (int)($r['id'] ?? 0) + 1); $rows[] = ['id' => $id] + $row; }
        else { $done = false; foreach ($rows as &$r) if ((int)($r['id'] ?? 0) === $id) { $r = ['id' => $id] + $row; $done = true; } unset($r); if (!$done) $rows[] = ['id' => $id] + $row; }
        $this->doc[$table] = array_values($rows);
        $this->save();
        return $id;
    }
    protected function removeRow(string $table, int $id): void {
        $d = $this->load();
        $this->doc[$table] = array_values(array_filter($d[$table] ?? [], fn($r) => (int)($r['id'] ?? 0) !== $id));
        $this->save();
    }
}
