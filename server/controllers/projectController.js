import db from '../config/db.js';
import aiGenerator from '../services/aiGenerator.js';
import githubService from '../services/githubService.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PDFDocument from 'pdfkit';

const DECISION_MEMORY_FILE_PATH = '.genesis/decision-memory.json';
const DEP_INSTALL_REPORT_FILE_PATH = '.genesis/dependency-install-report.json';
const MAX_DECISION_MEMORY_ITEMS = 20;
const DEFAULT_INTENT_MODE = 'balanced';
const ALLOWED_INTENT_MODES = new Set(['balanced', 'speed', 'quality', 'refactor', 'debug']);
const execFileAsync = promisify(execFile);

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function withDependencyInstallReport(files, report) {
  return {
    ...(files || {}),
    [DEP_INSTALL_REPORT_FILE_PATH]: JSON.stringify(report || {}, null, 2),
  };
}

function readFileFromMap(files, filePath) {
  if (!files || !Object.prototype.hasOwnProperty.call(files, filePath)) return null;
  const raw = files[filePath];
  if (raw === null || raw === undefined) return null;
  return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
}

async function runNpmInstall(targetDir) {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const hasLockFile = await fs
    .access(path.join(targetDir, 'package-lock.json'))
    .then(() => true)
    .catch(() => false);

  const installArgs = hasLockFile
    ? ['ci', '--no-audit', '--no-fund', '--prefer-offline', '--legacy-peer-deps']
    : ['install', '--no-audit', '--no-fund', '--prefer-offline', '--legacy-peer-deps'];

  const result = await execFileAsync(npmExecutable, installArgs, {
    cwd: targetDir,
    shell: process.platform === 'win32',
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    command: `${npmExecutable} ${installArgs.join(' ')}`,
    stdout: String(result.stdout || '').split(/\r?\n/).slice(-10).join('\n').trim(),
    stderr: String(result.stderr || '').split(/\r?\n/).slice(-10).join('\n').trim(),
  };
}

async function installNodeModulesForGeneratedProject(projectId, files, enabled = true) {
  if (!enabled) {
    return {
      enabled: false,
      skipped: true,
      reason: 'Disabled by request',
      targets: [],
      completedAt: new Date().toISOString(),
    };
  }

  // Serverless environments are not suitable for install-at-generation workflows.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return {
      enabled: true,
      skipped: true,
      reason: 'Skipped in serverless runtime',
      targets: [],
      completedAt: new Date().toISOString(),
    };
  }

  const installRoot = path.join(os.tmpdir(), 'genesis-ai', 'generated-installs', String(projectId), Date.now().toString());
  const targets = [
    { key: '', label: 'root', pkg: 'package.json', lock: 'package-lock.json', npmrc: '.npmrc' },
    { key: 'server', label: 'server', pkg: 'server/package.json', lock: 'server/package-lock.json', npmrc: 'server/.npmrc' },
    { key: 'client', label: 'client', pkg: 'client/package.json', lock: 'client/package-lock.json', npmrc: 'client/.npmrc' },
  ];

  const reportTargets = [];

  try {
    await fs.mkdir(installRoot, { recursive: true });

    for (const target of targets) {
      const pkg = readFileFromMap(files, target.pkg);
      if (!pkg) continue;

      const targetDir = target.key ? path.join(installRoot, target.key) : installRoot;
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, 'package.json'), pkg, 'utf8');

      const lock = readFileFromMap(files, target.lock);
      if (lock) {
        await fs.writeFile(path.join(targetDir, 'package-lock.json'), lock, 'utf8');
      }

      const npmrc = readFileFromMap(files, target.npmrc);
      if (npmrc) {
        await fs.writeFile(path.join(targetDir, '.npmrc'), npmrc, 'utf8');
      }

      try {
        const installResult = await runNpmInstall(targetDir);
        reportTargets.push({
          target: target.label,
          status: 'installed',
          ...installResult,
        });
      } catch (err) {
        reportTargets.push({
          target: target.label,
          status: 'failed',
          error: String(err?.message || 'install failed'),
          stderr: String(err?.stderr || '').split(/\r?\n/).slice(-12).join('\n').trim(),
          stdout: String(err?.stdout || '').split(/\r?\n/).slice(-12).join('\n').trim(),
        });
      }
    }

    return {
      enabled: true,
      skipped: reportTargets.length === 0,
      reason: reportTargets.length === 0 ? 'No package.json found in generated output' : undefined,
      targets: reportTargets,
      completedAt: new Date().toISOString(),
    };
  } finally {
    await fs.rm(installRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function normalizeIntentMode(intentMode) {
  const normalized = String(intentMode || DEFAULT_INTENT_MODE).trim().toLowerCase();
  return ALLOWED_INTENT_MODES.has(normalized) ? normalized : DEFAULT_INTENT_MODE;
}

function parseProjectFiles(rawFiles) {
  if (!rawFiles) return {};
  if (typeof rawFiles === 'string') {
    try {
      return JSON.parse(rawFiles);
    } catch {
      return {};
    }
  }

  if (typeof rawFiles === 'object' && !Array.isArray(rawFiles)) {
    return rawFiles;
  }

  return {};
}

function getDecisionMemoryEntries(files) {
  try {
    const content = files?.[DECISION_MEMORY_FILE_PATH];
    if (!content) return [];
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object');
  } catch {
    return [];
  }
}

function stripDecisionMemoryFile(files) {
  const next = { ...(files || {}) };
  delete next[DECISION_MEMORY_FILE_PATH];
  return next;
}

function withDecisionMemory(files, memoryEntries) {
  return {
    ...(files || {}),
    [DECISION_MEMORY_FILE_PATH]: JSON.stringify(memoryEntries, null, 2),
  };
}

function createDecisionMemoryEntry({ action, prompt, intentMode, stack, model, fileCount }) {
  const requirements = String(prompt || '')
    .split(/[\n.;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    action,
    intentMode: normalizeIntentMode(intentMode),
    stack: String(stack || 'fullstack'),
    model: String(model || ''),
    promptSummary: String(prompt || '').slice(0, 280),
    inferredRequirements: requirements,
    fileCount: Number(fileCount || 0),
    createdAt: new Date().toISOString(),
  };
}

function appendDecisionMemory(files, entry) {
  const existing = getDecisionMemoryEntries(files);
  const nextMemory = [...existing, entry].slice(-MAX_DECISION_MEMORY_ITEMS);
  return withDecisionMemory(stripDecisionMemoryFile(files), nextMemory);
}

function buildIntentAnnotatedPrompt(basePrompt, intentMode, memoryEntries = []) {
  const normalizedIntent = normalizeIntentMode(intentMode);
  const memorySnippet = memoryEntries
    .slice(-4)
    .map((item, index) => `${index + 1}. ${item.action} | intent=${item.intentMode} | summary=${item.promptSummary}`)
    .join('\n');

  const intentInstruction = {
    balanced: 'Prioritize balanced delivery: maintain quality while keeping implementation concise.',
    speed: 'Prioritize speed-to-delivery. Prefer simpler architecture choices that are still production-safe.',
    quality: 'Prioritize code quality and maintainability. Add clearer structure and stronger validation/tests where feasible.',
    refactor: 'Prioritize refactoring and maintainability improvements while preserving behavior.',
    debug: 'Prioritize bug fixing and correctness. Minimize unrelated changes.',
  }[normalizedIntent];

  return [
    String(basePrompt || '').trim(),
    '',
    '[Intent Mode]',
    normalizedIntent,
    intentInstruction,
    memorySnippet ? `\n[Decision Memory]\n${memorySnippet}` : '',
  ]
    .join('\n')
    .trim();
}

function summarizeFilesForExplanation(files) {
  const entries = Object.entries(stripDecisionMemoryFile(files || {}));
  const prioritized = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 80)
    .map(([filePath, content]) => {
      const text = String(content || '');
      return {
        path: filePath,
        preview: text.slice(0, 700),
      };
    });

  return prioritized;
}

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

const getModels = (req, res) => {
  res.json({
    providers: aiGenerator.getAvailableModels(),
    default: aiGenerator.DEFAULT_MODEL,
  });
};

const getProjects = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, prompt, stack, status, github_repo_url, deploy_url, deploy_frontend_url, deploy_backend_url, deploy_platform, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const { name, prompt, stack, model, intentMode, installNodeModules } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required.' });
    }

    const selectedModel = model || aiGenerator.DEFAULT_MODEL;
    const selectedIntentMode = normalizeIntentMode(intentMode);
    const shouldInstallNodeModules = normalizeBoolean(installNodeModules, true);

    const creditResult = await consumeOneCredit(req.user.id);
    if (!creditResult) {
      return res.status(402).json({
        error: 'Insufficient credits. Please purchase a plan before generating projects.',
      });
    }

    const result = await db.query(
      'INSERT INTO projects (user_id, name, prompt, stack, model, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, name, prompt, stack || 'fullstack', selectedModel, 'generating']
    );

    const project = result.rows[0];
    const previewFiles = aiGenerator.buildPreviewSkeleton(prompt);

    await db.query('UPDATE projects SET files = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(previewFiles),
      project.id,
    ]);

    project.files = previewFiles;

    generateProjectAsync(
      project.id,
      prompt,
      stack || 'fullstack',
      selectedModel,
      selectedIntentMode,
      shouldInstallNodeModules
    );

    project.intent_mode = selectedIntentMode;

    res.status(201).json({ project, creditsRemaining: Number(creditResult.credits || 0) });
  } catch (err) {
    next(err);
  }
};

async function generateProjectAsync(projectId, prompt, stack, modelName, intentMode, installNodeModules = true) {
  try {
    const promptWithIntent = buildIntentAnnotatedPrompt(prompt, intentMode, []);
    let generatedFiles;

    try {
      generatedFiles = await aiGenerator.generateProjectInPhases(
        modelName || aiGenerator.DEFAULT_MODEL,
        promptWithIntent,
        stack,
        async ({ phase, files }) => {
          if (!files || Object.keys(files).length === 0) {
            return;
          }

          if (phase !== 'backend' && phase !== 'complete') {
            return;
          }

          try {
            await db.query('UPDATE projects SET files = $1, updated_at = NOW() WHERE id = $2', [
              JSON.stringify(files),
              projectId,
            ]);
          } catch (progressErr) {
            console.warn(`[projectController] Failed to persist ${phase} progress for project ${projectId}:`, progressErr);
          }
        }
      );
    } catch (phaseErr) {
      console.warn(`[projectController] Phased generation failed for project ${projectId}. Falling back to single-pass generation.`, phaseErr);
      generatedFiles = await aiGenerator.generateProject(promptWithIntent, stack, modelName);
    }

    const autoFixResult = await aiGenerator.autoFixGeneratedCode(generatedFiles, prompt, stack, modelName);
    const filesToSave = autoFixResult?.files || generatedFiles;

    if (autoFixResult?.fixed) {
      console.log(
        `[projectController] Auto-fixed generated project ${projectId}. Files fixed: ${autoFixResult.fixedFiles?.length || 0}`
      );
    }

    const installReport = await installNodeModulesForGeneratedProject(projectId, filesToSave, installNodeModules);
    const filesWithInstallReport = withDependencyInstallReport(filesToSave, installReport);

    const files = appendDecisionMemory(
      filesWithInstallReport,
      createDecisionMemoryEntry({
        action: 'generate',
        prompt,
        intentMode,
        stack,
        model: modelName,
        fileCount: Object.keys(filesWithInstallReport || {}).length,
      })
    );

    await db.query('UPDATE projects SET files = $1, status = $2, updated_at = NOW() WHERE id = $3', [
      JSON.stringify(files),
      'ready',
      projectId,
    ]);
  } catch (err) {
    console.error('Project generation failed:', err);
    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'error',
      projectId,
    ]);
  }
}

const editProject = async (req, res, next) => {
  try {
    const { prompt: editPrompt, model, intentMode, installNodeModules } = req.body;
    const { id } = req.params;

    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = result.rows[0];
    const selectedModel = model || project.model || aiGenerator.DEFAULT_MODEL;
    const selectedIntentMode = normalizeIntentMode(intentMode);
    const shouldInstallNodeModules = normalizeBoolean(installNodeModules, true);
    const currentFiles = parseProjectFiles(project.files);

    const creditResult = await consumeOneCredit(req.user.id);
    if (!creditResult) {
      return res.status(402).json({
        error: 'Insufficient credits. Please purchase a plan before regenerating projects.',
      });
    }

    await db.query('UPDATE projects SET status = $1, model = $2, updated_at = NOW() WHERE id = $3', [
      'generating',
      selectedModel,
      id,
    ]);

    editProjectAsync(
      id,
      currentFiles,
      project.prompt,
      editPrompt,
      project.stack,
      selectedModel,
      selectedIntentMode,
      shouldInstallNodeModules
    );

    res.json({ message: 'Project edit started.', projectId: id, creditsRemaining: Number(creditResult.credits || 0) });
  } catch (err) {
    next(err);
  }
};

async function editProjectAsync(projectId, currentFiles, originalPrompt, editPrompt, stack, modelName, intentMode, installNodeModules = true) {
  try {
    const memoryEntries = getDecisionMemoryEntries(currentFiles);
    const intentAwareEditPrompt = buildIntentAnnotatedPrompt(editPrompt, intentMode, memoryEntries);

    const updatedFiles = await aiGenerator.editProject(
      stripDecisionMemoryFile(currentFiles),
      originalPrompt,
      intentAwareEditPrompt,
      stack,
      modelName
    );

    const autoFixResult = await aiGenerator.autoFixGeneratedCode(updatedFiles, originalPrompt, stack, modelName);
    const filesToSave = autoFixResult?.files || updatedFiles;

    if (autoFixResult?.fixed) {
      console.log(
        `[projectController] Auto-fixed edited project ${projectId}. Files fixed: ${autoFixResult.fixedFiles?.length || 0}`
      );
    }

    const installReport = await installNodeModulesForGeneratedProject(projectId, filesToSave, installNodeModules);
    const filesWithInstallReport = withDependencyInstallReport(filesToSave, installReport);

    const files = appendDecisionMemory(
      filesWithInstallReport,
      createDecisionMemoryEntry({
        action: 'edit',
        prompt: editPrompt,
        intentMode,
        stack,
        model: modelName,
        fileCount: Object.keys(filesWithInstallReport || {}).length,
      })
    );

    await db.query(
      'UPDATE projects SET files = $1, status = $2, prompt = $3, updated_at = NOW() WHERE id = $4',
      [JSON.stringify(files), 'ready', `${originalPrompt}\n\n[Edit]: ${editPrompt}`, projectId]
    );
  } catch (err) {
    console.error('Project edit failed:', err);
    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'error',
      projectId,
    ]);
  }
}

const explainProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, model, intentMode } = req.body || {};

    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = result.rows[0];
    const selectedModel = model || project.model || aiGenerator.DEFAULT_MODEL;
    const files = parseProjectFiles(project.files);
    const decisionMemory = getDecisionMemoryEntries(files);
    const resolvedIntentMode = normalizeIntentMode(intentMode || decisionMemory.at(-1)?.intentMode || DEFAULT_INTENT_MODE);
    const fileSummary = summarizeFilesForExplanation(files);

    const explanation = await aiGenerator.generateStructuredJson({
      modelName: selectedModel,
      systemPrompt: `You explain generated codebases to developers. Be concise, concrete, and implementation-focused. Return JSON only.`,
      userPrompt: `Explain this generated codebase as structured JSON.

Intent mode: ${resolvedIntentMode}
Project name: ${project.name}
Original prompt: ${project.prompt}
User question: ${String(question || 'Give me a complete technical walkthrough of this codebase.')}

Decision memory entries:
${JSON.stringify(decisionMemory.slice(-8), null, 2)}

File previews (path + first 700 chars):
${JSON.stringify(fileSummary, null, 2)}

Return JSON with this exact shape:
{
  "overview": "...",
  "architecture": ["..."],
  "requestFlow": ["..."],
  "keyFiles": [{"path":"...","purpose":"..."}],
  "dataModel": ["..."],
  "securityAndRisks": ["..."],
  "nextSteps": ["..."]
}`,
    });

    return res.json({
      explanation,
      intentMode: resolvedIntentMode,
      decisionMemory,
    });
  } catch (err) {
    next(err);
  }
};

const explainProjectPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, model, intentMode } = req.body || {};

    const result = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = result.rows[0];
    const selectedModel = model || project.model || aiGenerator.DEFAULT_MODEL;
    const files = parseProjectFiles(project.files);
    const decisionMemory = getDecisionMemoryEntries(files);
    const resolvedIntentMode = normalizeIntentMode(intentMode || decisionMemory.at(-1)?.intentMode || DEFAULT_INTENT_MODE);
    const fileSummary = summarizeFilesForExplanation(files);

    const explanation = await aiGenerator.generateStructuredJson({
      modelName: selectedModel,
      systemPrompt: `You explain generated codebases to developers. Be concise, concrete, and implementation-focused. Return JSON only.`,
      userPrompt: `Explain this generated codebase as structured JSON.

Intent mode: ${resolvedIntentMode}
Project name: ${project.name}
Original prompt: ${project.prompt}
User question: ${String(question || 'Give me a complete technical walkthrough of this codebase.')}

Decision memory entries:
${JSON.stringify(decisionMemory.slice(-8), null, 2)}

File previews (path + first 700 chars):
${JSON.stringify(fileSummary, null, 2)}

Return JSON with this exact shape:
{
  "overview": "...",
  "architecture": ["..."],
  "requestFlow": ["..."],
  "keyFiles": [{"path":"...","purpose":"..."}],
  "dataModel": ["..."],
  "securityAndRisks": ["..."],
  "nextSteps": ["..."]
}
`,
    });

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const safeName = String(project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '-') || 'project';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-explanation.pdf"`);

    doc.pipe(res);

    doc.fontSize(18).text(`${project.name} — Codebase Explanation`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Intent mode: ${resolvedIntentMode}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();

    doc.fontSize(14).text('Overview', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(11).text(explanation.overview || 'N/A', { paragraphGap: 6 });
    doc.moveDown();

    const writeList = (title, items) => {
      doc.fontSize(14).text(title, { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(11);
      if (!items || (Array.isArray(items) && items.length === 0)) {
        doc.text('None');
      } else {
        items.forEach((it, i) => {
          const line = typeof it === 'string' ? it : it.path ? `${it.path} — ${it.purpose || ''}` : JSON.stringify(it);
          doc.text(`${i + 1}. ${line}`);
        });
      }
      doc.moveDown();
    };

    writeList('Architecture', explanation.architecture);
    writeList('Request Flow', explanation.requestFlow);
    writeList('Key Files', (explanation.keyFiles || []).map(k => (k.path ? `${k.path}: ${k.purpose || ''}` : JSON.stringify(k))));
    writeList('Data Model', explanation.dataModel);
    writeList('Risks / Security', explanation.securityAndRisks);
    writeList('Next Steps', explanation.nextSteps);

    doc.end();
  } catch (err) {
    next(err);
  }
};

const updateProjectFiles = async (req, res, next) => {
  try {
    const { files } = req.body;
    const { id } = req.params;

    const result = await db.query(
      'UPDATE projects SET files = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [JSON.stringify(files), id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ message: 'Project deleted.' });
  } catch (err) {
    next(err);
  }
};

const pushToGithub = async (req, res, next) => {
  try {
    const { repoName, isPrivate } = req.body;
    const { id } = req.params;

    const userResult = await db.query('SELECT github_token FROM users WHERE id = $1', [req.user.id]);
    const githubToken = userResult.rows[0]?.github_token;

    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured. Go to Settings to add it.' });
    }

    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      req.user.id,
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projectResult.rows[0];
    const repoUrl = await githubService.createAndPushRepo(
      githubToken,
      repoName || project.name,
      project.files,
      isPrivate
    );

    await db.query('UPDATE projects SET github_repo_url = $1, updated_at = NOW() WHERE id = $2', [
      repoUrl,
      id,
    ]);

    res.json({ repoUrl });
  } catch (err) {
    next(err);
  }
};

const cancelProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      ['cancelled', id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ message: 'Generation cancelled.', project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

export default {
  getModels,
  getProjects,
  getProject,
  createProject,
  explainProject,
  explainProjectPdf,
  editProject,
  updateProjectFiles,
  deleteProject,
  pushToGithub,
  cancelProject,
};
