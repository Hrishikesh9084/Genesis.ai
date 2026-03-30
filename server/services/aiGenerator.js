import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI  from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Provider clients (initialized lazily based on available keys)
let geminiClient = null;
let openaiClient = null;
let anthropicClient = null;
let mistralClient = null;
let xaiClient = null;

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

function getMistral() {
  if (!mistralClient && process.env.MISTRAL_API_KEY) {
    mistralClient = new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
    });
  }
  return mistralClient;
}

function getXAI() {
  if (!xaiClient && process.env.XAI_API_KEY) {
    xaiClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
    });
  }
  return xaiClient;
}

// All supported models grouped by provider
const MODEL_CATALOG = {
  google: {
    label: 'Google',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Fast & efficient', envKey: 'GEMINI_API_KEY' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', desc: 'Lightweight & quick', envKey: 'GEMINI_API_KEY' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Balanced speed and quality', envKey: 'GEMINI_API_KEY' },
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
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Newest Sonnet release', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', desc: 'Latest Sonnet', envKey: 'ANTHROPIC_API_KEY' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', desc: 'Most capable', envKey: 'ANTHROPIC_API_KEY' },
    ],
  },
  mistral: {
    label: 'Mistral',
    models: [
      { id: 'mistral-small-latest', name: 'Mistral Small', desc: 'Fast and efficient', envKey: 'MISTRAL_API_KEY' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', desc: 'Balanced quality', envKey: 'MISTRAL_API_KEY' },
      { id: 'mistral-large-latest', name: 'Mistral Large', desc: 'Most capable Mistral', envKey: 'MISTRAL_API_KEY' },
    ],
  },
  xai: {
    label: 'Grok (xAI)',
    models: [
      { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Fast Grok model', envKey: 'XAI_API_KEY' },
      { id: 'grok-3', name: 'Grok 3', desc: 'Most capable Grok model', envKey: 'XAI_API_KEY' },
    ],
  },
};

const DEFAULT_MODEL = 'gemini-2.5-pro';

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
    result[providerKey] = {
      label: provider.label,
      models: provider.models.map(({ id, name, desc }) => ({ id, name, desc })),
    };
  }
  return result;
}

function getAllAllowedModelIds() {
  const ids = [];
  for (const provider of Object.values(MODEL_CATALOG)) {
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
12. Frontend and backend MUST be connected and runnable locally without extra manual fixes
13. Frontend must call backend APIs via '/api' paths (not hardcoded localhost URLs)
14. Backend must expose GET /api/health route returning { status: "ok" }

STACK OPTIONS:
- "nextjs-express": Next.js frontend + Express.js backend
- "react-express": React (Vite) frontend + Express.js backend
- "react-node": React (Vite) frontend + Node.js backend
- "vue-node": Vue frontend + Node.js backend
- "nuxt-express": Nuxt frontend + Express.js backend
- "sveltekit-node": SvelteKit frontend + Node.js backend
- "astro-express": Astro frontend + Express.js backend
- "fullstack": Complete PERN stack with PostgreSQL schema

IMPORTANT: Return ONLY the JSON object. No other text.`;

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function extractJsonObject(text) {
  const cleaned = cleanJsonResponse(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract the largest top-level JSON object block.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Model response did not contain a JSON object.');
    }
    const maybeJson = cleaned.slice(start, end + 1);
    return JSON.parse(maybeJson);
  }
}

function isLikelyTruncatedJson(text) {
  const cleaned = cleanJsonResponse(text);
  if (!cleaned.startsWith('{')) return true;
  if (!cleaned.endsWith('}')) return true;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const ch of cleaned) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth < 0) return true;
  }

  return inString || depth !== 0;
}

function normalizeFilesMap(rawFiles) {
  const maybeNested = rawFiles?.files && typeof rawFiles.files === 'object' ? rawFiles.files : rawFiles;
  if (!maybeNested || typeof maybeNested !== 'object' || Array.isArray(maybeNested)) {
    throw new Error('Generated payload must be a JSON object of files.');
  }

  const normalized = {};
  for (const [rawPath, rawContent] of Object.entries(maybeNested)) {
    if (!rawPath || typeof rawPath !== 'string') continue;

    const safePath = rawPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '')
      .trim();

    if (!safePath || safePath.includes('..')) continue;
    if (safePath.endsWith('/')) continue;

    normalized[safePath] =
      typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);
  }

  return normalized;
}

function fallbackClientPackage() {
  return JSON.stringify(
    {
      name: 'client',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        vite: '^5.2.0',
        '@vitejs/plugin-react': '^4.2.1',
      },
    },
    null,
    2
  );
}

function fallbackServerPackage() {
  return JSON.stringify(
    {
      name: 'server',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'node index.js',
        start: 'node index.js',
      },
      dependencies: {
        cors: '^2.8.5',
        express: '^4.21.0',
      },
    },
    null,
    2
  );
}

function ensureCoreFiles(files, prompt) {
  const output = { ...files };
  const hasClient = Object.keys(output).some((p) => p.startsWith('client/'));
  const hasServer = Object.keys(output).some((p) => p.startsWith('server/'));

  if (!hasClient || !hasServer) {
    throw new Error('Generated project must contain both client/ and server/ files.');
  }

  if (!output['client/package.json']) {
    output['client/package.json'] = fallbackClientPackage();
  }
  if (!output['server/package.json']) {
    output['server/package.json'] = fallbackServerPackage();
  }

  // Drop generated dependency/build artifacts that commonly break previews.
  for (const filePath of Object.keys(output)) {
    if (
      filePath.startsWith('client/node_modules/') ||
      filePath.startsWith('server/node_modules/') ||
      filePath.startsWith('client/dist/') ||
      filePath.startsWith('server/dist/') ||
      filePath.startsWith('client/.next/') ||
      filePath.startsWith('server/.next/') ||
      filePath.startsWith('client/.nuxt/') ||
      filePath.startsWith('server/.nuxt/') ||
      filePath.startsWith('client/.svelte-kit/') ||
      filePath.startsWith('server/.svelte-kit/') ||
      filePath.endsWith('package-lock.json') ||
      filePath.endsWith('pnpm-lock.yaml') ||
      filePath.endsWith('yarn.lock')
    ) {
      delete output[filePath];
    }
  }

  if (!output['server/index.js']) {
    output['server/index.js'] = `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/echo', (req, res) => {
  res.json({ reply: req.body?.message || 'Hello from backend' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
`;
  }

  if (!output['client/index.html']) {
    output['client/index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
  }

  if (!output['client/src/main.jsx']) {
    output['client/src/main.jsx'] = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);
`;
  }

  if (!output['client/src/App.jsx']) {
    output['client/src/App.jsx'] = `import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState('Checking backend...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status === 'ok' ? 'Backend connected' : 'Backend unavailable'))
      .catch(() => setHealth('Backend unavailable'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Generated Application</h1>
      <p>Prompt: ${JSON.stringify(prompt)}</p>
      <p>{health}</p>
    </main>
  );
}
`;
  }

  if (!output['client/vite.config.js']) {
    output['client/vite.config.js'] = `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});
`;
  }

  if (!output['README.md']) {
    output['README.md'] = `# Generated Project

## Run locally

1. Install and start backend
   - cd server
   - npm install
   - npm run dev

2. Install and start frontend
   - cd client
   - npm install
   - npm run dev
`;
  }

  try {
    const clientPkg = JSON.parse(output['client/package.json']);
    clientPkg.name = clientPkg.name || 'client';
    clientPkg.private = true;
    clientPkg.version = clientPkg.version || '1.0.0';
    clientPkg.type = clientPkg.type || 'module';
    clientPkg.scripts = clientPkg.scripts || {};
    if (!clientPkg.scripts.dev) clientPkg.scripts.dev = 'vite';
    if (!clientPkg.scripts.build) clientPkg.scripts.build = 'vite build';
    if (!clientPkg.scripts.preview) clientPkg.scripts.preview = 'vite preview';
    clientPkg.dependencies = clientPkg.dependencies || {};
    if (!clientPkg.dependencies.react) clientPkg.dependencies.react = '^18.2.0';
    if (!clientPkg.dependencies['react-dom']) clientPkg.dependencies['react-dom'] = '^18.2.0';
    clientPkg.devDependencies = clientPkg.devDependencies || {};
    if (!clientPkg.devDependencies.vite) clientPkg.devDependencies.vite = '^5.2.0';
    output['client/package.json'] = JSON.stringify(clientPkg, null, 2);
  } catch {
    output['client/package.json'] = fallbackClientPackage();
  }

  try {
    const serverPkg = JSON.parse(output['server/package.json']);
    serverPkg.name = serverPkg.name || 'server';
    serverPkg.version = serverPkg.version || '1.0.0';
    serverPkg.type = serverPkg.type || 'module';
    serverPkg.scripts = serverPkg.scripts || {};
    if (!serverPkg.scripts.start && !serverPkg.scripts.dev) {
      serverPkg.scripts.start = 'node index.js';
    }
    serverPkg.dependencies = serverPkg.dependencies || {};
    if (!serverPkg.dependencies.express) serverPkg.dependencies.express = '^4.21.0';
    if (!serverPkg.dependencies.cors) serverPkg.dependencies.cors = '^2.8.5';
    output['server/package.json'] = JSON.stringify(serverPkg, null, 2);
  } catch {
    output['server/package.json'] = fallbackServerPackage();
  }

  if (typeof output['server/index.js'] === 'string' && !output['server/index.js'].includes('/api/health')) {
    output['server/index.js'] += `

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
`;
  }

  return output;
}

function parseAndValidateFiles(content, prompt) {
  const json = extractJsonObject(content);
  const normalized = normalizeFilesMap(json);
  return ensureCoreFiles(normalized, prompt);
}

async function generateWithModel(modelId, userPrompt, promptForFallback) {
  const strictUserPrompt = `${userPrompt}

CRITICAL OUTPUT RULES:
- Output must be a single valid JSON object only.
- Do not wrap in markdown.
- Do not include explanatory text.
- Keep implementation concise and working over feature breadth.
- Do not include node_modules, dist, build output, or lock files.`;

  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const content = await callModel(modelId, SYSTEM_PROMPT, strictUserPrompt);
      const files = parseAndValidateFiles(content, promptForFallback);
      return files;
    } catch (err) {
      lastErr = err;
      if (attempt < 3 && isLikelyTruncatedJson(err?.message ? String(err.message) : '')) {
        continue;
      }
    }
  }

  throw lastErr || new Error('Generation failed.');
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

  const resolvedModelId =
    modelId === 'claude-sonnet-4-6'
      ? (process.env.ANTHROPIC_CLAUDE_SONNET_46_MODEL || 'claude-sonnet-4-6-latest')
      : modelId;

  const result = await client.messages.create({
    model: resolvedModelId,
    max_tokens: 16384,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = result.content.map((b) => b.text).join('');
  return cleanJsonResponse(text);
}

async function callMistral(modelId, systemPrompt, userPrompt) {
  const client = getMistral();
  if (!client) throw new Error('Mistral API key not configured.');

  const result = await client.chat.completions.create({
    model: modelId,
    temperature: 0.7,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return cleanJsonResponse(result.choices[0].message.content || '');
}

async function callXAI(modelId, systemPrompt, userPrompt) {
  const client = getXAI();
  if (!client) throw new Error('xAI API key not configured.');

  const result = await client.chat.completions.create({
    model: modelId,
    temperature: 0.7,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return cleanJsonResponse(result.choices[0].message.content || '');
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
    case 'mistral':
      return callMistral(modelId, systemPrompt, userPrompt);
    case 'xai':
      return callXAI(modelId, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported model: ${modelId}`);
  }
}

// ---- Exports ----

const generateProject = async (prompt, stack, modelName) => {
  try {
    const modelId = resolveModel(modelName);

    const userPrompt = `Generate a complete full-stack project with the following requirements:

Stack: ${stack}
Project Description: ${prompt}

Generate all necessary files for both frontend and backend. The frontend files should be under "client/" and backend files under "server/". Include package.json for both, proper configuration, and make sure the frontend connects to the backend API properly.

Return the result as a JSON object where each key is a file path and each value is the file content string.`;

    try {
      return await generateWithModel(modelId, userPrompt, prompt);
    } catch (primaryErr) {
      // Fallback to default model if a non-default model repeatedly fails.
      if (modelId !== DEFAULT_MODEL) {
        return await generateWithModel(DEFAULT_MODEL, userPrompt, prompt);
      }
      throw primaryErr;
    }
  } catch (err) {
    console.error('AI Generation error:', err);
    throw new Error('Failed to generate project: ' + err.message);
  }
};

const editProject = async (currentFiles, originalPrompt, editPrompt, stack, modelName) => {
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

    try {
      return await generateWithModel(modelId, userPrompt, originalPrompt);
    } catch (primaryErr) {
      if (modelId !== DEFAULT_MODEL) {
        return await generateWithModel(DEFAULT_MODEL, userPrompt, originalPrompt);
      }
      throw primaryErr;
    }
  } catch (err) {
    console.error('AI Edit error:', err);
    throw new Error('Failed to edit project: ' + err.message);
  }
};

const aiGenerator = {
  DEFAULT_MODEL,
  getAvailableModels,
  generateProject,
  editProject,
};

export { DEFAULT_MODEL, getAvailableModels, generateProject, editProject };
export default aiGenerator;
