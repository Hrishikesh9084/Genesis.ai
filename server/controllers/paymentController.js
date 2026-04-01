import crypto from 'crypto';
import Razorpay from 'razorpay';
import db from '../config/db.js';

const CREDIT_PLANS = [
  {
    id: 'starter',
    title: 'Starter',
    description: '15 credits for generating projects',
    amountPaise: 19900,
    currency: 'INR',
    credits: 15,
  },
  {
    id: 'professional',
    title: 'Professional',
    description: '40 credits for frequent project generation',
    amountPaise: 49900,
    currency: 'INR',
    credits: 40,
    mostPopular: true,
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    description: '120 credits for heavy usage',
    amountPaise: 149900,
    currency: 'INR',
    credits: 120,
  },
];

function getRazorpayClient() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) return null;

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function findPlan(planId) {
  return CREDIT_PLANS.find((plan) => plan.id === String(planId || '').trim().toLowerCase()) || null;
}

const getPlans = (_req, res) => {
  res.json({ plans: CREDIT_PLANS });
};

const getBalance = async (req, res, next) => {
  try {
    const result = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ credits: Number(result.rows[0].credits || 0) });
  } catch (err) {
    return next(err);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const plan = findPlan(req.body?.planId);
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay is not configured on server.' });
    }

    const receipt = `credits_${req.user.id.slice(0, 8)}_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes: {
        userId: req.user.id,
        planId: plan.id,
        credits: String(plan.credits),
      },
    });

    await db.query(
      `INSERT INTO credit_transactions
       (user_id, plan_id, credits, amount_paise, currency, razorpay_order_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        req.user.id,
        plan.id,
        plan.credits,
        plan.amountPaise,
        plan.currency,
        order.id,
        'created',
        JSON.stringify({ receipt }),
      ]
    );

    return res.status(201).json({
      orderId: order.id,
      amount: plan.amountPaise,
      currency: plan.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
    });
  } catch (err) {
    return next(err);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const orderId = String(req.body?.razorpay_order_id || '').trim();
    const paymentId = String(req.body?.razorpay_payment_id || '').trim();
    const signature = String(req.body?.razorpay_signature || '').trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Payment verification fields are required.' });
    }

    const secret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!secret) {
      return res.status(503).json({ error: 'Razorpay is not configured on server.' });
    }

    const txResult = await db.query(
      `SELECT id, credits, status
       FROM credit_transactions
       WHERE user_id = $1 AND razorpay_order_id = $2
       LIMIT 1`,
      [req.user.id, orderId]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment order not found.' });
    }

    const tx = txResult.rows[0];
    if (tx.status === 'paid') {
      const userResult = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
      return res.json({ message: 'Payment already verified.', credits: Number(userResult.rows[0]?.credits || 0) });
    }

    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generated !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE credit_transactions
         SET razorpay_payment_id = $1,
             razorpay_signature = $2,
             status = 'paid',
             updated_at = NOW()
         WHERE id = $3`,
        [paymentId, signature, tx.id]
      );

      const userUpdate = await client.query(
        `UPDATE users
         SET credits = credits + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING credits`,
        [Number(tx.credits || 0), req.user.id]
      );

      await client.query('COMMIT');

      return res.json({
        message: 'Payment verified. Credits added successfully.',
        credits: Number(userUpdate.rows[0]?.credits || 0),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return next(err);
  }
};

export default {
  getPlans,
  getBalance,
  createOrder,
  verifyPayment,
};
