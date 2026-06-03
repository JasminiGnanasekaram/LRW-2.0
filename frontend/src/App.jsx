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

function ProtectedRoute({ children, role }) {
  const u = currentUser();
  if (!u) return <Navigate to="/login" />;
  if (role && u.role !== role) return <Navigate to="/" />;
  return children;
}

function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = currentUser();
  if (!user) return null;

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const isActive = (path) => location.pathname === path ? "active" : "";

  return (
    <nav className="topbar">
      <span className="topbar-brand">LR<span>W</span></span>
      <div className="topbar-links">
        <Link to="/" className={isActive("/")}>Dashboard</Link>
        <Link to="/upload" className={isActive("/upload")}>Upload</Link>
        <Link to="/search" className={isActive("/search")}>Search</Link>
        {user.role === "admin" && <Link to="/admin" className={isActive("/admin")}>Admin</Link>}
      </div>
      <div className="topbar-right">
        <div className="topbar-user">
          <span>{user.name}</span>
          <span className="badge" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "11px" }}>
            {user.role}
          </span>
        </div>
        <button className="topbar-logout" onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
