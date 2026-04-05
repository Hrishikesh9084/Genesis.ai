import OpenAI from "openai";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const SYSTEM_PROMPT = `You are a senior full-stack architect.
Given a user prompt, generate a full-stack modern application.
Return only valid JSON, no markdown fences.

Required JSON shape:
{
  "appName": "string",
  "summary": "string",
  "previewHtml": "string",
  "files": [
    { "path": "client/src/App.jsx", "content": "string" },
    { "path": "server/server.js", "content": "string" }
  ]
}

Rules:
- Generate a complete, production-ready application.
- Use React for the frontend and Node.js/Express for the backend.
- Use Tailwind CSS for styling.
- The app must include a real-time data flow between frontend and backend.
- Use Socket.IO (preferred) or Server-Sent Events for real-time updates.
- Include all required files for both frontend and backend in a monorepo style:
  - client/... for frontend
  - server/... for backend
- Ensure frontend is already connected to backend endpoints/events with working URLs.
- \`files\` must be an array of objects, each with a 'path' and 'content'.
- \`previewHtml\` must be a complete HTML demo for iframe srcDoc rendering.
- Ensure JSON escapes newlines and quotes correctly.
`;

const EDIT_SYSTEM_PROMPT = `You are a senior full-stack engineer.
You will receive the current application files and an edit instruction.
Return only valid JSON, no markdown fences.

Required JSON shape:
{
  "appName": "string",
  "summary": "string",
  "previewHtml": "string",
  "files": [
    { "path": "client/src/App.jsx", "content": "string" },
    { "path": "server/server.js", "content": "string" }
  ]
}

Rules:
- Apply the edit instruction precisely to the files.
- Keep the output compatible with React, Node.js, and Tailwind CSS.
- Preserve or improve real-time behavior between frontend and backend.
- Keep frontend-backend integration intact after edits.
- \`previewHtml\` must reflect the edited UI.
`;

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Model returned empty output.");
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Could not parse model output as JSON.");
  }

  const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonSlice);
}

function slugify(name = "") {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "generated-react-tailwind-app"
  );
}

function fallbackAppJsx(prompt) {
  return `export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-300">Generated App</p>
          <h1 className="mb-4 text-4xl font-semibold">React + Tailwind Project</h1>
          <p className="text-zinc-300">Prompt: ${prompt.replace(/`/g, "\\`")}</p>
        </div>
      </main>
    </div>
  );
}`;
}

function fallbackPreviewHtml(prompt) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="min-h-screen bg-zinc-950 text-zinc-100">
    <main class="mx-auto max-w-5xl px-6 py-20">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-8">
        <p class="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-300">Live Demo</p>
        <h1 class="mb-4 text-4xl font-semibold">React + Tailwind Project</h1>
        <p class="text-zinc-300">Prompt: ${String(prompt).replace(/</g, "&lt;")}</p>
      </div>
    </main>
  </body>
</html>`;
}

function normalizeAppJsx(candidate, prompt) {
  if (!candidate || typeof candidate !== "string") {
    return fallbackAppJsx(prompt);
  }

  const trimmed = candidate.trim();

  if (/export\s+default\s+function\s+App|const\s+App\s*=|function\s+App\s*\(/.test(trimmed)) {
    return trimmed;
  }


function sanitizeGeneratedPath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return "";

  const normalized = rawPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.{2,}\//g, "")
    .replace(/\.{2,}/g, "")
    .trim();

  if (!normalized) return "";
  if (normalized.includes(":")) return "";

  return normalized;
}

function normalizeGeneratedFiles(draftFiles = []) {
  if (!Array.isArray(draftFiles)) return [];

  const byPath = new Map();

  for (const file of draftFiles) {
    const safePath = sanitizeGeneratedPath(file?.path);
    if (!safePath) continue;

    const content =
      typeof file?.content === "string"
        ? file.content
        : JSON.stringify(file?.content ?? {}, null, 2);

    byPath.set(safePath, { path: safePath, content });
  }

  return Array.from(byPath.values());
}

function fallbackFullstackFiles(prompt, appName) {
  const safePrompt = String(prompt).replace(/`/g, "\\`");

  return [
    {
      path: "client/package.json",
      content: JSON.stringify(
        {
          name: `${slugify(appName)}-client`,
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "socket.io-client": "^4.8.1",
          },
          devDependencies: {
            "@tailwindcss/vite": "^4.1.11",
            "@vitejs/plugin-react": "^4.3.1",
            tailwindcss: "^4.1.11",
            vite: "^5.4.0",
          },
        },
        null,
        2
      ),
    },
    {
      path: "client/index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    },
    {
      path: "client/vite.config.js",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});`,
    },
    {
      path: "client/src/main.jsx",
      content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    },
    {
      path: "client/src/index.css",
      content: `@import "tailwindcss";

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}`,
    },
    {
      path: "client/src/App.jsx",
      content: `import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export default function App() {
  const socket = useMemo(() => io(SERVER_URL, { transports: ["websocket"] }), []);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:message", (payload) => {
      setMessages((prev) => [...prev, payload]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("chat:message");
      socket.close();
    };
  }, [socket]);

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    socket.emit("chat:message", { text });
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">${appName}</h1>
        <p className="mt-2 text-zinc-300">Prompt: ${safePrompt}</p>
        <p className="mt-3 text-sm">
          Status: <span className={connected ? "text-emerald-400" : "text-rose-400"}>{connected ? "Connected" : "Disconnected"}</span>
        </p>

        <div className="mt-6 flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Send a real-time message"
            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none"
          />
          <button onClick={sendMessage} className="rounded-lg bg-white px-4 py-2 text-black">
            Send
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
              {msg.text}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`,
    },
    {
      path: "server/package.json",
      content: JSON.stringify(
        {
          name: `${slugify(appName)}-server`,
          private: true,
          version: "1.0.0",
          type: "module",
          scripts: {
            dev: "node --watch server.js",
            start: "node server.js",
          },
          dependencies: {
            cors: "^2.8.5",
            express: "^4.19.2",
            "socket.io": "^4.8.1",
          },
        },
        null,
        2
      ),
    },
    {
      path: "server/server.js",
      content: `import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "realtime-server" });
});

io.on("connection", (socket) => {
  socket.on("chat:message", (payload) => {
    const message = {
      text: String(payload?.text || ""),
      at: new Date().toISOString(),
    };

    io.emit("chat:message", message);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Realtime server running on port ${PORT}`);
});`,
    },
    {
      path: "README.md",
      content: `# ${appName}

Generated from prompt: ${prompt}

## Run locally

1. Start backend
   - cd server
   - npm install
   - npm run dev
2. Start frontend
   - cd client
   - npm install
   - npm run dev

Frontend expects backend at http://localhost:3000 by default.
`,
    },
  ];
}
  return `export default function App() {
  return (
    ${trimmed}
}

function buildFunctionalScaffold(prompt, draft = {}) {
  const appName = draft.appName || "Generated React Tailwind App";
  const safeName = slugify(appName);
  const normalizedFiles = normalizeGeneratedFiles(draft.files);
  const files = normalizedFiles.length > 0 ? normalizedFiles : fallbackFullstackFiles(prompt, appName);

## Stack

    summary: draft.summary || "Generated full-stack real-time application scaffold.",
    stack: ["React", "Node.js", "Express", "Tailwind CSS", "Socket.IO"],
  ];

    steps: [
      "cd server && npm install && npm run dev",
      "cd client && npm install && npm run dev",
    ],
    appName,
    summary: draft.summary || "Generated React + Tailwind project scaffold.",
    stack: ["React", "Vite", "Tailwind CSS"],
    previewHtml,
    files,
    steps: ["npm install", "npm run dev"],
  };
}

const OPENROUTER_PREFIXES = [
  "anthropic/",
  "meta-llama/",
  "mistralai/",
  "openclaw/",
];

function isOpenRouterModel(modelName = "") {
  return OPENROUTER_PREFIXES.some((prefix) => modelName.startsWith(prefix));
}

async function generateWithOpenAI(modelName, prompt) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("OpenAI request timeout (55s)")), 55000)
  );

  const response = await Promise.race([
    openai.chat.completions.create({
      model: modelName,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    timeoutPromise,
  ]);

  return response.choices?.[0]?.message?.content || "";
}

async function generateWithGemini(modelName, prompt) {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const requestOnce = async (timeoutMs) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini request timeout (${Math.floor(timeoutMs / 1000)}s)`)),
        timeoutMs
      )
    );

    const geminiModel = genAI.getGenerativeModel({ model: modelName });
    const result = await Promise.race([
      geminiModel.generateContent([
        { text: SYSTEM_PROMPT },
        { text: `User prompt: ${prompt}` },
      ]),
      timeoutPromise,
    ]);

    return result.response.text();
  };

  try {
    return await requestOnce(70000);
  } catch (error) {
    if (!String(error?.message || "").toLowerCase().includes("timeout")) {
      throw error;
    }

    // One retry for intermittent provider latency spikes.
    return requestOnce(90000);
  }
}

async function generateWithOpenRouter(modelName, prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "Model requires OPENROUTER_API_KEY. Either set it or choose Gemini/GPT model."
    );
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("OpenRouter request timeout (55s)")), 55000)
  );

  const response = await Promise.race([
    axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: modelName,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    ),
    timeoutPromise,
  ]);

  return response.data?.choices?.[0]?.message?.content || "";
}

export const generateAIResponse = async ({ model, prompt }) => {
  const requestedModel = (model || "google/gemini-flash").trim();
  let rawText = "";
  let draft = {};

  if (requestedModel === "google/gemini-flash" || requestedModel === "google/gemini-2.5-flash") {
    rawText = await generateWithGemini("gemini-2.5-flash", prompt);
  } else if (requestedModel === "openai/gpt-4o-mini") {
    rawText = await generateWithOpenAI("gpt-4o-mini", prompt);
  } else if (isOpenRouterModel(requestedModel)) {
    rawText = await generateWithOpenRouter(requestedModel, prompt);
  } else {
    // Safe fallback
    rawText = await generateWithGemini("gemini-2.5-pro", prompt);
  }

  try {
    draft = extractJson(rawText);
  } catch (error) {
    draft = {
      appName: "Generated React Tailwind App",
      summary: "Fallback scaffold due to model formatting issue.",
      previewHtml: fallbackPreviewHtml(prompt),
      appJsx: fallbackAppJsx(prompt),
    };
  }

  return buildFunctionalScaffold(prompt, draft);
};

export const editAIResponse = async ({
  model,
  originalPrompt,
  editPrompt,
  currentOutput,
}) => {
  const requestedModel = (model || "google/gemini-flash").trim();
  const currentFiles = Array.isArray(currentOutput?.files) ? currentOutput.files : [];
  const currentAppJsx =
    currentFiles.find?.((f) => f?.path === "client/src/App.jsx")?.content ||
    currentFiles.find?.((f) => f?.path === "src/App.jsx")?.content ||
    "";
  const currentSummary = currentOutput?.summary || "";
  const currentAppName = currentOutput?.appName || "Generated React Tailwind App";

  const currentFilesForPrompt = JSON.stringify(
    currentFiles.map((file) => ({
      path: file?.path,
      content: file?.content,
    })),
    null,
    2
  );

  const editPayload = `Original prompt:\n${originalPrompt}\n\nCurrent app name: ${currentAppName}\nCurrent summary: ${currentSummary}\n\nCurrent files:\n${currentFilesForPrompt}\n\nEdit instruction:\n${editPrompt}`;

  let rawText = "";
  let draft = {};

  if (requestedModel === "google/gemini-flash" || requestedModel === "google/gemini-2.5-flash") {
    rawText = await generateWithGemini("gemini-2.5-flash", `${EDIT_SYSTEM_PROMPT}\n\n${editPayload}`);
  } else if (requestedModel === "openai/gpt-4o-mini") {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EDIT_SYSTEM_PROMPT },
        { role: "user", content: editPayload },
      ],
    });
    rawText = response.choices?.[0]?.message?.content || "";
  } else if (isOpenRouterModel(requestedModel)) {
    rawText = await generateWithOpenRouter(
      requestedModel,
      `${EDIT_SYSTEM_PROMPT}\n\n${editPayload}`
    );
  } else {
    rawText = await generateWithGemini("gemini-2.5-pro", `${EDIT_SYSTEM_PROMPT}\n\n${editPayload}`);
  }

  try {
    draft = extractJson(rawText);
  } catch (error) {
    draft = {
      appName: currentAppName,
      summary: currentSummary || "Updated app based on edit prompt.",
      previewHtml: currentOutput?.previewHtml || fallbackPreviewHtml(editPrompt),
      appJsx: currentAppJsx || fallbackAppJsx(editPrompt),
    };
  }

  return buildFunctionalScaffold(`${originalPrompt}\nEdit: ${editPrompt}`, draft);
};
