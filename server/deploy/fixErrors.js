import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for AI auto-fix.');
  }

  return new OpenAI({ apiKey });
}

function parseJson(text) {
  const cleaned = String(text || '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('OpenAI response did not contain valid JSON.');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function applyUpdates(fileMap, updates = []) {
  const next = { ...fileMap };

  for (const update of updates) {
    const updatePath = String(update?.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!updatePath || updatePath.includes('..')) {
      continue;
    }

    if (typeof update?.content === 'string') {
      next[updatePath] = update.content;
    }
  }

  return next;
}

export async function fixDeploymentErrorsWithAI({
  projectName,
  frontendFiles,
  backendFiles,
  logs,
  logger,
}) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_DEPLOY_FIX_MODEL || 'gpt-4o-mini';

  const prompt = {
    projectName,
    task: 'Fix deployment issues in frontend and backend source files.',
    requirements: [
      'Handle missing env vars.',
      'Ensure backend uses process.env.PORT.',
      'Fix CORS for frontend origin + credentials.',
      'Fix dependency or build script issues in package.json.',
      'Keep patch minimal and production-safe.',
    ],
    logs,
    frontendFiles,
    backendFiles,
    outputSchema: {
      frontendUpdates: [{ path: 'string', content: 'string' }],
      backendUpdates: [{ path: 'string', content: 'string' }],
      notes: ['string'],
    },
  };

  await logger.warn('Sending deployment logs to OpenAI for auto-fix.', { model });

  const completion = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a senior DevOps + full-stack engineer. Return only JSON matching the requested outputSchema. No markdown.',
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: JSON.stringify(prompt) }],
      },
    ],
  });

  const text = completion.output_text || '';
  const parsed = parseJson(text);

  const nextFrontend = applyUpdates(frontendFiles, parsed.frontendUpdates);
  const nextBackend = applyUpdates(backendFiles, parsed.backendUpdates);

  await logger.info('AI auto-fix patch generated.', {
    frontendUpdates: Array.isArray(parsed.frontendUpdates) ? parsed.frontendUpdates.length : 0,
    backendUpdates: Array.isArray(parsed.backendUpdates) ? parsed.backendUpdates.length : 0,
    notes: parsed.notes || [],
  });

  return {
    frontendFiles: nextFrontend,
    backendFiles: nextBackend,
    notes: parsed.notes || [],
  };
}
