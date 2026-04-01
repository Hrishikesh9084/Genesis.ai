import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Github, Key, Save, Loader2, User, Upload, AlertTriangle, Trash2, LogOut, DeleteIcon } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, updateProfile, uploadProfileImage, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
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
