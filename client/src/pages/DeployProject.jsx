import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Github,
  Rocket,
  Globe,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  Lock,
  Unlock,
  Server,
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function DeployProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState([]);

  // GitHub push state
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pushingGithub, setPushingGithub] = useState(false);

  // Deploy state
  const [target, setTarget] = useState('fullstack');
  const [deploying, setDeploying] = useState(false);
  const [activeDeployCount, setActiveDeployCount] = useState(0);
  const [keyStatusLoading, setKeyStatusLoading] = useState(true);
  const [hasVercelToken, setHasVercelToken] = useState(false);
  const [hasRenderApiKey, setHasRenderApiKey] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [projRes, deployRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/deploy/${id}/deployments`),
      ]);
      const proj = projRes.data.project;
      setProject(proj);
      setRepoName(proj.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      setDeployments(deployRes.data.deployments);

      try {
        const keyRes = await api.get('/auth/deployment-keys');
        const keys = keyRes.data?.keys || {};
        setHasVercelToken(Boolean(keys.has_vercel_token));
        setHasRenderApiKey(Boolean(keys.has_render_api_key));
      } catch {
        setHasVercelToken(false);
        setHasRenderApiKey(false);
      }
    } catch {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setKeyStatusLoading(false);
      setLoading(false);
    }
  };

  const handlePushGithub = async () => {
    if (!repoName.trim()) {
      toast.error('Enter a repository name');
      return;
    }

    setPushingGithub(true);
    try {
      const res = await api.post(`/projects/${id}/github`, { repoName, isPrivate });
      setProject((prev) => ({ ...prev, github_repo_url: res.data.repoUrl }));
      toast.success('Code pushed to GitHub!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to push to GitHub');
    } finally {
      setPushingGithub(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await api.post(`/deploy/${id}`, { target });
      const startedDeployments = res.data.deployments || [];
      setDeployments((prev) => [...startedDeployments, ...prev]);
      setActiveDeployCount(startedDeployments.length);
      toast.success(`Deployment started for ${target}`);

      startedDeployments.forEach((dep) => {
        pollDeployment(dep.id);
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deploy');
      setDeploying(false);
    }
  };

  const pollDeployment = async (deployId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/deploy/status/${deployId}`);
        const dep = res.data.deployment;
        setDeployments((prev) => prev.map((d) => (d.id === deployId ? dep : d)));

        if (dep.status === 'deployed' || dep.status === 'failed') {
          clearInterval(interval);
          setActiveDeployCount((prev) => {
            const next = Math.max(prev - 1, 0);
            if (next === 0) {
              setDeploying(false);
            }
            return next;
          });

          if (dep.status === 'deployed') {
            setProject((prev) => {
              const isFrontend = dep.platform === 'vercel-frontend';
              const isBackend = dep.platform === 'render-backend';
              return {
                ...prev,
                deploy_url: prev.deploy_url || dep.url,
                deploy_frontend_url: isFrontend ? dep.url : prev.deploy_frontend_url,
                deploy_backend_url: isBackend ? dep.url : prev.deploy_backend_url,
              };
            });
            toast.success(`Deployed successfully! ${dep.url}`);
          } else {
            toast.error(dep.logs || 'Deployment failed');
          }
        }
      } catch {
        clearInterval(interval);
        setDeploying(false);
        setActiveDeployCount(0);
      }
    }, 5000);
  };

  if (loading) return <LoadingSpinner text="Loading deployment info..." />;
  if (!project) return null;

  const needsGithub = target === 'backend' || target === 'fullstack';
  const targetNeedsVercel = target === 'frontend' || target === 'fullstack';
  const targetNeedsRender = target === 'backend' || target === 'fullstack';
  const hasNeededKeys =
    (!targetNeedsVercel || hasVercelToken) &&
    (!targetNeedsRender || hasRenderApiKey);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to={`/project/${id}`} className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Project</span>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Deploy: {project.name}</h1>
        <p className="text-gray-400">Push to GitHub and deploy your project to the cloud.</p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">Connected Keys Check</h2>
          <Link to="/settings" className="text-xs text-orange-400 hover:text-orange-300">
            Manage in Settings
          </Link>
        </div>

        {keyStatusLoading ? (
          <p className="text-sm text-gray-500">Checking key status...</p>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-gray-800 p-3">
                <span className="text-gray-300">Vercel Token</span>
                <span className={`text-xs px-2 py-1 rounded ${hasVercelToken ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                  {hasVercelToken ? 'Connected' : 'Missing'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-800 p-3">
                <span className="text-gray-300">Render API Key</span>
                <span className={`text-xs px-2 py-1 rounded ${hasRenderApiKey ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                  {hasRenderApiKey ? 'Connected' : 'Missing'}
                </span>
              </div>
            </div>

            {!hasNeededKeys && (
              <div className="flex items-start space-x-2 rounded-lg border border-yellow-800/40 bg-yellow-900/20 p-3 text-yellow-300 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Missing required deployment keys for the selected target.
                  {targetNeedsVercel && !hasVercelToken ? ' Add Vercel token.' : ''}
                  {targetNeedsRender && !hasRenderApiKey ? ' Add Render API key.' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {(project.deploy_frontend_url || project.deploy_backend_url || project.deploy_url) && (
        <div className="card bg-linear-to-r from-green-900/30 to-emerald-900/30 border-green-800/50 mb-6">
          <p className="text-sm font-medium text-green-300 mb-3">Deployment URLs</p>

          <div className="space-y-2">
            {project.deploy_frontend_url && (
              <div className="p-2 rounded bg-black/20 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <Globe className="w-5 h-5 text-green-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-green-200">Frontend</p>
                    <a
                      href={project.deploy_frontend_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-300 hover:text-green-200 text-sm flex items-center gap-1"
                    >
                      <span className="truncate">{project.deploy_frontend_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {project.deploy_backend_url && (
              <div className="p-2 rounded bg-black/20 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <Server className="w-5 h-5 text-green-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-green-200">Backend</p>
                    <a
                      href={project.deploy_backend_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-300 hover:text-green-200 text-sm flex items-center gap-1"
                    >
                      <span className="truncate">{project.deploy_backend_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {!project.deploy_frontend_url && !project.deploy_backend_url && project.deploy_url && (
              <div className="p-2 rounded bg-black/20 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <Globe className="w-5 h-5 text-green-400 shrink-0" />
                  <a
                    href={project.deploy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-300 hover:text-green-200 text-sm flex items-center gap-1"
                  >
                    <span className="truncate">{project.deploy_url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold">1</div>
          <div>
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Github className="w-5 h-5" />
              <span>Push to GitHub</span>
            </h2>
            <p className="text-gray-400 text-sm">Create a GitHub repository and push your code</p>
          </div>
        </div>

        {project.github_repo_url ? (
          <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-300">Pushed to GitHub</span>
            </div>
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-400 hover:text-orange-300 flex items-center space-x-1"
            >
              <span>{project.github_repo_url}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Repository Name</label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-project"
                className="input-field"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                  isPrivate ? 'border-yellow-600 bg-yellow-900/20 text-yellow-400' : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span className="text-sm">{isPrivate ? 'Private' : 'Public'}</span>
              </button>
            </div>
            <button
              onClick={handlePushGithub}
              disabled={pushingGithub}
              className="btn-primary flex items-center space-x-2"
            >
              {pushingGithub ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Pushing...</span>
                </>
              ) : (
                <>
                  <Github className="w-5 h-5" />
                  <span>Push to GitHub</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold">2</div>
          <div>
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Rocket className="w-5 h-5" />
              <span>Deploy</span>
            </h2>
            <p className="text-gray-400 text-sm">Deploy frontend, backend, or both with URL sync</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <button
              onClick={() => setTarget('frontend')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'frontend'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-lg font-bold mb-1">Frontend</div>
              <p className="text-xs text-gray-400">Deploy client to Vercel</p>
            </button>
            <button
              onClick={() => setTarget('backend')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'backend'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-lg font-bold mb-1">Backend</div>
              <p className="text-xs text-gray-400">Deploy server to Render</p>
            </button>
            <button
              onClick={() => setTarget('fullstack')}
              className={`p-4 rounded-lg border-2 transition-all ${
                target === 'fullstack'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-lg font-bold mb-1">Fullstack</div>
              <p className="text-xs text-gray-400">Deploy both + sync URLs</p>
            </button>
          </div>

          {needsGithub && !project.github_repo_url && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Push to GitHub first to deploy backend on Render.</span>
            </div>
          )}

          {target === 'fullstack' && (
            <div className="text-xs text-gray-400 p-3 rounded-lg bg-gray-900/60 border border-gray-800">
              Fullstack flow: backend deploys first on Render, frontend deploys on Vercel with backend URL,
              then backend environment is updated with the frontend URL.
            </div>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || (needsGithub && !project.github_repo_url) || !hasNeededKeys}
            className="btn-primary w-full flex items-center justify-center space-x-2"
          >
            {deploying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                <span>
                  {target === 'frontend' && 'Deploy Frontend (Vercel)'}
                  {target === 'backend' && 'Deploy Backend (Render)'}
                  {target === 'fullstack' && 'Deploy Fullstack'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {deployments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Deployment History</h3>
          <div className="space-y-3">
            {deployments.map((dep) => (
              <div key={dep.id} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`w-2 h-2 rounded-full ${
                      dep.status === 'deployed' ? 'bg-green-400' :
                      dep.status === 'deploying' ? 'bg-yellow-400 animate-pulse' :
                      'bg-red-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium capitalize">{dep.platform.replace('-', ' ')}</p>
                      <p className="text-xs text-gray-500">{new Date(dep.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      dep.status === 'deployed' ? 'bg-green-400/10 text-green-400' :
                      dep.status === 'deploying' ? 'bg-yellow-400/10 text-yellow-400' :
                      'bg-red-400/10 text-red-400'
                    }`}>
                      {dep.status}
                    </span>
                    {dep.url && (
                      <a
                        href={dep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
                {dep.status === 'failed' && dep.logs && (
                  <p className="text-xs text-red-300 mt-2 wrap-break-word">{dep.logs}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
