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

const LANG_KEY = "lrw_lang";
const LANG_EVENT = "lrw_lang_changed";
const USER_EVENT = "lrw_user_updated";

const PUBLIC_PATHS = [
  "/home",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/privacy",
  "/terms",
  "/contact",
];
const AUTH_PATHS = ["/login", "/register"];

const TOPBAR_I18N = {
  English: {
    dashboard: "Dashboard",
    upload: "Upload",
    search: "Search",
    admin: "Admin",
    signIn: "Sign in",
    getStarted: "Get started",
    myProfile: "My Profile",
    adminPanel: "Admin Panel",
    signOut: "Sign out",
  },
  Tamil: {
    dashboard: "முகப்பு",
    upload: "பதிவேற்று",
    search: "தேடு",
    admin: "நிர்வாகம்",
    signIn: "உள்நுழைக",
    getStarted: "தொடங்குங்கள்",
    myProfile: "எனது சுயவிவரம்",
    adminPanel: "நிர்வாக குழு",
    signOut: "வெளியேறு",
  },
  Sinhala: {
    dashboard: "පුවරුව",
    upload: "උඩුගත කරන්න",
    search: "සොයන්න",
    admin: "පරිපාලක",
    signIn: "ඇතුල් වන්න",
    getStarted: "ආරම්භ කරන්න",
    myProfile: "මගේ පැතිකඩ",
    adminPanel: "පරිපාලක පුවරුව",
    signOut: "ඉවත් වන්න",
  },
};

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Tamil", label: "Tamil (தமிழ்)" },
  { value: "Sinhala", label: "Sinhala (සිංහල)" },
];

const CHEVRON_BG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='white' viewBox='0 0 24 24'><path d='M7 10l5 5 5-5z'/></svg>")`;

const styles = {
  brand: { cursor: "pointer" },
  right: { display: "flex", alignItems: "center" },
  langSelect: {
    background: "rgba(255, 255, 255, 0.12)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "var(--radius-sm)",
    padding: "5px 28px 5px 10px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    marginRight: 12,
    appearance: "none",
    backgroundImage: CHEVRON_BG,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: 12,
  },
  optionText: { color: "var(--ink)" },
  getStarted: {
    background: "#fff",
    color: "var(--forest)",
    border: "none",
    padding: "5px 14px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  trigger: {
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
    outline: "none",
  },
  triggerAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1.5px solid rgba(255,255,255,0.4)",
  },
  triggerText: { display: "flex", flexDirection: "column", alignItems: "flex-start", fontSize: 13, lineHeight: 1.2 },
  triggerRole: { opacity: 0.7, fontSize: 11 },
  dropdown: {
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
    transformOrigin: "top right",
  },
  dropdownHeader: { padding: "12px 16px 8px", display: "flex", gap: 10, alignItems: "center" },
  dropdownAvatar: { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" },
  ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  dropdownName: { fontWeight: 600, fontSize: 14, color: "var(--forest)" },
  dropdownEmail: { fontSize: 11, color: "var(--ink-lt)" },
  divider: { height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    fontSize: 13,
    color: "var(--ink-mid)",
    textDecoration: "none",
    transition: "background 0.15s, color 0.15s",
  },
  logout: {
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
    transition: "background 0.15s",
  },
};

const Icon = ({ children, size = 16, strokeWidth = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} style={style}>
    {children}
  </svg>
);

const ICONS = {
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

function getStoredLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return TOPBAR_I18N[stored] ? stored : "English";
  } catch {
    return "English";
  }
}

function getAvatar(user) {
  return (
    user.avatar_url ||
    user.image ||
    user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=4a7c59&color=fff&size=40`
  );
}

function formatRole(role) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Guest";
}

function ProtectedRoute({ children, role }) {
  const user = currentUser();
  if (!user) return <Navigate to="/home" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Brand({ to }) {
  const navigate = useNavigate();
  return (
    <span className="topbar-brand" onClick={() => navigate(to)} style={styles.brand}>
      LR<span>W</span>
    </span>
  );
}

function LanguageSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} aria-label="Select Language" style={styles.langSelect}>
      {LANGUAGES.map(({ value: v, label }) => (
        <option key={v} value={v} style={styles.optionText}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState(currentUser());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [appLang, setAppLang] = useState(getStoredLang);
  const dropdownRef = useRef(null);

  const t = (key) => TOPBAR_I18N[appLang]?.[key] ?? TOPBAR_I18N.English[key];

  useEffect(() => {
    const onUserUpdated = (e) => setUser(e.detail);
    const onLangChanged = (e) => e.detail && setAppLang(e.detail);
    window.addEventListener(USER_EVENT, onUserUpdated);
    window.addEventListener(LANG_EVENT, onLangChanged);
    return () => {
      window.removeEventListener(USER_EVENT, onUserUpdated);
      window.removeEventListener(LANG_EVENT, onLangChanged);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    const onEscape = (e) => e.key === "Escape" && setDropdownOpen(false);
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => setDropdownOpen(false), [pathname]);

  const handleLangChange = (e) => {
    const selected = e.target.value;
    setAppLang(selected);
    try {
      localStorage.setItem(LANG_KEY, selected);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: selected }));
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/home");
  };

  const langSelect = <LanguageSelect value={appLang} onChange={handleLangChange} />;
  const isActive = (path) => (pathname === path ? "active" : "");

  if (!user) {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!isPublic || AUTH_PATHS.includes(pathname)) return null;

    return (
      <nav className="topbar">
        <Brand to="/home" />
        <div className="topbar-links" />
        <div className="topbar-right" style={styles.right}>
          {langSelect}
          <Link to="/login">
            <button className="topbar-logout">{t("signIn")}</button>
          </Link>
          <Link to="/register">
            <button style={styles.getStarted}>{t("getStarted")}</button>
          </Link>
        </div>
      </nav>
    );
  }

  const isAdmin = user.role === "admin";
  const avatarSrc = getAvatar(user);
  const menuItems = [
    { to: "/profile", icon: ICONS.profile, label: t("myProfile") },
    { to: "/", icon: ICONS.dashboard, label: t("dashboard") },
    ...(isAdmin ? [{ to: "/admin", icon: ICONS.admin, label: t("adminPanel") }] : []),
  ];

  return (
    <nav className="topbar">
      <Brand to="/" />
      <div className="topbar-links">
        <Link to="/" className={isActive("/")}>{t("dashboard")}</Link>
        <Link to="/upload" className={isActive("/upload")}>{t("upload")}</Link>
        <Link to="/search" className={isActive("/search")}>{t("search")}</Link>
        {isAdmin && <Link to="/admin" className={isActive("/admin")}>{t("admin")}</Link>}
      </div>

      <div className="topbar-right" style={styles.right}>
        {langSelect}

        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            className="topbar-user-trigger"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((open) => !open)}
            style={styles.trigger}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <img src={avatarSrc} alt="avatar" style={styles.triggerAvatar} />
            <div style={styles.triggerText}>
              <span style={{ fontWeight: 600 }}>{user.name || "User"}</span>
              <span style={styles.triggerRole}>{formatRole(user.role)}</span>
            </div>
            <Icon
              size={12}
              strokeWidth={3}
              style={{
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s var(--ease)",
                opacity: 0.8,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </Icon>
          </button>

          {dropdownOpen && (
            <div className="topbar-dropdown" role="menu" style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <img src={avatarSrc} alt="avatar" style={styles.dropdownAvatar} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...styles.dropdownName, ...styles.ellipsis }}>{user.name || "User"}</div>
                  <div style={{ ...styles.dropdownEmail, ...styles.ellipsis }}>{user.email || ""}</div>
                </div>
              </div>

              <div style={styles.divider} />

              {menuItems.map(({ to, icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  className="topbar-dropdown-item"
                  style={styles.item}
                  onClick={() => setDropdownOpen(false)}
                >
                  <Icon>{icon}</Icon>
                  {label}
                </Link>
              ))}

              <div style={styles.divider} />

              <button role="menuitem" className="topbar-dropdown-logout-item" style={styles.logout} onClick={handleLogout}>
                <Icon>{ICONS.logout}</Icon>
                {t("signOut")}
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
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}
