import nodemailer from 'nodemailer';

function getAuthMethod() {
  return String(process.env.SMTP_AUTH_METHOD || 'password').toLowerCase();
}

function getOAuthClientSecret() {
  return process.env.SMTP_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
}

function isEmailConfigured() {
  const authMethod = getAuthMethod();

  if (authMethod === 'oauth2') {
    return Boolean(
      process.env.SMTP_USER &&
        process.env.SMTP_CLIENT_ID &&
        getOAuthClientSecret() &&
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
        clientSecret: getOAuthClientSecret(),
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
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return {
    skipped: false,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    response: info.response,
    messageId: info.messageId,
  };
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

async function sendHiredNotificationEmail({ to, name, roleTitle, applicationId }) {
  const subject = 'Congratulations! Offer: ' + roleTitle + ' at Genesis.ai';
  const text = `Hi ${name},\n\nCongratulations! We are pleased to offer you the position of ${roleTitle} at Genesis.ai.\n\nWe believe you will be a great fit for our team and look forward to working with you.\n\nApplication ID: ${applicationId}\n\nOur HR team will be in touch soon with next steps.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Congratulations!</h2>
      <p>Hi ${name},</p>
      <p>We are thrilled to offer you the position of <strong>${roleTitle}</strong> at Genesis.ai.</p>
      <p>We believe you will be a great addition to our team and look forward to working with you.</p>
      <p><strong>Application ID:</strong> ${applicationId}</p>
      <p>Our HR team will contact you shortly with details about the next steps and onboarding.</p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;
  return sendMail({ to, subject, text, html });
}

async function sendShortlistedNotificationEmail({ to, name, roleTitle, applicationId }) {
  const subject = 'Great news! You are shortlisted for ' + roleTitle + ' at Genesis.ai';
  const text = `Hi ${name},\n\nGreat news! Your application for the ${roleTitle} position has been shortlisted.\n\nWe were impressed by your profile and would like to move forward with the next stage of our hiring process.\n\nApplication ID: ${applicationId}\n\nOur team will reach out to you soon with further details.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>You're Shortlisted!</h2>
      <p>Hi ${name},</p>
      <p>Great news! Your application for the <strong>${roleTitle}</strong> position at Genesis.ai has been shortlisted.</p>
      <p>We were impressed by your profile and would like to move forward with the next stage of our hiring process.</p>
      <p><strong>Application ID:</strong> ${applicationId}</p>
      <p>Our team will be in touch with you soon regarding the next steps.</p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;
  return sendMail({ to, subject, text, html });
}

async function sendRejectionNotificationEmail({ to, name, roleTitle, applicationId }) {
  const subject = 'Application Status Update: ' + roleTitle + ' at Genesis.ai';
  const text = `Hi ${name},\n\nThank you for applying to the ${roleTitle} position at Genesis.ai. We appreciate the effort you put into your application.\n\nAfter careful consideration, we have decided to move forward with other candidates at this time. However, we would like to keep your profile for future opportunities.\n\nApplication ID: ${applicationId}\n\nWe wish you the best in your career endeavors.\n\n- Genesis.ai Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Application Status Update</h2>
      <p>Hi ${name},</p>
      <p>Thank you for applying to the <strong>${roleTitle}</strong> position at Genesis.ai. We genuinely appreciate the time and effort you invested in your application.</p>
      <p>After careful consideration, we have decided to move forward with other candidates at this time. However, we would love to keep your profile on file for suitable opportunities in the future.</p>
      <p><strong>Application ID:</strong> ${applicationId}</p>
      <p>We wish you the very best in your career endeavors.</p>
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
  sendHiredNotificationEmail,
  sendShortlistedNotificationEmail,
  sendRejectionNotificationEmail,
};