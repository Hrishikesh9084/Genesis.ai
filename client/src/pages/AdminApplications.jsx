import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizeFileName(value) {
  return String(value || "resume").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [statuses, setStatuses] = useState(["new", "reviewing", "shortlisted", "rejected", "hired", "archived"]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState("");
  const [editingRole, setEditingRole] = useState(null);
  const [editingRoleData, setEditingRoleData] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const [filters, setFilters] = useState({
    status: "",
    roleId: "",
    q: "",
    page: 1,
    pageSize: 20,
  });

  const [roleForm, setRoleForm] = useState({
    id: "",
    title: "",
    department: "",
    location: "",
    type: "Full-time",
    summary: "",
    requirementsText: "",
    isActive: true,
  });

  const roleOptions = useMemo(
    () => roles.map((role) => ({ id: role.id, title: role.title })),
    [roles]
  );

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const response = await api.get("/careers/admin/jobs");
      setRoles(response.data?.roles || []);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Unable to load job roles.");
    } finally {
      setRolesLoading(false);
    }
  };

  const loadApplications = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await api.get("/careers/admin/applications", {
        params: {
          status: filters.status || undefined,
          roleId: filters.roleId || undefined,
          q: filters.q || undefined,
          page: filters.page,
          pageSize: filters.pageSize,
        },
      });

      setApplications(response.data?.applications || []);
      setPagination(response.data?.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 1 });
      if (Array.isArray(response.data?.statuses) && response.data.statuses.length > 0) {
        setStatuses(response.data.statuses);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [filters.page, filters.pageSize, filters.status, filters.roleId, filters.q]);

  useEffect(() => {
    loadRoles();
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const handleStatusUpdate = async (applicationId, nextStatus) => {
    setUpdatingId(applicationId);
    setErrorMessage("");
    try {
      await api.patch(`/careers/admin/applications/${applicationId}/status`, { status: nextStatus });
      setApplications((prev) =>
        prev.map((item) =>
          item.id === applicationId ? { ...item, status: nextStatus, updated_at: new Date().toISOString() } : item
        )
      );
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Failed to update application status.");
    } finally {
      setUpdatingId("");
    }
  };

  const handleRoleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setRoleForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (roleMessage) setRoleMessage("");
    if (errorMessage) setErrorMessage("");
  };

  const handleCreateRole = async (event) => {
    event.preventDefault();
    setCreatingRole(true);
    setRoleMessage("");
    setErrorMessage("");

    try {
      const requirements = roleForm.requirementsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        id: roleForm.id.trim() || undefined,
        title: roleForm.title.trim(),
        department: roleForm.department.trim(),
        location: roleForm.location.trim(),
        type: roleForm.type.trim(),
        summary: roleForm.summary.trim(),
        requirements,
        isActive: roleForm.isActive,
      };

      await api.post("/careers/admin/jobs", payload);
      setRoleMessage("Job role added successfully.");
      setRoleForm({
        id: "",
        title: "",
        department: "",
        location: "",
        type: "Full-time",
        summary: "",
        requirementsText: "",
        isActive: true,
      });
      await loadRoles();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Failed to add job role.");
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!role?.id) return;

    const confirmed = window.confirm(`Delete job role "${role.title}"?`);
    if (!confirmed) return;

    setDeletingRoleId(role.id);
    setRoleMessage("");
    setErrorMessage("");

    try {
      await api.delete(`/careers/admin/jobs/${role.id}`);
      setRoleMessage("Job role deleted successfully.");
      setFilters((prev) => (prev.roleId === role.id ? { ...prev, roleId: "", page: 1 } : prev));
      await loadRoles();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Failed to delete job role.");
    } finally {
      setDeletingRoleId("");
    }
  };

  const handleStartEditRole = (role) => {
    setEditingRole(role);
    setEditingRoleData({
      title: role.title,
      department: role.department,
      location: role.location,
      type: role.type,
      summary: role.summary,
      requirementsText: (role.requirements || []).join("\n"),
      isActive: role.isActive,
    });
    setRoleMessage("");
  };

  const handleEditRoleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditingRoleData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveEditRole = async () => {
    if (!editingRole?.id) return;

    setSavingEdit(true);
    setErrorMessage("");
    setRoleMessage("");

    try {
      const requirements = editingRoleData.requirementsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        title: editingRoleData.title.trim(),
        department: editingRoleData.department.trim(),
        location: editingRoleData.location.trim(),
        type: editingRoleData.type.trim(),
        summary: editingRoleData.summary.trim(),
        requirements,
        isActive: editingRoleData.isActive,
      };

      await api.put(`/careers/admin/jobs/${editingRole.id}`, payload);
      setRoleMessage("Job role updated successfully.");
      setEditingRole(null);
      setEditingRoleData(null);
      await loadRoles();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Failed to update job role.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResumeDownload = async (application) => {
    try {
      const response = await api.get(`/careers/admin/applications/${application.id}/resume`, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = normalizeFileName(application.resume_original_name || `${application.full_name}-resume`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Failed to download resume.");
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-14 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 md:p-10 backdrop-blur-sm">
        <p className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-300">
          Internal Admin
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Job Applications</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Review candidate applications, filter by status/role, update hiring stage, and download uploaded resumes.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-white">{editingRole ? "Edit Job Role" : "Add Job Role"}</h2>
          <p className="mt-1 text-sm text-slate-300">{editingRole ? "Update the role details below." : "Create a new careers role visible on public openings and application form."}</p>

          {roleMessage && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {roleMessage}
            </div>
          )}

          {!editingRole ? (
            <form className="mt-4 space-y-3" onSubmit={handleCreateRole}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input className="input-field" name="title" value={roleForm.title} onChange={handleRoleFormChange} placeholder="Role title" required />
                <input className="input-field" name="department" value={roleForm.department} onChange={handleRoleFormChange} placeholder="Department" required />
                <input className="input-field" name="location" value={roleForm.location} onChange={handleRoleFormChange} placeholder="Location" required />
                <input className="input-field" name="type" value={roleForm.type} onChange={handleRoleFormChange} placeholder="Employment type" required />
                <input className="input-field" name="id" value={roleForm.id} onChange={handleRoleFormChange} placeholder="Role ID (optional)" />
                <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
                  <input type="checkbox" name="isActive" checked={roleForm.isActive} onChange={handleRoleFormChange} />
                  Active
                </label>
              </div>

              <textarea
                className="input-field min-h-24 resize-y"
                name="summary"
                value={roleForm.summary}
                onChange={handleRoleFormChange}
                placeholder="Role summary"
                required
              />
              <textarea
                className="input-field min-h-28 resize-y"
                name="requirementsText"
                value={roleForm.requirementsText}
                onChange={handleRoleFormChange}
                placeholder="Requirements (one per line)"
                required
              />

              <button type="submit" className="btn-primary rounded-lg px-4 py-2" disabled={creatingRole}>
                {creatingRole ? "Adding role..." : "Add Role"}
              </button>
            </form>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); handleSaveEditRole(); }}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input className="input-field" name="title" value={editingRoleData?.title} onChange={handleEditRoleChange} placeholder="Role title" required />
                <input className="input-field" name="department" value={editingRoleData?.department} onChange={handleEditRoleChange} placeholder="Department" required />
                <input className="input-field" name="location" value={editingRoleData?.location} onChange={handleEditRoleChange} placeholder="Location" required />
                <input className="input-field" name="type" value={editingRoleData?.type} onChange={handleEditRoleChange} placeholder="Employment type" required />
                <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
                  <input type="checkbox" name="isActive" checked={editingRoleData?.isActive} onChange={handleEditRoleChange} />
                  Active
                </label>
              </div>

              <textarea
                className="input-field min-h-24 resize-y"
                name="summary"
                value={editingRoleData?.summary}
                onChange={handleEditRoleChange}
                placeholder="Role summary"
                required
              />
              <textarea
                className="input-field min-h-28 resize-y"
                name="requirementsText"
                value={editingRoleData?.requirementsText}
                onChange={handleEditRoleChange}
                placeholder="Requirements (one per line)"
                required
              />

              <div className="flex gap-2">
                <button type="submit" className="btn-primary rounded-lg px-4 py-2" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="btn-secondary rounded-lg px-4 py-2" onClick={() => { setEditingRole(null); setEditingRoleData(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Existing Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {rolesLoading && <span className="text-sm text-slate-400">Loading roles...</span>}
              {!rolesLoading && roles.length === 0 && <span className="text-sm text-slate-400">No roles found.</span>}
              {!rolesLoading && roles.map((role) => (
                <div key={role.id} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                  <span>{role.title}</span>
                  {!role.isActive && <span className="text-[10px] uppercase text-slate-400">inactive</span>}
                  <button
                    type="button"
                    onClick={() => handleStartEditRole(role)}
                    className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase text-blue-300 hover:bg-blue-500/20"
                  >
                    Edit
                  </button>
                  {role.isActive && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(role)}
                      disabled={deletingRoleId === role.id}
                      className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingRoleId === role.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">Status</label>
            <select className="input-field" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">Role</label>
            <select className="input-field" name="roleId" value={filters.roleId} onChange={handleFilterChange}>
              <option value="">All roles</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>{role.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">Search</label>
            <input
              className="input-field"
              name="q"
              value={filters.q}
              onChange={handleFilterChange}
              placeholder="Name or email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">Rows per page</label>
            <select className="input-field" name="pageSize" value={filters.pageSize} onChange={handleFilterChange}>
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-275 border-collapse text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Applied At</th>
                <th className="px-4 py-3">Resume</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-300">Loading applications...</td>
                </tr>
              )}

              {!loading && applications.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No applications found.</td>
                </tr>
              )}

              {!loading && applications.map((application) => (
                <tr key={application.id} className="border-t border-white/10 align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{application.full_name}</p>
                    <p className="text-slate-300">{application.email}</p>
                    <p className="text-xs text-slate-400">{application.phone || "No phone"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-white">{application.role_title}</p>
                    <p className="text-xs text-slate-400">{application.role_id}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{application.years_experience ?? "-"}</td>
                  <td className="px-4 py-4 text-slate-300">{formatDateTime(application.created_at)}</td>
                  <td className="px-4 py-4">
                    {application.resume_original_name ? (
                      <button
                        type="button"
                        onClick={() => handleResumeDownload(application)}
                        className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-200 hover:bg-orange-500/20"
                      >
                        Download
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No file</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <select
                      className="input-field h-10"
                      value={application.status}
                      disabled={updatingId === application.id}
                      onChange={(event) => handleStatusUpdate(application.id, event.target.value)}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-300">
          <p>
            Showing page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2"
              disabled={pagination.page <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
