import db from '../config/db.js';
import aiGenerator from '../services/aiGenerator.js';

async function consumeOneCredit(userId) {
  const result = await db.query(
    `UPDATE users
     SET credits = credits - 1,
         updated_at = NOW()
     WHERE id = $1 AND credits > 0
     RETURNING credits`,
    [userId]
  );

  return result.rows[0] || null;
}

function buildCtoPrompt(payload) {
  return `Analyze this startup idea as a complete AI startup team and return structured JSON only.

Startup idea:
${payload.idea}

Target audience:
${payload.audience || 'Not specified'}

Primary goal:
${payload.goal || 'Not specified'}

Budget:
${payload.budget || 'Not specified'}

Timeline:
${payload.timeline || 'Not specified'}

Constraints:
${payload.constraints || 'None'}

Return JSON with this exact shape:
{
  "ideaSummary": "...",
  "startupScore": 0,
  "scores": {
    "product": 0,
    "technical": 0,
    "market": 0,
    "execution": 0
  },
  "aiCto": {
    "architecture": "...",
    "recommendedStack": ["..."],
    "database": "...",
    "hosting": "...",
    "apis": ["..."],
    "mvpScope": ["..."],
    "risks": ["..."]
  },
  "productManager": {
    "prd": ["..."],
    "userStories": ["..."],
    "featurePriorities": ["..."]
  },
  "uiUx": {
    "direction": "...",
    "layoutSuggestions": ["..."],
    "designSystem": ["..."]
  },
  "engineering": {
    "coreServices": ["..."],
    "auth": ["..."],
    "dataModel": ["..."],
    "implementationNotes": ["..."]
  },
  "qa": {
    "testPlan": ["..."],
    "criticalCases": ["..."]
  },
  "security": {
    "topRisks": ["..."],
    "recommendedFixes": ["..."]
  },
  "devops": {
    "deploymentPlan": ["..."],
    "environmentVariables": ["..."],
    "monitoring": ["..."]
  },
  "marketing": {
    "positioning": "...",
    "launchIdeas": ["..."],
    "seoNotes": ["..."]
  },
  "business": {
    "revenueModel": ["..."],
    "pricingIdeas": ["..."],
    "goToMarket": ["..."]
  },
  "analytics": {
    "northStarMetric": "...",
    "keyMetrics": ["..."],
    "alerts": ["..."]
  },
  "roadmap": [
    { "phase": "...", "duration": "...", "outcome": "..." }
  ],
  "milestones": ["..."],
  "nextActions": ["..."]
}`;
}

const analyzeIdea = async (req, res, next) => {
  try {
    const { idea, audience, goal, budget, timeline, constraints, model } = req.body || {};

    const creditResult = await consumeOneCredit(req.user.id);
    if (!creditResult) {
      return res.status(402).json({
        error: 'Insufficient credits. Please purchase a plan before running AI CTO analysis.',
      });
    }

    const report = await aiGenerator.generateStructuredJson({
      modelName: model || aiGenerator.DEFAULT_MODEL,
      systemPrompt:
        'You are Genesis.ai AI CTO. You analyze startup ideas with product, technical, design, QA, security, DevOps, marketing, business, and analytics thinking. Return JSON only.',
      userPrompt: buildCtoPrompt({ idea, audience, goal, budget, timeline, constraints }),
    });

    return res.json({
      report,
      creditsRemaining: Number(creditResult.credits || 0),
    });
  } catch (err) {
    next(err);
  }
};

export default {
  analyzeIdea,
};