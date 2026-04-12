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

const DEFAULT_MODEL = 'gemini-2.5-pro'
;

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

const SYSTEM_PROMPT = `You are Genesis.ai — a world-class full-stack developer AI that produces PRODUCTION-GRADE, POLISHED software indistinguishable from products built by top engineering teams. Every app you generate must look, feel, and function like a real SaaS product ready for paying customers.

OUTPUT FORMAT:
1. Return ONLY valid JSON — no markdown, no code fences, no explanations
2. Keys = file paths, values = complete file contents
3. Return ONLY the JSON object. No other text.

═══════════════════════════════════════
UI/UX DESIGN QUALITY (THIS IS CRITICAL)
═══════════════════════════════════════
1. TYPOGRAPHY: Use Inter or system-ui font stack. Clean hierarchy — large bold headings (text-3xl/4xl font-bold), medium subheadings (text-lg text-gray-600), readable body text (text-sm/base)
2. COLOR SYSTEM: Use a cohesive, professional palette. Primary color with 50-900 shades (e.g. indigo, violet, blue). NO plain red/blue/green. Use subtle backgrounds (gray-50, slate-50), card backgrounds (white with shadow-sm), and accent gradients
3. CARDS & CONTAINERS: Rounded corners (rounded-xl), subtle shadows (shadow-sm hover:shadow-md transition-shadow), clean borders (border border-gray-200), proper padding (p-6)
4. ANIMATIONS & TRANSITIONS: Add transition-all duration-200 on interactive elements. Hover effects on cards (hover:shadow-lg hover:-translate-y-0.5). Button hover states (hover:bg-primary-700). Smooth page transitions. Loading spinners with animate-spin
5. BUTTONS: Rounded (rounded-lg), proper padding (px-4 py-2.5), font-medium, transition colors, focus:ring-2 focus:ring-offset-2. Primary (bg-indigo-600 text-white hover:bg-indigo-700), Secondary (bg-white border border-gray-300 hover:bg-gray-50), Danger (bg-red-600 text-white hover:bg-red-700)
6. FORMS: Clean labels above inputs, rounded inputs with borders (rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500), helpful placeholder text, inline validation with red/green indicators, proper spacing (space-y-4)
7. NOTIFICATIONS: Use react-hot-toast for success/error/info toasts. Include toast({ success: green, error: red }) on all user actions (create, update, delete, login, register)
8. LOADING STATES: Skeleton loading placeholders for lists (animated pulse bars), centered spinners for page loads, disabled buttons with spinner while submitting
9. EMPTY STATES: Friendly illustrations or icons with helpful messages ("No items yet. Create your first one!" with a CTA button)
10. ERROR STATES: Clear error messages with retry buttons, form validation errors inline below inputs
11. NAVIGATION: Clean sidebar or top navbar with active state indicators, mobile hamburger menu, user avatar/dropdown for auth
12. RESPONSIVE: Mobile-first. Grid layouts (grid-cols-1 md:grid-cols-2 lg:grid-cols-3). Stack on mobile, side-by-side on desktop. Proper padding on all screen sizes
13. TABLES: Clean data tables with hover rows (hover:bg-gray-50), proper headers, pagination controls below
14. MODALS: Backdrop blur, centered, rounded-2xl, proper close button, animate entrance
15. BADGES & STATUS: Colored badges for statuses (bg-green-100 text-green-800 for active, bg-yellow-100 text-yellow-800 for pending)

═══════════════════════════════════════
BACKEND ARCHITECTURE (MANDATORY)
═══════════════════════════════════════
1. Layered architecture: routes → controllers → services → models (SEPARATE files per resource)
2. Centralized error handler middleware (server/middleware/errorHandler.js)
3. Async handler wrapper (server/middleware/asyncHandler.js)
4. Config module (server/config/) for environment variables
5. Input validation middleware
6. Proper HTTP status codes (200, 201, 400, 401, 404, 409, 500)
7. Database layer:
   - "fullstack" or "PERN" stacks: PostgreSQL with pg driver + schema SQL
   - All other stacks: SQLite via better-sqlite3 with db.js connection + schema init
   - ALL data persisted in database — NO in-memory arrays
   - Include seed data or initial schema
8. .env and .env.example with all needed variables
9. Security: helmet, cors, morgan, compression, express-rate-limit
10. Proper .gitignore

═══════════════════════════════════════
FRONTEND ARCHITECTURE (MANDATORY)
═══════════════════════════════════════
1. Component-based architecture: components/, pages/, services/, context/, hooks/ directories
2. API service layer (client/src/services/api.js) using axios with interceptors for auth tokens and error handling
3. Every page handles: loading (skeleton), error (retry), empty (CTA) states
4. React Router with nested layouts, protected route wrapper, 404 page
5. Tailwind CSS — professional, modern, polished design
6. React Context for auth state (AuthContext with login/register/logout)
7. Custom hooks for data fetching (useApi pattern with loading/error/data)
8. Reusable components: Button, Input, Card, Modal, Badge, LoadingSpinner, EmptyState, Pagination
9. react-hot-toast for all user action feedback
10. Client-side form validation with clear error messages

═══════════════════════════════════════
BUSINESS LOGIC (MANDATORY)
═══════════════════════════════════════
1. At LEAST 2-3 real CRUD features end-to-end (UI → API → DB → response)
2. User authentication: register, login, JWT tokens, protected routes, logout
3. NO placeholder data or TODO stubs
4. Pagination for list endpoints (page, limit, total count)
5. Search/filter functionality
6. Proper data relationships (foreign keys, user ownership)

═══════════════════════════════════════
CONNECTIVITY & DOCS
═══════════════════════════════════════
1. Frontend calls backend via '/api' paths (no hardcoded localhost)
2. Backend GET /api/health returns { status: "ok" }
3. Vite proxy for /api → backend
4. Comprehensive README.md with features, tech stack, setup, API docs, folder structure

STACK OPTIONS:
- "nextjs-express": Next.js + Express.js
- "react-express": React (Vite) + Express.js
- "react-node": React (Vite) + Node.js
- "vue-node": Vue + Node.js
- "nuxt-express": Nuxt + Express.js
- "sveltekit-node": SvelteKit + Node.js
- "astro-express": Astro + Express.js
- "fullstack": PERN (PostgreSQL + Express + React + Node.js)`;

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  // Sanitize control characters that break JSON.parse (tabs/newlines inside string values).
  // Replace raw control chars (except \n, \r, \t) with spaces, then fix unescaped newlines/tabs inside strings.
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
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
        'react-router-dom': '^6.22.0',
        axios: '^1.6.7',
        'lucide-react': '^0.344.0',
        'react-hot-toast': '^2.4.1',
        'clsx': '^2.1.0',
      },
      devDependencies: {
        vite: '^5.2.0',
        '@vitejs/plugin-react': '^4.2.1',
        tailwindcss: '^3.4.1',
        postcss: '^8.4.35',
        autoprefixer: '^10.4.17',
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
        dev: 'node --watch index.js',
        start: 'node index.js',
      },
      dependencies: {
        cors: '^2.8.5',
        express: '^4.21.0',
        helmet: '^7.1.0',
        morgan: '^1.10.0',
        compression: '^1.7.4',
        'express-rate-limit': '^7.1.5',
        'better-sqlite3': '^11.3.0',
        dotenv: '^16.4.5',
        jsonwebtoken: '^9.0.2',
        bcryptjs: '^2.4.3',
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
    output['server/index.js'] = `import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & performance middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' || 'https://genesis-ai-azure.vercel.app', credentials: true }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Import and mount your route files here
// import itemRoutes from './routes/items.js';
// app.use('/api/items', itemRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT} in \${process.env.NODE_ENV || 'development'} mode\`);
});

export default app;
`;
  }

  if (!output['client/index.html']) {
    output['client/index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <title>Generated App</title>
  </head>
  <body class="font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
  }

  if (!output['client/src/main.jsx']) {
    output['client/src/main.jsx'] = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: { borderRadius: '12px', background: '#1f2937', color: '#f9fafb', fontSize: '14px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
      }}
    />
  </React.StrictMode>
);
`;
  }

  // Ensure index.css with Tailwind directives and base styles
  if (!output['client/src/index.css']) {
    output['client/src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    @apply bg-gray-50 text-gray-900 antialiased;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2;
  }
  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2;
  }
  .input-field {
    @apply block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors duration-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500;
  }
  .card {
    @apply rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md;
  }
}
`;
  }

  // Ensure tailwind.config.js
  if (!output['client/tailwind.config.js']) {
    output['client/tailwind.config.js'] = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
`;
  }

  // Ensure postcss.config.js
  if (!output['client/postcss.config.js']) {
    output['client/postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  if (!output['client/src/App.jsx']) {
    output['client/src/App.jsx'] = `import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="text-xl font-bold text-indigo-600">App</Link>
            <div className="flex gap-4">
              <Link to="/" className="text-gray-700 hover:text-indigo-600 transition">Home</Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

function Home() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => { if (!r.ok) throw new Error('Backend unavailable'); return r.json(); })
      .then((d) => { setHealth(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (error) return <div className="text-center py-20"><p className="text-red-500 mb-4">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Retry</button></div>;

  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Your App</h1>
      <p className="text-gray-600 mb-2">Backend Status: <span className="text-green-600 font-semibold">{health?.status === 'ok' ? 'Connected' : 'Unavailable'}</span></p>
      <p className="text-sm text-gray-400">Start building your features!</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
`;
  }

  if (!output['client/vite.config.js']) {
    output['client/vite.config.js'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
`;
  }

  // Ensure API service layer exists
  if (!output['client/src/services/api.js']) {
    output['client/src/services/api.js'] = `import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
`;
  }

  // Ensure .env.example exists for documentation
  if (!output['server/.env.example']) {
    output['server/.env.example'] = `PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=./database.db
CLIENT_URL=http://localhost:5173 || 'https://genesis-ai-azure.vercel.app'
`;
  }

  // Ensure .gitignore exists
  if (!output['.gitignore']) {
    output['.gitignore'] = `node_modules/
dist/
build/
.env
*.db
*.sqlite
.DS_Store
*.log
coverage/
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

function buildPreviewSkeleton(prompt) {
  return ensureCoreFiles(
    {
      'client/package.json': fallbackClientPackage(),
      'server/package.json': fallbackServerPackage(),
    },
    prompt
  );
}

function parseAndValidateFiles(content, prompt) {
  const json = extractJsonObject(content);
  const normalized = normalizeFilesMap(json);
  return ensureCoreFiles(normalized, prompt);
}

// ---- Continuation for truncated responses ----

async function continueJsonResponse(modelId, partialJson) {
  // Only send the last ~3000 chars as context — sending 85K+ chars causes the LLM
  // to return malformed JSON. The model only needs the tail to know where to continue.
  const tailLength = 3000;
  const tail = partialJson.length > tailLength
    ? '... (earlier content omitted) ...\n' + partialJson.slice(-tailLength)
    : partialJson;

  const continuationPrompt = `The previous response was truncated. Here is the END of the partial JSON output so far:

${tail}

Please CONTINUE the JSON output from EXACTLY where it was cut off. Do NOT repeat any content that was already generated. Output ONLY the remaining JSON content to complete the object. Do not wrap in markdown.`;

  const systemContinue = `You are continuing a truncated JSON response. Output ONLY the remaining JSON content. Do NOT repeat any already-generated content. Do NOT add markdown or explanations.`;

  const continuation = await callModel(modelId, systemContinue, continuationPrompt);
  return cleanJsonResponse(continuation);
}

function mergeJsonParts(part1, part2) {
  // Remove trailing incomplete data from part1 and leading incomplete data from part2
  let merged = part1.trimEnd();
  let rest = part2.trim();

  // If part1 ends abruptly (no closing brace), try to splice
  if (!merged.endsWith('}')) {
    // Find the last complete key-value pair
    const lastComma = merged.lastIndexOf(',');
    const lastColon = merged.lastIndexOf(':');
    const lastCloseBrace = merged.lastIndexOf('}');
    const lastCloseQuote = merged.lastIndexOf('"');

    // If we're mid-value, trim back to last comma
    if (lastComma > lastCloseBrace && lastComma > 0) {
      merged = merged.slice(0, lastComma);
    }
  }

  // Remove opening brace from continuation if present
  if (rest.startsWith('{')) {
    rest = rest.slice(1);
  }
  // Remove closing brace from part1 if present at the end
  if (merged.endsWith('}')) {
    merged = merged.slice(0, -1);
  }

  // Ensure proper comma separation
  const trimmedMerged = merged.trimEnd();
  const trimmedRest = rest.trimStart();
  if (trimmedRest && !trimmedMerged.endsWith(',') && !trimmedRest.startsWith(',') && !trimmedRest.startsWith('}')) {
    merged = trimmedMerged + ',';
  } else {
    merged = trimmedMerged;
  }

  const result = merged + '\n' + rest;

  // Ensure it ends with }
  if (!result.trimEnd().endsWith('}')) {
    return result.trimEnd() + '\n}';
  }
  return result;
}

async function generateWithModel(modelId, userPrompt, promptForFallback) {
  const strictUserPrompt = `${userPrompt}

CRITICAL OUTPUT RULES:
- Output must be a single valid JSON object only.
- Do not wrap in markdown.
- Do not include explanatory text.
- Generate COMPLETE, FULL file contents for every file. Do not truncate or summarize code.
- Prioritize generating complete, working code over adding more features.
- Do not include node_modules, dist, build output, or lock files.`;

  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const content = await callModel(modelId, SYSTEM_PROMPT, strictUserPrompt);

      // Check if response was truncated
      if (isLikelyTruncatedJson(content)) {
        console.log(`[aiGenerator] Response truncated on attempt ${attempt}, trying continuation...`);
        try {
          const continuation = await continueJsonResponse(modelId, content);
          const merged = mergeJsonParts(content, continuation);

          // If still truncated after one continuation, try one more
          if (isLikelyTruncatedJson(merged)) {
            const continuation2 = await continueJsonResponse(modelId, merged);
            const merged2 = mergeJsonParts(merged, continuation2);
            const files = parseAndValidateFiles(merged2, promptForFallback);
            return files;
          }

          const files = parseAndValidateFiles(merged, promptForFallback);
          return files;
        } catch (contErr) {
          console.warn(`[aiGenerator] Continuation failed: ${contErr.message}`);
          // Fall through to retry
        }
      } else {
        const files = parseAndValidateFiles(content, promptForFallback);
        return files;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[aiGenerator] Attempt ${attempt} failed: ${err.message}`);
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
      maxOutputTokens: 1000000,
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
    max_tokens: 65536,
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
    max_tokens: 64000,
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
    max_tokens: 32768,
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
    max_tokens: 32768,
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

// ---- Two-phase generation for large apps ----

async function generateProjectInPhases(modelId, prompt, stack) {
  console.log(`[aiGenerator] Starting two-phase generation for large app...`);

  // Phase 1: Generate backend
  const backendPrompt = `Generate ONLY the BACKEND part of a production-grade full-stack project.

Stack: ${stack}
Project Description: ${prompt}

Generate ONLY files under "server/" directory. This must be REAL production-quality backend code:
1. server/package.json with ALL dependencies (express, cors, helmet, morgan, compression, express-rate-limit, better-sqlite3 or pg, dotenv, jsonwebtoken, bcryptjs)
2. server/index.js - Production Express app with full middleware stack
3. server/config/db.js - Database connection with schema initialization and seed data
4. server/middleware/errorHandler.js - Centralized error handler with proper status codes
5. server/middleware/asyncHandler.js - Async wrapper
6. server/middleware/auth.js - JWT authentication middleware
7. server/routes/ - One route file per resource, clean RESTful endpoints
8. server/controllers/ - One controller per resource, input validation, proper responses
9. server/services/ - Business logic per resource, database queries, pagination
10. server/.env.example - All required environment variables documented
11. Full JWT auth flow (register with password hashing, login with token generation, protected routes)
12. ALL data persisted in database with proper schema (CREATE TABLE statements)
13. Pagination (page, limit, offset) for all list endpoints
14. Search/filter functionality

Return ONLY a JSON object where keys are file paths (starting with "server/") and values are COMPLETE file contents.`;

  console.log('[aiGenerator] Phase 1: Generating backend...');
  const backendContent = await callModel(modelId, SYSTEM_PROMPT, backendPrompt);
  let backendFiles;
  try {
    if (isLikelyTruncatedJson(backendContent)) {
      const contd = await continueJsonResponse(modelId, backendContent);
      backendFiles = extractJsonObject(mergeJsonParts(backendContent, contd));
    } else {
      backendFiles = extractJsonObject(backendContent);
    }
  } catch (e) {
    console.warn('[aiGenerator] Phase 1 parse failed:', e.message);
    throw e;
  }

  // Phase 2: Generate frontend
  const backendFileList = Object.keys(backendFiles).join('\n');
  const frontendPrompt = `Generate ONLY the FRONTEND part of a PRODUCTION-GRADE full-stack project. The UI must look like a REAL SaaS product — polished, professional, beautiful.

Stack: ${stack}
Project Description: ${prompt}

The backend already exists with these files:
${backendFileList}

Generate ONLY files under "client/" directory. This must be PREMIUM UI quality:

PACKAGE & CONFIG:
1. client/package.json with ALL dependencies (react, react-dom, react-router-dom, axios, lucide-react, react-hot-toast, clsx, tailwindcss, postcss, autoprefixer, @vitejs/plugin-react)
2. client/index.html with Inter font from Google Fonts
3. client/vite.config.js with react plugin and /api proxy
4. client/tailwind.config.js with Inter font family
5. client/postcss.config.js

SOURCE FILES:
6. client/src/index.css with @tailwind directives AND custom component classes (btn-primary, btn-secondary, input-field, card)
7. client/src/main.jsx with React.StrictMode and react-hot-toast Toaster (dark themed toasts)
8. client/src/App.jsx with React Router, Layout component (clean navbar with active states), and all routes
9. client/src/services/api.js - Axios with auth interceptors
10. client/src/context/AuthContext.jsx - Auth state management

PAGES (each with loading skeleton, error state with retry, empty state with CTA):
11. client/src/pages/ - Login, Register, Dashboard, and pages for each CRUD feature
12. Beautiful login/register forms with validation, branded design
13. Dashboard with stats cards, recent activity

COMPONENTS:
14. client/src/components/ - Button, Input, Card, Modal, Badge, LoadingSpinner, EmptyState, Pagination, ProtectedRoute
15. All buttons use rounded-lg, proper padding, hover/focus states, transitions
16. Cards use rounded-xl, shadow-sm, hover:shadow-md, border-gray-200
17. Use lucide-react icons throughout
18. react-hot-toast on all user actions (create, update, delete, login, etc.)

Also include: README.md (features, tech stack, setup, API docs), .gitignore

Return ONLY a JSON object where keys are file paths and values are COMPLETE file contents.`;

  console.log('[aiGenerator] Phase 2: Generating frontend...');
  const frontendContent = await callModel(modelId, SYSTEM_PROMPT, frontendPrompt);
  let frontendFiles;
  try {
    if (isLikelyTruncatedJson(frontendContent)) {
      const contd = await continueJsonResponse(modelId, frontendContent);
      frontendFiles = extractJsonObject(mergeJsonParts(frontendContent, contd));
    } else {
      frontendFiles = extractJsonObject(frontendContent);
    }
  } catch (e) {
    console.warn('[aiGenerator] Phase 2 parse failed:', e.message);
    throw e;
  }

  // Merge both phases
  const mergedFiles = { ...normalizeFilesMap(backendFiles), ...normalizeFilesMap(frontendFiles) };
  console.log(`[aiGenerator] Two-phase generation complete: ${Object.keys(mergedFiles).length} files`);
  return ensureCoreFiles(mergedFiles, prompt);
}

const generateProject = async (prompt, stack, modelName) => {
  try {
    const modelId = resolveModel(modelName);

    const userPrompt = `Generate a PRODUCTION-GRADE, POLISHED full-stack project that looks and works like a real SaaS product.

Stack: ${stack}
Project Description: ${prompt}

QUALITY BAR — The app must look like it was built by a professional team:

BACKEND (server/ directory):
1. Layered architecture: routes/ → controllers/ → services/ (separate files per resource)
2. Real database (better-sqlite3 or PostgreSQL) with schema, seed data, NO in-memory arrays
3. JWT auth (register with bcrypt, login with token, auth middleware for protected routes)
4. Error handler middleware, async handler wrapper
5. helmet, cors, morgan, compression, rate-limit
6. Pagination (page, limit) for list endpoints, search/filter
7. .env.example with all variables documented

FRONTEND (client/ directory) — PREMIUM UI QUALITY:
1. Inter font (Google Fonts), Tailwind CSS with custom component classes
2. Cohesive color palette (indigo/violet primary with proper shade usage)
3. Cards: rounded-xl, shadow-sm, hover:shadow-md, border-gray-200, transitions
4. Buttons: rounded-lg, proper padding, font-medium, hover/focus states with ring
5. Forms: clean labels, rounded inputs, focus:ring, inline validation, proper spacing
6. react-hot-toast for ALL user actions (create/update/delete/login/register)
7. Loading: skeleton pulse for lists, spinner for pages, disabled+spinner on button submit
8. Empty states: icon + message + CTA button
9. Error states: message + retry button
10. React Router with Layout, protected routes, 404 page
11. AuthContext for login state management
12. API service layer with axios interceptors
13. lucide-react icons throughout
14. Responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
15. At least 2-3 COMPLETE CRUD features end-to-end

Include: package.json with ALL deps, README.md, .gitignore
IMPORTANT: Generate COMPLETE file contents. Do NOT truncate or leave placeholders.

Return as JSON object: keys = file paths, values = complete file content strings.`;

    try {
      // First try: single-pass generation with continuation support
      return await generateWithModel(modelId, userPrompt, prompt);
    } catch (primaryErr) {
      console.warn(`[aiGenerator] Single-pass failed: ${primaryErr.message}. Trying two-phase generation...`);

      try {
        // Second try: two-phase generation (backend first, then frontend)
        return await generateProjectInPhases(modelId, prompt, stack);
      } catch (phaseErr) {
        console.warn(`[aiGenerator] Two-phase failed with ${modelId}: ${phaseErr.message}`);

        // Third try: fallback to default model with two-phase
        if (modelId !== DEFAULT_MODEL) {
          try {
            return await generateProjectInPhases(DEFAULT_MODEL, prompt, stack);
          } catch (fallbackErr) {
            console.error('[aiGenerator] All generation strategies failed.');
            throw fallbackErr;
          }
        }
        throw phaseErr;
      }
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

    const userPrompt = `I have an existing SCALABLE project with these files:
${filesSummary}

Original project description: ${originalPrompt}

Current project files:
${JSON.stringify(currentFiles, null, 2)}

EDIT REQUEST: ${editPrompt}

Apply the requested changes while MAINTAINING the scalable architecture:
- Keep the layered backend pattern (routes → controllers → services → models)
- Keep database persistence (do NOT switch to in-memory arrays)
- Keep the API service layer on frontend
- Keep proper error handling and loading states
- Add any new dependencies to package.json

Return the COMPLETE updated project files as a JSON object (include ALL files, both modified and unmodified). Make sure frontend and backend remain properly connected.`;

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

function buildModelFallbackSequence(preferredModelId) {
  const sequence = [];
  const tried = new Set();

  const addModel = (modelId) => {
    if (modelId && !tried.has(modelId) && getAllAllowedModelIds().includes(modelId)) {
      sequence.push(modelId);
      tried.add(modelId);
    }
  };

  // Start with the preferred model
  addModel(preferredModelId);

  // Add other fast models from different providers
  addModel('gpt-4o-mini');
  addModel('gemini-2.5-flash');
  addModel('claude-3-5-haiku-latest');
  addModel('mistral-small-latest');
  addModel('grok-3-mini');

  // Add DEFAULT_MODEL if not already included
  addModel(DEFAULT_MODEL);

  // Add any remaining available models
  for (const modelId of getAllAllowedModelIds()) {
    addModel(modelId);
  }

  return sequence;
}

const generateStructuredJson = async ({ systemPrompt, userPrompt, modelName }) => {
  const modelId = resolveModel(modelName);
  const fallbackSequence = buildModelFallbackSequence(modelId);

  const callAndParse = async (targetModelId) => {
    const content = await callModel(targetModelId, String(systemPrompt || '').trim(), String(userPrompt || '').trim());
    return extractJsonObject(content);
  };

  let lastError;
  for (const currentModel of fallbackSequence) {
    try {
      const result = await callAndParse(currentModel);
      // Success - return immediately
      return result;
    } catch (err) {
      lastError = err;
      const errorMsg = String(err?.message || err).toLowerCase();
      // Only retry on service errors or network issues, not on bad requests
      const isRetryable = errorMsg.includes('503') || 
                         errorMsg.includes('service') ||
                         errorMsg.includes('timeout') ||
                         errorMsg.includes('network') ||
                         errorMsg.includes('econnrefused') ||
                         (err?.status >= 500);
      if (!isRetryable && currentModel !== fallbackSequence[0]) {
        // If this is a client error (not service error), skip retrying other models
        throw err;
      }
      // Continue to next model on retryable errors
      continue;
    }
  }

  // All models failed - throw the last error
  throw lastError || new Error('All models failed to generate structured response.');
};

const aiGenerator = {
  DEFAULT_MODEL,
  getAvailableModels,
  buildPreviewSkeleton,
  generateProject,
  editProject,
  generateStructuredJson,
};

export { DEFAULT_MODEL, getAvailableModels, buildPreviewSkeleton, generateProject, editProject, generateStructuredJson };
export default aiGenerator;
