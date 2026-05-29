import { useState, useEffect, useRef, useCallback } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, Square, Play, Loader2, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import api from '../services/api';

const PRODUCTION_STEPS = [
  { key: 'writing', label: 'Writing project files', icon: '1' },
  { key: 'installing', label: 'Installing dependencies', icon: '2' },
  { key: 'building', label: 'Building production bundle', icon: '3' },
  { key: 'starting', label: 'Starting preview gateway', icon: '4' },
  { key: 'running', label: 'Live', icon: '5' },
];

const DEVELOPMENT_STEPS = [
  { key: 'writing', label: 'Writing project files', icon: '1' },
  { key: 'installing', label: 'Installing dependencies', icon: '2' },
  { key: 'starting', label: 'Starting servers', icon: '3' },
  { key: 'running', label: 'Live', icon: '4' },
];

function getStepIndex(status, step, mode) {
  if (status === 'running') return mode === 'development' ? 3 : 4;
  if (status === 'installing') return 1;
  if (status === 'starting' && step?.includes('Building')) return 2;
  if (status === 'starting' && step?.includes('Writing')) return 0;
  if (status === 'starting' && step?.includes('Starting preview gateway')) return 3;
  if (status === 'starting' && step?.includes('Starting')) return 2;
  if (status === 'starting') return 1;
  return 0;
}

export default function PreviewPane({ projectId, files, liveReload = false }) {
  const [viewMode, setViewMode] = useState('desktop');
  const [previewStatus, setPreviewStatus] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const startedRef = useRef(false);
  const filesSignature = JSON.stringify(
    Object.entries(files || {}).sort(([left], [right]) => left.localeCompare(right))
  );
  const lastStartedFilesSignatureRef = useRef('');

  const startPreview = useCallback(async () => {
    setError(null);
    try {
      const res = await api.post(`/preview/${projectId}/start`, { mode: 'production' });
      setPreviewStatus(res.data);
      if (res.data.status !== 'running') {
        startPolling();
      } else {
        setIframeKey((k) => k + 1);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start preview');
    }
  }, [projectId]);

  const stopPreview = useCallback(async () => {
    clearPolling();
    try {
      await api.post(`/preview/${projectId}/stop`);
    } catch (_) {}
    setPreviewStatus(null);
    startedRef.current = false;
  }, [projectId]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await api.get(`/preview/${projectId}/status`);
      setPreviewStatus(res.data);
      if (res.data.status === 'running') {
        clearPolling();
        setIframeKey((k) => k + 1);
      } else if (res.data.status === 'error') {
        clearPolling();
        setError(res.data.step || 'Preview failed');
      } else if (res.data.status === 'stopped') {
        clearPolling();
      }
    } catch (_) {
      clearPolling();
    }
  }, [projectId]);

  const startPolling = useCallback(() => {
    clearPolling();
    pollRef.current = setInterval(pollStatus, 2000);
  }, [pollStatus]);

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const restartPreview = useCallback(async () => {
    clearPolling();
    try {
      await api.post(`/preview/${projectId}/stop`);
    } catch (_) {}
    await startPreview();
  }, [clearPolling, projectId, startPreview]);

  // Auto-start preview on mount
  useEffect(() => {
    if (!startedRef.current && projectId && files && Object.keys(files).length > 0) {
      startedRef.current = true;
      lastStartedFilesSignatureRef.current = filesSignature;
      startPreview();
    }
    return () => {
      clearPolling();
    };
  }, [projectId, filesSignature, startPreview, clearPolling]);

  useEffect(() => {
    if (!liveReload) return;
    if (!startedRef.current || !projectId || !files || Object.keys(files).length === 0) return;
    if (previewStatus?.status !== 'running') return;
    if (lastStartedFilesSignatureRef.current === filesSignature) return;

    lastStartedFilesSignatureRef.current = filesSignature;
    restartPreview();
  }, [filesSignature, liveReload, previewStatus?.status, projectId, restartPreview, files]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
      api.post(`/preview/${projectId}/stop`).catch(() => {});
    };
  }, [projectId]);

  const widthClass = {
    desktop: 'w-full',
    tablet: 'w-[768px] mx-auto',
    mobile: 'w-[375px] mx-auto',
  };

  const isRunning = previewStatus?.status === 'running';
  const isLoading = previewStatus && !isRunning && previewStatus.status !== 'error' && previewStatus.status !== 'stopped';
  const currentStep = previewStatus ? getStepIndex(previewStatus.status, previewStatus.step, previewStatus.mode) : -1;
  const steps = previewStatus?.mode === 'development' ? DEVELOPMENT_STEPS : PRODUCTION_STEPS;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setViewMode('desktop')}
            className={`p-1.5 rounded ${viewMode === 'desktop' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('tablet')}
            className={`p-1.5 rounded ${viewMode === 'tablet' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`p-1.5 rounded ${viewMode === 'mobile' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {isRunning && (
            <>
              <a
                href={previewStatus.frontendUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-400 hover:text-orange-300 flex items-center space-x-1"
              >
                <span>{previewStatus.frontendUrl}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={stopPreview}
                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                title="Stop preview"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          )}
          {!isRunning && !isLoading && (
            <button
              onClick={startPreview}
              className="btn-primary text-xs py-1 px-3 flex items-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Production Preview</span>
            </button>
          )}
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400' : isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500">
              {isRunning ? 'Live' : isLoading ? 'Starting...' : 'Stopped'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-gray-950 overflow-auto">
        {isRunning && previewStatus.frontendUrl ? (
          <div className={`${widthClass[viewMode]} h-full transition-all duration-300 p-2`}>
            <iframe
              key={iframeKey}
              src={previewStatus.frontendUrl}
              className="w-full h-full rounded-lg border border-gray-800 bg-white"
              title="Live Preview"
            />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md w-full p-8">
              <div className="text-center mb-8">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-1">Starting Production Preview</h3>
                <p className="text-sm text-gray-400">
                  Building the generated app and serving it through a production gateway...
                </p>
              </div>

              {/* Progress steps */}
              <div className="space-y-4">
                {steps.map((s, i) => {
                  const isDone = i < currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <div key={s.key} className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isDone ? 'bg-green-500/20 text-green-400' :
                        isCurrent ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-800 text-gray-600'
                      }`}>
                        {isDone ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : s.icon}
                      </div>
                      <span className={`text-sm ${isDone ? 'text-green-400' : isCurrent ? 'text-white' : 'text-gray-600'}`}>
                        {s.label}
                        {isCurrent && <span className="text-orange-400 ml-1">...</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-500 text-center mt-6">
                First run takes longer because the app is built before previewing. Subsequent runs are faster.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md p-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Preview Failed</h3>
              <p className="text-sm text-gray-400 mb-4 break-all">{error}</p>
              <button onClick={startPreview} className="btn-primary text-sm inline-flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <Monitor className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Production Preview</h3>
              <p className="text-sm text-gray-400 mb-4">
                Build and view the generated app the way it would run in production.
              </p>
              <button onClick={startPreview} className="btn-primary inline-flex items-center space-x-2">
                <Play className="w-5 h-5" />
                <span>Start Production Preview</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
