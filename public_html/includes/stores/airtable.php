<?php
/**
 * includes/stores/airtable.php - a family's data in an Airtable base (free tier).
 *
 * The owner makes a base with two tables, "Members" and "Media" (the admin page
 * shows the exact fields; "Set up" creates them through the API when the token
 * may create fields), and a personal access token with data.records:read/write
 * and schema.bases:read/write on that base.
 *
 * config: ['type' => 'airtable', 'base_id' => 'appXXXX', 'token' => 'pat...']
 *
 * Airtable record ids (rec...) are opaque, so every row also carries our own
 * numeric "id" field, which is what the tree uses for fid / mid / pids.
 */
class AirtableFamilyStore extends RowFamilyStore {
    private const TABLES = ['members' => 'Members', 'media' => 'Media'];
    private array $recIds = [];             // table -> [id => recXXX]
    public function __construct(private array $cfg, private string $tid) {}
    public function kind(): string { return 'airtable'; }

    private function http(string $method, string $path, mixed $body = null): array {
        if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL extension is required for Airtable');
        $ch = curl_init('https://api.airtable.com/v0/' . $path);
        $headers = ['Authorization: Bearer ' . ($this->cfg['token'] ?? '')];
        if ($body !== null) { $body = json_encode($body); $headers[] = 'Content-Type: application/json'; }
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => $body]);
        $out = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $err = curl_error($ch); curl_close($ch);
        if ($out === false) throw new RuntimeException('Network error: ' . $err);
        $json = json_decode((string)$out, true) ?? [];
        if ($code >= 400) { $m = $json['error']['message'] ?? (is_string($json['error'] ?? null) ? $json['error'] : "HTTP $code"); throw new RuntimeException('Airtable: ' . $m); }
        return $json;
    }
    private function base(): string { $b = (string)($this->cfg['base_id'] ?? ''); if ($b === '') throw new RuntimeException('Base ID is missing (starts with app)'); return rawurlencode($b); }

    /** create the two tables with our fields when they do not exist (needs schema.bases:write) */
    public function setup(): void {
        $meta = $this->http('GET', 'meta/bases/' . $this->base() . '/tables');
        $have = []; foreach ($meta['tables'] ?? [] as $t) $have[$t['name']] = array_column($t['fields'], 'name');
        foreach (self::TABLES as $key => $name) {
            $fields = array_map(fn($c) => ['name' => $c, 'type' => in_array($c, ['wiki', 'description'], true) ? 'multilineText' : ($c === 'id' ? 'number' : 'singleLineText')] + ($c === 'id' ? ['options' => ['precision' => 0]] : []), FT_ROW_TABLES[$key]);
            if (!isset($have[$name])) { $this->http('POST', 'meta/bases/' . $this->base() . '/tables', ['name' => $name, 'fields' => $fields]); continue; }
            $tbl = null; foreach ($meta['tables'] as $t) if ($t['name'] === $name) $tbl = $t;
            foreach ($fields as $f) if (!in_array($f['name'], $have[$name], true)) $this->http('POST', 'meta/bases/' . $this->base() . '/tables/' . $tbl['id'] . '/fields', $f);
        }
    }
    public function check(): void {
        if (empty($this->cfg['token'])) throw new RuntimeException('Personal access token is missing');
        $this->readRows('members');
    }
    protected function readRows(string $table): array {
        $name = self::TABLES[$table]; $rows = []; $offset = null; $this->recIds[$table] = [];
        do {
            $res = $this->http('GET', $this->base() . '/' . rawurlencode($name) . '?pageSize=100' . ($offset ? '&offset=' . rawurlencode($offset) : ''));
            foreach ($res['records'] ?? [] as $rec) {
                $f = $rec['fields'] ?? [];
                if (!isset($f['id']) || $f['id'] === '') continue;
                $row = []; foreach (FT_ROW_TABLES[$table] as $c) $row[$c] = isset($f[$c]) ? (is_array($f[$c]) ? implode(',', $f[$c]) : (string)$f[$c]) : '';
                $rows[] = $row; $this->recIds[$table][(int)$f['id']] = $rec['id'];
            }
            $offset = $res['offset'] ?? null;
        } while ($offset);
        return $rows;
    }
    private function fields(string $table, int $id, array $row): array {
        $f = ['id' => $id];
        foreach (FT_ROW_TABLES[$table] as $c) if ($c !== 'id') { $v = $row[$c] ?? ''; if ($v !== '' && $v !== null) $f[$c] = (string)$v; }
        return $f;
    }
    protected function writeRow(string $table, ?int $id, array $row): int {
        try { return $this->writeRowOnce($table, $id, $row); }
        catch (RuntimeException $e) {
            // a base set up before a new column (e.g. extra) existed: add the missing fields, then try again
            if (!preg_match('/UNKNOWN_FIELD_NAME|Unknown field/i', $e->getMessage())) throw $e;
            $this->setup();
            return $this->writeRowOnce($table, $id, $row);
        }
    }
    private function writeRowOnce(string $table, ?int $id, array $row): int {
        $rows = $this->readRows($table);
        $name = rawurlencode(self::TABLES[$table]);
        if ($id === null || empty($this->recIds[$table][$id])) {
            if ($id === null) { $id = 1; foreach ($rows as $r) $id = max($id, (int)$r['id'] + 1); }
            $this->http('POST', $this->base() . '/' . $name, ['records' => [['fields' => $this->fields($table, $id, $row)]], 'typecast' => true]);
            return $id;
        }
        // PUT replaces all fields, so cleared values really clear
        $this->http('PUT', $this->base() . '/' . $name . '/' . $this->recIds[$table][$id], ['fields' => $this->fields($table, $id, $row), 'typecast' => true]);
        return $id;
    }
    protected function removeRow(string $table, int $id): void {
        $this->readRows($table);
        $rec = $this->recIds[$table][$id] ?? null;
        if ($rec) $this->http('DELETE', $this->base() . '/' . rawurlencode(self::TABLES[$table]) . '/' . $rec);
    }
}
