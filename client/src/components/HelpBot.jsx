import { useState } from "react";
import { Bot, MessageCircle, Send, X, Loader2 } from "lucide-react";
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
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi, I am Genesis Help Bot. Ask me about credits, pricing, project generation, deployment, or account settings.",
      source: "faq",
    },
  ]);

  const sendMessage = async () => {
    const message = input.trim();
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

  return (
    <div className="fixed bottom-2 right-2 z-60 p-2 sm:bottom-5 sm:right-5 sm:p-5">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-2 w-[calc(100vw-1rem)] max-w-sm rounded-2xl border border-white/15 bg-gray-950/95 p-2 backdrop-blur-xl shadow-2xl sm:mb-3 sm:w-96"
          >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-orange-400" />
              <p className="text-sm font-semibold text-white">Genesis Help Bot</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
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
                className="h-10 w-10 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center"
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
