import fs from 'fs/promises';
import mockInterviewService from '../services/mockInterviewService.js';

const DEFAULT_MODEL = process.env.MOCK_INTERVIEW_MODEL || 'mistral-small-latest';

async function safeDeleteUploadedFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_err) {
    // Best-effort cleanup only.
  }
}

const startMockInterview = async (req, res, next) => {
  const resumePath = req.file?.path;
  try {
    const role = String(req.body?.role || 'General Software Engineer').trim();
    const modelName = String(req.body?.model || DEFAULT_MODEL).trim();

    const session = await mockInterviewService.createSession({
      resumeFilePath: resumePath,
      role,
      modelName,
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  } finally {
    await safeDeleteUploadedFile(resumePath);
  }
};

const answerMockInterviewQuestion = async (req, res, next) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const answer = String(req.body?.answer || '').trim();
    const modelName = String(req.body?.model || DEFAULT_MODEL).trim();

    const result = await mockInterviewService.submitAnswer({ sessionId, answer, modelName });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const suggestMockInterviewRole = async (req, res, next) => {
  const resumePath = req.file?.path;
  try {
    const modelName = String(req.body?.model || DEFAULT_MODEL).trim();

    const result = await mockInterviewService.suggestRoleFromResume({
      resumeFilePath: resumePath,
      modelName,
    });

    res.json(result);
  } catch (err) {
    next(err);
  } finally {
    await safeDeleteUploadedFile(resumePath);
  }
};

export default {
  suggestMockInterviewRole,
  startMockInterview,
  answerMockInterviewQuestion,
};
