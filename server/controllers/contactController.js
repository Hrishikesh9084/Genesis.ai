import emailService from '../services/emailService.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveTeamInbox() {
  return process.env.CONTACT_INBOX_EMAIL || process.env.SMTP_USER || process.env.SMTP_FROM;
}

const submitContact = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br/>');
    const safeIp = escapeHtml(req.ip || 'unknown');
    const safeUserAgent = escapeHtml(req.get('user-agent') || 'unknown');

    const teamInbox = resolveTeamInbox();
    if (!teamInbox) {
      return res.status(500).json({ error: 'Contact inbox is not configured on server.' });
    }

    if (!emailService.isEmailConfigured()) {
      return res.status(500).json({ error: 'Email delivery is not configured on server.' });
    }

    const notifySubject = `New contact request: ${subject}`;
    const notifyText = [
      'New contact form submission',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      'Message:',
      message,
      '',
      `IP: ${req.ip || 'unknown'}`,
      `User-Agent: ${req.get('user-agent') || 'unknown'}`,
    ].join('\n');

    const notifyHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Message:</strong><br/>${safeMessage}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 12px; color: #555;"><strong>IP:</strong> ${safeIp}</p>
        <p style="font-size: 12px; color: #555;"><strong>User-Agent:</strong> ${safeUserAgent}</p>
      </div>
    `;

    const confirmationSubject = 'We received your message - Genesis.ai';
    const confirmationText = [
      `Hi ${name},`,
      '',
      'Thanks for contacting Genesis.ai.',
      'We have received your message from our side, and our team will get back to you shortly.',
      '',
      'Your message summary:',
      `Subject: ${subject}`,
      `Message: ${message}`,
      '',
      '- Genesis.ai Team',
    ].join('\n');

    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>We received your message</h2>
        <p>Hi ${safeName},</p>
        <p>Thanks for contacting Genesis.ai.</p>
        <p>We have received your message from our side, and our team will get back to you shortly.</p>
        <div style="margin-top: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0;"><strong>Subject:</strong> ${safeSubject}</p>
          <p style="margin: 8px 0 0;"><strong>Message:</strong><br/>${safeMessage}</p>
        </div>
        <p style="margin-top: 24px;">- Genesis.ai Team</p>
      </div>
    `;

    await emailService.sendMail({
      to: teamInbox,
      subject: notifySubject,
      text: notifyText,
      html: notifyHtml,
    });

    await emailService.sendMail({
      to: email,
      subject: confirmationSubject,
      text: confirmationText,
      html: confirmationHtml,
    });

    res.status(201).json({
      message: 'Message received. A confirmation email has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

export default {
  submitContact,
};
