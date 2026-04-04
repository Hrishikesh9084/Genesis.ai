import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { generateStructuredJson } from './aiGenerator.js';

const MAX_RESUME_CHARS = 14000;
const MAX_ANSWER_CHARS = 3000;
const MAX_TURNS = 5;
const ACTIVE_SESSIONS_TTL_MS = 1000 * 60 * 60;

const sessions = new Map();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (!session || now - session.updatedAt > ACTIVE_SESSIONS_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredSessions, 1000 * 60 * 10).unref();

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function coerceArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseScore(value) {
  const num = Number.parseFloat(String(value ?? '0'));
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(10, Math.round(num * 10) / 10));
}

async function extractResumeText(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  const rawBuffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const parsed = await pdfParse(rawBuffer);
    return normalizeWhitespace(parsed.text || '');
  }

  if (ext === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer: rawBuffer });
    return normalizeWhitespace(parsed.value || '');
  }

  // Fallback for legacy .doc and unknown document types.
  return normalizeWhitespace(rawBuffer.toString('utf8'));
}

async function inferTargetRole({ resumeText, modelName }) {
  const systemPrompt = `You are an expert technical recruiter.
Infer the best-fit target job role from a candidate resume.
Return only valid JSON.`;

  const userPrompt = `Based on this resume, infer the single best-fit target role title.

Resume text (possibly truncated):
${resumeText.slice(0, MAX_RESUME_CHARS)}

Return exactly this JSON schema:
{
  "targetRole": "string"
}`;

  const data = await generateStructuredJson({ systemPrompt, userPrompt, modelName });
  return String(data?.targetRole || '').trim();
}

async function buildInterviewBlueprint({ resumeText, role, modelName }) {
  const systemPrompt = `You are an expert technical recruiter and interview coach.
Create an interview plan from the candidate resume.
Return only valid JSON.`;

  const userPrompt = `Create a mock interview setup for role: ${role || 'General Software Engineer'}.

Resume text (possibly truncated):
${resumeText.slice(0, MAX_RESUME_CHARS)}

Return exactly this JSON schema:
{
  "candidateSummary": "2-4 sentence summary",
  "strengths": ["string"],
  "focusAreas": ["string"],
  "openingQuestion": "string",
  "questionPlan": ["5-7 interview questions"],
  "recommendedDifficulty": "easy|medium|hard"
}`;

  const data = await generateStructuredJson({ systemPrompt, userPrompt, modelName });

  return {
    candidateSummary: String(data?.candidateSummary || 'Candidate profile available from resume.').trim(),
    strengths: coerceArray(data?.strengths, ['Communication', 'Problem solving']),
    focusAreas: coerceArray(data?.focusAreas, ['Depth in project decisions', 'Trade-off articulation']),
    openingQuestion: String(data?.openingQuestion || 'Walk me through the most impactful project on your resume.').trim(),
    questionPlan: coerceArray(data?.questionPlan, ['Walk me through your most impactful project.']),
    recommendedDifficulty: ['easy', 'medium', 'hard'].includes(String(data?.recommendedDifficulty || '').toLowerCase())
      ? String(data.recommendedDifficulty).toLowerCase()
      : 'medium',
  };
}

async function evaluateAnswer({ session, answer, modelName }) {
  const nextQuestionHint = session.questionPlan[session.turn] || session.questionPlan[session.questionPlan.length - 1] || '';

  const systemPrompt = `You are an interview evaluator.
Score candidate answers and provide coaching.
Return only valid JSON.`;

  const userPrompt = `Role: ${session.role}
Difficulty: ${session.difficulty}
Candidate summary: ${session.candidateSummary}
Strengths: ${session.strengths.join(', ')}
Focus areas: ${session.focusAreas.join(', ')}

Interview history:
${session.history
  .map((h, idx) => `${idx + 1}. Q: ${h.question}\nA: ${h.answer}\nScore: ${h.score}/10\n`)
  .join('\n')}

Current question:
${session.currentQuestion}

Candidate answer:
${answer.slice(0, MAX_ANSWER_CHARS)}

Suggested next question topic:
${nextQuestionHint}

Return exactly this JSON schema:
{
  "score": 0,
  "feedback": "2-4 sentence feedback",
  "improvements": ["string"],
  "nextQuestion": "string",
  "followUp": "optional short probing question"
}`;

  const data = await generateStructuredJson({ systemPrompt, userPrompt, modelName });

  return {
    score: parseScore(data?.score),
    feedback: String(data?.feedback || 'Good effort. Add clearer examples and measurable outcomes.').trim(),
    improvements: coerceArray(data?.improvements, ['Use the STAR format', 'Quantify outcomes']).slice(0, 4),
    nextQuestion: String(data?.nextQuestion || nextQuestionHint || 'Tell me about a difficult technical decision you made.').trim(),
    followUp: String(data?.followUp || '').trim(),
  };
}

async function createSession({ resumeFilePath, role, modelName }) {
  const resumeText = await extractResumeText(resumeFilePath);
  if (!resumeText || resumeText.length < 120) {
    throw new Error('Could not extract enough text from the resume. Please upload a clear PDF or DOCX file.');
  }

  const providedRole = String(role || '').trim();
  let resolvedRole = providedRole;

  if (!resolvedRole) {
    try {
      resolvedRole = await inferTargetRole({ resumeText, modelName });
    } catch (_err) {
      // Continue with a safe fallback if inference fails.
    }
  }

  if (!resolvedRole) {
    resolvedRole = 'General Software Engineer';
  }

  const blueprint = await buildInterviewBlueprint({ resumeText, role: resolvedRole, modelName });
  const sessionId = uuidv4();

  const session = {
    sessionId,
    role: resolvedRole,
    resumeText: resumeText.slice(0, MAX_RESUME_CHARS),
    candidateSummary: blueprint.candidateSummary,
    strengths: blueprint.strengths,
    focusAreas: blueprint.focusAreas,
    questionPlan: blueprint.questionPlan,
    currentQuestion: blueprint.openingQuestion,
    difficulty: blueprint.recommendedDifficulty,
    history: [],
    turn: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  sessions.set(sessionId, session);

  return {
    sessionId,
    role: session.role,
    candidateSummary: session.candidateSummary,
    strengths: session.strengths,
    focusAreas: session.focusAreas,
    currentQuestion: session.currentQuestion,
    turn: session.turn + 1,
    maxTurns: MAX_TURNS,
    difficulty: session.difficulty,
  };
}

async function suggestRoleFromResume({ resumeFilePath, modelName }) {
  const resumeText = await extractResumeText(resumeFilePath);
  if (!resumeText || resumeText.length < 120) {
    throw new Error('Could not extract enough text from the resume. Please upload a clear PDF or DOCX file.');
  }

  let targetRole = 'General Software Engineer';
  try {
    const inferredRole = await inferTargetRole({ resumeText, modelName });
    if (inferredRole) targetRole = inferredRole;
  } catch (_err) {
    // Use fallback if role inference fails.
  }

  return { targetRole };
}

async function submitAnswer({ sessionId, answer, modelName }) {
  cleanupExpiredSessions();
  const session = sessions.get(String(sessionId || '').trim());
  if (!session) {
    const err = new Error('Interview session not found or expired. Please start a new session.');
    err.status = 404;
    throw err;
  }

  const safeAnswer = String(answer || '').trim();
  if (!safeAnswer) {
    const err = new Error('Answer is required.');
    err.status = 400;
    throw err;
  }

  const evaluation = await evaluateAnswer({ session, answer: safeAnswer, modelName });

  session.history.push({
    question: session.currentQuestion,
    answer: safeAnswer.slice(0, MAX_ANSWER_CHARS),
    score: evaluation.score,
    feedback: evaluation.feedback,
    improvements: evaluation.improvements,
  });

  session.turn += 1;
  session.updatedAt = Date.now();

  const completed = session.turn >= MAX_TURNS;
  const avgScore = session.history.length
    ? Math.round((session.history.reduce((acc, item) => acc + item.score, 0) / session.history.length) * 10) / 10
    : 0;

  if (!completed) {
    session.currentQuestion = evaluation.nextQuestion;
    sessions.set(session.sessionId, session);
  } else {
    sessions.delete(session.sessionId);
  }

  return {
    sessionId: session.sessionId,
    completed,
    turn: session.turn,
    maxTurns: MAX_TURNS,
    score: evaluation.score,
    averageScore: avgScore,
    feedback: evaluation.feedback,
    improvements: evaluation.improvements,
    followUp: evaluation.followUp,
    nextQuestion: completed ? '' : session.currentQuestion,
  };
}

const mockInterviewService = {
  suggestRoleFromResume,
  createSession,
  submitAnswer,
};

export default mockInterviewService;
