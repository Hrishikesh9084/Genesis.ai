import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Sparkles, FolderOpen } from 'lucide-react';
import api from '../services/api';
import ProjectCard from '../components/ProjectCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectDelete = (deletedProjectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== deletedProjectId));
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner text="Loading your projects..." />;

  return (
    <div className="max-w-7xl mx-auto mt-14 pb-18">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Projects</h1>
          <p className="text-gray-400 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/new-project" className="btn-primary flex items-center gap-2 rounded-xl">
          <Plus className="w-5 h-5" />
          <span>New Project</span>
        </Link>
      </div>

      {projects.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input-field pl-11 max-w-md"
          />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-gray-400 mb-6">Create your first AI-generated project to get started.</p>
          <Link to="/new-project" className="btn-primary inline-flex items-center gap-2 rounded-xl">
            <Sparkles className="w-5 h-5" />
            <span>Create Your First Project</span>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={handleProjectDelete} />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">No projects match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
