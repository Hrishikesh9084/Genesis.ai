import db from '../config/db.js';
import newsletterService from '../services/newsletterService.js';

const subscribe = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    const existingResult = await db.query(
      'SELECT id, is_active FROM newsletter_subscribers WHERE email = $1',
      [email]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      if (existing.is_active) {
        return res.status(200).json({ message: 'You are already subscribed to the newsletter.' });
      }

      await db.query(
        `UPDATE newsletter_subscribers
         SET is_active = TRUE,
             subscribed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [existing.id]
      );

      return res.status(200).json({ message: 'You have been re-subscribed to the newsletter.' });
    }

    await db.query(
      `INSERT INTO newsletter_subscribers (email, is_active, subscribed_at, updated_at)
       VALUES ($1, TRUE, NOW(), NOW())`,
      [email]
    );

    return res.status(201).json({ message: 'Subscribed successfully. You will receive weekly newsletters.' });
  } catch (err) {
    return next(err);
  }
};

const unsubscribe = async (req, res, next) => {
  try {
    const token = String(req.query?.token || req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'token is required.' });
    }

    let email;
    try {
      email = newsletterService.verifyUnsubscribeToken(token);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired unsubscribe link.' });
    }

    const result = await db.query(
      `UPDATE newsletter_subscribers
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE email = $1 AND is_active = TRUE
       RETURNING id`,
      [email]
    );

    const message =
      result.rows.length > 0
        ? 'You have been unsubscribed from weekly newsletters.'
        : 'You are already unsubscribed from weekly newsletters.';

    const wantsHtml = String(req.get('accept') || '').includes('text/html');
    if (wantsHtml) {
      return res.status(200).send(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Newsletter Unsubscribe</title>
          </head>
          <body style="font-family: Arial, sans-serif; background: #0b0b0f; color: #e5e7eb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
            <div style="max-width: 520px; width: 100%; padding: 24px; border: 1px solid #27272a; border-radius: 12px; background: #111827;">
              <h1 style="margin: 0 0 12px; font-size: 22px;">Newsletter Preferences Updated</h1>
              <p style="margin: 0 0 16px; color: #d1d5db;">${message}</p>
              <a href="${process.env.CLIENT_URL || '/'}" style="display: inline-block; background: #f97316; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">Back to Genesis.ai</a>
            </div>
          </body>
        </html>
      `);
    }

    return res.status(200).json({ message });
  } catch (err) {
    return next(err);
  }
};

export default {
  subscribe,
  unsubscribe,
};
