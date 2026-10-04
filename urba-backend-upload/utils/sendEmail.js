const nodemailer = require('nodemailer');

/**
 * Send an email via SMTP or Ethereal test account (for development if SMTP not configured)
 */
const sendEmail = async ({ to, subject, html, text }) => {
  let transporter;

  const hasSmtpConfig = (process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS);

  if (hasSmtpConfig) {
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;

    // Direct Gmail configuration (simplest and most reliable for Google App Passwords)
    if (host.includes('gmail') || (!process.env.SMTP_HOST && user.includes('@gmail.com'))) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
    }
  } else {

    // Development fallback: Log email clearly to console & use test ethereal account
    console.log('\n================== [EMAIL DISPATCH - DEV PREVIEW] ==================');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text || html.replace(/<[^>]+>/g, ' ')}`);
    console.log('====================================================================\n');

    // Create test account for preview URL if in development without SMTP
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const fromName = process.env.FROM_NAME || 'Urban Threads';
  const fromEmail = process.env.FROM_EMAIL || 'support@urbanthreads.com';

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ' '),
    html,
  });

  if (!hasSmtpConfig) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📨 Ethereal Dev Email Preview URL: ${previewUrl}`);
    }
  }

  return info;
};

module.exports = sendEmail;
