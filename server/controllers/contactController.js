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
  return (
    process.env.CAREERS_INBOX_EMAIL ||
    process.env.CONTACT_INBOX_EMAIL ||
    process.env.SMTP_USER ||
    process.env.SMTP_FROM
  );
}

function parseBoolean(value) {
  if (value === true || value === 'true') {
    return true;
  }

  return false;
}

const submitContact = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    const callbackRequested = parseBoolean(req.body?.callbackRequested);
    const phone = String(req.body?.phone || '').trim();
    const preferredCallbackTime = String(req.body?.preferredCallbackTime || '').trim();

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br/>');
    const safePhone = escapeHtml(phone);
    const safePreferredCallbackTime = escapeHtml(preferredCallbackTime);
    const safeIp = escapeHtml(req.ip || 'unknown');
    const safeUserAgent = escapeHtml(req.get('user-agent') || 'unknown');

    const teamInbox = resolveTeamInbox();
    if (!teamInbox) {
      return res.status(500).json({ error: 'Contact inbox is not configured on server.' });
    }

    if (!emailService.isEmailConfigured()) {
      return res.status(500).json({ error: 'Email delivery is not configured on server.' });
    }

    if (callbackRequested && !phone) {
      return res.status(400).json({ error: 'Phone number is required for callback requests.' });
    }

    const notifySubject = callbackRequested
      ? `New callback request: ${subject}`
      : `New contact request: ${subject}`;
    const notifyText = [
      callbackRequested ? 'New callback request submission' : 'New contact form submission',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      callbackRequested ? `Phone: ${phone}` : null,
      callbackRequested ? `Preferred callback time: ${preferredCallbackTime || 'Not specified'}` : null,
      `Callback requested: ${callbackRequested ? 'Yes' : 'No'}`,
      '',
      'Message:',
      message,
      '',
      `IP: ${req.ip || 'unknown'}`,
      `User-Agent: ${req.get('user-agent') || 'unknown'}`,
    ]
      .filter(Boolean)
      .join('\n');

    const notifyHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>${callbackRequested ? 'New callback request submission' : 'New contact form submission'}</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        ${callbackRequested ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
        ${callbackRequested ? `<p><strong>Preferred callback time:</strong> ${safePreferredCallbackTime || 'Not specified'}</p>` : ''}
        <p><strong>Callback requested:</strong> ${callbackRequested ? 'Yes' : 'No'}</p>
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
      callbackRequested ? 'We also noted your callback request and will reach out using the phone number you shared.' : null,
      '',
      'Your message summary:',
      `Subject: ${subject}`,
      callbackRequested ? `Phone: ${phone}` : null,
      callbackRequested ? `Preferred callback time: ${preferredCallbackTime || 'Not specified'}` : null,
      `Message: ${message}`,
      '',
      '- Genesis.ai Team',
    ]
      .filter(Boolean)
      .join('\n');

    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>We received your message</h2>
        <p>Hi ${safeName},</p>
        <p>Thanks for contacting Genesis.ai.</p>
        <p>We have received your message from our side, and our team will get back to you shortly.</p>
        ${callbackRequested ? '<p>We also noted your callback request and will reach out using the phone number you shared.</p>' : ''}
        <div style="margin-top: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0;"><strong>Subject:</strong> ${safeSubject}</p>
          ${callbackRequested ? `<p style="margin: 8px 0 0;"><strong>Phone:</strong> ${safePhone}</p>` : ''}
          ${callbackRequested ? `<p style="margin: 8px 0 0;"><strong>Preferred callback time:</strong> ${safePreferredCallbackTime || 'Not specified'}</p>` : ''}
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
      message: 'Message received.',
    });
  } catch (err) {
    next(err);
  }
};

export default {
  submitContact,
};
