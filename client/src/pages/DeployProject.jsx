import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Github, Rocket, Globe, ExternalLink, Loader2, Check, AlertCircle, Lock, Unlock } from 'lucide-react';
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
  const [platform, setPlatform] = useState('vercel');
  const [deploying, setDeploying] = useState(false);

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
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
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
      const res = await api.post(`/deploy/${id}`, { platform });
      setDeployments((prev) => [res.data.deployment, ...prev]);
      toast.success(`Deployment to ${platform} started!`);
      pollDeployment(res.data.deployment.id);
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
          setDeploying(false);

          if (dep.status === 'deployed') {
            setProject((prev) => ({ ...prev, deploy_url: dep.url, deploy_platform: dep.platform }));
            toast.success(`Deployed successfully! ${dep.url}`);
          } else {
            toast.error('Deployment failed');
          }
        }
      } catch {
        clearInterval(interval);
        setDeploying(false);
      }
    }, 5000);
  };

  if (loading) return <LoadingSpinner text="Loading deployment info..." />;
  if (!project) return null;

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

      {/* Live URL Banner */}
      {project.deploy_url && (
        <div className="card bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-800/50 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-300">Your project is live!</p>
                <a
                  href={project.deploy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 text-sm flex items-center space-x-1"
                >
                  <span>{project.deploy_url}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <a
              href={project.deploy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm py-1.5 px-3"
            >
              Visit
            </a>
          </div>
        </div>
      )}

      {/* Step 1: Push to GitHub */}
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

      {/* Step 2: Deploy */}
      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold">2</div>
          <div>
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Rocket className="w-5 h-5" />
              <span>Deploy to Cloud</span>
            </h2>
            <p className="text-gray-400 text-sm">Deploy your project and get a live URL</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPlatform('vercel')}
              className={`p-4 rounded-lg border-2 transition-all ${
                platform === 'vercel'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-lg font-bold mb-1">Vercel</div>
              <p className="text-xs text-gray-400">Best for frontend & serverless</p>
            </button>
            <button
              onClick={() => setPlatform('render')}
              className={`p-4 rounded-lg border-2 transition-all ${
                platform === 'render'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="text-lg font-bold mb-1">Render</div>
              <p className="text-xs text-gray-400">Best for full-stack & databases</p>
            </button>
          </div>

          {platform === 'render' && !project.github_repo_url && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Push to GitHub first to deploy on Render.</span>
            </div>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || (platform === 'render' && !project.github_repo_url)}
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
                <span>Deploy to {platform === 'vercel' ? 'Vercel' : 'Render'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Deployment History */}
      {deployments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Deployment History</h3>
          <div className="space-y-3">
            {deployments.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`w-2 h-2 rounded-full ${
                    dep.status === 'deployed' ? 'bg-green-400' :
                    dep.status === 'deploying' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{dep.platform}</p>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
