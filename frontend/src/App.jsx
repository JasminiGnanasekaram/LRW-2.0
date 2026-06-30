import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState as useLocalState, useEffect, useRef as useLocalRef } from "react";
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
  const user = currentUser();
  const [dropOpen, setDropOpen] = useLocalState(false);
  const dropRef = useLocalRef(null);

  const isActive = (path) => location.pathname === path ? "active" : "";

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) {
    const publicPages = ["/home", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
    const isPublic = publicPages.some(p => location.pathname.startsWith(p));
    if (!isPublic) return null;
    if (["/login", "/register"].includes(location.pathname)) return null;

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

  const handleLogout = async () => { setDropOpen(false); await logout(); navigate("/home"); };

  const avatarSrc = user.image || user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "U")}&background=4a7c59&color=fff`;

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
        <div className="topbar-avatar-wrap" ref={dropRef}>
          <img
            src={avatarSrc}
            alt={user.name}
            className="topbar-avatar"
            onClick={() => setDropOpen(o => !o)}
            title={user.name}
          />
          {dropOpen && (
            <div className="topbar-dropdown">
              <div className="topbar-dropdown-header">
                <div className="topbar-dropdown-name">{user.name}</div>
                <div className="topbar-dropdown-role">{user.role}</div>
              </div>
              <div className="topbar-dropdown-divider" />
              <button className="topbar-dropdown-item" onClick={() => { setDropOpen(false); navigate("/profile"); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                Profile
              </button>
              <button className="topbar-dropdown-item topbar-dropdown-signout" onClick={handleLogout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </>
  );
}
