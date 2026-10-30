<?php
/**
 * tools/router.php - the .htaccess rewrites for PHP's built-in server.
 *
 *   php -S 127.0.0.1:8080 -t public_html tools/router.php
 *
 * Used for development and by the desktop app. Apache and Nginx use their own rules.
 */
$root = $_SERVER['DOCUMENT_ROOT'] ?: realpath(__DIR__ . '/../public_html');
$u = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('~^/(storage|tools)(/|$)~', $u)) { http_response_code(403); return true; }
if (preg_match('~^/tree/([a-zA-Z0-9_-]{1,80})/?$~', $u, $m)) { $_GET['slug'] = $m[1]; chdir($root); require $root . '/tree.php'; return true; }
if (preg_match('~^/tree/([a-zA-Z0-9_-]{1,80})/(events|map|memories|relation)/?$~', $u, $m)) { $_GET['slug'] = $m[1]; $_GET['view'] = $m[2]; chdir($root); require $root . '/tree.php'; return true; }
if (preg_match('~^/tree/([a-zA-Z0-9_-]{1,80})/(poster|book)/?$~', $u, $m)) { $_GET['slug'] = $m[1]; $_GET['kind'] = $m[2]; chdir($root); require $root . '/print.php'; return true; }
if ($u === '/sitemap.xml') { chdir($root); require $root . '/sitemap.php'; return true; }
if (preg_match('~^/mcp/?$~', $u)) { chdir($root); require $root . '/mcp.php'; return true; }
if (preg_match('~^/guide(?:/([a-z0-9-]{1,60}))?/?$~', $u, $m)) { $_GET['p'] = $m[1] ?? ''; chdir($root); require $root . '/guide.php'; return true; }
if (preg_match('~^/embed/([a-zA-Z0-9_-]{1,80})(?:/(events|map|memories|relation))?/?$~', $u, $m)) { $_GET['slug'] = $m[1]; if (!empty($m[2])) $_GET['view'] = $m[2]; $_GET['embed'] = '1'; chdir($root); require $root . '/tree.php'; return true; }
$dir = rtrim($u, '/');
if (is_dir($root . $u) && is_file($root . $dir . '/index.php')) {
    chdir($root . $dir);                                      // relative includes behave as under Apache
    $_SERVER['SCRIPT_NAME'] = $dir . '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $root . $dir . '/index.php';
    require $root . $dir . '/index.php';
    return true;
}
if (is_dir($root . $u) && is_file($root . $dir . '/index.html')) { readfile($root . $dir . '/index.html'); return true; }
return false;
