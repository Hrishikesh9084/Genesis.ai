import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2, Lightbulb, Cpu } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { validateEditPrompt } from '../utils/validators';

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

function isModelAllowed(modelId) {
  return modelId === LOCKED_MODEL_ID || modelId.startsWith('mistral-');
}

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editPrompt, setEditPrompt] = useState('');
  const [model, setModel] = useState('');
  const [providers, setProviders] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateEditPrompt(editPrompt);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/projects/${id}/edit`, { prompt: editPrompt, model });
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
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              AI Model
            </span>
          </label>
          <div className="space-y-4">
            {Object.entries(providers).map(([key, provider]) => (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{provider.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {provider.models.map((m) => {
                    const selected = model === m.id;
                    const disabled = !isModelAllowed(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (!disabled) setModel(m.id);
                        }}
                        disabled={disabled}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          selected
                            ? 'border-orange-500 bg-orange-500/10'
                            : disabled
                              ? 'border-gray-800 bg-gray-900/40 text-gray-500 cursor-not-allowed opacity-60'
                              : 'border-gray-700/60 bg-gray-800/40 hover:border-gray-600'
                        }`}
                        aria-disabled={disabled}
                      >
                        <div className={`text-sm font-medium ${selected ? 'text-orange-400' : 'text-gray-200'}`}>
                          {m.name}
                        </div>
                        {m.desc && <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>}
                        {disabled && <div className="text-[11px] text-gray-600 mt-1">Disabled</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
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
