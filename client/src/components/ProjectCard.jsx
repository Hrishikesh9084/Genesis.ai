import { Link, useNavigate } from 'react-router-dom';
import { Clock, Github, Globe, Sparkles, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const statusConfig = {
  generating: { icon: Loader2, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Generating', animate: true },
  ready: { icon: Sparkles, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Ready' },
  deployed: { icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Deployed' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Error' },
  cancelled: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Cancelled' },
};

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const status = statusConfig[project.status] || statusConfig.ready;
  const StatusIcon = status.icon;
  const timeAgo = getTimeAgo(project.created_at);

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success('Project deleted successfully');
      if (onDelete) onDelete(project.id);
    } catch (err) {
      toast.error('Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Link
      to={`/project/${project.id}`}
      className="card hover:border-orange-500/40 transition-all duration-300 group cursor-pointer relative"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors truncate pr-2">
          {project.name}
        </h3>
        <span className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${status.bg} ${status.color} shrink-0`}>
          <StatusIcon className={`w-3 h-3 ${status.animate ? 'animate-spin' : ''}`} />
          <span>{status.label}</span>
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{project.prompt}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
        <div className="flex items-center space-x-2">
          {project.github_repo_url && <Github className="w-3.5 h-3.5 text-gray-400" />}
          {project.deploy_url && <Globe className="w-3.5 h-3.5 text-orange-400" />}
        </div>
      </div>

      {/* Delete button - appears on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-3 right-3 hidden group-hover:flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/80 hover:bg-red-700 text-white transition-all opacity-0 group-hover:opacity-100"
        title="Delete project"
      >
        {deleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </Link>
  );
}

function getTimeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
