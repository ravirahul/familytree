<?php
/**
 * includes/auth-side.php - the brand panel beside the log in and sign up forms (styles in assets/auth.css).
 * Set $authHeadline and $authLede before including.
 */
if (!defined('FT_APP')) { http_response_code(403); exit; }
$check = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
?>
<aside class="auth-side">
  <a href="/" class="auth-brand"><svg width="28" height="28" viewBox="3 3 22 23.5" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25V15.5M14 21l-5.2-5.2M14 18.5l5.2-5.2M14 15.5V9.6M9.5 25h9"/><circle cx="7.2" cy="14.2" r="2.4"/><circle cx="20.8" cy="11.7" r="2.4"/><circle cx="14" cy="7" r="2.4"/></g></svg>FamilyTree</a>
  <div>
    <h2><?= htmlspecialchars($authHeadline) ?></h2>
    <p><?= htmlspecialchars($authLede) ?></p>
  </div>
  <svg class="auth-tree" viewBox="0 0 380 220" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="2">
      <path d="M190 52v24M70 76h240M70 76v24M190 76v24M310 76v24M190 140v24M130 164h120M130 164v16M250 164v16"/>
    </g>
    <rect class="n" x="110" y="14" width="74" height="38" rx="10"/><text x="147" y="38" text-anchor="middle">Harish</text>
    <rect class="n" x="196" y="14" width="74" height="38" rx="10"/><text x="233" y="38" text-anchor="middle">Kamla</text>
    <rect class="n" x="33" y="100" width="74" height="38" rx="10"/><text x="70" y="124" text-anchor="middle">Anil</text>
    <rect class="n n-on" x="153" y="100" width="74" height="38" rx="10"/><text x="190" y="124" text-anchor="middle">Meera</text>
    <rect class="n" x="273" y="100" width="74" height="38" rx="10"/><text x="310" y="124" text-anchor="middle">Vivek</text>
    <rect class="n" x="93" y="180" width="74" height="34" rx="10"/><text x="130" y="202" text-anchor="middle">Kabir</text>
    <rect class="n" x="213" y="180" width="74" height="34" rx="10"/><text x="250" y="202" text-anchor="middle">Tara</text>
  </svg>
  <ul class="auth-points">
    <li><?= $check ?>One link the whole family can open, no app needed</li>
    <li><?= $check ?>Tree, timeline, map, memory book and events</li>
    <li><?= $check ?>Free and open source; export your data any time</li>
  </ul>
</aside>
