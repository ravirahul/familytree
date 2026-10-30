<?php
/**
 * includes/mailer.php – Email utilities for Family Tree SaaS
 *
 * Uses PHP mail() which works on Hostinger shared hosting.
 * To improve deliverability, add to .env:
 *   APP_URL=https://your-domain.example
 *   MAIL_FROM_EMAIL=noreply@your-domain.example
 *   MAIL_FROM_NAME=Family Tree
 */

// Guard: don't allow direct web access
if (!defined('FT_APP')) {
    http_response_code(403);
    exit;
}

// ── Core send function ────────────────────────────────────────────────────
function sendEmail(
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody
): bool {
    $fromEmail = getenv('MAIL_FROM_EMAIL') ?: ('noreply@' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost')));
    $fromName  = getenv('MAIL_FROM_NAME')  ?: 'Family Tree';
    $appDomain = getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost');

    $toHeader  = $toName ? ('"' . str_replace('"', '', $toName) . '" <' . $toEmail . '>') : $toEmail;
    $messageId = '<' . uniqid('ft_', true) . '@' . $appDomain . '>';

    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: "' . str_replace('"', '', $fromName) . '" <' . $fromEmail . '>',
        'Reply-To: ' . $fromEmail,
        'Message-ID: ' . $messageId,
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    $result = @mail($toHeader, $subject, $htmlBody, $headers);
    if (!$result) {
        error_log("sendEmail failed: to={$toEmail} subject={$subject}");
    }
    return $result;
}

// ── Email templates ───────────────────────────────────────────────────────
function emailWrap(string $appName, string $content): string {
    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$appName}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1d26;border-radius:12px;overflow:hidden;max-width:560px;">
      <tr>
        <td style="background:#2a6496;padding:28px 36px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">{$appName}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:36px;color:#c8cad4;font-size:15px;line-height:1.7;">
          {$content}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 36px;border-top:1px solid #2a2d3a;color:#5a5d6b;font-size:12px;">
          You're receiving this because you registered at {$appName}.
          If you didn't register, ignore this email.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
}

function btnStyle(): string {
    return 'display:inline-block;padding:13px 28px;background:#2a6496;color:#fff;text-decoration:none;'
         . 'border-radius:7px;font-size:15px;font-weight:600;margin:20px 0;';
}

// ── Password reset email ───────────────────────────────────────────────────
function sendPasswordResetEmail(string $toEmail, string $toName, string $token): bool {
    $appUrl  = rtrim(getenv('APP_URL') ?: ('https://' . (getenv('APP_DOMAIN') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost'))), '/');
    $appName = getenv('MAIL_FROM_NAME') ?: 'Family Tree';
    $url     = $appUrl . '/admin/reset-password.php?token=' . urlencode($token);

    $content = '
        <p>Hi ' . htmlspecialchars($toName) . ',</p>
        <p>We received a request to reset the password for your account.
           Click the button below to choose a new password.</p>
        <p><a href="' . htmlspecialchars($url) . '" style="' . btnStyle() . '">Reset My Password</a></p>
        <p style="font-size:13px;color:#5a5d6b;">
            Or copy this link into your browser:<br>
            <span style="color:#7ab3d4;">' . htmlspecialchars($url) . '</span>
        </p>
        <p style="font-size:13px;color:#5a5d6b;">
            This link expires in <strong style="color:#c8cad4;">1 hour</strong>.<br>
            If you did not request a password reset, you can safely ignore this email.
        </p>';

    return sendEmail($toEmail, $toName, 'Reset your password – ' . $appName, emailWrap($appName, $content));
}
