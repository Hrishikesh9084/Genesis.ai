import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Code, Edit3, Rocket, Trash2, RefreshCw, Download, Loader2, X, Zap, Globe, ExternalLink, BrainCircuit } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import api from '../services/api';
import FileTree from '../components/FileTree';
import CodeEditor from '../components/CodeEditor';
import PreviewPane from '../components/PreviewPane';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DECISION_MEMORY_FILE = '.genesis/decision-memory.json';
const INTENT_OPTIONS = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'speed', label: 'Speed' },
  { value: 'quality', label: 'Quality' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'debug', label: 'Debug' },
];

function getVisibleFilePaths(files) {
  return Object.keys(files || {}).filter((path) => !path.startsWith('.genesis/'));
}

function getLatestIntentFromFiles(files) {
  try {
    const raw = files?.[DECISION_MEMORY_FILE];
    if (!raw) return 'balanced';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return 'balanced';
    return parsed[parsed.length - 1]?.intentMode || 'balanced';
  } catch {
    return 'balanced';
  }
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState('code');
  const [quickDeploying, setQuickDeploying] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainQuestion, setExplainQuestion] = useState('Explain the generated codebase architecture and main flows.');
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [intentMode, setIntentMode] = useState('balanced');
  const [intentModeTouched, setIntentModeTouched] = useState(false);

  useEffect(() => {
    if (selectedFile && !files[selectedFile]) {
      const firstFile = getVisibleFilePaths(files)[0] || null;
      setSelectedFile(firstFile);
    }
  }, [files, selectedFile]);

  useEffect(() => {
    if (!intentModeTouched) {
      setIntentMode(getLatestIntentFromFiles(files));
    }
  }, [files, intentModeTouched]);

  useEffect(() => {
    if (!explainOpen) return undefined;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [explainOpen]);

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (project?.status !== 'generating') return undefined;

    const interval = setInterval(() => {
      fetchProject();
    }, 1200);

    return () => clearInterval(interval);
  }, [project?.status, id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      const proj = res.data.project;
      setProject(proj);

      const parsedFiles = typeof proj.files === 'string' ? JSON.parse(proj.files) : proj.files;
      if (parsedFiles && Object.keys(parsedFiles).length > 0) {
        setFiles(parsedFiles);
        if (!selectedFile) {
          const firstFile = getVisibleFilePaths(parsedFiles)[0];
          setSelectedFile(firstFile);
        }
      }
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (content) => {
    setFiles((prev) => ({ ...prev, [selectedFile]: content }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${id}/files`, { files });
      toast.success('Files saved successfully');
    } catch (err) {
      toast.error('Failed to save files');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('Project deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  const handleStopGeneration = async () => {
    try {
      await api.post(`/projects/${id}/cancel`);
      toast.success('Generation stopped');
      setProject((prev) => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      toast.error('Failed to stop generation');
    }
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    for (const [filePath, content] of Object.entries(files)) {
      zip.file(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${project.name.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip`);
  };

  const handleQuickDeploy = async () => {
    setQuickDeploying(true);
    try {
      const res = await api.post('/deploy/deploy', { projectId: id });
      const newDeployment = res.data.deployment;
      toast.success('Deployment started! Check the Deploy page for live logs.');
      setProject((prev) => ({ 
        ...prev, 
        deploy_url: newDeployment.url, 
        deploy_platform: newDeployment.platform, 
        status: 'deploying' 
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deploy');
    } finally {
      setQuickDeploying(false);
    }
  };

  const handleExplainCodebase = async () => {
    setExplaining(true);
    try {
      const res = await api.post(`/projects/${id}/explain`, {
        question: explainQuestion,
        intentMode,
      });
      setExplanation(res.data.explanation);
      setExplainOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to explain codebase');
    } finally {
      setExplaining(false);
    }
  };

  const handleDownloadExplanationPdf = async () => {
    if (!explanation) {
      toast.error('No explanation available to download');
      return;
    }
    try {
      const res = await api.post(`/projects/${id}/explain/pdf`, { question: explainQuestion, intentMode }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      saveAs(blob, `${project.name.replace(/[^a-zA-Z0-9-_]/g, '-')}-explanation.pdf`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download PDF');
    }
  };

  if (loading) return <LoadingSpinner text="Loading project..." />;

  if (!project) return null;

  if (project.status === 'generating') {
    const filePaths = getVisibleFilePaths(files);
    const hasFiles = filePaths.length > 0;
    const previewFile = selectedFile || filePaths[0] || null;

    // Determine which generation step we're on based on file count
    const genSteps = [
      { label: 'Analyzing Prompt', icon: '🧠', threshold: 0 },
      { label: 'Scaffolding Project', icon: '📐', threshold: 1 },
      { label: 'Building Backend', icon: '⚙️', threshold: 3 },
      { label: 'Building Frontend', icon: '🎨', threshold: 8 },
      { label: 'Polishing & Testing', icon: '✨', threshold: 15 },
    ];
    const currentStep = genSteps.reduce((acc, step, i) => filePaths.length >= step.threshold ? i : acc, 0);

    return (
      <div className="h-[calc(100vh-128px)] flex flex-col min-h-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate max-w-50">{project.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">AI is generating your production application</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating
            </span>
          </div>
          <button
            onClick={handleStopGeneration}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Stop Generation</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-gray-950">
          {hasFiles ? (
            /* Show file tree + code editor + preview when files start appearing */
            <div className="grid h-full gap-4 p-4 xl:grid-cols-[280px_minmax(0,1.1fr)_minmax(0,1fr)]">
              <div
                data-lenis-prevent
                className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/70"
              >
                <div className="border-b border-gray-800 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Live files</p>
                      <p className="text-sm text-gray-300 mt-1">{filePaths.length} file{filePaths.length === 1 ? '' : 's'} generated</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse">● Live</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <FileTree files={files} onSelect={setSelectedFile} selectedFile={selectedFile} />
                </div>
              </div>

              <div className="min-h-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
                {selectedFile ? (
                  <CodeEditor
                    filePath={selectedFile}
                    content={files[selectedFile] || ''}
                    onChange={handleFileChange}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    Select a file to preview generated code
                  </div>
                )}
              </div>

              <div className="min-h-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
                <PreviewPane projectId={id} files={files} liveReload={true} />
              </div>
            </div>
          ) : (
            /* Premium animated generation screen when no files yet */
            <div className="flex items-center justify-center h-full relative overflow-hidden">
              {/* Animated Background Glow */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/5 via-purple-500/5 to-cyan-500/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-orange-400/8 to-indigo-500/8 blur-2xl" style={{ animation: 'spin 20s linear infinite' }} />
              </div>

              <div className="relative z-10 text-center max-w-lg px-6">
                {/* Orbital Animation */}
                <div className="relative w-32 h-32 mx-auto mb-8">
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/30">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  </div>
                  {/* Orbit ring 1 */}
                  <div className="absolute inset-0" style={{ animation: 'spin 3s linear infinite' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
                      <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
                    </div>
                  </div>
                  {/* Orbit ring 2 */}
                  <div className="absolute inset-[-8px]" style={{ animation: 'spin 5s linear infinite reverse' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
                      <div className="w-2.5 h-2.5 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50" />
                    </div>
                  </div>
                  {/* Orbit ring 3 */}
                  <div className="absolute inset-[-16px]" style={{ animation: 'spin 7s linear infinite' }}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50" />
                    </div>
                  </div>
                  {/* Orbit rings (visual) */}
                  <div className="absolute inset-0 rounded-full border border-dashed border-gray-700/30" />
                  <div className="absolute inset-[-8px] rounded-full border border-dashed border-gray-700/20" />
                  <div className="absolute inset-[-16px] rounded-full border border-dashed border-gray-700/15" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-orange-300 via-white to-purple-300 bg-clip-text text-transparent">
                  Generating Your Application
                </h2>
                <p className="text-gray-400 text-sm mb-8">
                  The AI is architecting, coding, and assembling your full-stack production app
                </p>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-1 mb-8">
                  {genSteps.map((step, i) => (
                    <div key={step.label} className="flex items-center">
                      <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500 ${
                        i < currentStep ? 'bg-green-900/30 text-green-400 border border-green-800/50' :
                        i === currentStep ? 'bg-orange-900/40 text-orange-300 border border-orange-700/50 shadow-lg shadow-orange-500/20' :
                        'bg-gray-800/40 text-gray-600 border border-gray-700/30'
                      }`}>
                        {i < currentStep ? (
                          <span>✓</span>
                        ) : i === currentStep ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span className="text-xs">{step.icon}</span>
                        )}
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {i < genSteps.length - 1 && (
                        <div className={`w-4 h-px mx-0.5 ${i < currentStep ? 'bg-green-700' : 'bg-gray-700'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Simulated Code Lines Animation */}
                <div className="bg-[#0a0e14] border border-gray-800 rounded-xl p-4 text-left overflow-hidden max-w-md mx-auto">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="flex space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono">genesis-ai generating...</span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center text-purple-400" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '0s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">1</span>
                      <span className="text-blue-400">import</span><span className="text-gray-300"> {'{ '}Express{' }'} </span><span className="text-blue-400">from</span><span className="text-green-400"> 'express'</span>
                    </div>
                    <div className="flex items-center" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '0.3s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">2</span>
                      <span className="text-blue-400">import</span><span className="text-gray-300"> {'{ '}Router{' }'} </span><span className="text-blue-400">from</span><span className="text-green-400"> './routes'</span>
                    </div>
                    <div className="flex items-center" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '0.6s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">3</span>
                      <span className="text-gray-600">// Setting up production server</span>
                    </div>
                    <div className="flex items-center" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '0.9s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">4</span>
                      <span className="text-purple-400">const</span><span className="text-cyan-300"> app</span><span className="text-gray-300"> = </span><span className="text-yellow-300">Express</span><span className="text-gray-300">()</span>
                    </div>
                    <div className="flex items-center" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '1.2s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">5</span>
                      <span className="text-cyan-300">app</span><span className="text-gray-300">.</span><span className="text-yellow-300">use</span><span className="text-gray-300">(</span><span className="text-yellow-300">Router</span><span className="text-gray-300">)</span>
                    </div>
                    <div className="flex items-center" style={{ animation: 'fadeInUp 0.5s ease-out', animationFillMode: 'both', animationDelay: '1.5s' }}>
                      <span className="text-gray-700 w-5 text-right mr-2">6</span>
                      <span className="w-2 h-3.5 bg-orange-400 animate-pulse rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <p className="text-[11px] text-gray-600 mt-6">
                  ⏱ Generation typically takes 30-90 seconds depending on complexity
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (project.status === 'cancelled') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="card py-16">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⊘</span>
          </div>
          <h2 className="text-2xl font-bold mb-3">Generation Cancelled</h2>
          <p className="text-gray-400 mb-6">The project generation was stopped.</p>
          <button onClick={fetchProject} className="btn-primary inline-flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Retry Generation</span>
          </button>
        </div>
      </div>
    );
  }

  if (project.status === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="card py-16">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-2xl font-bold mb-3">Generation Failed</h2>
          <p className="text-gray-400 mb-6">Something went wrong while generating your project.</p>
          <button onClick={fetchProject} className="btn-primary inline-flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const visibleFileCount = getVisibleFilePaths(files).length;

  return (
    <div className="h-[calc(100vh-128px)] flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold truncate max-w-50">{project.name}</h1>
          <span className="text-xs text-gray-500">{visibleFileCount} files</span>

          <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveView('code')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${activeView === 'code' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Code className="w-4 h-4" />
              <span>Code</span>
            </button>
            {/* <button
              type="button"
              onClick={() => setActiveView('preview')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${activeView === 'preview' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Rocket className="w-4 h-4" />
              <span>Preview</span>
            </button> */}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5">
            <span className="text-xs text-gray-400">Intent</span>
            <select
              value={intentMode}
              onChange={(e) => {
                setIntentMode(e.target.value);
                setIntentModeTouched(true);
              }}
              className="bg-transparent text-sm text-gray-200 focus:outline-none"
            >
              {INTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Live URL indicator */}
          {project.deploy_url && (
            <a
              href={project.deploy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 text-xs bg-green-900/30 text-green-400 px-3 py-1.5 rounded-lg border border-green-800/50 hover:border-green-600/50 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden lg:inline font-mono">Live</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm py-1.5 px-3 flex items-center space-x-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save</span>}
          </button>
          <Link to={`/project/${id}/edit`} className="btn-secondary text-sm py-1.5 px-3 flex items-center space-x-1.5">
            <Edit3 className="w-4 h-4" />
            <span className="hidden md:inline">AI Edit</span>
          </Link>
          <button
            onClick={handleExplainCodebase}
            disabled={explaining || visibleFileCount === 0}
            className="btn-secondary group text-sm py-1.5 px-3 flex items-center space-x-1.5 disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-cyan-900/30 transition-all duration-200"
            title="Explain generated codebase"
          >
            {explaining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BrainCircuit className="w-4 h-4 text-cyan-300 animate-pulse group-hover:animate-bounce" />
            )}
            <span className="hidden md:inline">Explain Codebase</span>
          </button>
          {/* Quick Deploy */}
          <button
            onClick={handleQuickDeploy}
            disabled
            className="text-sm py-1.5 px-3 flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
            title="Quick deploy is currently disabled"
          >
            {quickDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span className="hidden md:inline">Quick Deploy</span>
          </button>
          <button
            type="button"
            disabled
            className="btn-primary text-sm py-1.5 px-3 flex items-center space-x-1.5 cursor-not-allowed disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deploy is currently disabled"
          >
            <Rocket className="w-4 h-4" />
            <span className="hidden md:inline">Deploy</span>
          </button>
          <button onClick={handleDownload} className="btn-secondary text-sm py-1.5 px-3">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="text-gray-500 hover:text-red-400 p-1.5 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeView === 'code' ? (
          <>
            {/* File tree sidebar */}
            <div
              data-lenis-prevent
                className="w-64 bg-gray-900 border-r border-gray-800 overflow-hidden shrink-0 min-h-0"
            >
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Files
              </div>
              <FileTree files={files} onSelect={setSelectedFile} selectedFile={selectedFile} />
            </div>

            {/* Code editor */}
            <div className="flex-1 overflow-hidden min-h-0">
              {selectedFile ? (
                <CodeEditor
                  filePath={selectedFile}
                  content={files[selectedFile] || ''}
                  onChange={handleFileChange}
                  readOnly
                  liveTyping
                  />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a file to view
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div
              data-lenis-prevent
                className="w-64 bg-gray-900 border-r border-gray-800 overflow-hidden shrink-0 min-h-0"
            >
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Files
              </div>
              <FileTree files={files} onSelect={setSelectedFile} selectedFile={selectedFile} />
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              {selectedFile ? (
                <CodeEditor
                  filePath={selectedFile}
                  content={files[selectedFile] || ''}
                  readOnly
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a file to preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {explainOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Generated Codebase Explanation</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadExplanationPdf} disabled={!explanation} className="btn-secondary text-sm px-3 py-1.5 flex items-center space-x-2">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
                <button onClick={() => setExplainOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div data-lenis-prevent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Ask a focused question</label>
                <div className="flex gap-2">
                  <input
                    value={explainQuestion}
                    onChange={(e) => setExplainQuestion(e.target.value)}
                    className="input-field flex-1"
                    placeholder="Explain auth flow, API wiring, and folder architecture"
                  />
                  <button onClick={handleExplainCodebase} disabled={explaining} className="btn-primary px-4 py-2">
                    {explaining ? 'Explaining...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {explanation ? (
                <div className="space-y-4 text-sm">
                  <div className="card p-4">
                    <p className="text-gray-200 leading-relaxed">{explanation.overview}</p>
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-2">Architecture</h4>
                    {(explanation.architecture || []).map((item, index) => (
                      <p key={`arch-${index}`} className="text-gray-300">• {item}</p>
                    ))}
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-2">Request Flow</h4>
                    {(explanation.requestFlow || []).map((item, index) => (
                      <p key={`flow-${index}`} className="text-gray-300">• {item}</p>
                    ))}
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-2">Key Files</h4>
                    {(explanation.keyFiles || []).map((item, index) => (
                      <p key={`key-${index}`} className="text-gray-300">
                        • <span className="text-orange-300 font-mono">{item.path}</span>: {item.purpose}
                      </p>
                    ))}
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-2">Risks / Gaps</h4>
                    {(explanation.securityAndRisks || []).map((item, index) => (
                      <p key={`risk-${index}`} className="text-gray-300">• {item}</p>
                    ))}
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-2">Next Steps</h4>
                    {(explanation.nextSteps || []).map((item, index) => (
                      <p key={`next-${index}`} className="text-gray-300">• {item}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No explanation available yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
