import { GoogleGenerativeAI } from ('@google/generative-ai');
import OpenAI  from ('openai');
import Anthropic from ('@anthropic-ai/sdk');

// Provider clients (initialized lazily based on available keys)
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

// All supported models grouped by provider
const MODEL_CATALOG = {
  google: {
    label: 'Google',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Fast & efficient', envKey: 'GEMINI_API_KEY' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', desc: 'Lightweight & quick', envKey: 'GEMINI_API_KEY' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Balanced speed & quality', envKey: 'GEMINI_API_KEY' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Best Gemini quality', envKey: 'GEMINI_API_KEY' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast & affordable', envKey: 'OPENAI_API_KEY' },
      { id: 'gpt-4o', name: 'GPT-4o', desc: 'Flagship multimodal', envKey: 'OPENAI_API_KEY' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', desc: 'Latest efficient model', envKey: 'OPENAI_API_KEY' },
      { id: 'gpt-4.1', name: 'GPT-4.1', desc: 'Latest flagship model', envKey: 'OPENAI_API_KEY' },
      { id: 'o3-mini', name: 'o3-mini', desc: 'Reasoning, fast', envKey: 'OPENAI_API_KEY' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', desc: 'Fast & compact', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', desc: 'Balanced power', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: 'Latest Sonnet', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', desc: 'Most capable', envKey: 'ANTHROPIC_API_KEY' },
    ],
  },
};

const DEFAULT_MODEL = 'gemini-2.0-flash';

function getModelInfo(modelId) {
  for (const provider of Object.values(MODEL_CATALOG)) {
    const found = provider.models.find((m) => m.id === modelId);
    if (found) return found;
  }
  return null;
}

function getProviderForModel(modelId) {
  for (const [key, provider] of Object.entries(MODEL_CATALOG)) {
    if (provider.models.some((m) => m.id === modelId)) return key;
  }
  return null;
}

function getAvailableModels() {
  const result = {};
  for (const [providerKey, provider] of Object.entries(MODEL_CATALOG)) {
    const available = provider.models.filter((m) => !!process.env[m.envKey]);
    if (available.length > 0) {
      result[providerKey] = { label: provider.label, models: available };
    }
  }
  return result;
}

function getAllAllowedModelIds() {
  const models = getAvailableModels();
  const ids = [];
  for (const provider of Object.values(models)) {
    for (const m of provider.models) ids.push(m.id);
  }
  return ids;
}

function resolveModel(modelName) {
  const allowed = getAllAllowedModelIds();
  if (modelName && allowed.includes(modelName)) return modelName;
  return DEFAULT_MODEL;
}

const SYSTEM_PROMPT = `You are Genesis.ai, an expert full-stack developer AI. You generate complete, production-ready project files based on user prompts.

RULES:
1. Return ONLY valid JSON - no markdown, no code fences, no explanations
2. The JSON must be an object where keys are file paths and values are file contents
3. Generate a complete, working project with proper frontend and backend
4. Include package.json files with all needed dependencies
5. Include proper .gitignore
6. Frontend should use React with Vite and Tailwind CSS
7. Backend should use Express.js with proper routing
8. Include a README.md with setup instructions
9. All code must be clean, well-structured, and production-ready
10. Connect frontend to backend with proper API calls using fetch or axios
11. Include proper error handling and loading states

STACK OPTIONS:
- "react-express": React (Vite) frontend + Express.js backend
- "react-node": React (Vite) frontend + Node.js backend
- "fullstack": Complete PERN stack with PostgreSQL schema

IMPORTANT: Return ONLY the JSON object. No other text.`;

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

// ---- Provider-specific generation ----

async function callGemini(modelId, messages) {
  const client = getGemini();
  if (!client) throw new Error('Gemini API key not configured.');

  const model = client.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  });

  const parts = messages.map((m) => ({ text: m }));
  const result = await model.generateContent(parts);
  return cleanJsonResponse(result.response.text());
}

async function callOpenAI(modelId, systemPrompt, userPrompt) {
  const client = getOpenAI();
  if (!client) throw new Error('OpenAI API key not configured.');

  const params = {
    model: modelId,
    temperature: 0.7,
    max_tokens: 16384,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  // o3-mini uses reasoning and doesn't support temperature or system in the same way
  if (modelId.startsWith('o3')) {
    delete params.temperature;
    delete params.response_format;
  }

  const result = await client.chat.completions.create(params);
  return cleanJsonResponse(result.choices[0].message.content);
}

async function callAnthropic(modelId, systemPrompt, userPrompt) {
  const client = getAnthropic();
  if (!client) throw new Error('Anthropic API key not configured.');

  const result = await client.messages.create({
    model: modelId,
    max_tokens: 16384,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = result.content.map((b) => b.text).join('');
  return cleanJsonResponse(text);
}

async function callModel(modelId, systemPrompt, userPrompt) {
  const provider = getProviderForModel(modelId);

  switch (provider) {
    case 'google':
      return callGemini(modelId, [systemPrompt, userPrompt]);
    case 'openai':
      return callOpenAI(modelId, systemPrompt, userPrompt);
    case 'anthropic':
      return callAnthropic(modelId, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported model: ${modelId}`);
  }
}

// ---- Exports ----

exports.DEFAULT_MODEL = DEFAULT_MODEL;
exports.getAvailableModels = getAvailableModels;

exports.generateProject = async (prompt, stack, modelName) => {
  try {
    const modelId = resolveModel(modelName);

    const userPrompt = `Generate a complete full-stack project with the following requirements:

Stack: ${stack}
Project Description: ${prompt}

Generate all necessary files for both frontend and backend. The frontend files should be under "client/" and backend files under "server/". Include package.json for both, proper configuration, and make sure the frontend connects to the backend API properly.

Return the result as a JSON object where each key is a file path and each value is the file content string.`;

    const content = await callModel(modelId, SYSTEM_PROMPT, userPrompt);
    const files = JSON.parse(content);
    return files;
  } catch (err) {
    console.error('AI Generation error:', err);
    throw new Error('Failed to generate project: ' + err.message);
  }
};

exports.editProject = async (currentFiles, originalPrompt, editPrompt, stack, modelName) => {
  try {
    const modelId = resolveModel(modelName);
    const filesSummary = Object.keys(currentFiles).join('\n');

    const userPrompt = `I have an existing project with these files:
${filesSummary}

Original project description: ${originalPrompt}

Current project files:
${JSON.stringify(currentFiles, null, 2)}

EDIT REQUEST: ${editPrompt}

Apply the requested changes to the project. Return the COMPLETE updated project files as a JSON object (include ALL files, both modified and unmodified). Make sure frontend and backend remain properly connected.`;

    const content = await callModel(modelId, SYSTEM_PROMPT, userPrompt);
    const files = JSON.parse(content);
    return files;
  } catch (err) {
    console.error('AI Edit error:', err);
    throw new Error('Failed to edit project: ' + err.message);
  }
};
