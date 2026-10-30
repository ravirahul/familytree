<?php
/**
 * includes/brand.php - the FamilyTree logo, one source for every page. Styles in assets/brand.css.
 * The same mark is in assets/logo.svg, the app icons (assets/icon.svg, favicon.ico, icon-*.png)
 * and, for JavaScript pages, as FT_LOGO in shell/shell.js.
 */
if (!defined('FT_APP')) { http_response_code(403); exit; }

const FT_THEME_COLOR = '#0E241B';

/** The drawing inside the mark: a trunk with three branches, each ending in a ring (a person). */
const FT_MARK_PATHS = '<path d="M14 25V15.5M14 21l-5.2-5.2M14 18.5l5.2-5.2M14 15.5V9.6M9.5 25h9"/><circle cx="7.2" cy="14.2" r="2.4"/><circle cx="20.8" cy="11.7" r="2.4"/><circle cx="14" cy="7" r="2.4"/>';

/** The mark alone, drawn in currentColor. */
function ft_logo(int $size = 28): string {
    return '<svg class="ft-mark" width="' . $size . '" height="' . $size . '" viewBox="3 3 22 23.5" aria-hidden="true" focusable="false">'
         . '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . FT_MARK_PATHS . '</g></svg>';
}

/** The mark and the name as a link, with an optional small line under the name ("Admin", "Guide"). */
function ft_brand(string $href = '/', string $sub = '', int $size = 28): string {
    $name = $sub !== ''
        ? '<span>FamilyTree<small>' . htmlspecialchars($sub) . '</small></span>'
        : '<span>FamilyTree</span>';
    return '<a href="' . htmlspecialchars($href) . '" class="ft-brand" aria-label="FamilyTree home">' . ft_logo($size) . $name . '</a>';
}

/** The <head> lines every branded page shares: fonts, brand.css, icons, theme colour, and the saved light/dark choice. */
function ft_brand_head(): string {
    $v = defined('FT_VERSION') ? FT_VERSION : '1';
    return '<script>try{document.documentElement.setAttribute("data-theme",localStorage.getItem("family_tree_theme")==="dark"?"dark":"light")}catch(e){}</script>' . "\n"
         . '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n"
         . '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">' . "\n"
         . '<link rel="stylesheet" href="/assets/brand.css?v=' . $v . '">' . "\n"
         . '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">' . "\n"
         . '<meta name="theme-color" content="' . FT_THEME_COLOR . '">' . "\n";
}
