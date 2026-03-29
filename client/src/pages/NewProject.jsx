import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, Lightbulb, Cpu, ChevronDown, Check } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { validateProjectInput } from "../utils/validators";

const promptExamples = [
  "Build a todo app with user authentication, categories, due dates, and priority levels",
  "Create an e-commerce store with product listings, shopping cart, and checkout flow",
  "Build a blog platform with markdown editor, categories, comments, and user profiles",
  "Create a real-time chat application with rooms, direct messages, and online status",
  "Build a project management tool like Trello with boards, lists, and drag-and-drop cards",
  "Create a recipe sharing platform with search, ratings, and user collections",
];

const LOCKED_MODEL_ID = "gemini-2.5-pro";

function isModelAllowed(modelId) {
  return modelId === LOCKED_MODEL_ID || modelId.startsWith("mistral-");
}

export default function NewProject() {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [stack, setStack] = useState("nextjs-express");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);
  const navigate = useNavigate();

  const selectedModel = useMemo(() => {
    for (const provider of Object.values(providers)) {
      const found = provider.models?.find((m) => m.id === model);
      if (found) return found;
    }
    return null;
  }, [providers, model]);

  useEffect(() => {
    if (!isModelDropdownOpen) return undefined;

    const onDocumentClick = (event) => {
      if (!modelDropdownRef.current?.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [isModelDropdownOpen]);

  useEffect(() => {
    api
      .get("/projects/models")
      .then((res) => {
        setProviders(res.data.providers);
        setModel(LOCKED_MODEL_ID);
      })
      .catch(() => {
        setProviders({
          google: {
            label: "Google",
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                desc: "Best Gemini quality",
              },
              {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                desc: "Balanced speed and quality",
              },
              {
                id: "gemini-2.0-flash",
                name: "Gemini 2.0 Flash",
                desc: "Fast & efficient",
              },
            ],
          },
          anthropic: {
            label: "Anthropic",
            models: [
              {
                id: "claude-sonnet-4-6",
                name: "Claude Sonnet 4.6",
                desc: "Newest Sonnet release",
              },
            ],
          },
          mistral: {
            label: "Mistral",
            models: [
              {
                id: "mistral-small-latest",
                name: "Mistral Small",
                desc: "Fast and efficient",
              },
              {
                id: "mistral-medium-latest",
                name: "Mistral Medium",
                desc: "Balanced quality",
              },
              {
                id: "mistral-large-latest",
                name: "Mistral Large",
                desc: "Most capable Mistral",
              },
            ],
          },
          xai: {
            label: "Grok (xAI)",
            models: [
              {
                id: "grok-3-mini",
                name: "Grok 3 Mini",
                desc: "Fast Grok model",
              },
              {
                id: "grok-3",
                name: "Grok 3",
                desc: "Most capable Grok model",
              },
            ],
          },
        });
        setModel(LOCKED_MODEL_ID);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateProjectInput({ name, prompt });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/projects", { name, prompt, stack, model });
      toast.success("Project generation started!");
      navigate(`/project/${res.data.project.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-gray-400">
          Describe what you want to build and let AI generate it for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Stack
            </label>
            <select
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              className="input-field"
            >
              <option value="nextjs-express">Nextjs + Express.js</option>
              <option value="react-express">React (Vite) + Express.js</option>
              <option value="react-node">React + Node.js</option>
              <option value="vue-node">Vue + Node.js</option>
              <option value="nuxt-express">Nuxt + Express.js</option>
              <option value="sveltekit-node">SvelteKit + Node.js</option>
              <option value="astro-express">Astro + Express.js</option>
              <option value="fullstack">
                Full PERN Stack (PostgreSQL + Express + React + Node)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-400" />
                AI Model
              </span>
            </label>
            <div ref={modelDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen((open) => !open)}
                className="input-field w-full flex items-center justify-between"
                aria-haspopup="listbox"
                aria-expanded={isModelDropdownOpen}
              >
                <span className="text-left truncate">
                  {selectedModel
                    ? `${selectedModel.name}${selectedModel.desc ? ` - ${selectedModel.desc}` : ""}`
                    : "Select an AI model"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isModelDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl z-30 max-h-72 overflow-y-auto">
                  {Object.entries(providers).map(([key, provider]) => (
                    <div key={key} className="p-2">
                      <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {provider.label}
                      </p>
                      {provider.models.map((m) => {
                        const selected = model === m.id;
                        const disabled = !isModelAllowed(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              setModel(m.id);
                              setIsModelDropdownOpen(false);
                            }}
                            disabled={disabled}
                            className={`w-full flex items-start justify-between gap-2 text-left px-3 py-2 rounded-lg transition-colors ${
                              selected
                                ? "bg-orange-500/15 text-orange-300"
                                : disabled
                                  ? "text-gray-500 cursor-not-allowed opacity-60"
                                  : "text-gray-200 hover:bg-gray-800"
                            }`}
                            role="option"
                            aria-selected={selected}
                            aria-disabled={disabled}
                          >
                            <span>
                              <span className="block text-sm font-medium">{m.name}</span>
                              {m.desc && <span className="block text-xs text-gray-500 mt-0.5">{m.desc}</span>}
                              {disabled && <span className="block text-[11px] text-gray-600 mt-0.5">Disabled</span>}
                            </span>
                            {selected && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Project Description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the application you want to build. Include features, pages, functionality, and any specific requirements..."
              className="input-field min-h-45 resize-y"
              required
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Be as detailed as possible for better results. Include specific
              features, pages, and functionality.
            </p>
          </div>
        </div>

        {/* Prompt Examples */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-medium text-gray-300">
              Need inspiration? Try one of these:
            </h3>
          </div>
          <div className="grid gap-2">
            {promptExamples.map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPrompt(example);
                  if (!name) setName(example.split(" ").slice(1, 4).join(" "));
                }}
                className="text-left text-sm text-gray-400 hover:text-orange-400 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center space-x-2 text-lg py-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Generate Project</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
