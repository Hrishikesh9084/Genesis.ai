import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Github, Rocket, Globe, ExternalLink, Loader2, Check, AlertCircle, Lock, Unlock, Plus, Trash2, Eye, EyeOff, Download, Heart, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import api from '../services/api';
import { API_BASE_URL } from '../services/api';
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
  const [platform] = useState('genesis-managed');
  const [deploying, setDeploying] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState({});
  const [activeLogDeploymentId, setActiveLogDeploymentId] = useState(null);
  const [loadingActiveLogs, setLoadingActiveLogs] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);
  const completedToastByDeploymentRef = useRef(new Set());

  // Custom subdomain state
  const [customSubdomain, setCustomSubdomain] = useState('');

  // Env vars state
  const [envVars, setEnvVars] = useState([]);
  const [loadingEnvVars, setLoadingEnvVars] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvSecret, setNewEnvSecret] = useState(false);
  const [savingEnvVars, setSavingEnvVars] = useState(false);
  const [showEnvSection, setShowEnvSection] = useState(false);

  // Health monitoring state
  const [healthStatus, setHealthStatus] = useState(null); // 'healthy' | 'unhealthy' | 'checking' | null
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const healthIntervalRef = useRef(null);

  // Section collapse state
  const [showHistory, setShowHistory] = useState(true);

  const platformMeta = {
    'genesis-managed': {
      label: 'Genesis Managed',
      description: 'Zero-config deployment. Click deploy and get a live URL instantly.',
    },
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Fetch env vars when tab opens
  useEffect(() => {
    if (showEnvSection && envVars.length === 0 && !loadingEnvVars) {
      fetchEnvVars();
    }
  }, [showEnvSection]);

  // Health monitoring
  useEffect(() => {
    if (project?.deploy_url) {
      checkHealth();
      healthIntervalRef.current = setInterval(checkHealth, 30000);
    }
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
  }, [project?.deploy_url]);

  useEffect(() => {
    if (!activeLogDeploymentId) return undefined;

    const abortController = new AbortController();
    const token = localStorage.getItem('genesis_token');
    let disposed = false;
    let reconnectTimer = null;
    let connectAttempts = 0;

    const readSseStream = async () => {
      setLoadingActiveLogs(true);
      try {
        const response = await fetch(`${API_BASE_URL}/deploy/logs/stream/${activeLogDeploymentId}`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Unable to start live logs stream.');
        }

        connectAttempts = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            if (!chunk.trim()) continue;

            const lines = chunk.split('\n');
            const eventType = lines
              .find((line) => line.startsWith('event:'))
              ?.slice(6)
              .trim() || 'message';

            const dataLines = lines
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());

            if (dataLines.length === 0) continue;

            try {
              const payload = JSON.parse(dataLines.join('\n'));
              if (!payload?.deploymentId) continue;

              setDeploymentLogs((prev) => ({
                ...prev,
                [payload.deploymentId]: payload.logs || '',
              }));

              setDeployments((prev) => prev.map((dep) => (
                dep.id === payload.deploymentId
                  ? {
                      ...dep,
                      status: payload.status,
                      url: payload.url ?? dep.url,
                      platform: payload.platform ?? dep.platform,
                      logs: payload.logs || dep.logs,
                      updated_at: payload.updatedAt || dep.updated_at,
                    }
                  : dep
              )));

              if (payload.deploymentId === activeLogDeploymentId) {
                if (payload.status === 'deployed' && payload.url) {
                  setProject((prev) => ({
                    ...prev,
                    deploy_url: payload.url,
                    deploy_platform: payload.platform || prev.deploy_platform,
                  }));
                }

                if (['deployed', 'failed', 'stopped'].includes(String(payload.status))) {
                  setDeploying(false);
                }

                if (eventType === 'complete' && !completedToastByDeploymentRef.current.has(payload.deploymentId)) {
                  completedToastByDeploymentRef.current.add(payload.deploymentId);
                  if (payload.status === 'deployed') {
                    toast.success(payload.url ? `Deployed successfully! ${payload.url}` : 'Deployed successfully!');
                    setTimeout(checkHealth, 3000);
                  } else if (payload.status === 'failed') {
                    toast.error(payload.logs || 'Deployment failed');
                  } else if (payload.status === 'stopped') {
                    toast.success('Deployment stopped');
                  }
                }
              }
            } catch {
              // Ignore malformed event payloads.
            }
          }
        }

        // Reconnect when stream ends unexpectedly before terminal status.
        if (!disposed) {
          reconnectTimer = setTimeout(() => {
            readSseStream().catch(() => {});
          }, 1200);
        }
      } catch (err) {
        if (!disposed && err.name !== 'AbortError') {
          const message = String(err?.message || '');
          const isTransientStreamError =
            message.toLowerCase().includes('input stream') ||
            message.toLowerCase().includes('networkerror') ||
            message.toLowerCase().includes('failed to fetch') ||
            message.toLowerCase().includes('stream disconnected');

          if (connectAttempts < 5) {
            connectAttempts += 1;
            reconnectTimer = setTimeout(() => {
              readSseStream().catch(() => {});
            }, Math.min(1200 * connectAttempts, 5000));
          } else if (!isTransientStreamError) {
            toast.error(message || 'Live logs stream disconnected.');
          }
        }
      } finally {
        if (!disposed) {
          setLoadingActiveLogs(false);
        }
      }
    };

    readSseStream();

    return () => {
      disposed = true;
      abortController.abort();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setLoadingActiveLogs(false);
    };
  }, [activeLogDeploymentId, streamNonce]);

  const fetchData = async () => {
    try {
      const [projRes, deployRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/deploy/${id}/deployments`),
      ]);
      const proj = projRes.data.project;
      setProject(proj);
      setRepoName(proj.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      setCustomSubdomain(proj.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
      setDeployments(deployRes.data.deployments);
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvVars = async () => {
    setLoadingEnvVars(true);
    try {
      const res = await api.get(`/deploy/${id}/env`);
      setEnvVars(res.data.envVars || []);
    } catch (err) {
      toast.error('Failed to load environment variables');
    } finally {
      setLoadingEnvVars(false);
    }
  };

  const handleAddEnvVar = async () => {
    const key = newEnvKey.trim().toUpperCase();
    if (!key || !/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      toast.error('Key must be UPPER_SNAKE_CASE (e.g. DATABASE_URL)');
      return;
    }
    setSavingEnvVars(true);
    try {
      await api.put(`/deploy/${id}/env`, { vars: [{ key, value: newEnvValue, isSecret: newEnvSecret }] });
      toast.success(`${key} saved`);
      setNewEnvKey('');
      setNewEnvValue('');
      setNewEnvSecret(false);
      await fetchEnvVars();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save env var');
    } finally {
      setSavingEnvVars(false);
    }
  };

  const handleDeleteEnvVar = async (key) => {
    if (!window.confirm(`Delete ${key}?`)) return;
    try {
      await api.delete(`/deploy/${id}/env/${key}`);
      toast.success(`${key} deleted`);
      setEnvVars((prev) => prev.filter((v) => v.key !== key));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete env var');
    }
  };

  const checkHealth = useCallback(async () => {
    if (!project?.deploy_url) return;
    setHealthStatus('checking');
    try {
      const res = await fetch(project.deploy_url, { mode: 'no-cors', cache: 'no-store' });
      setHealthStatus('healthy');
    } catch {
      setHealthStatus('unhealthy');
    }
    setLastHealthCheck(new Date());
  }, [project?.deploy_url]);

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
      const payload = { projectId: id };
      if (customSubdomain?.trim()) {
        payload.subdomain = customSubdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      }
      const res = await api.post('/deploy/deploy', payload);
      const newDeployment = res.data.deployment;
      setDeployments((prev) => [newDeployment, ...prev]);
      
      // EXPLICITLY set the generated URL instantly from the response
      setProject((prev) => ({ 
        ...prev, 
        deploy_url: newDeployment.url, 
        deploy_platform: newDeployment.platform, 
        status: 'deploying' 
      }));

      toast.success('Deployment started!');
      setActiveLogDeploymentId(newDeployment.id);
      loadDeploymentLogs(newDeployment.id, { silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deploy');
      setDeploying(false);
    }
  };

  const loadDeploymentLogs = async (deployId, options = {}) => {
    const { silent = false } = options;
    try {
      if (!silent && activeLogDeploymentId === deployId) {
        setLoadingActiveLogs(true);
      }
      const res = await api.get(`/deploy/logs/${deployId}`);
      setDeploymentLogs((prev) => ({ ...prev, [deployId]: res.data.logs || '' }));
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to load logs');
      }
    } finally {
      if (!silent && activeLogDeploymentId === deployId) {
        setLoadingActiveLogs(false);
      }
    }
  };

  const openLiveLogs = (deployId) => {
    setActiveLogDeploymentId(deployId);
    setStreamNonce((prev) => prev + 1);
    loadDeploymentLogs(deployId);
  };

  const handleStopDeployment = async (deployId) => {
    try {
      await api.post(`/deploy/stop/${deployId}`);
      toast.success('Deployment stopped');
      await fetchData();
      setDeploying(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to stop deployment');
    }
  };

  const handleRedeploy = async () => {
    setDeploying(true);
    try {
      const res = await api.post(`/deploy/redeploy/${id}`);
      setDeployments((prev) => [res.data.deployment, ...prev]);
      toast.success('Redeploy started!');
      setActiveLogDeploymentId(res.data.deployment.id);
      loadDeploymentLogs(res.data.deployment.id, { silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to redeploy');
      setDeploying(false);
    }
  };

  const handleDownload = async () => {
    if (!project?.files) {
      toast.error('No files to download');
      return;
    }
    try {
      const zip = new JSZip();
      const parsed = typeof project.files === 'string' ? JSON.parse(project.files) : project.files;
      for (const [filePath, content] of Object.entries(parsed)) {
        zip.file(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${project.name.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip`);
      toast.success('Project downloaded!');
    } catch {
      toast.error('Failed to create download');
    }
  };

  const activeDeployment = deployments.find((dep) => dep.id === activeLogDeploymentId) || null;
  const activeLogs = activeLogDeploymentId ? (deploymentLogs[activeLogDeploymentId] || '') : '';

  if (loading) return <LoadingSpinner text="Loading deployment info..." />;
  if (!project) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to={`/project/${id}`} className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project</span>
        </Link>
        <button
          onClick={handleDownload}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-all text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Download ZIP</span>
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Deploy: {project.name}</h1>
        <p className="text-gray-400 text-lg">Zero-configuration deployment with managed infrastructure.</p>
      </div>

      {/* Live URL Banner with Health Status */}
      {project.deploy_url && (
        <div className="card bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-2 border-green-800/60 hover:border-green-700/80 shadow-lg shadow-green-500/10 mb-6 transform transition-all hover:shadow-green-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg relative">
                <Globe className="w-6 h-6 text-green-400" />
                {/* Health dot */}
                <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-green-900 ${
                  healthStatus === 'healthy' ? 'bg-green-400 shadow-lg shadow-green-400/50' :
                  healthStatus === 'unhealthy' ? 'bg-red-400 shadow-lg shadow-red-400/50' :
                  healthStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                  'bg-gray-500'
                }`} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-bold text-green-300 tracking-wide">✓ Your project is live!</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    healthStatus === 'healthy' ? 'bg-green-500/20 text-green-300' :
                    healthStatus === 'unhealthy' ? 'bg-red-500/20 text-red-300' :
                    healthStatus === 'checking' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {healthStatus === 'healthy' ? '● Healthy' :
                     healthStatus === 'unhealthy' ? '● Unreachable' :
                     healthStatus === 'checking' ? '● Checking...' :
                     '● Unknown'}
                  </span>
                </div>
                <a
                  href={project.deploy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 text-sm flex items-center space-x-1.5 mt-1 group transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 group-hover:animate-pulse" />
                  <span className="font-mono text-xs break-all">{project.deploy_url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </a>
                {lastHealthCheck && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Last checked: {lastHealthCheck.toLocaleTimeString()} • Auto-refreshes every 30s
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={checkHealth}
                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-lg transition-colors"
                title="Check health now"
              >
                <Heart className={`w-4 h-4 ${healthStatus === 'checking' ? 'animate-pulse' : ''}`} />
              </button>
              <a
                href={project.deploy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
              >
                Visit Now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Push to GitHub (Optional) */}
      <div className="card mb-6 border-l-4 border-gray-700 hover:border-gray-600 transition-colors">
        <div className="flex items-center space-x-4 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-sm font-bold text-gray-300">1</div>
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Github className="w-5 h-5 text-gray-400" />
              <span>Push to GitHub (Optional)</span>
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">Optional source sync for your own repository.</p>
          </div>
        </div>

        {project.github_repo_url ? (
          <div className="flex items-center justify-between p-4 bg-green-900/20 border-2 border-green-800/50 rounded-lg hover:border-green-700/70 transition-colors">
            <div className="flex items-center space-x-3">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-300 font-medium">Code pushed to GitHub</span>
            </div>
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-400 hover:text-orange-300 flex items-center space-x-1.5 group transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="font-mono text-xs">{project.github_repo_url}</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Repository Name</label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-awesome-project"
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1.5">Name your GitHub repository. Must be lowercase, no spaces.</p>
            </div>
            <div className="flex items-center space-x-3 bg-gray-800/50 p-3 rounded-lg">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border-2 font-medium transition-all ${
                  isPrivate ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400 shadow-lg shadow-yellow-500/10' : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{isPrivate ? 'Private Repository' : 'Public Repository'}</span>
              </button>
              <p className="text-xs text-gray-400">
                {isPrivate ? 'Only you can see this repo' : 'Anyone can see this repo'}
              </p>
            </div>
            <button
              onClick={handlePushGithub}
              disabled={pushingGithub}
              className="btn-primary w-full flex items-center justify-center space-x-2 py-3"
            >
              {pushingGithub ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Pushing to GitHub...</span>
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

      {/* Step 2: Environment Variables */}
      <div className="card mb-6 border-l-4 border-purple-700/50 hover:border-purple-600/50 transition-colors">
        <button
          onClick={() => setShowEnvSection(!showEnvSection)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center text-sm font-bold text-purple-300">2</div>
            <div className="text-left">
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <Settings2 className="w-5 h-5 text-purple-400" />
                <span>Environment Variables</span>
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">Set API keys, database URLs, and secrets for your deployed app</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {envVars.length > 0 && (
              <span className="text-xs bg-purple-900/30 text-purple-300 px-2.5 py-1 rounded-full font-medium">{envVars.length} var{envVars.length !== 1 ? 's' : ''}</span>
            )}
            {showEnvSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </button>

        {showEnvSection && (
          <div className="mt-5 space-y-4">
            {/* Existing env vars */}
            {loadingEnvVars ? (
              <div className="flex items-center justify-center py-6 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading variables...</span>
              </div>
            ) : envVars.length > 0 ? (
              <div className="space-y-2">
                {envVars.map((v) => (
                  <div key={v.key} className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg group hover:bg-gray-800/70 transition-colors">
                    <code className="text-sm text-purple-300 font-mono font-medium min-w-[140px]">{v.key}</code>
                    <span className="text-gray-600 text-xs">=</span>
                    <span className="text-sm text-gray-300 font-mono flex-1 truncate">
                      {v.is_secret ? (
                        <span className="text-gray-500 flex items-center space-x-1">
                          <EyeOff className="w-3 h-3" />
                          <span>{v.value}</span>
                        </span>
                      ) : (
                        v.value
                      )}
                    </span>
                    {v.is_secret && (
                      <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Secret</span>
                    )}
                    <button
                      onClick={() => handleDeleteEnvVar(v.key)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No environment variables set</p>
                <p className="text-xs mt-1">Add variables like DATABASE_URL, API_KEY, etc.</p>
              </div>
            )}

            {/* Add new env var */}
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <p className="text-xs font-semibold text-gray-300 mb-3">Add Variable</p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Key</label>
                  <input
                    type="text"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="DATABASE_URL"
                    className="input-field w-full font-mono text-sm"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">Value</label>
                  <input
                    type={newEnvSecret ? 'password' : 'text'}
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder="postgres://user:pass@host/db"
                    className="input-field w-full font-mono text-sm"
                  />
                </div>
                <button
                  onClick={() => setNewEnvSecret(!newEnvSecret)}
                  className={`px-3 py-2.5 rounded-lg border-2 transition-all ${
                    newEnvSecret ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400' : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                  }`}
                  title={newEnvSecret ? 'Marked as secret' : 'Not a secret'}
                >
                  {newEnvSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleAddEnvVar}
                  disabled={!newEnvKey.trim() || savingEnvVars}
                  className="btn-primary px-4 py-2.5 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingEnvVars ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="flex items-start space-x-2 p-3 bg-purple-900/15 border-l-4 border-purple-500/50 rounded-r-lg">
              <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="text-xs text-purple-300">Variables are injected into the runtime on next deploy or redeploy.</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Deploy */}
      <div className="card mb-6 border-l-4 border-orange-700/50 hover:border-orange-600/50 transition-colors">
        <div className="flex items-center space-x-4 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-700 to-orange-800 rounded-full flex items-center justify-center text-sm font-bold text-orange-300">3</div>
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Rocket className="w-5 h-5 text-orange-400" />
              <span>Deploy to Cloud</span>
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">One-click deploy to Genesis managed runtime</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Custom Subdomain Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Custom Subdomain</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={customSubdomain}
                  onChange={(e) => setCustomSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-project"
                  className="input-field w-full font-mono text-sm pr-32"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">.genesisapp.in</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Choose your subdomain. Lowercase letters, numbers, and hyphens only.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {Object.entries(platformMeta).map(([key, meta]) => {
              const isRecommended = key === 'genesis-managed';
              const isSelected = platform === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`relative p-5 rounded-xl border-2 transition-all text-left shadow-lg transform hover:scale-105 ${
                    isSelected
                      ? isRecommended
                        ? 'border-orange-400 bg-gradient-to-br from-orange-900/30 to-orange-800/20 shadow-orange-500/30'
                        : 'border-orange-500 bg-orange-500/10 shadow-orange-500/20'
                      : `border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800/70 ${isRecommended ? 'shadow-none' : ''}`
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                      ⭐ Recommended
                    </div>
                  )}
                  <div className="text-lg font-bold mb-2 text-orange-300">{meta.label}</div>
                  <p className="text-sm text-gray-300 leading-relaxed">{meta.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex items-start space-x-3 p-4 bg-blue-900/25 border-l-4 border-blue-400 rounded-r-lg">
            <Rocket className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 text-sm font-medium">No credentials required</p>
              <p className="text-blue-200 text-xs mt-1">Genesis handles provisioning, runtime, and wildcard routing automatically.</p>
            </div>
          </div>

          <button
            onClick={handleDeploy}
            disabled={deploying}
            className={`btn-primary w-full flex items-center justify-center space-x-3 py-4 text-lg font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              deploying ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
            }`}
          >
            {deploying ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <Rocket className="w-6 h-6" />
                <span>Deploy</span>
              </>
            )}
          </button>

          <button
            onClick={handleRedeploy}
            disabled={deploying}
            className="w-full border border-orange-500/40 hover:border-orange-400 text-orange-300 py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            Redeploy
          </button>
        </div>
      </div>

      {activeDeployment && (
        <div className="card mb-6 border-l-4 border-cyan-600/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                activeDeployment.status === 'deploying' ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/40' :
                activeDeployment.status === 'deployed' ? 'bg-green-400 shadow-lg shadow-green-400/40' :
                'bg-red-400 shadow-lg shadow-red-400/40'
              }`} />
              <div>
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <span>Live Deployment Logs</span>
                  {activeDeployment.status === 'deploying' && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium animate-pulse">● LIVE</span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: {activeDeployment.id.slice(0, 8)} • Platform: {activeDeployment.platform || 'genesis-managed'} • Status: <span className={
                    activeDeployment.status === 'deployed' ? 'text-green-400' :
                    activeDeployment.status === 'deploying' ? 'text-yellow-400' :
                    'text-red-400'
                  }>{activeDeployment.status}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeLogs || '');
                  toast.success('Logs copied to clipboard');
                }}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
                title="Copy logs"
              >
                📋 Copy
              </button>
              <button
                onClick={() => {
                  setStreamNonce((prev) => prev + 1);
                  loadDeploymentLogs(activeDeployment.id);
                }}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => setActiveLogDeploymentId(null)}
                className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Deployment Progress Steps */}
          {activeDeployment.status === 'deploying' && (
            <div className="flex items-center space-x-1 mb-4 overflow-x-auto pb-1">
              {['Queued', 'Writing Files', 'Installing Deps', 'Starting Runtime', 'Health Check'].map((step, i) => {
                const lowerLogs = (activeLogs || '').toLowerCase();
                const stepDone =
                  (i === 0) ||
                  (i === 1 && lowerLogs.includes('files written')) ||
                  (i === 2 && lowerLogs.includes('install finished')) ||
                  (i === 3 && (lowerLogs.includes('pm2 process is running') || lowerLogs.includes('container started'))) ||
                  (i === 4 && lowerLogs.includes('health check passed'));
                const stepActive =
                  (i === 1 && lowerLogs.includes('preparing') && !lowerLogs.includes('files written')) ||
                  (i === 2 && lowerLogs.includes('installing') && !lowerLogs.includes('install finished')) ||
                  (i === 3 && (lowerLogs.includes('starting') && !lowerLogs.includes('running'))) ||
                  (i === 4 && lowerLogs.includes('health check') && !lowerLogs.includes('passed'));

                return (
                  <div key={step} className="flex items-center space-x-1">
                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                      stepDone ? 'bg-green-900/30 text-green-400 border border-green-800/50' :
                      stepActive ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50 animate-pulse' :
                      'bg-gray-800/50 text-gray-500 border border-gray-700/30'
                    }`}>
                      {stepDone ? <span>✓</span> : stepActive ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-gray-600" />}
                      <span>{step}</span>
                    </div>
                    {i < 4 && <span className="text-gray-700 text-xs">→</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Terminal-style log viewer */}
          <div className="bg-[#0a0e14] border border-gray-800 rounded-xl overflow-hidden">
            {/* Terminal title bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <span className="text-[10px] text-gray-500 font-mono ml-2">genesis-deploy — {activeDeployment.id.slice(0, 8)}</span>
              </div>
              <span className="text-[10px] text-gray-600 font-mono">
                {activeDeployment.status === 'deploying' && '⏱ deploying...'}
                {activeDeployment.status === 'deployed' && '✓ completed'}
                {activeDeployment.status === 'failed' && '✕ failed'}
              </span>
            </div>

            {/* Log content with colored lines */}
            <div
              className="p-4 max-h-96 overflow-y-auto font-mono text-xs leading-6 scroll-smooth"
              ref={(el) => {
                if (el && activeDeployment.status === 'deploying') {
                  el.scrollTop = el.scrollHeight;
                }
              }}
            >
              {activeLogs ? (
                activeLogs.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  const isError = /\bERROR\b/i.test(trimmed);
                  const isWarn = /\bWARN(ING)?\b/i.test(trimmed);
                  const isInfo = /\bINFO\b/i.test(trimmed);
                  const isTimestamp = /^\[?\d{4}-\d{2}-\d{2}/.test(trimmed);

                  // Extract timestamp if present
                  const tsMatch = trimmed.match(/^\[?(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]?\s*/);
                  const timestamp = tsMatch ? tsMatch[1] : null;
                  const rest = timestamp ? trimmed.slice(tsMatch[0].length) : trimmed;

                  return (
                    <div key={i} className={`flex items-start hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors ${
                      isError ? 'bg-red-900/10' : isWarn ? 'bg-yellow-900/5' : ''
                    }`}>
                      <span className="text-gray-700 select-none w-8 shrink-0 text-right mr-3">{i + 1}</span>
                      {timestamp && (
                        <span className="text-gray-600 shrink-0 mr-2">{new Date(timestamp).toLocaleTimeString()}</span>
                      )}
                      {isError && <span className="text-red-500 font-bold shrink-0 mr-1">ERROR</span>}
                      {isWarn && <span className="text-yellow-500 font-bold shrink-0 mr-1">WARN</span>}
                      {isInfo && !isError && !isWarn && <span className="text-cyan-600 shrink-0 mr-1">INFO</span>}
                      <span className={`whitespace-pre-wrap break-all ${
                        isError ? 'text-red-300' :
                        isWarn ? 'text-yellow-300' :
                        isInfo ? 'text-cyan-200' :
                        'text-gray-300'
                      }`}>
                        {rest.replace(/^\s*(INFO|ERROR|WARN(ING)?)\s*/i, '')}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  {loadingActiveLogs ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin mb-2" />
                      <span className="text-sm">Connecting to log stream...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl mb-2">📋</span>
                      <span className="text-sm">No logs yet. Logs will stream here when deployment starts.</span>
                    </>
                  )}
                </div>
              )}

              {/* Blinking cursor when actively deploying */}
              {activeDeployment.status === 'deploying' && activeLogs && (
                <div className="flex items-center mt-1 px-2">
                  <span className="text-gray-700 w-8 shrink-0 text-right mr-3">&gt;</span>
                  <span className="w-2 h-4 bg-cyan-400 animate-pulse rounded-sm" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-gray-500">
              🔴 Streaming via SSE • Logs push in real-time while this panel is open
            </p>
            {activeDeployment.status === 'deploying' && (
              <button
                onClick={() => handleStopDeployment(activeDeployment.id)}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
              >
                Stop deployment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deployment History */}
      {deployments.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full mb-4"
          >
            <h3 className="text-xl font-bold">Deployment History</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-gray-700 px-3 py-1 rounded-full text-gray-300">
                {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>
          {showHistory && (
            <div className="space-y-3">
              {deployments.map((dep, idx) => {
                const isSuccess = dep.status === 'deployed';
                const isDeploying = dep.status === 'deploying';
                const isFailed = dep.status === 'failed';
                
                return (
                  <div 
                    key={dep.id} 
                    className={`group p-4 rounded-lg border-2 transition-all transform hover:scale-102 ${
                      isSuccess 
                        ? 'bg-green-900/10 border-green-800/50 hover:border-green-700/70' 
                        : isDeploying 
                        ? 'bg-yellow-900/10 border-yellow-800/50 hover:border-yellow-700/70'
                        : 'bg-red-900/10 border-red-800/50 hover:border-red-700/70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex flex-col items-center">
                          <span className={`w-3 h-3 rounded-full ${
                            isSuccess ? 'bg-green-400 shadow-lg shadow-green-400/50' :
                            isDeploying ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' :
                            'bg-red-400 shadow-lg shadow-red-400/50'
                          }`} />
                          {idx < deployments.length - 1 && (
                            <div className={`w-0.5 h-8 mt-2 ${
                              isSuccess ? 'bg-green-800/30' :
                              isDeploying ? 'bg-yellow-800/30' :
                              'bg-red-800/30'
                            }`} />
                          )}
                        </div>
                        <div className="pt-0.5">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-bold text-white">
                              {dep.platform === 'genesis-managed' || dep.platform === 'docker-cloud' ? 'Genesis Managed' : dep.platform.charAt(0).toUpperCase() + dep.platform.slice(1)}
                            </p>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                              isSuccess ? 'bg-green-400/20 text-green-300' :
                              isDeploying ? 'bg-yellow-400/20 text-yellow-300' :
                              'bg-red-400/20 text-red-300'
                            }`}>
                              {dep.status === 'deploying' ? '⏳ In Progress' : 
                               dep.status === 'deployed' ? '✓ Live' :
                               '✕ Failed'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {new Date(dep.created_at).toLocaleString()}
                          </p>
                          {isSuccess && dep.url && (
                            <a 
                              href={dep.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-orange-400 hover:text-orange-300 mt-1.5 flex items-center space-x-1 group-hover:underline"
                            >
                              <span>{dep.url}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {isFailed && (deploymentLogs[dep.id] || dep.logs) && (
                            <div className="text-xs text-red-300 mt-2 p-2 bg-red-900/20 rounded border border-red-800/30 max-h-20 overflow-y-auto font-mono">
                              {deploymentLogs[dep.id] || dep.logs}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isSuccess && dep.url && (
                          <a
                            href={dep.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors"
                            title="Visit deployment"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => openLiveLogs(dep.id)}
                          className={`p-1.5 rounded-lg transition-colors text-xs ${
                            activeLogDeploymentId === dep.id
                              ? 'bg-cyan-900/40 text-cyan-200 border border-cyan-700/50'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          }`}
                          title="View live logs"
                        >
                          Live Logs
                        </button>
                        {(dep.platform === 'genesis-managed' || dep.platform === 'docker-cloud') && isDeploying && (
                          <button
                            onClick={() => handleStopDeployment(dep.id)}
                            className="p-1.5 bg-red-900/40 hover:bg-red-800/50 text-red-300 rounded-lg transition-colors text-xs"
                            title="Stop deployment"
                          >
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
