import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, Lightbulb, Cpu } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const promptExamples = [
  "Build a todo app with user authentication, categories, due dates, and priority levels",
  "Create an e-commerce store with product listings, shopping cart, and checkout flow",
  "Build a blog platform with markdown editor, categories, comments, and user profiles",
  "Create a real-time chat application with rooms, direct messages, and online status",
  "Build a project management tool like Trello with boards, lists, and drag-and-drop cards",
  "Create a recipe sharing platform with search, ratings, and user collections",
];

export default function NewProject() {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [stack, setStack] = useState("react-express");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/projects/models")
      .then((res) => {
        setProviders(res.data.providers);
        setModel(res.data.default);
      })
      .catch(() => {
        setProviders({
          google: {
            label: "Google",
            models: [
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
        });
        setModel("gemini-2.5-flash");
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) {
      toast.error("Please fill in all fields");
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
              <option value="react-express">React + Express.js</option>
              <option value="react-node">React + Node.js</option>
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
            <div className="space-y-4">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-field"
              >
                {Object.entries(providers).map(([key, provider]) => (
                  <optgroup key={key} label={provider.label}>
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.desc ? ` - ${m.desc}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
              className="input-field min-h-[180px] resize-y"
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
