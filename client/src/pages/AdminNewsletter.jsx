import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Plus, Edit2, Trash2, Send, Eye, EyeOff, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminNewsletter() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [articles, setArticles] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 1 });

  // Form states
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [issueForm, setIssueForm] = useState({ title: '', subject: '' });
  const [articleForm, setArticleForm] = useState({ title: '', description: '', content: '', category: '', link: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Load issues
  useEffect(() => {
    loadIssues();
  }, [pagination.page]);

  async function loadIssues() {
    try {
      setLoading(true);
      const response = await api.get('/admin/newsletter/issues', {
        params: { page: pagination.page, pageSize: pagination.pageSize },
      });
      setIssues(response.data.issues);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load issues:', error);
      toast.error('Failed to load newsletter issues');
    } finally {
      setLoading(false);
    }
  }

  async function loadIssueDetail(issueId) {
    try {
      const response = await api.get(`/admin/newsletter/issues/${issueId}`);
      setSelectedIssue(response.data.issue);
      setArticles(response.data.articles);
      setSubscriberCount(response.data.subscriberCount);
      setEditingArticle(null);
      setShowArticleForm(false);
    } catch (error) {
      console.error('Failed to load issue detail:', error);
      toast.error('Failed to load issue details');
    }
  }

  async function handleCreateIssue() {
    if (!issueForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/admin/newsletter/issues', issueForm);
      setIssues([response.data, ...issues]);
      setIssueForm({ title: '', subject: '' });
      setShowIssueForm(false);
      toast.success('Newsletter issue created');
      loadIssues();
    } catch (error) {
      console.error('Failed to create issue:', error);
      toast.error('Failed to create newsletter issue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateIssue() {
    if (!issueForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/admin/newsletter/issues/${editingIssue.id}`, issueForm);
      setSelectedIssue({ ...editingIssue, ...issueForm });
      setEditingIssue(null);
      setShowIssueForm(false);
      toast.success('Newsletter issue updated');
      loadIssues();
    } catch (error) {
      console.error('Failed to update issue:', error);
      toast.error('Failed to update newsletter issue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteIssue(issueId) {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;

    try {
      await api.delete(`/admin/newsletter/issues/${issueId}`);
      setIssues(issues.filter(i => i.id !== issueId));
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(null);
      }
      toast.success('Newsletter issue deleted');
    } catch (error) {
      console.error('Failed to delete issue:', error);
      toast.error('Failed to delete newsletter issue');
    }
  }

  async function handleAddArticle() {
    if (!articleForm.title.trim() || !articleForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/admin/newsletter/articles', {
        ...articleForm,
        issueId: selectedIssue.id,
      });
      setArticles([...articles, response.data]);
      setArticleForm({ title: '', description: '', content: '', category: '', link: '' });
      setShowArticleForm(false);
      toast.success('Article added');
    } catch (error) {
      console.error('Failed to add article:', error);
      toast.error('Failed to add article');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateArticle() {
    if (!articleForm.title.trim() || !articleForm.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/admin/newsletter/articles/${editingArticle.id}`, articleForm);
      setArticles(articles.map(a => a.id === editingArticle.id ? { ...editingArticle, ...articleForm } : a));
      setEditingArticle(null);
      setArticleForm({ title: '', description: '', content: '', category: '', link: '' });
      setShowArticleForm(false);
      toast.success('Article updated');
    } catch (error) {
      console.error('Failed to update article:', error);
      toast.error('Failed to update article');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteArticle(articleId) {
    if (!window.confirm('Are you sure you want to delete this article?')) return;

    try {
      await api.delete(`/admin/newsletter/articles/${articleId}`);
      setArticles(articles.filter(a => a.id !== articleId));
      toast.success('Article deleted');
    } catch (error) {
      console.error('Failed to delete article:', error);
      toast.error('Failed to delete article');
    }
  }

  async function handleSendIssue() {
    if (!window.confirm(`Send this newsletter to ${subscriberCount} subscribed users?`)) return;

    try {
      setSendingId(selectedIssue.id);
      const response = await api.post(`/admin/newsletter/issues/${selectedIssue.id}/send`);
      const targetCount = response.data?.activeSubscriberCount ?? subscriberCount;

      toast.success(`Newsletter is being sent to ${targetCount} subscribed users`);
      loadIssueDetail(selectedIssue.id);
    } catch (error) {
      console.error('Failed to send newsletter:', error);
      toast.error(error.response?.data?.error || 'Failed to send newsletter');
    } finally {
      setSendingId(null);
    }
  }

  function openEditIssue(issue) {
    setEditingIssue(issue);
    setIssueForm({ title: issue.title, subject: issue.subject });
    setShowIssueForm(true);
  }

  function openEditArticle(article) {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      description: article.description,
      content: article.content,
      category: article.category,
      link: article.link,
    });
    setShowArticleForm(true);
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Newsletter Management</h1>
            <p className="text-slate-400 mt-2">Create and send newsletters to your subscribers</p>
          </div>
          <button
            onClick={() => {
              setEditingIssue(null);
              setIssueForm({ title: '', subject: '' });
              setShowIssueForm(!showIssueForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={20} /> New Issue
          </button>
        </div>

        {/* Create/Edit Issue Form */}
        {showIssueForm && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{editingIssue ? 'Edit Issue' : 'Create New Issue'}</h2>
              <button onClick={() => setShowIssueForm(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  placeholder="e.g., Weekly Update - December 10"
                  value={issueForm.title}
                  onChange={e => setIssueForm({ ...issueForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email Subject</label>
                <input
                  type="text"
                  placeholder="Leave empty to use title"
                  value={issueForm.subject}
                  onChange={e => setIssueForm({ ...issueForm, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowIssueForm(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingIssue ? handleUpdateIssue : handleCreateIssue}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
                >
                  {submitting ? 'Saving...' : editingIssue ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Issues List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold">Newsletter Issues</h2>
              </div>
              {loading ? (
                <div className="p-4 text-center text-slate-400">Loading...</div>
              ) : issues.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No issues yet</div>
              ) : (
                <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                  {issues.map(issue => (
                    <div
                      key={issue.id}
                      onClick={() => loadIssueDetail(issue.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedIssue?.id === issue.id ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <h3 className="font-medium text-sm line-clamp-2">{issue.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          issue.status === 'sent' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                        }`}>
                          {issue.status}
                        </span>
                        {issue.sent_at && (
                          <span className="text-xs text-slate-400">
                            {new Date(issue.sent_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-700 flex gap-2 justify-center">
                  <button
                    onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                  >
                    ← Prev
                  </button>
                  <span className="px-2 py-1 text-sm text-slate-400">{pagination.page} / {pagination.totalPages}</span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Issue Details */}
          <div className="lg:col-span-2">
            {selectedIssue ? (
              <div className="space-y-4">
                {/* Issue Header */}
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedIssue.title}</h2>
                      <p className="text-slate-400 mt-1">{selectedIssue.subject}</p>
                    </div>
                    <span className={`text-sm px-3 py-1 rounded whitespace-nowrap ${
                      selectedIssue.status === 'sent' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                    }`}>
                      {selectedIssue.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-slate-400 text-sm">Subscribers</p>
                      <p className="text-2xl font-bold mt-1">{subscriberCount}</p>
                    </div>
                    {selectedIssue.sent_at && (
                      <div>
                        <p className="text-slate-400 text-sm">Sent</p>
                        <p className="text-sm mt-1">{new Date(selectedIssue.sent_at).toLocaleDateString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-400 text-sm">Articles</p>
                      <p className="text-2xl font-bold mt-1">{articles.length}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => openEditIssue(selectedIssue)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                      <Edit2 size={16} /> Edit
                    </button>
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                      {previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
                      {previewMode ? 'Hide Preview' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleDeleteIssue(selectedIssue.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-800 rounded transition-colors"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                    {selectedIssue.status !== 'sent' && (
                      <button
                        onClick={handleSendIssue}
                        disabled={sendingId === selectedIssue.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors ml-auto"
                      >
                        <Send size={16} /> {sendingId === selectedIssue.id ? 'Sending...' : 'Send Now'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview Mode */}
                {previewMode && (
                  <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4">📧 Email Preview</h3>
                    {articles.length === 0 ? (
                      <div className="bg-slate-700/50 rounded p-8 text-center text-slate-400">
                        <p>Add articles to see preview</p>
                      </div>
                    ) : (
                      <div className="bg-white text-slate-900 rounded shadow-lg overflow-hidden">
                        {/* Email Header */}
                        <div className="bg-linear-to-r from-slate-900 to-slate-800 text-white p-6">
                          <h2 className="text-2xl font-bold">Genesis.ai Newsletter</h2>
                          <p className="text-slate-300 text-sm mt-2">Check out this week's updates</p>
                        </div>

                        {/* Email Body */}
                        <div className="p-6">
                          <p className="mb-4 text-slate-700">Hi there,</p>
                          <p className="mb-6 text-slate-700">Here's your {selectedIssue.subject || selectedIssue.title}</p>

                          {/* Articles */}
                          <div className="space-y-4 mb-6">
                            {articles.map((article, index) => (
                              <div key={article.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-bold text-slate-900">{article.title}</h4>
                                    {article.category && (
                                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                        {article.category}
                                      </span>
                                    )}
                                    <p className="text-slate-700 text-sm mt-2">{article.description}</p>
                                    {article.link && (
                                      <a 
                                        href={article.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors"
                                      >
                                        Learn More →
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <hr className="my-6 border-slate-200" />

                          {/* Footer */}
                          <div className="text-center">
                            <p className="text-slate-600 text-sm">
                              Have questions?{' '}
                              <a href="https://genesis.ai" className="text-blue-600 hover:underline">
                                Visit Genesis.ai
                              </a>
                            </p>
                            <p className="text-slate-500 text-xs mt-4">
                              You can unsubscribe from these emails by clicking the unsubscribe link in the email footer.
                            </p>
                            <p className="text-slate-600 text-sm font-semibold mt-4">- The Genesis.ai Team</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Articles Section */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700 bg-linear-to-r from-slate-800 to-slate-700 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">📰 Articles & News</h3>
                      <p className="text-xs text-slate-400 mt-1">Add 4-5 articles for best results</p>
                    </div>
                    {!showArticleForm && (
                      <button
                        onClick={() => {
                          setEditingArticle(null);
                          setArticleForm({ title: '', description: '', content: '', category: '', link: '' });
                          setShowArticleForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg text-sm font-semibold transition-all shadow-lg"
                      >
                        <Plus size={18} /> Add Article
                      </button>
                    )}
                  </div>

                  {/* Add/Edit Article Form */}
                  {showArticleForm && (
                    <div className="p-4 border-b border-slate-700 bg-slate-700/50">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Article Title</label>
                          <input
                            type="text"
                            placeholder="e.g., New Feature: AI Code Generation"
                            value={articleForm.title}
                            onChange={e => setArticleForm({ ...articleForm, title: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Description</label>
                          <textarea
                            placeholder="Brief description for the email"
                            value={articleForm.description}
                            onChange={e => setArticleForm({ ...articleForm, description: e.target.value })}
                            rows="2"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Full Content (Optional)</label>
                          <textarea
                            placeholder="Full article content"
                            value={articleForm.content}
                            onChange={e => setArticleForm({ ...articleForm, content: e.target.value })}
                            rows="3"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Category</label>
                            <input
                              type="text"
                              placeholder="e.g., Feature, Update, Tip"
                              value={articleForm.category}
                              onChange={e => setArticleForm({ ...articleForm, category: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Link</label>
                            <input
                              type="url"
                              placeholder="https://..."
                              value={articleForm.link}
                              onChange={e => setArticleForm({ ...articleForm, link: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => {
                              setShowArticleForm(false);
                              setEditingArticle(null);
                              setArticleForm({ title: '', description: '', content: '', category: '', link: '' });
                            }}
                            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={editingArticle ? handleUpdateArticle : handleAddArticle}
                            disabled={submitting}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
                          >
                            {submitting ? 'Saving...' : editingArticle ? 'Update Article' : 'Add Article'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Articles List */}
                  {articles.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-slate-400 mb-4">
                        {showArticleForm ? '📝 Create your first article below' : '📭 No articles yet'}
                      </p>
                      {!showArticleForm && (
                        <p className="text-xs text-slate-500">
                          Articles are sections in your newsletter. Add 4-5 to create an engaging newsletter.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {articles.map((article, index) => (
                        <div key={article.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full font-semibold">
                                  #{index + 1}
                                </span>
                                <h4 className="font-semibold text-white">{article.title}</h4>
                              </div>
                              <p className="text-slate-400 text-sm mt-2">{article.description}</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {article.category && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">
                                    {article.category}
                                  </span>
                                )}
                                {article.link && (
                                  <a 
                                    href={article.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 truncate"
                                  >
                                    🔗 {article.link.split('/')[2] || article.link}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => openEditArticle(article)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Edit article"
                              >
                                <Edit2 size={16} className="text-blue-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteArticle(article.id)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Delete article"
                              >
                                <Trash2 size={16} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
                <p className="text-slate-400">Select a newsletter issue to view details and manage articles</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
