import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Github, Key, Save, Loader2, User } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveGithub = async () => {
    if (!githubToken.trim()) {
      toast.error('Enter a GitHub personal access token');
      return;
    }

    setSaving(true);
    try {
      await api.put('/auth/github-token', { github_token: githubToken });
      toast.success('GitHub token saved!');
      setGithubToken('');
    } catch (err) {
      toast.error('Failed to save token');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Profile */}
      <div className="card mb-6 p-2">
        <div className="flex items-center space-x-3 mb-4">
          <User className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <p className="text-white  border border-white p-2 w-sm">{user?.name}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <p className="text-white">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* GitHub Token */}
      <div className="card mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Github className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">GitHub Integration</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Add a GitHub Personal Access Token to push generated projects to your GitHub account.
          The token needs <code className="text-orange-400">repo</code> scope.
        </p>
        <div className="flex space-x-3">
          <div className="relative flex-1">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="input-field pl-11"
            />
          </div>
          <button
            onClick={handleSaveGithub}
            disabled={saving}
            className="btn-primary flex items-center space-x-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Create a token at{' '}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=Genesis.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline"
          >
            GitHub Settings → Developer Settings → Personal Access Tokens
          </a>
        </p>
      </div>

      {/* API Keys Info */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <Key className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Deployment Keys</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Deployment API keys (Vercel, Render) are configured on the server side by the administrator.
          Contact your admin to set up deployment capabilities.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-gray-300">Vercel</span>
            <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">Server-side</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-gray-300">Render</span>
            <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">Server-side</span>
          </div>
        </div>
      </div>
    </div>
  );
}
