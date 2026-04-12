import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Globe, ShieldCheck, Link2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function statusTone(status) {
  if (status === 'verified' || status === 'active') return 'text-green-300 border-green-700/50 bg-green-900/20';
  if (status === 'provisioning' || status === 'pending') return 'text-yellow-300 border-yellow-700/50 bg-yellow-900/20';
  return 'text-gray-300 border-gray-700 bg-gray-800/60';
}

export default function Domains() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyProjectId, setBusyProjectId] = useState(null);
  const [subdomainInput, setSubdomainInput] = useState({});
  const [customDomainInput, setCustomDomainInput] = useState({});

  const fetchDomains = async () => {
    try {
      const res = await api.get('/domains');
      const nextDomains = res.data?.domains || [];
      setDomains(nextDomains);

      setSubdomainInput((prev) => {
        const next = { ...prev };
        nextDomains.forEach((item) => {
          if (!next[item.project_id]) {
            next[item.project_id] = item.subdomain || '';
          }
        });
        return next;
      });

      setCustomDomainInput((prev) => {
        const next = { ...prev };
        nextDomains.forEach((item) => {
          if (!next[item.project_id]) {
            next[item.project_id] = item.custom_domain || '';
          }
        });
        return next;
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const connectedCount = useMemo(() => domains.filter((item) => item.custom_domain).length, [domains]);

  const reassignSubdomain = async (projectId) => {
    const nextSubdomain = String(subdomainInput[projectId] || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!nextSubdomain) {
      toast.error('Subdomain cannot be empty.');
      return;
    }

    setBusyProjectId(projectId);
    try {
      await api.post('/domains/reassign', { projectId, subdomain: nextSubdomain });
      toast.success('Subdomain reassigned.');
      await fetchDomains();
    } catch (err) {
      const suggestions = err.response?.data?.suggestedSubdomains || [];
      if (suggestions.length) {
        setSubdomainInput((prev) => ({ ...prev, [projectId]: suggestions[0] }));
      }
      toast.error(err.response?.data?.error || 'Failed to reassign subdomain');
    } finally {
      setBusyProjectId(null);
    }
  };

  const releaseSubdomain = async (projectId) => {
    if (!window.confirm('Release this project subdomain and take its frontend URL offline?')) return;

    setBusyProjectId(projectId);
    try {
      await api.post('/domains/release', { projectId });
      toast.success('Subdomain released.');
      await fetchDomains();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to release subdomain');
    } finally {
      setBusyProjectId(null);
    }
  };

  const connectCustomDomain = async (projectId) => {
    const domain = String(customDomainInput[projectId] || '').trim().toLowerCase();
    if (!domain) {
      toast.error('Enter a custom domain first.');
      return;
    }

    setBusyProjectId(projectId);
    try {
      await api.post('/domains/custom/connect', { projectId, domain });
      toast.success('Custom domain added. Configure DNS records then verify.');
      await fetchDomains();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to connect custom domain');
    } finally {
      setBusyProjectId(null);
    }
  };

  const verifyCustomDomain = async (projectId) => {
    setBusyProjectId(projectId);
    try {
      await api.post('/domains/custom/verify', { projectId });
      toast.success('Domain verification check complete.');
      await fetchDomains();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify custom domain');
    } finally {
      setBusyProjectId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading domain dashboard..." />;
  }

  return (
    <div className="max-w-6xl mx-auto mt-12 pb-20">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Domains</h1>
          <p className="text-sm text-gray-400 mt-1">Manage Genesis subdomains, custom domain verification, and SSL readiness.</p>
        </div>
        <button
          type="button"
          onClick={fetchDomains}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/70 px-4 py-2 text-sm hover:bg-gray-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Projects with Subdomains</p>
          <p className="mt-1 text-2xl font-semibold">{domains.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Custom Domains</p>
          <p className="mt-1 text-2xl font-semibold">{connectedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">SSL Active</p>
          <p className="mt-1 text-2xl font-semibold">{domains.filter((d) => d.ssl_status === 'active').length}</p>
        </div>
      </div>

      <div className="space-y-4">
        {domains.map((item) => {
          const isBusy = busyProjectId === item.project_id;
          const domainInput = customDomainInput[item.project_id] || '';
          const subInput = subdomainInput[item.project_id] || item.subdomain;

          return (
            <div key={item.project_id} className="rounded-2xl border border-gray-800 bg-black/35 p-5 backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{item.project_name}</p>
                  <p className="text-xs text-gray-500">Project Status: {item.project_status}</p>
                </div>
                <a
                  href={item.deployment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-orange-300 hover:text-orange-200"
                >
                  <Globe className="w-4 h-4" />
                  {item.deployment_url}
                </a>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                  <p className="text-sm font-medium mb-3">Genesis Subdomain</p>
                  <div className="flex gap-2">
                    <input
                      value={subInput}
                      onChange={(event) =>
                        setSubdomainInput((prev) => ({
                          ...prev,
                          [item.project_id]: event.target.value,
                        }))
                      }
                      placeholder="project-name"
                      className="input-field"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => reassignSubdomain(item.project_id)}
                      className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium hover:bg-orange-500 disabled:opacity-60"
                    >
                      Reassign
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => releaseSubdomain(item.project_id)}
                      className="rounded-lg border border-red-700/50 px-3 py-2 text-sm text-red-300 hover:bg-red-900/20 disabled:opacity-60"
                      title="Release subdomain"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                  <p className="text-sm font-medium mb-3">Custom Domain</p>
                  <div className="flex gap-2">
                    <input
                      value={domainInput}
                      onChange={(event) =>
                        setCustomDomainInput((prev) => ({
                          ...prev,
                          [item.project_id]: event.target.value,
                        }))
                      }
                      placeholder="app.example.com"
                      className="input-field"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => connectCustomDomain(item.project_id)}
                      className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-60"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => verifyCustomDomain(item.project_id)}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
                    >
                      Verify
                    </button>
                  </div>

                  {item.custom_domain && (
                    <div className="mt-3 space-y-2 text-xs">
                      <p className="text-gray-300">Connected: <span className="text-orange-300">{item.custom_domain}</span></p>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 ${statusTone(item.verification_status)}`}>
                          Verification: {item.verification_status}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 ${statusTone(item.ssl_status)}`}>
                          <ShieldCheck className="inline-block w-3.5 h-3.5 mr-1" />
                          SSL: {item.ssl_status}
                        </span>
                      </div>
                      <p className="text-gray-400">{item.status_message || 'No status message yet.'}</p>
                      <div className="rounded-lg border border-dashed border-gray-700 p-2 text-gray-400">
                        <p>TXT: {item.txt_record_name} = {item.verification_token}</p>
                        <p>CNAME: {item.custom_domain} {'->'} {item.cname_target}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
