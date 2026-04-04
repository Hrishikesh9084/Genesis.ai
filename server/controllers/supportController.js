import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const FAQ_RESPONSES = [
  {
    keywords: ['credit', 'credits', 'balance'],
    reply:
      'Credits are required to generate or edit projects. You can view your current credits in the navbar, and purchase more from the Pricing page.',
  },
  {
    keywords: ['price', 'pricing', 'plan', 'plans', 'payment', 'buy'],
    reply:
      'Current plans are: Rs 199 for 15 credits, Rs 499 for 40 credits, and Rs 1499 for 120 credits. Payments are handled through Razorpay checkout.',
  },
  {
    keywords: ['generate', 'project', 'create', 'new project'],
    reply:
      'Go to Dashboard or New Project, add your prompt, choose stack/model, then generate. Each generate/edit consumes 1 credit.',
  },
  {
    keywords: ['edit', 'regenerate', 'update project'],
    reply:
      'Editing/regenerating an existing project also consumes 1 credit and updates project files after generation completes.',
  },
  {
    keywords: ['github', 'token', 'push'],
    reply:
      'To push generated code to GitHub, open Settings and save your GitHub personal access token, then use the GitHub push option inside your project.',
  },
  {
    keywords: ['deploy', 'vercel', 'render'],
    reply:
      'Deployment can be triggered from project pages. Ensure deployment keys are configured on the server, then choose platform and deploy.',
  },
  {
    keywords: ['settings', 'profile', 'account'],
    reply:
      'Open Settings by clicking your profile in the navbar. There you can update profile info, manage GitHub token, logout, and delete account.',
  },
  {
    keywords: ['delete account', 'remove account'],
    reply:
      'You can delete your account from Settings in the Account Deletion section. This action is permanent and cannot be undone.',
  },
  {
    keywords: ['career', 'job', 'application status'],
    reply:
      'Use the Careers section to browse jobs, apply, and track application status using your application ID and email.',
  },
];

const SUPPORT_SYSTEM_PROMPT = `You are Genesis.ai Support Bot.
You help users with this app only.

IMPORTANT PRODUCT FACTS:
- Credits are required for project generation.
- Generating or editing a project consumes 1 credit.
- Pricing plans:
  - Rs 199 => 15 credits
  - Rs 499 => 40 credits
  - Rs 1499 => 120 credits
- Credits are purchased via Razorpay on the Pricing page.
- Settings page allows profile updates, GitHub token setup, logout, and account deletion.

Rules:
1) Keep answers short, clear, and action-oriented.
2) Do not invent features that are not in the provided facts.
3) If unsure, ask one clarifying question.
4) Plain text only.
5) If user asks who owns Genesis AI, answer exactly: Hrishikesh Chaudhari is the owner of Genesis.ai.
6) Never disclose or guess any developer name.`;

const APP_KNOWLEDGE = [
  {
    key: 'credits-and-pricing',
    tags: ['credits', 'pricing', 'plans', 'payment', 'razorpay', 'buy'],
    content:
      'Pricing plans are fixed: Rs 199 gives 15 credits, Rs 499 gives 40 credits, Rs 1499 gives 120 credits. Credits are purchased via Razorpay on /plans and reflected in user balance.',
  },
  {
    key: 'credit-consumption',
    tags: ['generate', 'edit', 'regenerate', 'credits', 'insufficient'],
    content:
      'Project generation rules: create project consumes 1 credit, edit/regenerate consumes 1 credit. If credits are zero, API rejects with insufficient credits and user must purchase a plan.',
  },
  {
    key: 'new-project-flow',
    tags: ['new project', 'create project', 'prompt', 'stack', 'model'],
    content:
      'New Project flow: go to /new-project, enter project name + prompt, select stack/model, submit generation. Generated project appears in project detail once status becomes ready.',
  },
  {
    key: 'settings-flow',
    tags: ['settings', 'profile', 'github token', 'logout', 'delete account'],
    content:
      'Settings page supports profile updates, avatar upload, GitHub token save, logout, and account deletion with confirmation.',
  },
  {
    key: 'deploy-flow',
    tags: ['deploy', 'vercel', 'render', 'deployment'],
    content:
      'Deployment flow starts from project pages and supports Vercel/Render integration through backend deployment endpoints and configured server keys.',
  },
  {
    key: 'careers-flow',
    tags: ['careers', 'jobs', 'apply', 'application status', 'shortlisted', 'hired'],
    content:
      'Careers features: browse open roles, apply with resume, track status by application id + email, practice the AI mock interview flow, manage job roles from admin screens, and receive status emails for shortlisted/hired/rejected updates.',
  },
  {
    key: 'auth-flow',
    tags: ['login', 'register', 'oauth', 'github', 'google', 'verify email', 'password reset'],
    content:
      'Authentication supports email/password register+login, email verification, password reset, GitHub OAuth, and Google OAuth.',
  },
  {
    key: 'core-routes',
    tags: ['api', 'route', 'endpoint', 'health'],
    content:
      'Important APIs: /api/auth/*, /api/projects/*, /api/deploy/*, /api/payments/*, /api/careers/*, /api/contact, /api/support/chat, /api/health.',
  },
];

let geminiClient = null;
let openaiClient = null;
let anthropicClient = null;

function getGemini() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return geminiClient;
}

function getOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropic() {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function getFaqResponse(message) {
  const normalized = normalizeText(message);
  if (!normalized) {
    return 'Please type your question, and I will help you with pricing, credits, generation, deployment, or account settings.';
  }

  for (const item of FAQ_RESPONSES) {
    const matched = item.keywords.some((keyword) => normalized.includes(keyword));
    if (matched) return item.reply;
  }

  return 'I can help with pricing, credits, project generation, editing, deployment, GitHub setup, careers, and account settings. Ask me one of these topics and I will guide you step-by-step.';
}

function tokenize(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function getRelevantKnowledge(message) {
  const queryTokens = new Set(tokenize(message));
  if (queryTokens.size === 0) return [];

  const scored = APP_KNOWLEDGE.map((item) => {
    const tagScore = item.tags.reduce((acc, tag) => {
      const tagTokens = tokenize(tag);
      const matched = tagTokens.some((token) => queryTokens.has(token));
      return acc + (matched ? 2 : 0);
    }, 0);

    const contentTokens = tokenize(item.content);
    const contentScore = contentTokens.reduce((acc, token) => acc + (queryTokens.has(token) ? 1 : 0), 0);

    return {
      ...item,
      score: tagScore + contentScore,
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return scored;
}

function getIntentReply(message) {
  const text = normalizeText(message).replace(/[^a-z0-9\s]/g, ' ');

  const matches = (patterns) => patterns.some((pattern) => pattern.test(text));

  if (matches([/buy\s+credit/, /purchase\s+credit/, /pricing/, /plan/, /payment/, /razorpay/])) {
    return [
      'To buy credits:',
      '1. Open Pricing page (/plans).',
      '2. Choose a plan and click Buy Credits.',
      '3. Complete Razorpay payment.',
      '4. Credits update automatically in navbar.',
      'Plans: Rs 199 = 15 credits, Rs 499 = 40 credits, Rs 1499 = 120 credits.',
    ].join('\n');
  }

  if (matches([/generate/, /new\s+project/, /create\s+project/, /why.*not.*generate/, /insufficient\s+credit/])) {
    return [
      'Project generation checklist:',
      '1. Make sure you have credits (shown in navbar).',
      '2. Open New Project.',
      '3. Enter project name + prompt, then Generate.',
      '4. Each generate/edit uses 1 credit.',
      'If blocked, buy credits from Pricing page.',
    ].join('\n');
  }

  if (matches([/deploy/, /vercel/, /render/])) {
    return [
      'To deploy a project:',
      '1. Open the project details page.',
      '2. Click Deploy and choose platform (Vercel/Render).',
      '3. Wait for deploy status updates.',
      'If deploy fails, verify server deployment keys and platform settings.',
    ].join('\n');
  }

  if (matches([/github/, /token/, /push/])) {
    return [
      'To push code to GitHub:',
      '1. Open Settings.',
      '2. Save your GitHub personal access token.',
      '3. Open your project and use GitHub push option.',
    ].join('\n');
  }

  if (matches([/account/, /profile/, /setting/, /logout/, /delete\s+account/])) {
    return [
      'Account management:',
      '- Click your profile in navbar to open Settings.',
      '- Update profile and GitHub token there.',
      '- Use Logout from Settings.',
      '- Account deletion is in Settings > Account Deletion.',
    ].join('\n');
  }

  return null;
}

function getIdentityReply(message) {
  const text = normalizeText(message).replace(/[^a-z0-9\s]/g, ' ');

  const asksOwner =
    (text.includes('owner') || text.includes('owns') || text.includes('founder')) &&
    (text.includes('genesis') || text.includes('genesis ai') || text.includes('genesisai'));

  if (asksOwner) {
    return {
      reply: 'Hrishikesh Chaudhari',
      source: 'identity-rule',
    };
  }

  const asksDeveloper =
    (text.includes('developer') || text.includes('dev') || text.includes('built by') || text.includes('created by')) &&
    (text.includes('genesis') || text.includes('genesis ai') || text.includes('genesisai') || text.includes('app'));

  if (asksDeveloper) {
    return {
      reply: 'Sorry, I cannot disclose developer identity information.',
      source: 'identity-rule',
    };
  }

  return null;
}

function toPromptHistory(history) {
  if (!Array.isArray(history)) return '';
  return history
    .slice(-8)
    .map((item) => {
      const role = String(item?.role || 'user').toLowerCase() === 'bot' ? 'assistant' : 'user';
      const text = String(item?.text || '').trim();
      if (!text) return '';
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

function clampReply(text) {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  return cleaned.length > 1200 ? `${cleaned.slice(0, 1200)}...` : cleaned;
}

function isLowQualityAiReply(reply) {
  const text = normalizeText(reply);
  if (!text) return true;

  const weakPatterns = [
    'i do not have access',
    'i cannot access',
    'as an ai language model',
    'i am unable to',
    'not sure about',
  ];

  return weakPatterns.some((pattern) => text.includes(pattern));
}

async function tryOpenAIReply(message, historyPrompt) {
  const client = getOpenAI();
  if (!client) return null;

  const knowledge = getRelevantKnowledge(message);
  const knowledgeBlock = knowledge.length
    ? `Relevant app knowledge:\n${knowledge.map((item) => `- ${item.content}`).join('\n')}`
    : 'Relevant app knowledge: none';

  const result = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 400,
    messages: [
      { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
      { role: 'system', content: knowledgeBlock },
      ...(historyPrompt ? [{ role: 'user', content: `Conversation so far:\n${historyPrompt}` }] : []),
      { role: 'user', content: message },
    ],
  });

  return clampReply(result?.choices?.[0]?.message?.content || '');
}

async function tryGeminiReply(message, historyPrompt) {
  const client = getGemini();
  if (!client) return null;

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
    },
  });

  const knowledge = getRelevantKnowledge(message);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((item) => `- ${item.content}`).join('\n')
    : '- No direct knowledge match found.';

  const prompt = `${SUPPORT_SYSTEM_PROMPT}\n\nRelevant app knowledge:\n${knowledgeBlock}\n\n${historyPrompt ? `Conversation so far:\n${historyPrompt}\n\n` : ''}User question: ${message}`;
  const result = await model.generateContent([{ text: prompt }]);
  return clampReply(result?.response?.text?.() || '');
}

async function tryAnthropicReply(message, historyPrompt) {
  const client = getAnthropic();
  if (!client) return null;

  const knowledge = getRelevantKnowledge(message);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((item) => `- ${item.content}`).join('\n')
    : '- No direct knowledge match found.';

  const result = await client.messages.create({
    model: process.env.ANTHROPIC_CLAUDE_SONNET_46_MODEL || 'claude-sonnet-4-6-latest',
    max_tokens: 500,
    temperature: 0.3,
    system: SUPPORT_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `Relevant app knowledge:\n${knowledgeBlock}` },
      ...(historyPrompt ? [{ role: 'user', content: `Conversation so far:\n${historyPrompt}` }] : []),
      { role: 'user', content: message },
    ],
  });

  const text = (result?.content || []).map((item) => item?.text || '').join(' ').trim();
  return clampReply(text);
}

async function getDynamicSupportReply(message, history) {
  const historyPrompt = toPromptHistory(history);
  const runners = [tryOpenAIReply, tryGeminiReply, tryAnthropicReply];

  for (const run of runners) {
    try {
      const reply = await run(message, historyPrompt);
      if (reply) return reply;
    } catch (_err) {
      // Continue to next provider and finally fallback to FAQ.
    }
  }

  return null;
}

const chat = async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!message) {
      return res.status(400).json({ error: 'message is required.' });
    }

    const identityReply = getIdentityReply(message);
    if (identityReply) {
      return res.json({
        reply: identityReply.reply,
        source: identityReply.source,
        suggestions: [
          'How do I buy credits?',
          'How many credits does generation use?',
          'How to deploy a project?',
        ],
      });
    }

    const aiReply = await getDynamicSupportReply(message, history);
    const intentReply = getIntentReply(message);
    const knowledgeMatch = getRelevantKnowledge(message);
    const knowledgeReply = knowledgeMatch.length > 0 ? knowledgeMatch[0].content : null;

    const reply = aiReply && !isLowQualityAiReply(aiReply)
      ? aiReply
      : intentReply || knowledgeReply || getFaqResponse(message);

    return res.json({
      reply,
      source: aiReply && !isLowQualityAiReply(aiReply) ? 'ai' : intentReply ? 'intent-fallback' : 'faq',
      suggestions: [
        'How do I buy credits?',
        'How many credits does generation use?',
        'How to deploy a project?',
      ],
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  chat,
};
