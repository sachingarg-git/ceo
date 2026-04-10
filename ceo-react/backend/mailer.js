const nodemailer = require('nodemailer');

// ── SMTP Transport ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'noreply@wizone.ai',
    pass: 'lxnn tapj bsim muhk',   // Google Workspace App Password
  },
  tls: { rejectUnauthorized: false },
});

// ── Verify connection on startup ────────────────────────────
transporter.verify((err) => {
  if (err) console.error('❌ Mailer SMTP error:', err.message);
  else     console.log('✅ Mailer ready — noreply@wizone.ai connected');
});

// ── Welcome Email Template ───────────────────────────────────
function buildWelcomeEmail({ companyName, username, password, loginUrl }) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:94vw;">

        <!-- Header Banner -->
        <tr>
          <td style="background:linear-gradient(135deg,#0D6E6E 0%,#14919B 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:13px;color:rgba(255,255,255,0.75);font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">Wizone AI Labs</div>
            <div style="font-size:28px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">Welcome to EA to M.D</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:8px;">Your account has been approved ✓</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <!-- Greeting -->
            <p style="font-size:15px;color:#1E293B;font-weight:600;margin:0 0 6px;">Hello, <span style="color:#0D6E6E;">${companyName}</span>!</p>
            <p style="font-size:13px;color:#64748B;line-height:1.7;margin:0 0 28px;">
              Your company has been successfully verified and approved by our team.
              You can now log in to the <strong>EA to M.D Productivity System</strong> using the credentials below.
            </p>

            <!-- Credentials Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px 28px;">
                  <div style="font-size:10px;font-weight:800;color:#0369A1;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">Your Login Credentials</div>

                  <!-- Username -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                    <tr>
                      <td style="width:40%;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;padding:10px 14px;background:#E0F2FE;border-radius:8px 0 0 8px;">Username</td>
                      <td style="font-size:14px;font-weight:700;color:#0C4A6E;padding:10px 16px;background:#fff;border-radius:0 8px 8px 0;border:1px solid #BAE6FD;border-left:none;">${username}</td>
                    </tr>
                  </table>

                  <!-- Password -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:40%;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;padding:10px 14px;background:#E0F2FE;border-radius:8px 0 0 8px;">Password</td>
                      <td style="font-size:14px;font-weight:700;color:#0C4A6E;padding:10px 16px;background:#fff;border-radius:0 8px 8px 0;border:1px solid #BAE6FD;border-left:none;letter-spacing:2px;">${password}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#0D6E6E,#14919B);color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(13,110,110,0.35);">
                    🚀 &nbsp; Login to EA to M.D
                  </a>
                </td>
              </tr>
            </table>

            <!-- Login URL text -->
            <p style="font-size:11px;color:#94A3B8;text-align:center;margin:0 0 28px;">
              Or copy this link: <a href="${loginUrl}" style="color:#0D6E6E;font-weight:600;word-break:break-all;">${loginUrl}</a>
            </p>

            <!-- Features grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:10px;font-weight:800;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">What You Can Do</div>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:50%;padding:4px 0;font-size:12px;color:#475569;">📋 &nbsp; Quick Capture Tasks</td>
                      <td style="width:50%;padding:4px 0;font-size:12px;color:#475569;">📅 &nbsp; Daily Schedule</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:12px;color:#475569;">🔄 &nbsp; Recurring Tasks</td>
                      <td style="padding:4px 0;font-size:12px;color:#475569;">📊 &nbsp; Performance Analytics</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:12px;color:#475569;">📋 &nbsp; Someday List</td>
                      <td style="padding:4px 0;font-size:12px;color:#475569;">📈 &nbsp; Weekly Scorecard</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Security note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:0 8px 8px 0;margin-bottom:8px;">
              <tr>
                <td style="padding:12px 16px;font-size:11px;color:#92400E;line-height:1.6;">
                  <strong>⚠️ Security Tip:</strong> Please change your password after your first login via Settings → Users.
                  Keep your credentials confidential and do not share them with anyone.
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 40px;text-align:center;">
            <p style="font-size:11px;color:#94A3B8;margin:0 0 4px;">This is an automated message from Wizone AI Labs Pvt Ltd. Please do not reply to this email.</p>
            <p style="font-size:11px;color:#94A3B8;margin:0;">
              Need help? Contact us at
              <a href="mailto:support@wizone.ai" style="color:#0D6E6E;text-decoration:none;font-weight:600;">support@wizone.ai</a>
            </p>
            <p style="font-size:10px;color:#CBD5E1;margin:10px 0 0;">&copy; ${new Date().getFullYear()} Wizone AI Labs Pvt Ltd. All rights reserved.</p>
          </td>
        </tr>

      </table>
      <!-- End Card -->

    </td></tr>
  </table>

</body>
</html>`;

  return html;
}

// ── Send welcome/approval email ──────────────────────────────
async function sendApprovalEmail({ toEmail, companyName, username, password }) {
  const loginUrl = 'https://ea.wizone.ai';

  const mailOptions = {
    from: '"EA to M.D — Wizone AI" <noreply@wizone.ai>',
    to: toEmail,
    subject: `✅ Your EA to M.D Account is Approved — Welcome, ${companyName}!`,
    html: buildWelcomeEmail({ companyName, username, password, loginUrl }),
    text: `
Welcome to EA to M.D, ${companyName}!

Your company account has been approved. Here are your login credentials:

Username : ${username}
Password : ${password}
Login URL: ${loginUrl}

Please change your password after first login.

This is an automated message from Wizone AI Labs Pvt Ltd.
Support: support@wizone.ai
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${toEmail} — MessageId: ${info.messageId}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Failed to send approval email to ${toEmail}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendApprovalEmail };
