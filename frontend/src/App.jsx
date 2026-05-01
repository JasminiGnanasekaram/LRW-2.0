import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
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
  const user = currentUser();
  if (!user) return null;
  const handleLogout = async () => { await logout(); navigate("/login"); };
  return (
    <nav className="topbar">
      <span className="brand">LRW</span>
      <Link to="/">Dashboard</Link>
      <Link to="/upload">Upload</Link>
      <Link to="/search">Search</Link>
      {user.role === "admin" && <Link to="/admin">Admin</Link>}
      <span style={{ marginLeft: "auto" }}>
        {user.name} <span className="badge">{user.role}</span>
      </span>
      <button className="ghost" onClick={handleLogout} style={{ background: "transparent", color: "#fff", borderColor: "#fff" }}>Logout</button>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <div className="container">
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
      </div>
    </>
  );
}
