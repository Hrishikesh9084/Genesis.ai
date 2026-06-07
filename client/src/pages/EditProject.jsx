import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2, Lightbulb, Cpu } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { validateEditPrompt } from '../utils/validators';
import inferIntentFromText from '../utils/intent';

const editExamples = [
  'Add a dark mode toggle to the navbar',
  'Add user authentication with login and register pages',
  'Connect the frontend to the backend API endpoints',
  'Add form validation to all input fields',
  'Add a responsive sidebar navigation',
  'Add pagination to the list views',
  'Add a search/filter feature to the main page',
  'Add error handling and loading states to all API calls',
];

const LOCKED_MODEL_ID = 'gemini-2.5-pro';

const intentOptions = [
  { value: 'balanced', label: 'Balanced', desc: 'Good speed and quality' },
  { value: 'speed', label: 'Speed', desc: 'Faster implementation' },
  { value: 'quality', label: 'Quality', desc: 'Higher rigor and maintainability' },
  { value: 'refactor', label: 'Refactor', desc: 'Cleaner architecture and readability' },
  { value: 'debug', label: 'Debug', desc: 'Bug-fix and correctness first' },
];

function isModelAllowed(modelId) {
  return modelId === LOCKED_MODEL_ID || modelId.startsWith('mistral-');
}

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editPrompt, setEditPrompt] = useState('');
  const [intentMode, setIntentMode] = useState('balanced');
  const [intentModeTouched, setIntentModeTouched] = useState(false);
  const [model, setModel] = useState('');
  const [providers, setProviders] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);

  useEffect(() => {
    if (!isModelDropdownOpen) return undefined;

    const onDocumentClick = (event) => {
      if (!modelDropdownRef.current?.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [isModelDropdownOpen]);

  useEffect(() => {
    fetchProject();
    api.get('/projects/models')
      .then((res) => {
        setProviders(res.data.providers);
      })
      .catch(() => {
        setProviders({
          google: {
            label: 'Google',
            models: [
              { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Best Gemini quality' },
              { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Balanced speed and quality' },
              { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Fast & efficient' },
            ],
          },
          anthropic: {
            label: 'Anthropic',
            models: [
              { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Newest Sonnet release' },
            ],
          },
          mistral: {
            label: 'Mistral',
            models: [
              { id: 'mistral-small-latest', name: 'Mistral Small', desc: 'Fast and efficient' },
              { id: 'mistral-medium-latest', name: 'Mistral Medium', desc: 'Balanced quality' },
              { id: 'mistral-large-latest', name: 'Mistral Large', desc: 'Most capable Mistral' },
            ],
          },
          xai: {
            label: 'Grok (xAI)',
            models: [
              { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Fast Grok model' },
              { id: 'grok-3', name: 'Grok 3', desc: 'Most capable Grok model' },
            ],
          },
        });
      });
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data.project);
      const existingModel = res.data.project.model;
      setModel(isModelAllowed(existingModel) ? existingModel : LOCKED_MODEL_ID);

      try {
        const parsedFiles = typeof res.data.project.files === 'string'
          ? JSON.parse(res.data.project.files)
          : res.data.project.files;
        const memoryRaw = parsedFiles?.['.genesis/decision-memory.json'];
        if (memoryRaw) {
          const memory = typeof memoryRaw === 'string' ? JSON.parse(memoryRaw) : memoryRaw;
          if (Array.isArray(memory) && memory.length > 0) {
            const latestIntent = memory[memory.length - 1]?.intentMode;
            if (intentOptions.some((item) => item.value === latestIntent)) {
              setIntentMode(latestIntent);
              setIntentModeTouched(false);
            }
          }
        }
      } catch {
        // Ignore malformed metadata and keep default intent mode.
      }
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Auto-select intent based on the edit prompt unless user changed it or a memory set it
  useEffect(() => {
    if (intentModeTouched) return;
    if (!editPrompt || !editPrompt.trim()) return;
    if (intentMode && intentMode !== 'balanced') return; // respect existing selection (e.g., from memory)
    const inferred = inferIntentFromText(editPrompt);
    if (inferred && inferred !== intentMode) setIntentMode(inferred);
  }, [editPrompt, intentModeTouched, intentMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateEditPrompt(editPrompt);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/projects/${id}/edit`, { prompt: editPrompt, model, intentMode });
      toast.success('Edit started! AI is updating your project...');
      navigate(`/project/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to edit project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading project..." />;
  if (!project) return null;

  let selectedModelLabel = 'Select an AI model';
  for (const provider of Object.values(providers)) {
    const found = provider.models?.find((m) => m.id === model);
    if (found) {
      selectedModelLabel = found.name;
      break;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to={`/project/${id}`} className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Project</span>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Edit: {project.name}</h1>
        <p className="text-gray-400">
          Describe the changes you want and AI will update your project, keeping the frontend and backend connected.
        </p>
      </div>

      {/* Current project info */}
      <div className="card mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Current Project Prompt</h3>
        <p className="text-gray-300 text-sm bg-gray-800 rounded-lg p-3">{project.prompt}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            What changes do you want to make?
          </label>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Describe the changes you want... e.g., 'Add a dark mode toggle' or 'Connect the login form to the backend auth API'"
            className="input-field min-h-37.5 resize-y"
            required
          />
          <p className="text-xs text-gray-500 mt-1.5">
            The AI will modify your existing code and keep frontend-backend connections intact.
          </p>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Intent Mode</label>
          <select
            value={intentMode}
            onChange={(e) => { setIntentMode(e.target.value); setIntentModeTouched(true); }}
            className="input-field"
          >
            {intentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.desc}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1.5">
            Intent mode guides how AI applies this edit to your existing codebase.
          </p>
        </div>

        <div className="card">
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
              className="input-field w-full text-left flex items-center justify-between"
              aria-haspopup="listbox"
              aria-expanded={isModelDropdownOpen}
            >
              <span className="truncate">{selectedModelLabel}</span>
              <span className={`text-xs text-gray-500 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isModelDropdownOpen && (
              <div
                data-lenis-prevent
                className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
              >
                {Object.entries(providers).map(([key, provider]) => (
                  <div key={key} className="p-2">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{provider.label}</p>
                    {provider.models.map((m) => {
                      const disabled = !isModelAllowed(m.id);
                      const selected = model === m.id;
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
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selected
                              ? 'bg-orange-500/15 text-orange-300'
                              : disabled
                                ? 'text-gray-500 opacity-60 cursor-not-allowed'
                                : 'text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          {m.name}{disabled ? ' (Disabled)' : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Choose Gemini 2.5 Pro or any Mistral model for edits.
          </p>
        </div>

        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-medium text-gray-300">Common edits:</h3>
          </div>
          <div className="grid gap-2">
            {editExamples.map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setEditPrompt(example)}
                className="text-left text-sm text-gray-400 hover:text-orange-400 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center space-x-2 text-lg py-3"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Applying Changes...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Apply AI Edit</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
