# Mock Interview Feature - Detailed Technical Documentation

## Scope

This document covers only the AI Mock Interview feature implementation in the current codebase.

Excluded on purpose:
- Admin control panels and admin workflows
- Application-level route mapping/navigation design

## Feature Goal

The mock interview module simulates a live AI interviewer based on a candidate resume.
It supports:
- Resume-driven role inference
- Session-based interview generation
- Voice input (speech-to-text)
- AI voice output (speech synthesis)
- Webcam call-style experience
- Multi-turn scoring and feedback timeline
- End-of-session result handoff

## Primary Frontend Module

Main page component:
- `client/src/pages/MockInterview.jsx`

### Frontend Responsibilities

1. Capture user input
- Resume upload (PDF, DOC, DOCX)
- Optional target role override
- Typed or spoken answer input

2. Manage session lifecycle
- Start interview
- Track current turn and timer
- Submit answers and update history
- End call, cleanup media/speech resources

3. Render real-time interview UI
- Live user camera preview
- AI speaking/listening visual state
- Current question and round metadata
- Feedback timeline and summary

4. Browser capability checks
- Speech recognition availability
- Speech synthesis availability
- Camera/media capability availability

## Frontend State Model

Core state variables:
- `role`: User-entered or inferred target role
- `resumeFile`: Uploaded resume file object
- `isInferringRole`: Role inference in progress
- `isStarting`: Start session request in progress
- `session`: Active session payload from backend
- `answer`: Answer editor text
- `liveTranscript`: Current speech transcript preview
- `isSubmitting`: Answer submission in progress
- `voiceCaptureTime`: Last successful speech capture timestamp
- `history`: Completed rounds with scoring and coaching
- `isListening`: Microphone capture state
- `isCallActive`: Call state for timer and controls
- `callSeconds`: Call duration counter
- `isCameraOn`: Local camera stream state
- `aiSpeaking`: Speech synthesis playback state
- `supportsSpeechToText`: Browser STT support flag
- `supportsSpeechSynthesis`: Browser TTS support flag

Important refs:
- `recognitionRef`: Active speech recognition instance
- `videoRef`: Local video element reference
- `userStreamRef`: Media stream for camera/mic
- `isListeningRef`: Mutable listening flag to avoid stale closures
- `answerRef`: Latest answer value for delayed auto-submit logic
- `autoSubmitTimerRef`: Timer handle for speech pause auto-submit
- `manualStopRef`: Distinguishes manual stop from natural recognition end

## Speech-to-Text Flow

Speech recognition setup:
- Uses `window.SpeechRecognition` or `window.webkitSpeechRecognition`
- Configured as continuous with interim results

Recognition event behavior:
1. `onstart`
- Marks listening active (`isListening`, `isListeningRef`)

2. `onresult`
- Separates final transcript and interim transcript
- Appends final text to answer box
- Updates live transcript preview
- Stores voice capture time when text becomes non-empty
- Starts/restarts an auto-submit timer (1.7 seconds)

3. `onend`
- Stops listening state
- If not manually stopped and minimum words reached, schedules a short auto-submit

4. `onerror`
- Maps browser error codes to user-friendly toasts
- Handles common states:
  - permission denied
  - no speech
  - no audio device
  - network issues
  - service unavailable

Auto-submit guardrails:
- Requires at least 3 words before submission
- Prevents submission while already submitting

## Text-to-Speech Flow

AI question playback uses browser speech synthesis:
- Cancels previous utterance before speaking a new one
- Creates `SpeechSynthesisUtterance` with controlled rate and pitch
- Toggles `aiSpeaking` to drive interviewer visual indicators
- Supports manual "Read Question" replay

## Camera and Call Experience

Media handling:
- Requests user media with preferred 1280x720 camera constraints and audio enabled
- Attaches stream to local video element
- Stops all tracks and clears element source on call end or camera off

Call controls:
- Start/resume call activates timer and camera workflow
- End call performs full cleanup:
  - stop timer
  - clear pending auto-submit timers
  - stop speech recognition
  - cancel speech synthesis
  - stop media tracks

## Interview Session Lifecycle

### 1. Resume selection and role suggestion

When a resume is selected:
- File is stored in local state
- Role suggestion request is triggered
- If backend returns target role, role input is auto-filled
- User can still manually edit role

### 2. Interview start

Start action requirements:
- User must be authenticated
- Resume file must be present

On success:
- Receives a new session payload
- Resets answer/transcript/timer state
- Activates call state
- Starts camera
- Speaks opening question

### 3. Answer submission

Validation before send:
- Active session must exist
- Answer must be non-empty
- Minimum 3 words required

Submission logic:
- Sends current answer with session id
- Adds returned feedback into timeline history
- Clears current answer and transcript
- If completed, ends call and generates final result
- If not completed, sets next question and continues

Retry behavior:
- Retries temporary server/network failures up to 2 times
- 1-second delay between retries
- Shows temporary service availability messages

### 4. Completion and final result

When interview completes:
- Computes or uses backend average score
- Creates final result object (score, motivational line, role, rounds)
- Persists result in `sessionStorage`
- Triggers result-page handoff using navigation state

## Backend Modules

Controller:
- `server/controllers/mockInterviewController.js`

Service:
- `server/services/mockInterviewService.js`

### Backend Responsibilities

1. Parse uploaded resumes
- PDF parsing via `pdf-parse`
- DOCX text extraction via `mammoth`
- Fallback plain text extraction for legacy/unknown formats

2. Infer target role
- Uses structured JSON AI response
- Falls back to `General Software Engineer` when needed

3. Build interview blueprint
- Candidate summary
- Strengths
- Focus areas
- Opening question
- Question plan
- Recommended difficulty

4. Create and store active sessions in memory
- Session id generated via UUID
- Tracks turn count, history, current question, and metadata

5. Evaluate submitted answers
- Sends role, difficulty, interview history, and answer to AI evaluator
- Receives structured score, feedback, improvements, and next question

6. Compute average score and completion status
- Interview max turns fixed at 5
- Session removed from memory when completed

7. Cleanup temporary uploaded files
- Best-effort deletion after controller processing

## Backend Session Data Contract

Session fields stored in memory include:
- `sessionId`
- `role`
- `resumeText` (truncated)
- `candidateSummary`
- `strengths`
- `focusAreas`
- `questionPlan`
- `currentQuestion`
- `difficulty`
- `history[]`
- `turn`
- `createdAt`, `updatedAt`

History entry fields:
- `question`
- `answer`
- `score`
- `feedback`
- `improvements[]`

## Core Limits and Guardrails

Backend constants:
- `MAX_RESUME_CHARS = 14000`
- `MAX_ANSWER_CHARS = 3000`
- `MAX_TURNS = 5`
- Session TTL: 1 hour (`ACTIVE_SESSIONS_TTL_MS`)

TTL maintenance:
- Expired sessions are purged on interval (every 10 minutes)
- Cleanup is also invoked on answer submission requests

Input quality threshold:
- Resume extraction must produce at least 120 characters
- Otherwise interview creation/role inference returns an error

Score normalization:
- Scores are constrained to 0-10 and rounded to one decimal place

## AI Prompting Strategy

The service uses structured JSON prompting for three tasks:
1. Role inference
2. Interview blueprint generation
3. Per-answer evaluation

Prompt design characteristics:
- Explicit JSON schema requirement
- Resume text truncation to controlled token footprint
- Contextual evaluation using full interview history
- Fallback defaults when model output is incomplete

## Error Handling Strategy

Frontend:
- Shows actionable toast messages for speech, media, auth, and submission failures
- Distinguishes short-answer validation from server issues
- Retries transient AI/service errors

Backend:
- Throws descriptive errors for invalid session and invalid answer
- Uses status codes where applicable (for example, missing/expired session)
- Applies resilient fallback values when AI responses are partial

File lifecycle safety:
- Uploaded files are deleted in `finally` blocks to prevent storage leaks

## Dependencies Used by This Feature

Frontend/browser APIs:
- SpeechRecognition/WebkitSpeechRecognition
- SpeechSynthesis API
- MediaDevices/getUserMedia

Backend packages:
- `pdf-parse`
- `mammoth`
- `uuid`

Shared service dependency:
- AI structured JSON generation via `generateStructuredJson` from `aiGenerator.js`

## UX Details and Practical Behavior

1. Real-time confidence cues
- AI speaking state and call status badges provide immediate context

2. Voice-first workflow
- User can answer by speaking without manual submit after pauses
- Live transcript confirms speech capture continuously

3. Feedback timeline
- Each round records question, answer, score, average, and improvement points
- Enables post-session reflection on progression

4. Session-end motivation
- Summary messaging is tiered by average score bands

## Known Constraints

1. In-memory session storage
- Sessions are not persisted across server restarts
- Horizontal scaling requires shared session storage to keep continuity

2. Browser feature variability
- Speech recognition support differs by browser and platform
- Camera/mic permissions can block full experience

3. AI availability dependency
- Temporary service issues can impact answer evaluation latency

## Security and Privacy Notes

1. Resume handling
- Resume files are processed server-side and deleted after processing
- Extracted text is kept in active in-memory session context for interview generation

2. Client-side result persistence
- Final result summary is stored in browser session storage for handoff only

3. Access control
- Frontend enforces authenticated start for interview creation

## Testing Recommendations

Functional coverage:
1. Resume upload with PDF and DOCX
2. Role inference success and fallback
3. Interview start with and without role override
4. Voice capture start/stop and auto-submit behavior
5. Manual answer submission validation and retries
6. Turn progression until completion at 5 turns
7. Session expiration behavior after TTL

Edge-case coverage:
1. Empty/low-quality resume extraction
2. Browser without STT/TTS/camera support
3. Mid-session network/API failures
4. Rapid toggling of mic/camera/call controls

## Operations Notes

Configuration:
- Interview model can be configured with `MOCK_INTERVIEW_MODEL`
- Default model fallback is `gpt-4o-mini`

Observability improvements to consider:
1. Add structured logs for session lifecycle events
2. Add metrics for average score distribution and completion rate
3. Add error-rate monitoring for STT and evaluation API failures

## Summary

The Mock Interview feature is a session-driven, resume-aware AI interview system combining browser media APIs with backend structured AI evaluation. It is designed for realistic interview practice with immediate scoring, coaching feedback, and a strong voice-and-video user experience, while keeping the implementation isolated from admin controls and route architecture concerns.