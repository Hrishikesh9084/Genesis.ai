import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import api from "../services/api";

function sourceLabel(source) {
  if (source === "ai") return "AI";
  if (source === "intent-fallback") return "Intent Fallback";
  if (source === "faq") return "FAQ Fallback";
  if (source === "error-fallback") return "Error Fallback";
  return "Bot";
}

export default function HelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState({ right: 20, bottom: 20 });
  const dragState = useRef(null);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi, I am Genesis Help Bot. Ask me about credits, pricing, project generation, deployment, account settings, or use the Project Planner tool.",
      source: "faq",
    },
  ]);

  const quickTools = [
    {
      id: "project-planner",
      label: "Project Planner",
      description: "Turn an idea into a step-by-step build plan.",
      prompt:
        "Act as a Genesis.ai project planner. I want a concise build plan with recommended stack, core features, database needs, and the first 5 implementation steps for my app idea.",
    },
  ];

  useEffect(() => {
    try {
      const savedPosition = window.localStorage.getItem("genesis-help-bot-position");
      if (!savedPosition) return;

      const parsed = JSON.parse(savedPosition);
      if (typeof parsed?.right === "number" && typeof parsed?.bottom === "number") {
        setPosition({
          right: Math.max(0, parsed.right),
          bottom: Math.max(0, parsed.bottom),
        });
      }
    } catch {
      // Ignore malformed stored position data.
    }
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      if (!dragState.current) return;

      const { startX, startY, startRight, startBottom } = dragState.current;
      const nextRight = startRight - (event.clientX - startX);
      const nextBottom = startBottom - (event.clientY - startY);

      const maxRight = Math.max(0, window.innerWidth - 56);
      const maxBottom = Math.max(0, window.innerHeight - 56);

      setPosition({
        right: Math.min(Math.max(0, nextRight), maxRight),
        bottom: Math.min(Math.max(0, nextBottom), maxBottom),
      });
    };

    const stopDragging = () => {
      if (!dragState.current) return;

      dragState.current = null;
      try {
        window.localStorage.setItem("genesis-help-bot-position", JSON.stringify(position));
      } catch {
        // Ignore storage failures.
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [position]);

  const startDragging = (event) => {
    if (event.button !== 0) return;

    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRight: position.right,
      startBottom: position.bottom,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const sendMessage = async (overrideMessage) => {
    const message = String(overrideMessage ?? input).trim();
    if (!message || sending) return;

    const nextMessages = [...messages, { role: "user", text: message }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post("/support/chat", {
        message,
        history: nextMessages,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data?.reply || "I could not generate a response right now.",
          source: data?.source || "faq",
        },
      ]);
    } catch (_err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Support service is temporarily unavailable. Please try again in a moment.",
          source: "error-fallback",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleToolClick = (tool) => {
    setInput(tool.prompt);
    void sendMessage(tool.prompt);
  };

  return (
    <div
      className="fixed z-60 p-2 sm:p-5"
      style={{ right: `${position.right}px`, bottom: `${position.bottom}px` }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-2 w-[calc(100vw-1rem)] max-w-sm rounded-2xl border border-white/15 bg-gray-950/95 p-2 backdrop-blur-xl shadow-2xl sm:mb-3 sm:w-96"
          >
            <div
              className="flex cursor-grab items-center justify-between border-b border-white/10 px-4 py-3.5 active:cursor-grabbing"
              onPointerDown={startDragging}
              title="Drag to move"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-orange-400" />
                <p className="text-sm font-semibold text-white">Genesis Help Bot</p>
              </div>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/10 px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                AI Tools
              </div>
              <div className="flex flex-wrap gap-2">
                {quickTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolClick(tool)}
                    disabled={sending}
                    className="group rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-left transition hover:border-orange-400/50 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    title={tool.description}
                  >
                    <div className="text-xs font-semibold text-orange-200 group-hover:text-orange-100">
                      {tool.label}
                    </div>
                    <div className="mt-0.5 max-w-56 text-[11px] leading-4 text-gray-400">
                      {tool.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              data-lenis-prevent
              className="max-h-[55vh] overflow-y-auto overscroll-contain touch-pan-y px-3 py-3 space-y-2.5 sm:max-h-80 sm:px-4 sm:py-4"
            >
              {messages.map((msg, index) => (
                <motion.div
                  key={`${msg.role}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.2) }}
                  className={`max-w-[92%] wrap-break-word rounded-xl px-3 py-2 text-sm sm:max-w-[90%] ${
                    msg.role === "user"
                      ? "ml-auto bg-orange-500 text-white"
                      : "mr-auto bg-white/10 text-gray-100"
                  }`}
                >
                  {msg.text}
                  {msg.role === "bot" && (
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                      Source: {sourceLabel(msg.source)}
                    </div>
                  )}
                </motion.div>
              ))}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mr-auto inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-gray-200"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking...
                </motion.div>
              )}
            </div>

            <div className="border-t border-white/10 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendMessage();
                  }}
                  className="input-field h-10 min-w-0 flex-1"
                  placeholder="Ask your question..."
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
        title="Open help bot"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </motion.div>
      </motion.button>
    </div>
  );
}
