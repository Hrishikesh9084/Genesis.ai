import db from '../config/db.js';
import emailService from './emailService.js';
import jwt from 'jsonwebtoken';

const NEWSLETTER_DAY_UTC = Number.parseInt(String(process.env.NEWSLETTER_DAY_UTC || '1'), 10);
const NEWSLETTER_HOUR_UTC = Number.parseInt(String(process.env.NEWSLETTER_HOUR_UTC || '9'), 10);
const NEWSLETTER_INTERVAL_MS = 60 * 60 * 1000;

let schedulerTimer = null;
let isSending = false;

function resolveUnsubscribeBaseUrl() {
  const explicitBase = String(process.env.NEWSLETTER_UNSUBSCRIBE_BASE_URL || '').trim();
  if (explicitBase) {
    return explicitBase.replace(/\/+$/, '');
  }

  const apiUrl = String(process.env.API_URL || '').trim();
  if (apiUrl) {
    return apiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  }

  const fallback = String(process.env.CLIENT_URL || 'https://genesis-ai-tu97.vercel.app').trim();
  return fallback.replace(/\/+$/, '');
}

function getUnsubscribeSecret() {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || '';
}

function createUnsubscribeToken(email) {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    throw new Error('Unsubscribe secret is not configured. Set NEWSLETTER_UNSUBSCRIBE_SECRET or JWT_SECRET.');
  }

  return jwt.sign({ email, purpose: 'newsletter_unsubscribe' }, secret, { expiresIn: '180d' });
}

function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    throw new Error('Unsubscribe secret is not configured.');
  }

  const payload = jwt.verify(token, secret);
  if (payload?.purpose !== 'newsletter_unsubscribe' || !payload?.email) {
    throw new Error('Invalid unsubscribe token.');
  }

  return String(payload.email).toLowerCase();
}

function buildNewsletterEmail(email, issueTitle = null, articles = []) {
  const subject = issueTitle || process.env.NEWSLETTER_SUBJECT || 'Your Weekly Genesis.ai Newsletter';
  const appUrl = process.env.CLIENT_URL || 'https://genesis.ai';
  const token = createUnsubscribeToken(email);
  const unsubscribeUrl = `${resolveUnsubscribeBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

  let text = [
    'Hi there,',
    '',
    issueTitle || 'Here is your weekly Genesis.ai update.',
    '',
  ];

  if (articles && articles.length > 0) {
    for (const article of articles) {
      text.push(`- ${article.title}: ${article.description}`);
      if (article.link) {
        text.push(`  ${article.link}`);
      }
    }
  } else {
    text.push('- New product improvements and platform updates');
    text.push('- Latest AI building tips');
    text.push('- Feature highlights you can use right away');
  }

  text.push('');
  text.push(`Open Genesis.ai: ${appUrl}`);
  text.push(`Unsubscribe: ${unsubscribeUrl}`);
  text.push('');
  text.push('- Genesis.ai Team');

  let articlesHtml = '';
  if (articles && articles.length > 0) {
    articlesHtml = '<ul style="margin: 16px 0;">';
    for (const article of articles) {
      articlesHtml += `<li style="margin: 10px 0;">
        <strong>${article.title}</strong><br/>
        ${article.description}`;
      if (article.link) {
        articlesHtml += `<br/><a href="${article.link}" style="color: #1f2937;">${article.link}</a>`;
      }
      articlesHtml += '</li>';
    }
    articlesHtml += '</ul>';
  } else {
    articlesHtml = `<ul>
      <li>New product improvements and platform updates</li>
      <li>Latest AI building tips</li>
      <li>Feature highlights you can use right away</li>
    </ul>`;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>${issueTitle || 'Your Weekly Genesis.ai Newsletter'}</h2>
      <p>Hi there,</p>
      <p>${issueTitle ? 'Check out this week\'s updates:' : 'Here is your weekly Genesis.ai update.'}</p>
      ${articlesHtml}
      <p style="margin-top: 20px;">
        <a href="${appUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">
          Open Genesis.ai
        </a>
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #4b5563;">
        Prefer not to receive these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
      <p style="margin-top: 24px;">- Genesis.ai Team</p>
    </div>
  `;

  return { subject, text: text.join('\n'), html };
}

function isWithinWeeklyWindow(now = new Date()) {
  return now.getUTCDay() === NEWSLETTER_DAY_UTC && now.getUTCHours() === NEWSLETTER_HOUR_UTC;
}

async function sendWeeklyNewsletterBatch() {
  if (!emailService.isEmailConfigured()) {
    return { sent: 0, skipped: true, reason: 'Email service not configured.' };
  }

  const candidates = await db.query(
    `SELECT id, email
     FROM newsletter_subscribers
     WHERE is_active = TRUE
       AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '6 days')
     ORDER BY subscribed_at ASC
     LIMIT 500`
  );

  if (candidates.rows.length === 0) {
    return { sent: 0, skipped: false, reason: 'No eligible subscribers.' };
  }

  const sentIds = [];

  for (const subscriber of candidates.rows) {
    try {
      const { subject, text, html } = buildNewsletterEmail(subscriber.email);
      await emailService.sendMail({
        to: subscriber.email,
        subject,
        text,
        html,
      });
      sentIds.push(subscriber.id);
    } catch (err) {
      console.error(`Newsletter send failed for ${subscriber.email}:`, err.message);
    }
  }

  if (sentIds.length > 0) {
    await db.query(
      `UPDATE newsletter_subscribers
       SET last_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [sentIds]
    );
  }

  return { sent: sentIds.length, skipped: false };
}

async function runScheduledNewsletterCheck() {
  if (isSending) return;
  if (!isWithinWeeklyWindow()) return;

  isSending = true;
  try {
    const result = await sendWeeklyNewsletterBatch();
    if (result.sent > 0) {
      console.log(`Weekly newsletter sent to ${result.sent} subscribers.`);
    }
  } catch (err) {
    console.error('Weekly newsletter job failed:', err);
  } finally {
    isSending = false;
  }
}

function startNewsletterScheduler() {
  if (String(process.env.NEWSLETTER_SCHEDULER_DISABLED || 'false').toLowerCase() === 'true') {
    console.log('Newsletter scheduler is disabled via NEWSLETTER_SCHEDULER_DISABLED.');
    return;
  }

  if (schedulerTimer) return;

  runScheduledNewsletterCheck().catch((err) => {
    console.error('Initial newsletter check failed:', err.message);
  });

  schedulerTimer = setInterval(() => {
    runScheduledNewsletterCheck().catch((err) => {
      console.error('Scheduled newsletter check failed:', err.message);
    });
  }, NEWSLETTER_INTERVAL_MS);

  console.log(`Newsletter scheduler started (UTC day=${NEWSLETTER_DAY_UTC}, hour=${NEWSLETTER_HOUR_UTC}).`);
}

async function sendIssue(issueId) {
  if (!emailService.isEmailConfigured()) {
    throw new Error('Email service not configured.');
  }

  const issueResult = await db.query(
    'SELECT * FROM newsletter_issues WHERE id = $1',
    [issueId]
  );

  if (issueResult.rows.length === 0) {
    throw new Error('Newsletter issue not found.');
  }

  const issue = issueResult.rows[0];

  const articlesResult = await db.query(
    'SELECT * FROM newsletter_articles WHERE issue_id = $1 ORDER BY order_index ASC',
    [issueId]
  );

  const articles = articlesResult.rows;

  const subscribersResult = await db.query(
    'SELECT id, email FROM newsletter_subscribers WHERE is_active = TRUE ORDER BY subscribed_at ASC'
  );

  const subscribers = subscribersResult.rows;

  if (subscribers.length === 0) {
    console.log('No active subscribers to send to.');
    return { sent: 0, issueId };
  }

  const sentIds = [];
  const failed = [];

  for (const subscriber of subscribers) {
    try {
      const { subject, text, html } = buildNewsletterEmail(subscriber.email, issue.subject || issue.title, articles);
      const delivery = await emailService.sendMail({
        to: subscriber.email,
        subject,
        text,
        html,
      });

      if (delivery?.rejected?.length) {
        failed.push({ email: subscriber.email, reason: `Rejected by SMTP: ${delivery.rejected.join(', ')}` });
        continue;
      }

      sentIds.push(subscriber.id);
    } catch (err) {
      console.error(`Newsletter send failed for ${subscriber.email}:`, err.message);
      failed.push({ email: subscriber.email, reason: err.message });
    }
  }

  if (sentIds.length > 0) {
    await db.query(
      `UPDATE newsletter_subscribers
       SET last_sent_at = NOW(),
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [sentIds]
    );

    await db.query(
      `UPDATE newsletter_issues
       SET sent_at = NOW(),
           status = $1,
           subscriber_count = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['sent', sentIds.length, issueId]
    );
  }

  console.log(
    `Newsletter issue ${issueId}: sent=${sentIds.length}, failed=${failed.length}, total=${subscribers.length}`
  );
  return {
    sent: sentIds.length,
    failedCount: failed.length,
    totalSubscribers: subscribers.length,
    failed,
    issueId,
  };
}

export default {
  startNewsletterScheduler,
  sendWeeklyNewsletterBatch,
  sendIssue,
  verifyUnsubscribeToken,
};
