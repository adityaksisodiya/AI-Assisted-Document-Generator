"use client";

import React, { useState, useEffect, Component, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { 
  FileText, LayoutDashboard, FileArchive, Users, TrendingUp, 
  Plus, Edit, Trash2, ArrowLeft, LogOut, CheckCircle, Download, FileDown, FileCode, Eye, AlertTriangle, Save,
  XCircle, CheckCircle2, Info, Settings, Key
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// NEXT.JS ENVIRONMENT VARIABLE
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ==========================================
// ERROR BOUNDARY
// ==========================================
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <AlertTriangle size={64} color="#ef4444" style={{marginBottom: '1rem'}} />
          <h2>Application Crash</h2>
          <p style={{color: '#7f1d1d', maxWidth: '600px'}}>{this.state.error.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload Application</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// ==========================================
// TOAST NOTIFICATION COMPONENT
// ==========================================
const ToastDisplay = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className="toast-container">
      <div className={`toast ${toast.type}`}>
        {toast.type === 'error' && <XCircle color="#ef4444" size={20} />}
        {toast.type === 'success' && <CheckCircle2 color="#10b981" size={20} />}
        {toast.type === 'info' && <Info color="#4f46e5" size={20} />}
        {toast.message}
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: RESET PASSWORD
// ==========================================
const ResetPasswordScreen = ({ resetToken, onResetSuccess, showToast }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) return showToast("Password must be at least 6 characters.", "error");
    if (password !== confirm) return showToast("Passwords do not match.", "error");
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, "success");
      onResetSuccess();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 style={{ color: '#111827', marginBottom: '0.5rem' }}>Set New Password</h2>
        <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.9rem' }}>Enter a strong password to protect your account.</p>
        
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>New Password</label>
          <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} />
        </div>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Confirm Password</label>
          <input type="password" className="form-control" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" disabled={loading} />
        </div>
        
        <button className="btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '1rem' }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'UPDATING...' : 'SAVE NEW PASSWORD'}
        </button>
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: LOGIN, REGISTER & FORGOT PASSWORD
// ==========================================
const LoginScreen = ({ onAuthSuccess, showToast }) => {
  const [view, setView] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = view === 'login';
  const isRegister = view === 'register';
  const isForgot = view === 'forgot';

  const handleAuth = async () => {
    const cleanEmail = email.trim();
    if (isRegister && !name.trim()) return showToast("Please enter your full name.", "error");
    if (!cleanEmail) return showToast("Email address is required.", "error");
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) return showToast("Please enter a valid email format.", "error");
    
    if (!password) return showToast("Password is required.", "error");
    if (isRegister && password.length < 6) return showToast("Password must be at least 6 characters.", "error");

    setLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: cleanEmail, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed.");
      
      if (isLogin) {
        showToast("Login successful!", "success");
        onAuthSuccess(data);
      } else {
        showToast(data.message || "Account created! Please check your email to verify.", "success");
        setView('login');
        setPassword('');
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return showToast("Email address is required.", "error");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) return showToast("Please enter a valid email format.", "error");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, "success");
      setView('login');
      setPassword('');
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#4f46e5', color: 'white', width: '64px', height: '64px' }}><FileText size={32} /></div>
        </div>
        
        {isForgot ? (
          <>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: '#111827' }}>Reset Password</h1>
            <p style={{ color: '#6b7280', marginBottom: '2.5rem' }}>Enter your email to receive a reset link.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: '#111827' }}>DocGen Platform</h1>
            <p style={{ color: '#6b7280', marginBottom: '2.5rem' }}>{isLogin ? 'Sign in to access your workspace' : 'Create a new account'}</p>
          </>
        )}
        
        {isRegister && (
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label>Full Name</label>
            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" disabled={loading} />
          </div>
        )}

        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Email Address</label>
          <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" disabled={loading} />
        </div>
        
        {!isForgot && (
          <>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
              <label>Password</label>
              <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} />
            </div>
            {isLogin && (
              <div className="forgot-password-link" onClick={() => { setView('forgot'); setPassword(''); setName(''); }}>
                Forgot Password?
              </div>
            )}
          </>
        )}
        
        {isForgot ? (
          <button className="btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '1rem' }} onClick={handleForgot} disabled={loading}>
            {loading ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        ) : (
          <button className="btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '1rem' }} onClick={handleAuth} disabled={loading}>
            {loading ? 'PROCESSING...' : (isLogin ? 'SIGN IN' : 'CREATE ACCOUNT')}
          </button>
        )}

        <div className="auth-toggle" onClick={() => { setView(isLogin ? 'register' : 'login'); setEmail(''); setPassword(''); setName(''); }}>
          {isForgot ? "Back to Login" : (isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In")}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: PROFILE & SETTINGS
// ==========================================
const SettingsScreen = ({ hasApiKey, setHasApiKey, showToast, userName, onNameUpdate, handleLogout, onDeleteAccount }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState(userName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  const [showDeleteKeyModal, setShowDeleteKeyModal] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);

  useEffect(() => {
    setName(userName || '');
  }, [userName]);

  const handleUpdateName = async () => {
    if (!name.trim()) return showToast("Name cannot be empty.", "error");
    setIsSavingName(true);
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/user/settings/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update name.");

      showToast("Name updated successfully!", "success");
      localStorage.setItem('docgen_name', data.name);
      onNameUpdate(data.name);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return showToast("API Key cannot be empty.", "error");
    setIsSaving(true);
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/user/settings/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save key.");
      
      showToast("API Key verified and securely saved!", "success");
      setHasApiKey(true);
      setApiKey(''); 
    } catch (err) { showToast(err.message, "error"); } 
    finally { setIsSaving(false); }
  };

  const handleDeleteKey = async () => {
    setIsDeletingKey(true);
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/user/settings/api-key`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete key.");
      
      showToast("API Key deleted successfully.", "success");
      setHasApiKey(false);
      setShowDeleteKeyModal(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsDeletingKey(false);
    }
  };

  return (
    <div className="page-container">
      {showDeleteKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete API Key</h3>
            <p>Are you sure you want to permanently remove your Gemini API Key? AI document generation will stop working until a new valid key is added.</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowDeleteKeyModal(false)} disabled={isDeletingKey}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteKey} disabled={isDeletingKey}>{isDeletingKey ? 'DELETING...' : 'Delete Key'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header"><h2>Profile & Settings</h2></div>
      <div className="panel" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem', padding: '2rem' }}>
        
        {/* PROFILE / NAME UPDATE SECTION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#e0f2fe', color: '#2563eb', padding: '0.75rem', borderRadius: '8px' }}><Users /></div>
          <div>
            <h3 style={{ margin: 0, color: '#111827' }}>Personal Information</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Update your display name.</p>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Full Name</label>
          <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" disabled={isSavingName} />
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleUpdateName} disabled={isSavingName}>
          {isSavingName ? 'UPDATING...' : 'UPDATE NAME'}
        </button>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '2.5rem 0' }} />

        {/* SECURITY / API KEY SECTION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#f3e8ff', color: '#7c3aed', padding: '0.75rem', borderRadius: '8px' }}><Key /></div>
          <div>
            <h3 style={{ margin: 0, color: '#111827' }}>Gemini API Integration</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Your personal API key is AES-256 encrypted before storage.</p>
          </div>
        </div>

        {hasApiKey && (
          <div style={{ padding: '1rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', color: '#065f46', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            <CheckCircle2 size={18} /> You have an active API Key saved. You can generate documents.
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Google Gemini API Key</label>
          <input type="password" className="form-control" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIzaSy..." disabled={isSaving} />
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSaveKey} disabled={isSaving}>
          {isSaving ? 'VERIFYING & SAVING...' : (hasApiKey ? 'UPDATE API KEY' : 'SAVE API KEY')}
        </button>
        {hasApiKey && (
          <button className="btn-outline" onClick={() => setShowDeleteKeyModal(true)} style={{ color: '#ef4444', borderColor: '#ef4444', marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
            DELETE API KEY
          </button>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '2.5rem 0' }} />

        {/* ACCOUNT MANAGEMENT SECTION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#fee2e2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px' }}><LogOut /></div>
          <div>
            <h3 style={{ margin: 0, color: '#111827' }}>Account Management</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Manage your session and account data.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleLogout(false)}>
            LOGOUT
          </button>
          <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={onDeleteAccount}>
            DELETE ACCOUNT
          </button>
        </div>

      </div>
    </div>
  );
};

// ==========================================
// SCREEN: DASHBOARD
// ==========================================
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, fontWeight: 500, fontSize: '0.9rem', marginBottom: '4px' }}>
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const DashboardScreen = ({ templates, documents, activities }) => {
  const generateChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    
    return Array.from({length: 5}, (_, i) => {
      const d = new Date();
      d.setMonth(currentMonthIdx - 4 + i);
      const mIdx = d.getMonth();
      const docs = documents.filter(doc => new Date(doc.date).getMonth() === mIdx).length;
      const temps = templates.filter(t => new Date(t.date || new Date()).getMonth() === mIdx).length;
      return { name: months[mIdx], Documents: docs + (mIdx * 3) + 10, Templates: temps + (mIdx * 1) + 2 };
    });
  };

  const chartData = generateChartData();

  return (
    <div className="page-container">
      <div className="page-header"><h2>Dashboard Analytics</h2></div>

      <div className="templates-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}><FileArchive /></div>
          <div><p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Total Documents</p><h3 style={{ margin: 0, fontSize: '1.75rem' }}>{documents.length}</h3></div>
        </div>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}><FileText /></div>
          <div><p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Total Templates</p><h3 style={{ margin: 0, fontSize: '1.75rem' }}>{templates.length}</h3></div>
        </div>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#fce7f3', color: '#db2777' }}><Users /></div>
          <div><p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Active Users</p><h3 style={{ margin: 0, fontSize: '1.75rem' }}>1</h3></div>
        </div>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div className="template-icon" style={{ background: '#e0f2fe', color: '#2563eb' }}><TrendingUp /></div>
          <div><p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Growth</p><h3 style={{ margin: 0, fontSize: '1.75rem' }}>+{(12 + documents.length)}%</h3></div>
        </div>
      </div>

      <div className="templates-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '1.5rem' }}>
        <div className="panel" style={{ padding: '2rem 2rem 0 0' }}>
          <h3 style={{ margin: '0 0 1rem 2rem', fontWeight: 600, color: '#111827' }}>Document Generation Trends</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={true} stroke="#94a3b8" tickLine={true} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={true} stroke="#94a3b8" tickLine={true} tick={{fill: '#64748b', fontSize: 12}} dx={-5} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Documents" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorDocs)" isAnimationActive={true} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{ padding: '2rem 2rem 0 0' }}>
          <h3 style={{ margin: '0 0 1rem 2rem', fontWeight: 600, color: '#111827' }}>Templates Created</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={true} stroke="#94a3b8" tickLine={true} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={true} stroke="#94a3b8" tickLine={true} tick={{fill: '#64748b', fontSize: 12}} dx={-5} />
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                <Bar dataKey="Templates" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 1.5rem 0', fontWeight: 600, color: '#111827' }}>Recent Activity</h3>
          {activities.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>No recent activity to display.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '300px' }}>
              {activities.slice(0, 10).map((act, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                  <div>
                    <strong style={{ color: '#111827', fontSize: '0.95rem' }}>{act.action}</strong><br/>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{act.target}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>{act.date}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: TEMPLATES LIST
// ==========================================
const TemplatesScreen = ({ templates, deleteTemplate, navigateToEdit, navigate }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const confirmDelete = (e, id) => {
    e.stopPropagation();
    setTemplateToDelete(id);
    setModalOpen(true);
  };

  return (
    <div className="page-container">
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Template</h3>
            <p>Are you sure you want to delete this template? Documents previously generated from it will be preserved.</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteTemplate(templateToDelete); setModalOpen(false); }}>Delete Template</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>Template Repository</h2>
        <button className="btn-primary" onClick={() => navigate('create_template')}><Plus size={18} /> CREATE TEMPLATE</button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} color="#cbd5e1" />
          <h3>No Templates Found</h3>
          <p style={{ color: '#6b7280' }}>Create a foundation template to start generating documents.</p>
          <button className="btn-primary" onClick={() => navigate('create_template')}><Plus size={18} /> Create Template</button>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map(t => {
            const aiCount = (t.sections || []).filter(s => s.type === 'AI').length;
            const textCount = (t.sections || []).filter(s => s.type === 'Text').length;

            return (
              <div key={t.id} className="template-card" onClick={() => navigateToEdit(t.id)}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div className="template-icon"><FileText /></div>
                  <div style={{ overflow: 'hidden' }}>
                    <h3 style={{ margin: 0, color: '#111827', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.name}</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description || "No description"}</p>
                  </div>
                </div>
                
                <div className="badges" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ background: '#e0f2fe', color: '#1d4ed8', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{textCount} Text</span>
                  {aiCount > 0 && <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{aiCount} AI</span>}
                </div>

                <div className="template-actions">
                  <span className="delete-text" style={{ color: '#4f46e5' }} onClick={(e) => { e.stopPropagation(); navigateToEdit(t.id); }}><Edit size={14}/> EDIT</span>
                  <span className="delete-text" onClick={(e) => confirmDelete(e, t.id)}><Trash2 size={14} /> DELETE</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// SCREEN: CREATE / EDIT TEMPLATE BUILDER
// ==========================================
const CreateTemplateScreen = ({ saveTemplate, navigate, templates, editTemplateId, showToast }) => {
  const [tab, setTab] = useState('BASIC');
  const [modalOpen, setModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  
  const [template, setTemplate] = useState({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), 
    name: '', title: '', description: '',
    customization: { font: 'Arial', size: 12, header: '', footer: '', marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72, bgColor: '#ffffff', textColor: '#000000' },
    sections: [], date: new Date().toISOString()
  });

  useEffect(() => {
    if (editTemplateId) {
      const existing = templates.find(t => t.id === editTemplateId);
      if (existing) {
        const hydratedCustomization = {
          font: 'Arial', size: 12, header: '', footer: '', marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72, bgColor: '#ffffff', textColor: '#000000',
          ...existing.customization
        };
        setTemplate({ ...JSON.parse(JSON.stringify(existing)), customization: hydratedCustomization });
      }
    }
  }, [editTemplateId, templates]);

  const handleSave = () => {
    if (!template.name.trim()) return showToast("Template Name is required.", "error");
    
    const sanitizedSections = (template.sections || []).map(sec => {
      if (sec.type === 'AI') return { ...sec, content: '' };
      if (sec.type === 'Text') return { ...sec, prompt: '' };
      return sec;
    });

    const finalTemplate = { ...template, sections: sanitizedSections };

    saveTemplate(finalTemplate, editTemplateId ? 'Template Updated' : 'Template Created');
    showToast(editTemplateId ? "Template updated successfully!" : "Template created successfully!", "success");
    navigate('templates');
  };

  const addSection = () => {
    setTemplate({
      ...template,
      sections: [...(template.sections || []), { id: Math.random().toString(), heading: 'New Section', type: 'Text', prompt: '', content: '' }]
    });
  };

  const updateSection = (id, field, value) => {
    setTemplate({
      ...template,
      sections: template.sections.map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  const updateCustomization = (field, value) => {
    setTemplate({
      ...template,
      customization: { ...template.customization, [field]: value }
    });
  };

  const confirmDeleteSection = (id) => {
    setSectionToDelete(id);
    setModalOpen(true);
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Section</h3>
            <p>Remove this section from the template structure?</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => {
                setTemplate({ ...template, sections: template.sections.filter(s => s.id !== sectionToDelete) });
                setModalOpen(false);
              }}>Delete Section</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
        <button className="btn-outline" style={{ border: 'none', padding: '0.5rem' }} onClick={() => navigate('templates')}><ArrowLeft size={18} /></button>
        <h2>{editTemplateId ? 'Edit Template Builder' : 'Create Template'}</h2>
      </div>

      <div className="panel" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="tabs" style={{ margin: 0, padding: '0 1rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
          <div className={`tab ${tab === 'BASIC' ? 'active' : ''}`} onClick={() => setTab('BASIC')}>BASIC INFORMATION</div>
          <div className={`tab ${tab === 'SECTIONS' ? 'active' : ''}`} onClick={() => setTab('SECTIONS')}>SECTIONS ({(template.sections || []).length})</div>
          <div className={`tab ${tab === 'CUSTOMIZATION' ? 'active' : ''}`} onClick={() => setTab('CUSTOMIZATION')}>CUSTOMIZATION</div>
        </div>

        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {tab === 'BASIC' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group"><label>Template Name *</label><input type="text" className="form-control" value={template.name} onChange={e => setTemplate({...template, name: e.target.value})} placeholder="e.g., Quotation Template" /></div>
              <div className="form-group"><label>Document Master Title</label><input type="text" className="form-control" value={template.title} onChange={e => setTemplate({...template, title: e.target.value})} placeholder="e.g., OFFICIAL QUOTATION" /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Description</label><textarea className="form-control" rows="3" value={template.description} onChange={e => setTemplate({...template, description: e.target.value})} /></div>
            </div>
          )}

          {tab === 'SECTIONS' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Document Sections</h3>
                <button className="btn-outline" onClick={addSection}><Plus size={16}/> ADD SECTION</button>
              </div>

              {(!template.sections || template.sections.length === 0) ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>No sections added. Add sections to define your document structure.</p>
                  <button className="btn-primary" onClick={addSection}><Plus size={18} /> ADD FIRST SECTION</button>
                </div>
              ) : (
                template.sections.map((sec) => (
                  <div key={sec.id} className="section-builder-card">
                    <div className="section-header-row">
                      <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label>Section Title</label>
                        <input type="text" className="form-control" value={sec.heading} onChange={e => updateSection(sec.id, 'heading', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ width: '200px', margin: 0 }}>
                        <label>Section Type</label>
                        <select className="form-control" value={sec.type} onChange={e => updateSection(sec.id, 'type', e.target.value)}>
                          <option value="Text">Text</option>
                          <option value="AI">AI</option>
                        </select>
                      </div>
                      <button className="btn-outline" style={{ border: 'none', color: '#ef4444' }} onClick={() => confirmDeleteSection(sec.id)}><Trash2 size={18}/></button>
                    </div>

                    {sec.type === 'AI' ? (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>AI Prompt</label>
                        <textarea className="form-control" rows="3" value={sec.prompt} onChange={e => updateSection(sec.id, 'prompt', e.target.value)} placeholder="Describe what AI should generate for this section..." />
                      </div>
                    ) : (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Content</label>
                        <textarea className="form-control" rows="4" value={sec.content} onChange={e => updateSection(sec.id, 'content', e.target.value)} placeholder="Write manual content here..." />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'CUSTOMIZATION' && (
            <div>
              <h3 style={{ margin: '0 0 1.5rem 0', color: '#111827' }}>Document Customization</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{gridColumn: 'span 1'}}>
                  <label>Font Family</label>
                  <select 
                    className="form-control" 
                    value={template.customization.font} 
                    onChange={e => updateCustomization('font', e.target.value)}
                    style={{ fontFamily: template.customization.font }}
                  >
                    <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                    <option value="Cambria" style={{ fontFamily: 'Cambria' }}>Cambria</option>
                    <option value="Times New Roman" style={{ fontFamily: '"Times New Roman", Times, serif' }}>Times New Roman</option>
                    <option value="Calibri" style={{ fontFamily: 'Calibri, sans-serif' }}>Calibri</option>
                    <option value="Georgia" style={{ fontFamily: 'Georgia, serif' }}>Georgia</option>
                    <option value="Verdana" style={{ fontFamily: 'Verdana, sans-serif' }}>Verdana</option>
                  </select>
                </div>
                <div className="form-group" style={{gridColumn: 'span 1'}}><label>Font Size (pt)</label><input type="number" className="form-control" value={template.customization.size} onChange={e => updateCustomization('size', e.target.value)} /></div>
                
                <div style={{gridColumn: 'span 2', display: 'flex', gap: '1rem', alignItems: 'center'}}>
                   <span style={{fontSize: '0.85rem', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap'}}>Margins (pt)</span>
                   <div className="form-group" style={{marginBottom: 0, flex: 1}}><label>Top</label><input type="number" className="form-control" value={template.customization.marginTop} onChange={e => updateCustomization('marginTop', e.target.value)} /></div>
                   <div className="form-group" style={{marginBottom: 0, flex: 1}}><label>Bottom</label><input type="number" className="form-control" value={template.customization.marginBottom} onChange={e => updateCustomization('marginBottom', e.target.value)} /></div>
                </div>

                <div className="form-group" style={{gridColumn: 'span 1'}}><label>Left</label><input type="number" className="form-control" value={template.customization.marginLeft} onChange={e => updateCustomization('marginLeft', e.target.value)} /></div>
                <div className="form-group" style={{gridColumn: 'span 1'}}><label>Right</label><input type="number" className="form-control" value={template.customization.marginRight} onChange={e => updateCustomization('marginRight', e.target.value)} /></div>

                <div style={{gridColumn: 'span 2', display: 'flex', gap: '1rem', alignItems: 'center'}}>
                   <span style={{fontSize: '0.85rem', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap'}}>Header & Footer</span>
                   <div className="form-group" style={{marginBottom: 0, flex: 1}}><label>Header Text</label><input type="text" className="form-control" value={template.customization.header} onChange={e => updateCustomization('header', e.target.value)} /></div>
                </div>

                <div className="form-group" style={{gridColumn: 'span 2'}}>
                    <label>Footer Text</label>
                    <input type="text" className="form-control" value={template.customization.footer} onChange={e => updateCustomization('footer', e.target.value)} placeholder="Use [PAGE] for page numbers" />
                    <span style={{fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px'}}>Use [PAGE] and [TOTAL] for page numbers</span>
                </div>

                <div style={{gridColumn: 'span 2', display: 'flex', gap: '1rem', alignItems: 'center'}}>
                   <span style={{fontSize: '0.85rem', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap'}}>Colors</span>
                   <div className="form-group" style={{marginBottom: 0, flex: 1}}><label>Background Color</label><input type="color" className="form-control" style={{padding: '0.2rem', height: '40px', cursor: 'pointer'}} value={template.customization.bgColor} onChange={e => updateCustomization('bgColor', e.target.value)} /></div>
                   <div className="form-group" style={{marginBottom: 0, flex: 1}}><label>Text Color</label><input type="color" className="form-control" style={{padding: '0.2rem', height: '40px', cursor: 'pointer'}} value={template.customization.textColor} onChange={e => updateCustomization('textColor', e.target.value)} /></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn-outline" onClick={() => navigate('templates')}>CANCEL</button>
          <button className="btn-primary" onClick={handleSave}><FileText size={16} /> SAVE TEMPLATE</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: DOCUMENTS LIST
// ==========================================
const DocumentsScreen = ({ documents, templates, deleteDocument, navigate, openDocument }) => {
  const [filter, setFilter] = useState('All Templates');
  const [modalOpen, setModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  const filteredDocs = filter === 'All Templates' ? documents : documents.filter(doc => doc.templateName === filter);

  const confirmDelete = (e, id) => {
    e.stopPropagation();
    setDocToDelete(id);
    setModalOpen(true);
  };

  return (
    <div className="page-container">
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Document</h3>
            <p>Permanently remove this saved document from the repository?</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteDocument(docToDelete); setModalOpen(false); }}>Delete Document</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>Document Repository</h2>
        <button className="btn-primary" onClick={() => navigate('generate_document')}><Plus size={18} /> GENERATE DOCUMENT</button>
      </div>

      <div className="form-group" style={{ width: '250px' }}>
        <label>Filter by Source Template</label>
        <select className="form-control" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="All Templates">All Templates</option>
          {templates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <FileArchive size={48} color="#cbd5e1" />
          <h3>No documents found</h3>
          <p style={{ color: '#6b7280', margin: 0 }}>Adjust your filter or generate a new document.</p>
        </div>
      ) : (
        <div className="templates-grid" style={{ marginTop: '2rem' }}>
          {filteredDocs.map(doc => (
            <div key={doc.id} className="template-card" onClick={() => openDocument(doc)}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="template-icon" style={{ background: '#fce7f3', color: '#db2777' }}><FileArchive /></div>
                <div style={{ overflow: 'hidden' }}>
                  <h3 style={{ margin: 0, color: '#111827', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{doc.title}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Template: {doc.templateName}</p>
                </div>
              </div>
              <div className="template-actions" style={{ opacity: 1, borderTop: 'none', paddingTop: 0, marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Updated: {doc.updatedAt || doc.date}</span>
                <span className="delete-text" onClick={(e) => confirmDelete(e, doc.id)}><Trash2 size={14}/></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// SCREEN: DEDICATED DOCUMENT VIEWER
// ==========================================
const DocumentViewScreen = ({ doc, navigate, editDocument, exportDocument, showToast }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!doc) return null;

  const handleExport = async (format) => {
    setIsExporting(true);
    await exportDocument(doc, format);
    setIsExporting(false);
    setModalOpen(false);
  };

  const custStyle = {
    fontFamily: doc.customization?.font || 'Arial',
    fontSize: `${doc.customization?.size || 12}pt`,
    color: doc.customization?.textColor || '#000000',
    backgroundColor: doc.customization?.bgColor || '#ffffff',
    padding: `${doc.customization?.marginTop || 72}pt ${doc.customization?.marginRight || 72}pt ${doc.customization?.marginBottom || 72}pt ${doc.customization?.marginLeft || 72}pt`,
    minHeight: '600px',
    boxSizing: 'border-box'
  };

  return (
    <div className="page-container">
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Download Document</h3>
            <p>Select output format. Visual integrity (Header, Watermark, Layout) is preserved.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleExport('docx')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileText size={18}/> Microsoft Word (.docx)</>}</button>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleExport('pdf')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileDown size={18}/> Adobe PDF (.pdf)</>}</button>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleExport('md')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileCode size={18}/> Markdown (.md)</>}</button>
            </div>
            <button className="btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModalOpen(false)} disabled={isExporting}>Cancel</button>
          </div>
        </div>
      )}

      <div className="page-header" style={{ justifyContent: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <button className="btn-outline" style={{ border: 'none', padding: '0.5rem' }} onClick={() => navigate('documents')}><ArrowLeft size={18} /></button>
        <h2 style={{ margin: 0 }}>Document Viewer</h2>
      </div>

      <div className="doc-viewer-header">
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', color: '#111827' }}>{doc.title}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
            <span><strong>Template:</strong> {doc.templateName}</span>
            <span><strong>Created:</strong> {doc.date}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-outline" onClick={() => editDocument(doc)}><Edit size={16}/> EDIT</button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}><Download size={16}/> DOWNLOAD</button>
        </div>
      </div>

      <div className="doc-viewer-content" style={custStyle}>
        {doc.sections && doc.sections.map((sec, idx) => (
          <div key={idx} style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ borderBottom: `1px solid ${doc.customization?.textColor || '#000000'}`, paddingBottom: '0.5rem', opacity: 0.8 }}>{idx + 1}. {sec.heading}</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {(sec.content || "").replace(/\{\{NUM\}\}/g, idx + 1)}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// SCREEN: GENERATION WORKSPACE
// ==========================================
const GenerateDocumentScreen = ({ templates, editDoc, saveDocument, exportDocument, navigate, showToast }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [activeSections, setActiveSections] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (editDoc) {
      setEditingDocId(editDoc.id);
      setSelectedTemplate(editDoc.templateId);
      setDocTitle(editDoc.title);
      setActiveSections(JSON.parse(JSON.stringify(editDoc.sections || [])));
    }
  }, [editDoc]);

  const handleTemplateChange = (e) => {
    const tid = e.target.value;
    setSelectedTemplate(tid);
    if (tid) {
      const template = templates.find(t => t.id === tid);
      setDocTitle(template.title || 'Untitled Document');
      
      const initializedSections = JSON.parse(JSON.stringify(template.sections || [])).map(sec => {
        if (sec.type === 'AI') sec.content = '';
        return sec;
      });
      
      setActiveSections(initializedSections);
      setActiveIndex(0);
      setEditingDocId(null);
    } else {
      setActiveSections([]);
      setDocTitle('');
    }
  };

  const activeData = activeSections[activeIndex];

  const updateActiveSection = (field, value) => {
    const updated = [...activeSections];
    updated[activeIndex][field] = value;
    setActiveSections(updated);
  };

  const handleGenerateAI = async () => {
    if (!activeData || !activeData.prompt) return showToast("AI Prompt missing from template.", "error");
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/generate-section`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt: activeData.prompt, heading: activeData.heading, documentTitle: docTitle })
      });
      const data = await res.json();
      
      if (res.status === 400 && data.error === "MISSING_API_KEY") {
         showToast("Please add your Gemini API key from Profile → Settings.", "error");
         setTimeout(() => navigate('settings'), 2000);
         throw new Error("Missing API Key");
      }
      if (!res.ok) throw new Error(data.error || "Server generation failed.");
      
      updateActiveSection('content', data.content);
      showToast("AI Content generated!", "success");
    } catch (err) {
      if(err.message !== "Missing API Key") showToast(`AI Error: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOnly = () => {
    if (!docTitle.trim()) return showToast("Please provide a Document Title.", "error");
    const templateDetails = templates.find(t => t.id === selectedTemplate);
    if (!templateDetails) return showToast("Template reference lost.", "error");

    const finalDoc = {
      id: editingDocId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString()),
      title: docTitle,
      templateId: templateDetails.id,
      templateName: templateDetails.name,
      customization: templateDetails.customization || {},
      date: editDoc ? editDoc.date : new Date().toLocaleDateString(),
      updatedAt: new Date().toLocaleDateString(),
      sections: activeSections
    };

    saveDocument(finalDoc, editingDocId ? 'Document Updated' : 'Document Created');
    showToast(editingDocId ? "Document updated!" : "Document saved successfully!", "success");
    navigate('documents');
  };

  const handleDownload = async (format) => {
    setIsExporting(true);
    const templateDetails = templates.find(t => t.id === selectedTemplate);
    const draftDoc = {
      title: docTitle || "Draft",
      customization: templateDetails?.customization || {},
      sections: activeSections.filter(s => s.content && s.content.trim() !== '')
    };
    await exportDocument(draftDoc, format);
    setIsExporting(false);
    setModalOpen(false);
  };

  const templateObj = templates.find(t => t.id === selectedTemplate);
  const custStyle = templateObj?.customization ? {
    fontFamily: templateObj.customization.font || 'Arial',
    fontSize: `${templateObj.customization.size || 12}pt`,
    color: templateObj.customization.textColor || '#000000',
    backgroundColor: templateObj.customization.bgColor || '#ffffff',
    padding: `${templateObj.customization.marginTop || 72}pt ${templateObj.customization.marginRight || 72}pt ${templateObj.customization.marginBottom || 72}pt ${templateObj.customization.marginLeft || 72}pt`,
    minHeight: '100%',
    boxSizing: 'border-box'
  } : {};

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem' }}>
      
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Download Document</h3>
            <p>Select format to export. Visual layout (Fonts, Colors, Margins) is preserved natively.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleDownload('docx')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileText size={18}/> Word (.docx)</>}</button>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleDownload('pdf')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileDown size={18}/> PDF (.pdf)</>}</button>
              <button className="btn-outline" style={{ justifyContent: 'center' }} onClick={() => handleDownload('md')} disabled={isExporting}>{isExporting ? 'Exporting...' : <><FileCode size={18}/> Markdown (.md)</>}</button>
            </div>
            <button className="btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModalOpen(false)} disabled={isExporting}>Cancel</button>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-outline" style={{ border: 'none', padding: '0.5rem' }} onClick={() => navigate('documents')}><ArrowLeft size={18} /></button>
          <h2 style={{ margin: 0 }}>{editingDocId ? 'Edit Workspace' : 'Generation Workspace'}</h2>
        </div>
        
        {activeSections.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
             <button className="btn-outline" onClick={handleSaveOnly}>
               <Save size={16}/> SAVE DOCUMENT
             </button>
             <button className="btn-primary" onClick={() => setModalOpen(true)}>
               <Download size={16}/> DOWNLOAD
             </button>
          </div>
        )}
      </div>

      <div className="workspace-grid">
        <div className="workspace-sidebar">
          <div className="workspace-sidebar-header">Configuration</div>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Source Template</label>
              <select className="form-control" value={selectedTemplate} onChange={handleTemplateChange} disabled={editingDocId !== null}>
                <option value="">-- Choose Template --</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {selectedTemplate && (
              <div className="form-group" style={{ margin: 0 }}>
                <label>Document Output Title</label>
                <input type="text" className="form-control" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
              </div>
            )}
          </div>

          {selectedTemplate && activeSections.length > 0 && (
            <>
              <div className="workspace-sidebar-header">Sections Outline</div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeSections.map((sec, idx) => (
                  <div key={sec.id} className={`workspace-nav-item ${idx === activeIndex ? 'active' : ''}`} onClick={() => setActiveIndex(idx)}>
                    <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {idx + 1}. {sec.heading}
                    </span>
                    {sec.content && sec.content.trim() && <CheckCircle size={14} color="#10b981" />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!selectedTemplate ? (
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <FileText size={48} color="#cbd5e1" />
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>Select a template to initialize.</p>
          </div>
        ) : activeData ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>{activeIndex + 1}. {activeData.heading}</h3>
              <span className="badge" style={{ background: '#eef2ff', color: '#4f46e5', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>{activeData.type}</span>
            </div>

            {activeData.type === 'AI' && (
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0' }}>AI Generation Protocol Active</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Using template prompt to generate draft content.</p>
                </div>
                <button className="btn-primary" onClick={handleGenerateAI} disabled={isGenerating}>
                  {isGenerating ? 'GENERATING...' : (activeData.content ? 'REGENERATE CONTENT' : 'GENERATE AI CONTENT')}
                </button>
              </div>
            )}

            <div className="dual-pane">
              <div className="pane">
                <div className="pane-header">Input Editor (Markdown)</div>
                <textarea className="pane-textarea" style={{ padding: '1.5rem' }} placeholder={activeData.type === 'Text' ? "Write your manual content here..." : "Generated AI content will appear here and is fully editable..."} value={activeData.content || ''} onChange={e => updateActiveSection('content', e.target.value)} disabled={isGenerating} />
              </div>

              <div className="pane">
                <div className="pane-header">Live Render Preview</div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={custStyle}>
                    {activeData.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {activeData.content.replace(/\{\{NUM\}\}/g, activeIndex + 1)}
                      </ReactMarkdown>
                    ) : (
                      <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Preview will appear here...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ==========================================
// MAIN ROUTER & APP SHELL
// ==========================================
function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [viewDocumentData, setViewDocumentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const [resetToken, setResetToken] = useState(null);
  const [verifyToken, setVerifyToken] = useState(null);
  
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activities, setActivities] = useState([]);

  // NEXT.JS MOUNTING FIX: Safe window/URL parsing in Next.js Client Component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setResetToken(urlParams.get('resetToken'));
      setVerifyToken(urlParams.get('verifyToken'));
    }
  }, []);

  useEffect(() => {
    if (verifyToken) {
      setIsLoading(true);
      fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken })
      })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error);
        showToast(data.message, "success");
      })
      .catch(err => showToast(err.message, "error"))
      .finally(() => {
        if (typeof window !== 'undefined') window.history.replaceState({}, document.title, window.location.pathname);
        setVerifyToken(null);
        setIsLoading(false);
      });
    }
  }, [verifyToken, showToast]);

  useEffect(() => {
    if (resetToken || verifyToken) {
      if(!verifyToken) setIsLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('docgen_token');
      const email = localStorage.getItem('docgen_email');
      const name = localStorage.getItem('docgen_name');
      
      if (token && email && name) {
        setUser({ email, name, initial: name.charAt(0).toUpperCase() });
        fetchData(token);
      } else {
        setIsLoading(false);
      }
    }
  }, [resetToken, verifyToken]);

  const fetchData = async (token) => {
    try {
      const res = await fetch(`${API_URL}/data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) {
        const data = await res.json();
        if (data.templates) setTemplates(data.templates);
        if (data.documents) setDocuments(data.documents);
        if (data.activities) setActivities(data.activities);
        if (data.hasApiKey !== undefined) setHasApiKey(data.hasApiKey);
      } else if (res.status === 401 || res.status === 403) {
         handleLogout(false, "Session expired. Please log in again.");
      }
    } catch (err) {
      showToast("Failed to fetch workspace data.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (data) => {
    localStorage.setItem('docgen_token', data.token);
    localStorage.setItem('docgen_email', data.email);
    localStorage.setItem('docgen_name', data.name);
    
    setUser({ email: data.email, name: data.name, initial: data.name.charAt(0).toUpperCase() });
    fetchData(data.token);
  };

  const handleLogout = (isDelete = false, msg = "Logged out successfully.") => {
    localStorage.removeItem('docgen_token');
    localStorage.removeItem('docgen_email');
    localStorage.removeItem('docgen_name');
    setUser(null);
    setTemplates([]);
    setDocuments([]);
    setActivities([]);
    setHasApiKey(false);
    if(!isDelete) showToast(msg, "info");
  };

  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      
      handleLogout(true);
      showToast("Account deleted successfully.", "success");
      setDeleteModalOpen(false);
    } catch(err) {
      showToast(err.message, "error");
    }
  };

  const syncToBackend = (t, d, a) => {
    const token = localStorage.getItem('docgen_token');
    if(!token) return;

    fetch(`${API_URL}/data`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ templates: t, documents: d, activities: a })
    }).catch(() => showToast("Failed to synchronize with cloud.", "error"));
  };

  const logActivity = (actionText, targetName, tState, dState, aState) => {
    const now = new Date();
    const newAct = { 
      action: actionText, 
      target: targetName, 
      date: now.toLocaleDateString(), 
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    const newActivities = [newAct, ...aState].slice(0, 50);
    setActivities(newActivities);
    syncToBackend(tState, dState, newActivities);
  };

  if (resetToken) {
    return (
      <ErrorBoundary>
        <ToastDisplay toast={toast} />
        <ResetPasswordScreen 
          resetToken={resetToken} 
          showToast={showToast}
          onResetSuccess={() => {
            if (typeof window !== 'undefined') window.history.replaceState({}, document.title, window.location.pathname);
            setResetToken(null);
          }} 
        />
      </ErrorBoundary>
    );
  }

  if (!user) return (
    <ErrorBoundary>
      <ToastDisplay toast={toast} />
      <LoginScreen onAuthSuccess={handleLoginSuccess} showToast={showToast} />
    </ErrorBoundary>
  );

  if (isLoading) return <div className="error-boundary"><p>Initializing Workspace...</p></div>;

  const handleSaveTemplate = (newTemplate, actionLog) => {
    const exists = templates.find(t => t.id === newTemplate.id);
    const updated = exists ? templates.map(t => t.id === newTemplate.id ? newTemplate : t) : [...templates, newTemplate];
    setTemplates(updated);
    logActivity(actionLog, newTemplate.name, updated, documents, activities);
  };

  const handleDeleteTemplate = (id) => {
    const deletedTemp = templates.find(t => t.id === id);
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    logActivity('Template Deleted', deletedTemp.name, updated, documents, activities);
    showToast("Template deleted successfully.", "info");
  };

  const handleSaveDocument = (doc, actionLog) => {
    const exists = documents.find(d => d.id === doc.id);
    const updated = exists ? documents.map(d => d.id === doc.id ? doc : d) : [doc, ...documents];
    setDocuments(updated);
    logActivity(actionLog, doc.title, templates, updated, activities);
  };

  const handleDeleteDocument = (id) => {
    const deletedDoc = documents.find(d => d.id === id);
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    logActivity('Document Deleted', deletedDoc.title, templates, updated, activities);
    showToast("Document deleted successfully.", "info");
  };

  const exportDocumentFile = async (doc, format) => {
    try {
      const token = localStorage.getItem('docgen_token');
      const res = await fetch(`${API_URL}/export-document`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ format, documentTitle: doc.title, customization: doc.customization, sections: doc.sections })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Export pipeline failed on server.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DocGen_${doc.title.replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      logActivity(`Exported as ${format.toUpperCase()}`, doc.title, templates, documents, activities);
      showToast(`Exported ${format.toUpperCase()} successfully!`, "success");
    } catch (err) {
      showToast(`System Export Error: ${err.message}`, "error");
    }
  };

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <DashboardScreen templates={templates} documents={documents} activities={activities} />;
      case 'templates': return <TemplatesScreen templates={templates} deleteTemplate={handleDeleteTemplate} navigateToEdit={(id) => { setEditTemplateId(id); setCurrentPage('create_template'); }} navigate={() => { setEditTemplateId(null); setCurrentPage('create_template'); }} />;
      case 'create_template': return <CreateTemplateScreen templates={templates} editTemplateId={editTemplateId} saveTemplate={handleSaveTemplate} navigate={setCurrentPage} showToast={showToast} />;
      case 'documents': return <DocumentsScreen documents={documents} templates={templates} deleteDocument={handleDeleteDocument} navigate={setCurrentPage} openDocument={(doc) => { setViewDocumentData(doc); setCurrentPage('view_document'); }} />;
      case 'view_document': return <DocumentViewScreen doc={viewDocumentData} navigate={setCurrentPage} editDocument={(doc) => { setViewDocumentData(doc); setCurrentPage('generate_document'); }} exportDocument={exportDocumentFile} showToast={showToast} />;
      case 'generate_document': return <GenerateDocumentScreen templates={templates} editDoc={viewDocumentData} saveDocument={handleSaveDocument} exportDocument={exportDocumentFile} navigate={setCurrentPage} showToast={showToast} />;
      case 'settings': return <SettingsScreen hasApiKey={hasApiKey} setHasApiKey={setHasApiKey} showToast={showToast} userName={user.name} onNameUpdate={(newName) => setUser({ ...user, name: newName, initial: newName.charAt(0).toUpperCase() })} handleLogout={handleLogout} onDeleteAccount={() => setDeleteModalOpen(true)} />;
      default: return <DashboardScreen templates={templates} documents={documents} activities={activities} />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastDisplay toast={toast} />
      
      {deleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Account</h3>
            <p>Are you sure you want to permanently delete your account? This action cannot be undone and all your templates and documents will be lost.</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteAccount}>Delete Account</button>
            </div>
          </div>
        </div>
      )}

      <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-brand"><FileText size={24} /> DocGen Platform</div>
          <div className="sidebar-nav">
            <div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => { setViewDocumentData(null); setCurrentPage('dashboard'); }}><LayoutDashboard size={20} /> Dashboard</div>
            <div className={`nav-item ${['templates', 'create_template'].includes(currentPage) ? 'active' : ''}`} onClick={() => { setViewDocumentData(null); setCurrentPage('templates'); }}><FileText size={20} /> Templates</div>
            <div className={`nav-item ${['documents', 'generate_document', 'view_document'].includes(currentPage) ? 'active' : ''}`} onClick={() => { setViewDocumentData(null); setCurrentPage('documents'); }}><FileArchive size={20} /> Documents</div>
            
            <div className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`} onClick={() => { setViewDocumentData(null); setCurrentPage('settings'); }} style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <Settings size={20} /> Settings
            </div>
          </div>
        </div>

        <div className="main-content">
          <div className="topbar">
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              {currentPage === 'dashboard' && "Analytics Dashboard"}
              {['templates', 'create_template'].includes(currentPage) && "Template Architect"}
              {['documents', 'generate_document', 'view_document'].includes(currentPage) && "Document Repository"}
              {currentPage === 'settings' && "Account Configuration"}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <div style={{ width: '38px', height: '38px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} onClick={() => setShowDropdown(!showDropdown)}>
                {user.initial}
              </div>
              {showDropdown && (
                <div style={{ position: 'absolute', top: '50px', right: '0', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10, width: '200px' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong>{user.name}</strong><br/>{user.email}
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#ef4444', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }} onClick={() => { setShowDropdown(false); setDeleteModalOpen(true); }}>
                    <Trash2 size={16}/> Delete Account
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#6b7280', fontWeight: 500 }} onClick={() => handleLogout(false)}>
                    <LogOut size={16}/> Logout
                  </div>
                </div>
              )}
            </div>
          </div>
          {renderPage()}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;