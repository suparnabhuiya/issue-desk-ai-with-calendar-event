import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, ArrowUpRight, Bot, Check, ChevronDown, CirclePlus, Clock3, MoreHorizontal, RefreshCw, Search, Send, Trash2, X } from 'lucide-react';
import { issuesApi } from './api';
import './styles.css';

const emptyForm = { title: '', description: '', priority: 'medium' };
const filters = ['all', 'open', 'in_progress', 'closed'];

function formatStatus(status) {
  return status.replace('_', ' ');
}

function App() {
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadIssues() {
    setLoading(true);
    setError('');
    try {
      setIssues(await issuesApi.list());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIssues(); }, []);

  const visibleIssues = useMemo(() => issues.filter((issue) => {
    const matchesFilter = filter === 'all' || issue.status === filter;
    const searchText = `${issue.title} ${issue.description}`.toLowerCase();
    return matchesFilter && searchText.includes(query.toLowerCase());
  }), [issues, filter, query]);

  const counts = useMemo(() => filters.reduce((result, status) => {
    result[status] = status === 'all' ? issues.length : issues.filter((issue) => issue.status === status).length;
    return result;
  }, {}), [issues]);

  async function createIssue(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await issuesApi.create(form);
      setIssues((current) => [created, ...current]);
      setForm(emptyForm);
      setIsFormOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(issue, status) {
    try {
      const updated = await issuesApi.update(issue.id, { status });
      setIssues((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedIssue?.id === updated.id) setSelectedIssue(updated);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeIssue(issue) {
    try {
      await issuesApi.remove(issue.id);
      setIssues((current) => current.filter((item) => item.id !== issue.id));
      setSelectedIssue(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function askAssistant(event) {
    event.preventDefault();
    if (!assistantMessage.trim()) return;
    setSaving(true);
    setError('');
    try {
      const result = await issuesApi.askAgent(assistantMessage);
      setAssistantResponse(result.response);
      setAssistantMessage('');
      await loadIssues();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">ID</span><span>Issue Desk</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list"><button className="nav-item active"><AlertCircle size={17} /> Issues <span>{counts.all}</span></button><button className="nav-item"><Clock3 size={17} /> Activity</button></nav>
        <div className="sidebar-foot"><div className="avatar">SD</div><div><strong>Support desk</strong><small>Local workspace</small></div><MoreHorizontal size={17} /></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">OPERATIONS / ISSUES</p><h1>Keep the queue moving.</h1></div><button className="primary-button" onClick={() => setIsFormOpen(true)}><CirclePlus size={18} /> New issue</button></header>
        {error && <div className="error-banner"><AlertCircle size={17} /> {error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}

        <section className="metrics"><div><span>Open issues</span><strong>{counts.open}</strong></div><div><span>In progress</span><strong>{counts.in_progress}</strong></div><div><span>Closed</span><strong>{counts.closed}</strong></div><div className="metric-note"><span>API STATUS</span><strong><i className="status-dot" /> Connected</strong></div></section>

        <section className="toolbar"><div className="tabs">{filters.map((status) => <button key={status} className={filter === status ? 'tab active' : 'tab'} onClick={() => setFilter(status)}>{status === 'all' ? 'All issues' : formatStatus(status)} <b>{counts[status]}</b></button>)}</div><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" /></label><button className="icon-button" onClick={loadIssues} title="Refresh issues" aria-label="Refresh issues"><RefreshCw size={17} /></button></section>

        <section className="content-grid"><div className="issue-list"><div className="list-heading"><span>{visibleIssues.length} issue{visibleIssues.length === 1 ? '' : 's'}</span><span className="muted">Sorted by newest</span></div>{loading ? <div className="empty-state">Loading your issue queue...</div> : visibleIssues.length === 0 ? <div className="empty-state"><AlertCircle size={24} /><strong>No issues here</strong><span>Try another filter or create a new issue.</span></div> : visibleIssues.map((issue) => <IssueRow key={issue.id} issue={issue} onSelect={setSelectedIssue} onStatusChange={updateStatus} />)}</div>
          <AssistantPanel message={assistantMessage} setMessage={setAssistantMessage} response={assistantResponse} onSubmit={askAssistant} loading={saving} />
        </section>
      </main>

      {isFormOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsFormOpen(false)}><form className="modal" onSubmit={createIssue}><div className="modal-header"><div><p className="eyebrow">NEW RECORD</p><h2>Create an issue</h2></div><button type="button" className="icon-button" onClick={() => setIsFormOpen(false)} aria-label="Close"><X size={18} /></button></div><label>Title<input required minLength="3" maxLength="100" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs attention?" /></label><label>Description<textarea required minLength="5" maxLength="2000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add enough context for someone else to pick this up." /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><button className="primary-button full" disabled={saving}>{saving ? 'Creating...' : 'Create issue'} <ArrowUpRight size={17} /></button></form></div>}
      {selectedIssue && <IssueDetail issue={selectedIssue} onClose={() => setSelectedIssue(null)} onDelete={removeIssue} />}
    </div>
  );
}

function IssueRow({ issue, onSelect, onStatusChange }) {
  return <article className="issue-row" onClick={() => onSelect(issue)}><div className={`priority-bar ${issue.priority}`} /><div className="issue-main"><div className="issue-title-line"><h3>{issue.title}</h3><span className={`priority ${issue.priority}`}>{issue.priority}</span></div><p>{issue.description}</p><div className="issue-meta"><span className={`status ${issue.status}`}><i /> {formatStatus(issue.status)}</span><span className="issue-id">#{issue.id.slice(0, 8)}</span></div></div><select className="status-select" value={issue.status} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatusChange(issue, event.target.value)} aria-label={`Change status for ${issue.title}`}><option value="open">Open</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select><ChevronDown size={16} className="select-chevron" /></article>;
}

function AssistantPanel({ message, setMessage, response, onSubmit, loading }) {
  return <aside className="assistant"><div className="assistant-top"><div className="bot-icon"><Bot size={20} /></div><div><p className="eyebrow">AI ASSISTANT</p><h2>Make a request</h2></div><span className="online-dot" /></div><p className="assistant-copy">Schedule events or draft follow-ups through the connected assistant.</p><div className="conversation">{response ? <div className="response"><span>Assistant</span><p>{response}</p></div> : <div className="prompt"><Bot size={23} /><p>Try “schedule a design review next Tuesday at 2pm”.</p></div>}</div><form className="assistant-form" onSubmit={onSubmit}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask the assistant..." /><button disabled={loading} aria-label="Send request"><Send size={17} /></button></form></aside>;
}

function IssueDetail({ issue, onClose, onDelete }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal detail-modal"><div className="modal-header"><div><p className="eyebrow">ISSUE DETAIL</p><h2>{issue.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p className="detail-description">{issue.description}</p><div className="detail-facts"><span><small>Priority</small><strong className={`priority ${issue.priority}`}>{issue.priority}</strong></span><span><small>Status</small><strong>{formatStatus(issue.status)}</strong></span><span><small>Reference</small><strong>#{issue.id.slice(0, 8)}</strong></span></div><button className="danger-button" onClick={() => onDelete(issue)}><Trash2 size={16} /> Delete issue</button></div></div>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
