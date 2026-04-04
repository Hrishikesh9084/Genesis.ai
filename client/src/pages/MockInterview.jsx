import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Play,
  Send,
  Square,
  Timer,
  Upload,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function MockInterview() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [isInferringRole, setIsInferringRole] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceCaptureTime, setVoiceCaptureTime] = useState(null);
  const [history, setHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [supportsSpeechToText, setSupportsSpeechToText] = useState(false);
  const [supportsSpeechSynthesis, setSupportsSpeechSynthesis] = useState(false);
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const userStreamRef = useRef(null);
  const isListeningRef = useRef(false);
  const answerRef = useRef("");
  const autoSubmitTimerRef = useRef(null);
  const manualStopRef = useRef(false);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    const RecognitionCtor = getSpeechRecognition();
    setSupportsSpeechToText(Boolean(RecognitionCtor));
    setSupportsSpeechSynthesis(typeof window !== "undefined" && "speechSynthesis" in window);

    if (!RecognitionCtor) return undefined;

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalText += `${transcript} `;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        setAnswer((prev) => {
          const updated = `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${finalText}`.trimStart();
          // Track when voice was last captured
          if (updated.trim().length > 0) {
            setVoiceCaptureTime(new Date().toLocaleTimeString());
          }
          return updated;
        });
        setLiveTranscript(finalText.trim());

        if (autoSubmitTimerRef.current) {
          window.clearTimeout(autoSubmitTimerRef.current);
        }

        autoSubmitTimerRef.current = window.setTimeout(() => {
          const combinedAnswer = `${answerRef.current} ${finalText}`.trim();
          if (!isSubmitting && combinedAnswer.split(/\s+/).filter(Boolean).length >= 3) {
            handleSubmitAnswer({ preventDefault: () => {} });
          }
        }, 1700);
      }

      if (interimText) {
        setLiveTranscript(interimText.trim());
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      if (!manualStopRef.current && answerRef.current.trim().split(/\s+/).filter(Boolean).length >= 3 && !isSubmitting) {
        if (autoSubmitTimerRef.current) {
          window.clearTimeout(autoSubmitTimerRef.current);
        }
        autoSubmitTimerRef.current = window.setTimeout(() => {
          handleSubmitAnswer({ preventDefault: () => {} });
        }, 500);
      }
      manualStopRef.current = false;
      if (isListening) {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      isListeningRef.current = false;
      setIsListening(false);

      const errorCode = event.error || "unknown";
      let errorMessage = "Voice capture stopped. Please try again.";

      switch (errorCode) {
        case "not-allowed":
        case "permission-denied":
          errorMessage = "Microphone access denied. Please check your browser permissions and allow access to the microphone.";
          break;
        case "no-speech":
          errorMessage = "No speech detected. Please speak clearly into your microphone.";
          break;
        case "audio-capture":
          errorMessage = "No microphone found. Please check that your microphone is connected and working.";
          break;
        case "network-error":
          errorMessage = "Network error. Speech recognition requires an internet connection. Please check your connection and try again.";
          break;
        case "service-not-available":
          errorMessage = "Speech recognition service is not available. Please try again later or use a different browser.";
          break;
        case "bad-grammar":
          errorMessage = "Language configuration error. Please refresh the page and try again.";
          break;
        case "aborted":
          return;
        default:
          errorMessage = `Voice capture error: ${errorCode}. Please try again.`;
      }

      toast.error(errorMessage);
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      if (autoSubmitTimerRef.current) {
        window.clearTimeout(autoSubmitTimerRef.current);
      }
      try {
        recognition.stop();
      } catch (_err) {
        // No-op
      }
    };
  }, [isListening]);

  const canStart = useMemo(() => {
    return resumeFile && !isStarting && !isInferringRole;
  }, [resumeFile, isStarting, isInferringRole]);

  const canRunVideoCall = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const formattedCallTime = useMemo(() => {
    const mins = Math.floor(callSeconds / 60).toString().padStart(2, "0");
    const secs = (callSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [callSeconds]);

  const interviewSummary = useMemo(() => {
    if (history.length === 0) return null;

    const averageScore = Math.round((history.reduce((total, item) => total + Number(item.score || 0), 0) / history.length) * 10) / 10;

    if (averageScore >= 8) {
      return {
        title: "Excellent performance",
        message: "You sounded structured, confident, and ready for a real interview. Keep this rhythm and you’ll be in strong shape for the live round.",
        color: "emerald",
      };
    }

    if (averageScore >= 6) {
      return {
        title: "Solid interview foundation",
        message: "Your answers are progressing well. Add sharper examples and stronger outcomes, and your real interview performance will climb quickly.",
        color: "cyan",
      };
    }

    return {
      title: "Good practice session",
      message: "This is exactly what mock interviews are for. Keep practicing the STAR format and your next attempt will feel much more natural.",
      color: "amber",
    };
  }, [history]);

  const getFinalInterviewResult = (overrideScore) => {
    const averageScore = typeof overrideScore === "number"
      ? overrideScore
      : history.length
        ? Math.round((history.reduce((total, item) => total + Number(item.score || 0), 0) / history.length) * 10) / 10
        : 0;

    let motivationalLine = "Keep practicing, stay calm, and you’ll be ready for the real interview.";
    if (averageScore >= 8) {
      motivationalLine = "You’re interviewing at a strong level. Keep this momentum and you’ll do great in the real round.";
    } else if (averageScore >= 6) {
      motivationalLine = "You have a solid foundation. A bit more structure and confidence will make you interview-ready.";
    }

    return {
      score: averageScore,
      motivationalLine,
      role: session?.role || role || "General Software Engineer",
      rounds: history.length,
    };
  };

  const redirectToResultPage = (overrideScore) => {
    const result = getFinalInterviewResult(overrideScore);
    try {
      window.sessionStorage.setItem("mockInterviewResult", JSON.stringify(result));
    } catch (_err) {
      // Ignore storage failures.
    }
    navigate("/careers/mock-interview/result", { state: result });
  };

  useEffect(() => {
    if (!isCallActive) return undefined;

    const intervalId = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isCallActive]);

  const attachStreamToVideo = (stream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const stopCamera = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop());
      userStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const startCamera = async () => {
    if (!canRunVideoCall) {
      toast.error("Camera is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      userStreamRef.current = stream;
      attachStreamToVideo(stream);
      setIsCameraOn(true);
    } catch (_err) {
      toast.error("Could not access camera or microphone. Check browser permissions.");
    }
  };

  const endCall = ({ resetSession = false, showResult = false, finalScore } = {}) => {
    setIsCallActive(false);
    setAiSpeaking(false);
    setCallSeconds(0);

    if (autoSubmitTimerRef.current) {
      window.clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_err) {
        // No-op.
      }
    }
    setIsListening(false);

    if (supportsSpeechSynthesis && typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }

    stopCamera();

    if (resetSession) {
      setSession(null);
    }

    if (showResult) {
      redirectToResultPage(finalScore);
    }
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const speakQuestion = (text) => {
    if (!supportsSpeechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setAiSpeaking(true);
    utterance.onend = () => setAiSpeaking(false);
    utterance.onerror = () => setAiSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    if (isListening || isListeningRef.current) {
      manualStopRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (_err) {
        // No-op
      }
      isListeningRef.current = false;
      setIsListening(false);
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (err) {
      isListeningRef.current = false;
      setIsListening(false);
      toast.error(`Could not start voice input: ${err.message || "Unknown error"}. Check browser permissions or try refreshing the page.`);
    }
  };

  const handleResumeSelection = async (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setResumeFile(selectedFile);

    if (!selectedFile) {
      return;
    }

    setIsInferringRole(true);
    try {
      const payload = new FormData();
      payload.append("resume", selectedFile);

      const response = await api.post("/careers/mock-interview/suggest-role", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const suggestedRole = String(response.data?.targetRole || "").trim();
      if (suggestedRole) {
        setRole(suggestedRole);
        toast.success(`Detected target role: ${suggestedRole}`);
      }
    } catch (_error) {
      toast.error("Could not auto-detect role from resume. You can still enter it manually.");
    } finally {
      setIsInferringRole(false);
    }
  };

  const handleStartInterview = async (event) => {
    event.preventDefault();
    if (!resumeFile) {
      toast.error("Upload your resume first.");
      return;
    }

    setIsStarting(true);
    setHistory([]);
    endCall({ resetSession: false });
    setLiveTranscript("");
    manualStopRef.current = false;

    try {
      const payload = new FormData();
      payload.append("resume", resumeFile);
      payload.append("role", role || "");

      const response = await api.post("/careers/mock-interview/start", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSession(response.data);
      setAnswer("");
      setLiveTranscript("");
      setCallSeconds(0);
      setIsCallActive(true);
      await startCamera();
      if (response.data?.currentQuestion) {
        speakQuestion(response.data.currentQuestion);
      }
      toast.success("Interview session started.");
    } catch (error) {
      const message = error.response?.data?.error || "Failed to start interview session.";
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmitAnswer = async (event) => {
    event.preventDefault();
    if (!session?.sessionId) {
      toast.error("Start interview first.");
      return;
    }

    const safeAnswer = answer.trim();
    if (!safeAnswer) {
      toast.error("Please provide your answer. Use the microphone to capture voice or type directly.");
      return;
    }

    const wordCount = safeAnswer.split(/\s+/).length;
    if (wordCount < 3) {
      toast.error(`Answer too short (${wordCount} words). Please provide at least 3 words.`);
      return;
    }

    setIsSubmitting(true);
    let retryCount = 0;
    const maxRetries = 2;

    const submitAnswerWithRetry = async () => {
      try {
        const response = await api.post("/careers/mock-interview/answer", {
          sessionId: session.sessionId,
          answer: safeAnswer,
        });

        const result = response.data;

        setHistory((prev) => [
          ...prev,
          {
            question: session.currentQuestion,
            answer: safeAnswer,
            score: result.score,
            feedback: result.feedback,
            improvements: result.improvements || [],
            averageScore: result.averageScore,
          },
        ]);

        setAnswer("");
        setLiveTranscript("");
        setVoiceCaptureTime(null);

        if (result.completed) {
          toast.success(`Interview complete. Average score: ${result.averageScore}/10`);
          endCall({ resetSession: true, showResult: true, finalScore: result.averageScore });
        } else {
          setSession((prev) => ({
            ...prev,
            currentQuestion: result.nextQuestion,
            turn: result.turn + 1,
          }));
          if (result.nextQuestion) {
            speakQuestion(result.nextQuestion);
          }
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Failed to submit answer.";
        const isNetworkError = error.response?.status >= 500 || String(errorMsg).includes('network');
        
        if (isNetworkError && retryCount < maxRetries) {
          retryCount += 1;
          toast.loading(`AI service temporarily unavailable, retrying... (${retryCount}/${maxRetries})`);
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return submitAnswerWithRetry();
        } else if (isNetworkError) {
          toast.error("AI recruiter service is temporarily unavailable. Please wait a moment and try again.");
        } else {
          toast.error(errorMsg);
        }
        throw error;
      }
    };

    try {
      await submitAnswerWithRetry();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <p className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-300">
          AI Live Video Interview
        </p>

        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          AI video call interview based on your resume
        </h1>

        <p className="mt-4 leading-7 text-slate-300">
          Upload your resume and join a live AI interview call with webcam + voice. The AI asks questions in real time and scores each response instantly.
        </p>

        <form className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={handleStartInterview}>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Resume file (PDF, DOC, DOCX)</span>
            <input
              className="input-field"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeSelection}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Target role</span>
            <input
              className="input-field"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder={isInferringRole ? "Analyzing resume..." : "Frontend Engineer"}
              maxLength={120}
            />
          </label>

          <div className="flex items-end">
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl" type="submit" disabled={!canStart}>
              <Upload className="h-4 w-4" />
              {isInferringRole ? "Analyzing Resume..." : isStarting ? "Starting..." : "Start Interview"}
            </button>
          </div>
        </form>

        {session && (
          <div className="mt-8 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3 text-sm">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${isCallActive ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${isCallActive ? "bg-emerald-400" : "bg-slate-400"}`} />
                  {isCallActive ? "In call" : "Call paused"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-slate-200">
                  <Timer className="h-3.5 w-3.5" />
                  {formattedCallTime}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={isCameraOn ? stopCamera : startCamera}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                >
                  {isCameraOn ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  {isCameraOn ? "Camera off" : "Camera on"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isCallActive) {
                      endCall({ resetSession: true, showResult: true });
                    } else {
                      setIsCallActive(true);
                      startCamera();
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isCallActive ? "border border-red-500/40 bg-red-500/15 text-red-200" : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200"}`}
                >
                  {isCallActive ? <PhoneOff className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                  {isCallActive ? "End call" : "Resume call"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">You (live camera)</p>
                <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${isCameraOn ? "opacity-100" : "opacity-0"}`}
                  />
                  {!isCameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                      Camera is off
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-900/40 to-slate-900/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-300">AI interviewer</p>
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-cyan-500/20 bg-black/50">
                  <div className={`absolute h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl ${aiSpeaking ? "animate-pulse" : ""}`} />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-500/20 text-cyan-100">
                    AI
                  </div>
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-1 text-xs text-cyan-100">
                    {aiSpeaking ? "Speaking" : "Listening"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-cyan-200">Turn {session.turn} of {session.maxTurns}</p>
                <p className="text-sm text-slate-300">Difficulty: <span className="text-white">{session.difficulty}</span></p>
              </div>

              <h2 className="mt-3 text-xl font-semibold text-white">Current question</h2>
              <p className="mt-2 text-slate-100 leading-7">{session.currentQuestion}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => speakQuestion(session.currentQuestion)}
                disabled={!supportsSpeechSynthesis}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Volume2 className="h-4 w-4" />
                Read Question
              </button>

              <button
                type="button"
                onClick={toggleListening}
                disabled={!supportsSpeechToText || !isCallActive}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  !supportsSpeechToText || !isCallActive
                    ? "border border-white/15 bg-white/5 text-slate-100 cursor-not-allowed opacity-50"
                    : isListening
                      ? "border border-red-500/60 bg-red-500/20 text-red-200 hover:bg-red-500/30"
                      : "border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isListening ? "Stop Listening" : "Start Voice Input"}
              </button>
            </div>

            <form className="mt-4" onSubmit={handleSubmitAnswer}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-sm text-slate-300">Your answer</label>
                <div className="flex items-center gap-2 text-xs">
                  {isListening && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      Speech locked while recording
                    </span>
                  )}
                  {voiceCaptureTime && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Voice captured at {voiceCaptureTime}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-1 ${answer.trim() ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400"}`}>
                    {answer.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              </div>
              <textarea
                className="input-field min-h-36 resize-y"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                readOnly={isListening}
                placeholder="Answer in detail. Mention decisions, trade-offs, and outcomes. Or use the microphone to capture your voice."
                minLength={5}
                maxLength={3000}
              />

              <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-cyan-300">Live preview</p>
                  {isListening && <span className="text-xs text-cyan-200">Auto-detecting when you finish speaking</span>}
                </div>
                <p className="mt-2 min-h-6 text-sm leading-6 text-slate-100">
                  {liveTranscript || (isListening ? "Listening... speak naturally and the answer will appear here live." : "Your spoken answer will appear here in real time.")}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button 
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    isSubmitting
                      ? "border border-cyan-500/40 bg-cyan-500/20 text-cyan-200 cursor-wait"
                      : answer.trim().split(/\s+/).filter(Boolean).length < 3
                        ? "border border-white/15 bg-white/5 text-slate-300 cursor-not-allowed opacity-50"
                        : "border border-cyan-500/60 bg-cyan-500/20 text-white hover:bg-cyan-500/30 hover:border-cyan-400/60"
                  }`}
                  type="submit" 
                  disabled={isSubmitting || answer.trim().split(/\s+/).filter(Boolean).length < 3}
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Sending to AI Recruiter..." : "Submit Answer to AI"}
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 hover:bg-white/10"
                  onClick={() => {
                    setAnswer("");
                    setLiveTranscript("");
                  }}
                >
                  <Square className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white">Interview feedback timeline</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No answers yet. Start the interview and submit your first response.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {history.map((item, index) => (
                <article key={`${index + 1}-${item.score}`} className="rounded-xl border border-white/10 bg-white/3 p-4">
                  <p className="text-xs text-slate-400">Round {index + 1}</p>
                  <p className="mt-2 text-sm text-slate-300"><span className="text-slate-400">Q:</span> {item.question}</p>
                  <p className="mt-2 text-sm text-slate-300"><span className="text-slate-400">A:</span> {item.answer}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">Score: {item.score}/10</span>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">Avg: {item.averageScore}/10</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-100">{item.feedback}</p>
                  {item.improvements?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {item.improvements.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        {!session && interviewSummary && (
          <div className={`mt-8 rounded-2xl border p-5 ${
            interviewSummary.color === "emerald"
              ? "border-emerald-500/20 bg-emerald-500/10"
              : interviewSummary.color === "cyan"
                ? "border-cyan-500/20 bg-cyan-500/10"
                : "border-amber-500/20 bg-amber-500/10"
          }`}>
            <p className={`text-xs uppercase tracking-wide ${interviewSummary.color === "emerald" ? "text-emerald-300" : interviewSummary.color === "cyan" ? "text-cyan-300" : "text-amber-300"}`}>
              Interview complete
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{interviewSummary.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-100">{interviewSummary.message}</p>
            <p className="mt-4 text-sm text-slate-200">
              Final score: <span className="font-semibold text-white">{Math.round((history.reduce((total, item) => total + Number(item.score || 0), 0) / history.length) * 10) / 10}/10</span>
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Keep practicing. The goal is not just to answer questions, but to sound calm, structured, and ready for the real interview.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-400">
          <Link to="/careers" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
            <Play className="h-4 w-4" />
            Explore open roles
          </Link>
          <Link to="/careers/apply" className="text-cyan-300 hover:text-cyan-200">Apply for a role</Link>
          {!supportsSpeechToText && <span className="text-amber-300">Voice input is not supported in this browser.</span>}
          {!canRunVideoCall && <span className="text-amber-300">Live video is not supported in this browser.</span>}
        </div>
      </div>
    </section>
  );
}
