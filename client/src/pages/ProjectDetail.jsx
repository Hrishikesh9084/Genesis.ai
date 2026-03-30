import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Code, Edit3, Rocket, Trash2, RefreshCw, Download, Loader2, X } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import api from '../services/api';
import FileTree from '../components/FileTree';
import CodeEditor from '../components/CodeEditor';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(() => {
      if (project?.status === 'generating') fetchProject();
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (project?.status === 'generating') {
      const interval = setInterval(fetchProject, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      const proj = res.data.project;
      setProject(proj);

      const parsedFiles = typeof proj.files === 'string' ? JSON.parse(proj.files) : proj.files;
      if (parsedFiles && Object.keys(parsedFiles).length > 0) {
        setFiles(parsedFiles);
        if (!selectedFile) {
          const firstFile = Object.keys(parsedFiles)[0];
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

  if (loading) return <LoadingSpinner text="Loading project..." />;

  if (!project) return null;

  if (project.status === 'generating') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="card py-16">
          <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-3">Generating Your Project</h2>
          <p className="text-gray-400 mb-2">Our AI is building your full-stack application...</p>
          <p className="text-gray-500 text-sm">This usually takes 30-60 seconds.</p>
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleStopGeneration}
            className="mt-8 inline-flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Stop Generation</span>
          </button>
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

  const fileCount = Object.keys(files).length;

  return (
    <div className="h-[calc(100vh-128px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold truncate max-w-[200px]">{project.name}</h1>
          <span className="text-xs text-gray-500">{fileCount} files</span>

          <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm bg-orange-600 text-white">
              <Code className="w-4 h-4" />
              <span>Code</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm py-1.5 px-3 flex items-center space-x-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save</span>}
          </button>
          <Link to={`/project/${id}/edit`} className="btn-secondary text-sm py-1.5 px-3 flex items-center space-x-1.5">
            <Edit3 className="w-4 h-4" />
            <span className="hidden md:inline">AI Edit</span>
          </Link>
          <Link to={`/project/${id}/deploy`} className="btn-primary text-sm py-1.5 px-3 flex items-center space-x-1.5">
            <Rocket className="w-4 h-4" />
            <span className="hidden md:inline">Deploy</span>
          </Link>
          <button onClick={handleDownload} className="btn-secondary text-sm py-1.5 px-3">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="text-gray-500 hover:text-red-400 p-1.5 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Files
          </div>
          <FileTree files={files} onSelect={setSelectedFile} selectedFile={selectedFile} />
        </div>

        {/* Code editor */}
        <div className="flex-1 overflow-hidden">
          {selectedFile ? (
            <CodeEditor
              filePath={selectedFile}
              content={files[selectedFile] || ''}
              onChange={handleFileChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
