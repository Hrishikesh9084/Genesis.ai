import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Github, Key, Save, Loader2, User, Upload, AlertTriangle, Trash2, LogOut, DeleteIcon, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, updateProfile, uploadProfileImage, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [vercelToken, setVercelToken] = useState('');
  const [renderApiKey, setRenderApiKey] = useState('');
  const [renderOwnerId, setRenderOwnerId] = useState('');
  const [hasVercelToken, setHasVercelToken] = useState(false);
  const [hasRenderApiKey, setHasRenderApiKey] = useState(false);
  const [savingDeployKeys, setSavingDeployKeys] = useState(false);
  const [loadingDeployKeys, setLoadingDeployKeys] = useState(true);
  const [savedRenderOwnerId, setSavedRenderOwnerId] = useState('');
  const [showVercelToken, setShowVercelToken] = useState(false);
  const [showRenderApiKey, setShowRenderApiKey] = useState(false);
  const [removingVercelToken, setRemovingVercelToken] = useState(false);
  const [removingRenderApiKey, setRemovingRenderApiKey] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileImage(user?.avatar_url || '');
  }, [user]);

  useEffect(() => {
    const fetchDeploymentKeys = async () => {
      try {
        const res = await api.get('/auth/deployment-keys');
        const keys = res.data?.keys || {};
        setHasVercelToken(Boolean(keys.has_vercel_token));
        setHasRenderApiKey(Boolean(keys.has_render_api_key));
        const ownerId = keys.render_owner_id || '';
        setRenderOwnerId(ownerId);
        setSavedRenderOwnerId(ownerId);
      } catch {
        toast.error('Failed to load deployment key status');
      } finally {
        setLoadingDeployKeys(false);
      }
    };

    fetchDeploymentKeys();
  }, []);

  const handleSaveProfile = async () => {
    const trimmedName = profileName.trim();
    const trimmedImage = profileImage.trim();

    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }

    if (trimmedImage && !/^https?:\/\//i.test(trimmedImage)) {
      toast.error('Profile image URL must start with http:// or https://');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        name: trimmedName,
        avatar_url: trimmedImage,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB.');
      event.target.value = '';
      return;
    }

    setUploadingProfileImage(true);
    try {
      const updatedUser = await uploadProfileImage(file);
      setProfileImage(updatedUser.avatar_url || '');
      toast.success('Profile image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploadingProfileImage(false);
      event.target.value = '';
    }
  };

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

  const handleSaveDeploymentKeys = async () => {
    const payload = {};
    const nextVercelToken = vercelToken.trim();
    const nextRenderApiKey = renderApiKey.trim();
    const nextOwnerId = renderOwnerId.trim();

    if (nextVercelToken) {
      payload.vercel_token = nextVercelToken;
    }

    if (nextRenderApiKey) {
      payload.render_api_key = nextRenderApiKey;
    }

    if (nextOwnerId !== savedRenderOwnerId) {
      payload.render_owner_id = nextOwnerId;
    }

    if (Object.keys(payload).length === 0) {
      toast.error('Enter a deployment key or change Render owner ID first');
      return;
    }

    setSavingDeployKeys(true);
    try {
      const res = await api.put('/auth/deployment-keys', payload);
      const keys = res.data?.keys || {};
      setHasVercelToken(Boolean(keys.has_vercel_token));
      setHasRenderApiKey(Boolean(keys.has_render_api_key));
      const ownerId = keys.render_owner_id || '';
      setRenderOwnerId(ownerId);
      setSavedRenderOwnerId(ownerId);
      setVercelToken('');
      setRenderApiKey('');
      toast.success('Deployment keys updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save deployment keys');
    } finally {
      setSavingDeployKeys(false);
    }
  };

  const handleRemoveDeploymentKey = async (keyType) => {
    const payload = keyType === 'vercel'
      ? { vercel_token: '' }
      : { render_api_key: '' };

    if (keyType === 'vercel') setRemovingVercelToken(true);
    if (keyType === 'render') setRemovingRenderApiKey(true);

    try {
      const res = await api.put('/auth/deployment-keys', payload);
      const keys = res.data?.keys || {};
      setHasVercelToken(Boolean(keys.has_vercel_token));
      setHasRenderApiKey(Boolean(keys.has_render_api_key));
      setVercelToken('');
      setRenderApiKey('');
      toast.success(`${keyType === 'vercel' ? 'Vercel token' : 'Render API key'} removed`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove key');
    } finally {
      if (keyType === 'vercel') setRemovingVercelToken(false);
      if (keyType === 'render') setRemovingRenderApiKey(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm account deletion.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success('Account deleted successfully.');
      navigate('/register', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Profile */}
      <div className="card mb-6 p-8 py-5">
        <div className="flex items-center space-x-3 mb-4">
          <User className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-4 pb-2">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border border-gray-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                  <User className="w-7 h-7 text-orange-300" />
                </div>
              )}
              <label
                htmlFor="profile-image-file"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center cursor-pointer hover:bg-orange-600 transition"
                title="Upload profile image"
              >
                <Upload className="w-3.5 h-3.5" />
              </label>
              <input
                id="profile-image-file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleProfileImageUpload}
              />
            </div>
            <p className="text-xs text-gray-400">
              {uploadingProfileImage ? 'Uploading image...' : 'Tap the upload icon to choose an image from your device.'}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="input-field"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <p className="text-white">{user?.email}</p>
          </div>
          <div>
            <label htmlFor="profile-image-url" className="block text-sm text-gray-400 mb-1">Profile image URL</label>
            <input
              id="profile-image-url"
              type="url"
              value={profileImage}
              onChange={(e) => setProfileImage(e.target.value)}
              className="input-field"
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to remove profile image.</p>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="btn-primary inline-flex items-center space-x-2"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
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

      {/* Deployment Keys */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <Key className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Deployment Keys</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Add your Vercel and Render API keys to deploy frontend and backend separately from the Deploy page.
        </p>

        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-xs text-gray-300">
          <p className="font-medium text-gray-100 mb-2">Generate Deployment Keys</p>
          <div className="space-y-2">
            <p>
              1. Vercel token: go to{' '}
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                Vercel Dashboard - Account Tokens
              </a>{' '}
              and create a new token.
            </p>
            <p>
              2. Render API key: go to{' '}
              <a
                href="https://dashboard.render.com/account/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                Render Dashboard - API Keys
              </a>{' '}
              and create a key.
            </p>
            <p>
              3. Optional owner ID (Render): open{' '}
              <a
                href="https://dashboard.render.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                Render Dashboard
              </a>{' '}
              and copy workspace owner ID if you want to set it manually.
            </p>
          </div>
        </div>

        {loadingDeployKeys ? (
          <p className="text-sm text-gray-500">Loading key status...</p>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-gray-300">Vercel Token</span>
                <span className={`text-xs px-2 py-1 rounded ${hasVercelToken ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                  {hasVercelToken ? 'Configured' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-gray-300">Render API Key</span>
                <span className={`text-xs px-2 py-1 rounded ${hasRenderApiKey ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                  {hasRenderApiKey ? 'Configured' : 'Missing'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Vercel Token</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showVercelToken ? 'text' : 'password'}
                    value={vercelToken}
                    onChange={(e) => setVercelToken(e.target.value)}
                    placeholder={hasVercelToken ? 'Token saved (masked). Enter new value to replace.' : 'Enter Vercel token'}
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVercelToken((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label={showVercelToken ? 'Hide Vercel token input' : 'Show Vercel token input'}
                  >
                    {showVercelToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDeploymentKey('vercel')}
                  disabled={!hasVercelToken || removingVercelToken}
                  className="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingVercelToken ? 'Removing...' : 'Remove'}
                </button>
              </div>
              {hasVercelToken && (
                <p className="text-xs text-gray-500 mt-1">Saved token: ************</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Render API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showRenderApiKey ? 'text' : 'password'}
                    value={renderApiKey}
                    onChange={(e) => setRenderApiKey(e.target.value)}
                    placeholder={hasRenderApiKey ? 'Key saved (masked). Enter new value to replace.' : 'Enter Render API key'}
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRenderApiKey((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label={showRenderApiKey ? 'Hide Render API key input' : 'Show Render API key input'}
                  >
                    {showRenderApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDeploymentKey('render')}
                  disabled={!hasRenderApiKey || removingRenderApiKey}
                  className="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingRenderApiKey ? 'Removing...' : 'Remove'}
                </button>
              </div>
              {hasRenderApiKey && (
                <p className="text-xs text-gray-500 mt-1">Saved key: ************</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Render Owner ID (optional)</label>
              <input
                type="text"
                value={renderOwnerId}
                onChange={(e) => setRenderOwnerId(e.target.value)}
                placeholder="If empty, app tries auto-detection"
                className="input-field"
              />
            </div>

            <button
              onClick={handleSaveDeploymentKeys}
              disabled={savingDeployKeys}
              className="btn-primary inline-flex items-center gap-2"
            >
              {savingDeployKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{savingDeployKeys ? 'Saving...' : 'Save Deployment Keys'}</span>
            </button>

            <p className="text-xs text-gray-500">
              Keys are never shown after saving. Use Remove to revoke stored keys.
            </p>
            <p className="text-xs text-white/60">
              <span className='text-white gap-2'>Note: </span>We do not store users’ personal API keys or private identifiers in our database. All sensitive credentials remain securely managed by the user and are never persisted on our servers. Our system is designed to prioritize privacy and security by ensuring that no confidential key information is retained, logged, or exposed at any stage.
            </p>
          </div>
        )}
      </div>

      {/* Account Deletion */}
      <div className="card mt-6 border border-red-500/30">
      <div className="flex items-center space-x-3 mb-4">
          <LogOut className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-300">Account Logout</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          You can log out of your account here. Logging out will require you to log in again to access your projects and settings.
        </p>
       <button
          onClick={handleLogout}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-gray-200 "
        >
          <span className='inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70'>Logout</span>
        </button>
        <div className="flex items-center space-x-3 mb-4">
          <DeleteIcon className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-300">Account Deletion</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Deleting your account will permanently remove your profile and all linked projects. This action cannot be undone.
        </p>
        <label htmlFor="delete-confirm" className="block text-sm text-gray-400 mb-1">Type <span className="text-red-300 font-semibold">DELETE</span> to confirm</label>
        <input
          id="delete-confirm"
          type="text"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          className="input-field mb-3"
          placeholder="DELETE"
        />
        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          <span>{deletingAccount ? 'Deleting Account...' : 'Delete Account'}</span>
        </button>
      </div>
    </div>
  );
}
