import React, { useState, useRef, useEffect } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { currentUser, logout } from "./api";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Search from "./pages/Search.jsx";
import DocumentView from "./pages/DocumentView.jsx";
import Admin from "./pages/Admin.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Home from "./pages/Home.jsx";
import ResendVerification from "./pages/ResendVerification.jsx";
import Profile from "./pages/Profile.jsx";

function ProtectedRoute({ children, role }) {
  const u = currentUser();
  if (!u) return <Navigate to="/home" />;
  if (role && u.role !== role) return <Navigate to="/" />;
  return children;
}

function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(currentUser());
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function onUserUpdate(e) {
      if (e?.detail) setUser(e.detail);
      else setUser(currentUser());
    }
    window.addEventListener('lrw_user_updated', onUserUpdate);
    return () => window.removeEventListener('lrw_user_updated', onUserUpdate);
  }, []);

  const isActive = (path) => location.pathname === path ? "active" : "";

  if (!user) {
    const publicPages = ["/home", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
    const isPublic = publicPages.some(p => location.pathname.startsWith(p));
    if (!isPublic) return null;

    return (
      <nav className="topbar">
        <span className="topbar-brand" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>LR<span>W</span></span>
        <div className="topbar-links" />
        <div className="topbar-right">
          <Link to="/login"><button className="topbar-logout">Sign in</button></Link>
          <Link to="/register"><button style={{ background: "#fff", color: "var(--forest)", border: "none", padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Get started</button></Link>
        </div>
      </nav>
    );
  }

  const handleLogout = async () => { await logout(); navigate("/home"); };

  return (
    <nav className="topbar">
      <span className="topbar-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>LR<span>W</span></span>
      <div className="topbar-links">
        <Link to="/" className={isActive("/")}>Dashboard</Link>
        <Link to="/upload" className={isActive("/upload")}>Upload</Link>
        <Link to="/search" className={isActive("/search")}>Search</Link>
        {user.role === "admin" && <Link to="/admin" className={isActive("/admin")}>Admin</Link>}
      </div>
      <div className="topbar-right">
        <div className="profile" ref={profileRef}>
          <div className="profile-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img className="profile-avatar" src={user.image || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4a7c59&color=fff`} alt="avatar" onClick={(e) => { e.stopPropagation(); if (fileInputRef.current) fileInputRef.current.click(); }} />
            <button className="profile-name-btn" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}>{user.name}</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (ev) => {
              const f = ev.target.files && ev.target.files[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result;
                const updated = { ...(user || {}), image: dataUrl };
                try { localStorage.setItem('lrw_user', JSON.stringify(updated)); } catch (e) {}
                setUser(updated);
                window.dispatchEvent(new CustomEvent('lrw_user_updated', { detail: updated }));
              };
              reader.readAsDataURL(f);
            }} />
          </div>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-card card">
                <div className="row items-center">
                  <img className="profile-avatar-lg" src={user.image || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4a7c59&color=fff`} alt="avatar" />
                  <div>
                    <div className="card-title">{user.name}</div>
                    <div className="muted">{user.email}</div>
                    <div style={{ marginTop: 6 }} className="badge">{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}</div>
                  </div>
                </div>
                <div className="divider" />
                <div className="field">
                  <div className="label">Date of birth</div>
                  <div>{(() => { try { const d = user.dob || user.date_of_birth || user.birthdate; return d ? new Date(d).toLocaleDateString() : 'ÔÇö'; } catch (e) { return 'ÔÇö'; } })()}</div>
                </div>
                <div className="field">
                  <div className="label">Additional information</div>
                  <div className="muted">{user.bio || user.info || user.additional || 'ÔÇö'}</div>
                </div>
                <div style={{ marginTop: 12 }} className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>Edit profile</button>
                  <div style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => { setProfileOpen(false); handleLogout(); }}>Sign out</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </>
  );
}
