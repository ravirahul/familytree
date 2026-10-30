<?php
/**
 * includes/stores/sheets.php - a family's data in a Google Sheet (free).
 *
 * The owner creates a blank Google Sheet, shares it (Editor) with the email of a
 * service account, and pastes the service account's JSON key here. Two tabs,
 * "Members" and "Media", are created on first use with a header row; the family
 * can read and even edit the sheet by hand. Reads are cached for a minute by
 * CachedFamilyStore; writes go straight to the sheet.
 *
 * config: ['type' => 'sheets', 'sheet_id' => '1AbC...', 'service_account' => '{...json key...}']
 *
 * How a family gets a service account (free, five minutes):
 *   console.cloud.google.com -> new project -> APIs: enable "Google Sheets API"
 *   -> IAM & Admin -> Service accounts -> create -> Keys -> add key (JSON).
 *   Share the sheet with the account's client_email.
 */
class SheetsFamilyStore extends RowFamilyStore {
    private ?string $token = null;
    private array $sheetIds = [];           // tab title -> sheetId (gid)
    private const TABS = ['members' => 'Members', 'media' => 'Media'];

    public function __construct(private array $cfg, private string $tid) {}
    public function kind(): string { return 'sheets'; }

    /* ── auth: service account JWT -> access token (cached in storage/cache) ── */
    private function key(): array {
        $k = json_decode((string)($this->cfg['service_account'] ?? ''), true);
        if (!is_array($k) || empty($k['client_email']) || empty($k['private_key'])) throw new RuntimeException('Service account key is missing or not valid JSON');
        return $k;
    }
    private function token(): string {
        if ($this->token) return $this->token;
        $k = $this->key();
        $cacheF = ft_cache_dir() . '/gtoken.' . md5($k['client_email']) . '.json';
        if (is_file($cacheF)) { $c = json_decode((string)file_get_contents($cacheF), true); if (($c['exp'] ?? 0) > time() + 60) return $this->token = $c['token']; }
        $now = time();
        $b64 = fn($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $hdr = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $cl  = $b64(json_encode(['iss' => $k['client_email'], 'scope' => 'https://www.googleapis.com/auth/spreadsheets', 'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600]));
        if (!openssl_sign("$hdr.$cl", $sig, $k['private_key'], 'sha256WithRSAEncryption')) throw new RuntimeException('Could not sign with the service account key');
        $jwt = "$hdr.$cl." . $b64($sig);
        $res = $this->http('POST', 'https://oauth2.googleapis.com/token', http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]), ['Content-Type: application/x-www-form-urlencoded'], false);
        if (empty($res['access_token'])) throw new RuntimeException('Google did not issue a token: ' . ($res['error_description'] ?? $res['error'] ?? 'unknown'));
        file_put_contents($cacheF, json_encode(['token' => $res['access_token'], 'exp' => $now + (int)($res['expires_in'] ?? 3600)]), LOCK_EX);
        return $this->token = $res['access_token'];
    }
    private function http(string $method, string $url, mixed $body = null, array $headers = [], bool $auth = true): array {
        if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL extension is required for Google Sheets');
        $ch = curl_init($url);
        if ($auth) $headers[] = 'Authorization: Bearer ' . $this->token();
        if ($body !== null && !is_string($body)) { $body = json_encode($body); $headers[] = 'Content-Type: application/json'; }
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => $body]);
        $out = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $err = curl_error($ch); curl_close($ch);
        if ($out === false) throw new RuntimeException('Network error: ' . $err);
        $json = json_decode((string)$out, true) ?? [];
        if ($code >= 400) throw new RuntimeException('Google Sheets: ' . ($json['error']['message'] ?? $json['error_description'] ?? "HTTP $code"));
        return $json;
    }
    private function base(): string { return 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode((string)($this->cfg['sheet_id'] ?? '')); }

    /* ── tabs ─────────────────────────────────────────────────────────────── */
    private function ensureTabs(): void {
        if ($this->sheetIds) return;
        $meta = $this->http('GET', $this->base() . '?fields=sheets.properties');
        foreach ($meta['sheets'] ?? [] as $s) $this->sheetIds[$s['properties']['title']] = (int)$s['properties']['sheetId'];
        $reqs = [];
        foreach (self::TABS as $key => $title) if (!isset($this->sheetIds[$title])) $reqs[] = ['addSheet' => ['properties' => ['title' => $title]]];
        if ($reqs) {
            $res = $this->http('POST', $this->base() . ':batchUpdate', ['requests' => $reqs]);
            foreach ($res['replies'] ?? [] as $r) if (isset($r['addSheet'])) $this->sheetIds[$r['addSheet']['properties']['title']] = (int)$r['addSheet']['properties']['sheetId'];
            foreach (self::TABS as $key => $title) {                       // header rows
                $this->http('PUT', $this->base() . '/values/' . rawurlencode($title . '!A1') . '?valueInputOption=RAW', ['values' => [FT_ROW_TABLES[$key]]]);
            }
        }
    }
    public function check(): void {
        if (empty($this->cfg['sheet_id'])) throw new RuntimeException('Sheet ID is missing (the long id in the sheet URL)');
        $this->ensureTabs();
        $this->readRows('members');
    }

    /* ── rows ─────────────────────────────────────────────────────────────── */
    private array $rowIndex = [];           // table -> [id => row number (1-based, header is 1)]
    protected function readRows(string $table): array {
        $this->ensureTabs();
        $title = self::TABS[$table];
        $res = $this->http('GET', $this->base() . '/values/' . rawurlencode($title) . '?majorDimension=ROWS');
        $values = $res['values'] ?? [];
        if (!$values) return [];
        $header = array_map(fn($h) => trim((string)$h), $values[0]);
        // sheets made before a column was added (e.g. extra): extend the header, data columns stay where they are
        $want = FT_ROW_TABLES[$table];
        if (count(array_filter($header, 'strlen')) < count($want) && array_slice($want, 0, count($header)) === $header) {
            $this->http('PUT', $this->base() . '/values/' . rawurlencode($title . '!A1') . '?valueInputOption=RAW', ['values' => [$want]]);
            $header = $want;
        }
        $rows = []; $this->rowIndex[$table] = [];
        foreach ($values as $i => $v) {
            if ($i === 0) continue;
            $row = []; foreach ($header as $j => $h) if ($h !== '') $row[$h] = $v[$j] ?? '';
            if (($row['id'] ?? '') === '') continue;
            $rows[] = $row; $this->rowIndex[$table][(int)$row['id']] = $i + 1;
        }
        return $rows;
    }
    private function pack(string $table, int $id, array $row): array {
        $out = []; foreach (FT_ROW_TABLES[$table] as $c) $out[] = $c === 'id' ? $id : (string)($row[$c] ?? '');
        return $out;
    }
    protected function writeRow(string $table, ?int $id, array $row): int {
        $rows = $this->readRows($table);
        $title = self::TABS[$table];
        if ($id === null) {
            $id = 1; foreach ($rows as $r) $id = max($id, (int)$r['id'] + 1);
            $this->http('POST', $this->base() . '/values/' . rawurlencode($title . '!A1') . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', ['values' => [$this->pack($table, $id, $row)]]);
            return $id;
        }
        $n = $this->rowIndex[$table][$id] ?? null;
        if (!$n) { $this->http('POST', $this->base() . '/values/' . rawurlencode($title . '!A1') . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', ['values' => [$this->pack($table, $id, $row)]]); return $id; }
        $this->http('PUT', $this->base() . '/values/' . rawurlencode($title . '!A' . $n) . '?valueInputOption=RAW', ['values' => [$this->pack($table, $id, $row)]]);
        return $id;
    }
    protected function removeRow(string $table, int $id): void {
        $this->readRows($table);
        $n = $this->rowIndex[$table][$id] ?? null;
        if (!$n) return;
        $sid = $this->sheetIds[self::TABS[$table]];
        $this->http('POST', $this->base() . ':batchUpdate', ['requests' => [['deleteDimension' => ['range' => ['sheetId' => $sid, 'dimension' => 'ROWS', 'startIndex' => $n - 1, 'endIndex' => $n]]]]]);
    }
}
