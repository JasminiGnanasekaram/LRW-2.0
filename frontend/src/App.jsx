import React, { useState, useEffect, useRef } from "react";
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
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Contact from "./pages/Contact.jsx";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [appLang, setAppLang] = useState(localStorage.getItem("lrw_lang") || "English");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleUpdate = (e) => {
      setUser(e.detail);
    };
    window.addEventListener("lrw_user_updated", handleUpdate);
    return () => window.removeEventListener("lrw_user_updated", handleUpdate);
  }, []);

  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleLangChange = (e) => {
    const selected = e.target.value;
    setAppLang(selected);
    localStorage.setItem("lrw_lang", selected);
    window.dispatchEvent(new CustomEvent("lrw_lang_changed", { detail: selected }));
  };

  const langSelect = (
    <select
      value={appLang}
      onChange={handleLangChange}
      aria-label="Select Language"
      style={{
        background: "rgba(255, 255, 255, 0.12)",
        color: "#fff",
        border: "1px solid rgba(255, 255, 255, 0.25)",
        borderRadius: "var(--radius-sm)",
        padding: "5px 28px 5px 10px",
        fontSize: "13px",
        fontWeight: "500",
        cursor: "pointer",
        outline: "none",
        marginRight: "12px",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='white' viewBox='0 0 24 24'><path d='M7 10l5 5 5-5z'/></svg>")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        backgroundSize: "12px"
      }}
    >
      <option value="English" style={{ color: "var(--ink)" }}>English</option>
      <option value="Tamil" style={{ color: "var(--ink)" }}>Tamil (தமிழ்)</option>
      <option value="Sinhala" style={{ color: "var(--ink)" }}>Sinhala (සිංහල)</option>
    </select>
  );

  const isActive = (path) => location.pathname === path ? "active" : "";

  if (!user) {
    const publicPages = ["/home", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/privacy", "/terms", "/contact"];
    const isPublic = publicPages.some(p => location.pathname.startsWith(p));
    if (!isPublic) return null;
    if (["/login", "/register"].includes(location.pathname)) return null;

    return (
      <nav className="topbar">
        <span className="topbar-brand" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>LR<span>W</span></span>
        <div className="topbar-links" />
        <div className="topbar-right" style={{ display: "flex", alignItems: "center" }}>
          {langSelect}
          <Link to="/login"><button className="topbar-logout">Sign in</button></Link>
          <Link to="/register"><button style={{ background: "#fff", color: "var(--forest)", border: "none", padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Get started</button></Link>
        </div>
      </nav>
    );
  }

  const handleLogout = async () => { await logout(); navigate("/home"); };
  const avatarSrc = user.avatar_url || user.image || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=4a7c59&color=fff&size=40`;

  return (
    <nav className="topbar">
      <span className="topbar-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>LR<span>W</span></span>
      <div className="topbar-links">
        <Link to="/" className={isActive("/")}>Dashboard</Link>
        <Link to="/upload" className={isActive("/upload")}>Upload</Link>
        <Link to="/search" className={isActive("/search")}>Search</Link>
        {user.role === "admin" && <Link to="/admin" className={isActive("/admin")}>Admin</Link>}
      </div>
      
      <div className="topbar-right" style={{ display: "flex", alignItems: "center" }}>
        {langSelect}
        
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button 
            className="topbar-user-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "var(--radius)",
              transition: "background 0.2s",
              outline: "none"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <img 
              src={avatarSrc} 
              alt="avatar" 
              style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.4)" }} 
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", fontSize: 13, lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600 }}>{user.name || "User"}</span>
              <span style={{ opacity: 0.7, fontSize: 11 }}>{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Guest"}</span>
            </div>
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3" 
              style={{ 
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", 
                transition: "transform 0.2s var(--ease)",
                opacity: 0.8
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div 
              className="topbar-dropdown"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 240,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 1000,
                padding: "8px 0",
                color: "var(--ink)",
                transformOrigin: "top right"
              }}
            >
              {/* User Details Header */}
              <div style={{ padding: "12px 16px 8px", display: "flex", gap: 10, alignItems: "center" }}>
                <img 
                  src={avatarSrc} 
                  alt="avatar" 
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} 
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--forest)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "User"}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-lt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email || ""}</div>
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0" }} />

              {/* Menu Links */}
              <Link 
                to="/profile" 
                onClick={() => setDropdownOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  color: "var(--ink-mid)",
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s"
                }}
                className="topbar-dropdown-item"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My Profile
              </Link>

              <Link 
                to="/" 
                onClick={() => setDropdownOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  color: "var(--ink-mid)",
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s"
                }}
                className="topbar-dropdown-item"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                Dashboard
              </Link>

              {user.role === "admin" && (
                <Link 
                  to="/admin" 
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    color: "var(--ink-mid)",
                    textDecoration: "none",
                    transition: "background 0.15s, color 0.15s"
                  }}
                  className="topbar-dropdown-item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Admin Panel
                </Link>
              )}

              <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0" }} />

              <button 
                onClick={() => { setDropdownOpen(false); handleLogout(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  padding: "10px 16px",
                  fontSize: 13,
                  color: "var(--danger)",
                  cursor: "pointer",
                  transition: "background 0.15s"
                }}
                className="topbar-dropdown-logout-item"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </>
  );
}
