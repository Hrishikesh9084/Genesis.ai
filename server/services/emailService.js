import nodemailer from 'nodemailer';

function getAuthMethod() {
  return String(process.env.SMTP_AUTH_METHOD || 'password').toLowerCase();
}

function isEmailConfigured() {
  const authMethod = getAuthMethod();

  if (authMethod === 'oauth2') {
    return Boolean(
      process.env.SMTP_USER &&
        process.env.SMTP_CLIENT_ID &&
        process.env.SMTP_CLIENT_SECRET &&
        process.env.SMTP_REFRESH_TOKEN &&
        process.env.SMTP_FROM
    );
  }

  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

function createTransporter() {
  const authMethod = getAuthMethod();

  if (authMethod === 'oauth2') {
    return nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.SMTP_USER,
        clientId: process.env.SMTP_CLIENT_ID,
        clientSecret: process.env.SMTP_CLIENT_SECRET,
        refreshToken: process.env.SMTP_REFRESH_TOKEN,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    return { skipped: true, reason: 'SMTP configuration is missing.' };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return { skipped: false };
}

async function sendWelcomeEmail({ to, name }) {
  const subject = 'Welcome to Genesis.ai';
  const text = `Hi ${name},\n\nYour Genesis.ai account has been created successfully.\n\nYou can now log in and start building projects.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Welcome to Genesis.ai</h2>
      <p>Hi ${name},</p>
      <p>Your account has been created successfully.</p>
      <p>You can now log in and start building projects.</p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendEmailVerificationEmail({ to, name, verificationUrl }) {
  const subject = 'Verify your Genesis.ai email';
  const text = `Hi ${name},\n\nPlease verify your email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address to activate your Genesis.ai account.</p>
      <p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email</a>
      </p>
      <p>If the button does not work, copy and paste this URL in your browser:</p>
      <p>${verificationUrl}</p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Reset your Genesis.ai password';
  const text = `Hi ${name},\n\nWe received a request to reset your password.\n\nReset link: ${resetUrl}\n\nThis link will expire in 15 minutes.\nIf you did not request this, you can ignore this email.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Reset your password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your Genesis.ai password.</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">Reset Password</a>
      </p>
      <p>If the button does not work, copy and paste this URL in your browser:</p>
      <p>${resetUrl}</p>
      <p>This link expires in <strong>15 minutes</strong>.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

export default {
  isEmailConfigured,
  sendMail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};