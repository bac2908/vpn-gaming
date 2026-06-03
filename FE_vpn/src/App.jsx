import { BrowserRouter, Navigate, Route, Routes, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock3, Gamepad2, Menu as MenuIcon, MoreVertical, Plus, User, Wallet } from 'lucide-react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Machines from './pages/Machines'
import Wizard from './pages/Wizard'
import History from './pages/History'
import Support from './pages/Support'
import Subscriptions from './pages/Subscriptions'
import Landing from './pages/Landing'
import Admin from './pages/Admin'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import AdminLogin from './pages/auth/AdminLogin'
import { createMomoPayment, getBalance } from './api/payments'
import { changePassword, fetchMe, logout as logoutApi, normalizeUser, setPassword, updateProfile } from './api/auth'
import { buildLoginRedirect, getSafeRedirect } from './utils/redirect'

const DEFAULT_SESSION = {
  remainingMinutes: 0,
  queuePosition: null,
  vpn: {
    status: 'unknown',
    ip: null,
  },
}

function LauncherIcon({ name, className = '' }) {
  const icons = {
    gamepad: Gamepad2,
    clock: Clock3,
    wallet: Wallet,
    plus: Plus,
    user: User,
    chevron: ChevronDown,
    more: MoreVertical,
    menu: MenuIcon,
  }
  const Icon = icons[name] || MenuIcon

  return <Icon className={['launcher-icon', className].filter(Boolean).join(' ')} aria-hidden="true" />
}

function parseJwt(token) {
  try {
    const base64Payload = token.split('.')[1]
    const jsonPayload = atob(base64Payload)
    return JSON.parse(jsonPayload)
  } catch (err) {
    console.warn('Không thể parse JWT', err)
    return null
  }
}

function userFromToken(token, fallbackEmail) {
  const payload = parseJwt(token)
  if (!payload?.sub) return null
  return {
    id: payload.sub,
    email: fallbackEmail || 'unknown@example.com',
    name: fallbackEmail?.split('@')[0] || 'User',
    role: 'user',
  }
}

function App() {
  const storedToken = localStorage.getItem('auth_token')
  const storedEmail = localStorage.getItem('auth_email')
  const storedUserRaw = localStorage.getItem('auth_user')
  const storedUser = storedUserRaw ? (() => {
    try {
      const parsed = JSON.parse(storedUserRaw)
      return normalizeUser(parsed, storedEmail) || parsed
    } catch (err) {
      console.warn('Không parse được user cache', err)
      return null
    }
  })() : null

  const [token, setToken] = useState(storedToken)
  const [user, setUser] = useState(storedUser || (storedToken ? userFromToken(storedToken, storedEmail) : null))
  const [session, setSession] = useState(DEFAULT_SESSION)
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState(50000)
  const [topupDesc, setTopupDesc] = useState('')
  const [topupError, setTopupError] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [accountModal, setAccountModal] = useState(null)
  const hasPasswordRefreshRef = useRef(false)

  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token)
      if (user?.email) localStorage.setItem('auth_email', user.email)
      if (user) localStorage.setItem('auth_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_user')
    }
  }, [token, user])

  const handleTopupSubmit = async (event) => {
    event.preventDefault()
    setTopupError('')
    const amountNum = Number(topupAmount)
    if (!Number.isFinite(amountNum) || amountNum < 10000) {
      setTopupError('Số tiền phải từ 10.000đ trở lên')
      return
    }
    try {
      setTopupLoading(true)
      const res = await createMomoPayment({ amount: amountNum, description: topupDesc }, token)
      window.location.href = res.pay_url
    } catch (err) {
      setTopupError(err.message || 'Không tạo được giao dịch MoMo')
    } finally {
      setTopupLoading(false)
    }
  }

  const handleLogout = useCallback(async () => {
    const confirmed = window.confirm('Bạn chắc chắn muốn đăng xuất không?')
    if (!confirmed) return
    if (token) {
      try {
        await logoutApi(token)
      } catch (err) {
        console.warn('Logout failed', err)
      }
    }
    setToken(null)
    setUser(null)
    setSession(DEFAULT_SESSION)
    window.location.href = '/login'
  }, [token, setToken, setUser, setSession])

  const clearAuthSession = useCallback(() => {
    if (token) {
      logoutApi(token).catch((err) => {
        console.warn('Clear auth logout failed', err)
      })
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_email')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_session')
    window.sessionStorage?.removeItem('post_login_redirect')
    setToken(null)
    setUser(null)
    setSession(DEFAULT_SESSION)
  }, [token, setToken, setUser, setSession])

  useEffect(() => {
    if (!token || user?.id) return
    fetchMe(token)
      .then((data) => {
        const normalized = normalizeUser(data, storedEmail)
        if (normalized) setUser(normalized)
      })
      .catch((err) => {
        console.warn('Fetch me failed', err)
        setToken(null)
        setUser(null)
      })
  }, [token, user, storedEmail, setUser, setToken])

  useEffect(() => {
    if (!token || !user?.id) {
      hasPasswordRefreshRef.current = false
      return
    }
    if (user?.has_password !== undefined || hasPasswordRefreshRef.current) return
    hasPasswordRefreshRef.current = true
    fetchMe(token)
      .then((data) => {
        const normalized = normalizeUser(data, storedEmail || user?.email)
        if (normalized) setUser(normalized)
      })
      .catch((err) => {
        console.warn('Refresh user profile failed', err)
      })
  }, [token, user, storedEmail, setUser])

  // Refresh balance when needed
  const refreshBalance = useCallback(async () => {
    if (!token) return
    try {
      const data = await getBalance(token)
      if (data?.balance !== undefined && user) {
        setUser({ ...user, balance: data.balance })
      }
    } catch (err) {
      console.warn('Refresh balance failed', err)
    }
  }, [token, user, setUser])

  const context = useMemo(
    () => ({
      user,
      session,
      token,
      setUser,
      setSession,
      setToken,
      openTopup: () => {
        setTopupError('')
        setTopupOpen(true)
      },
      openProfile: () => {
        setAccountModal('profile')
      },
      openPassword: () => {
        setAccountModal('password')
      },
      logout: handleLogout,
      clearAuth: clearAuthSession,
      refreshBalance,
    }),
    [user, session, token, handleLogout, clearAuthSession, refreshBalance],
  )

  return (
    <>
      <BrowserRouter>
        <PostLoginRedirect user={user} />
        <Routes>
          <Route path="/" element={<Landing ctx={context} />} />
          <Route path="/login" element={<Login ctx={context} />} />
          <Route path="/register" element={<Register ctx={context} />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword ctx={context} />} />
          <Route path="/admin/login" element={<Navigate to="/admin-portal/login" replace />} />
          <Route path="/admin-portal/login" element={<AdminLogin ctx={context} />} />
          <Route
            path="/app/*"
            element={
              <Shell ctx={context}>
                <Routes>
                  <Route index element={<Dashboard ctx={context} />} />
                  <Route path="machines" element={<Machines ctx={context} />} />
                  <Route path="wizard" element={<Wizard ctx={context} />} />
                  <Route path="subscriptions" element={<Subscriptions ctx={context} />} />
                  <Route path="history" element={<History ctx={context} />} />
                  <Route path="support" element={<Support />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
              </Shell>
            }
          />
          <Route
            path="/admin-portal/*"
            element={
              <AdminShell ctx={context}>
                <Routes>
                  <Route index element={<Navigate to="/admin-portal/overview" replace />} />
                  <Route path="overview" element={<Admin ctx={context} />} />
                  <Route path="users" element={<Admin ctx={context} />} />
                  <Route path="machines" element={<Admin ctx={context} />} />
                  <Route path="sessions" element={<Admin ctx={context} />} />
                  <Route path="billing" element={<Admin ctx={context} />} />
                  <Route path="settings" element={<Admin ctx={context} />} />
                  <Route path="*" element={<Navigate to="/admin-portal/overview" replace />} />
                </Routes>
              </AdminShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <TopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        amount={topupAmount}
        setAmount={setTopupAmount}
        description={topupDesc}
        setDescription={setTopupDesc}
        error={topupError}
        loading={topupLoading}
        onSubmit={handleTopupSubmit}
      />
      <AccountSettingsModal
        open={accountModal === 'profile'}
        onClose={() => setAccountModal(null)}
        user={user}
        token={token}
        onUpdated={(nextUser) => setUser(nextUser)}
      />
      <ChangePasswordModal
        open={accountModal === 'password'}
        onClose={() => setAccountModal(null)}
        user={user}
        token={token}
        onUpdated={(nextUser) => setUser(nextUser)}
      />
    </>
  )
}

function Shell({ ctx, children }) {
  const location = useLocation()
  if (!ctx.user?.id || ctx.user?.role !== 'user') {
    const target = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={buildLoginRedirect(target)} replace />
  }
  return (
    <div className="app-shell user-shell">
      <TopBar
        user={ctx.user}
        session={ctx.session}
        onTopup={ctx.openTopup}
        onLogout={ctx.logout}
        onProfile={ctx.openProfile}
        onPassword={ctx.openPassword}
      />
      <main className="app-main user-main">
        <div className="app-content">{children}</div>
        <AppFooter />
      </main>
    </div>
  )
}

function AppFooter() {
  return (
    <footer className="user-app-footer">
      <div className="user-app-footer-grid">
        <div className="user-footer-brand">
          <div className="brand">VPN Gaming</div>
          <p>Cloud gaming GPU cho game thủ Việt, tối ưu ping thấp, VPN riêng và stream qua Moonlight.</p>
          <span className="user-footer-status">
            <i className="status-dot" /> Hệ thống đang hoạt động
          </span>
        </div>
        <div className="user-footer-column">
          <h4>Sản phẩm</h4>
          <NavLink to="/app">Play Center</NavLink>
          <NavLink to="/app/machines">Máy cloud</NavLink>
          <NavLink to="/app/wizard">Khởi tạo</NavLink>
          <NavLink to="/app/subscriptions">Gói dịch vụ</NavLink>
        </div>
        <div className="user-footer-column">
          <h4>Hỗ trợ</h4>
          <NavLink to="/app/support#faq">FAQ</NavLink>
          <NavLink to="/app/wizard">Quy trình kết nối</NavLink>
          <NavLink to="/app/support#guide-openvpn">Hướng dẫn OpenVPN</NavLink>
          <NavLink to="/app/support#guide-moonlight">Hướng dẫn Moonlight</NavLink>
        </div>
        <div className="user-footer-column">
          <h4>Chính sách</h4>
          <NavLink to="/app/support#terms">Điều khoản sử dụng</NavLink>
          <NavLink to="/app/support#privacy">Chính sách riêng tư</NavLink>
          <NavLink to="/app/support#refund">Chính sách hoàn tiền</NavLink>
          <NavLink to="/app/support#system-status">Trạng thái hệ thống</NavLink>
        </div>
      </div>
      <div className="user-app-footer-bottom">
        <span>© 2026 VPN Gaming</span>
        <div>
          <NavLink to="/app/subscriptions">Gói</NavLink>
          <NavLink to="/app/support#faq">FAQ</NavLink>
          <NavLink to="/app/support">Support</NavLink>
          <NavLink to="/app/support#support-contact">Email</NavLink>
        </div>
      </div>
    </footer>
  )
}

function AppNav() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const nav = [
    { label: 'Play Center', path: '/app', icon: 'gamepad' },
    { label: 'Máy', path: '/app/machines' },
    { label: 'Khởi tạo', path: '/app/wizard' },
  ]
  const moreLinks = [
    { label: 'Lịch sử', path: '/app/history' },
    { label: 'Gói dịch vụ', path: '/app/subscriptions' },
    { label: 'Hỗ trợ', path: '/app/support' },
  ]

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <>
      <nav className="app-nav" aria-label="Điều hướng ứng dụng">
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/app'}
            className={({ isActive }) =>
              ['nav-item', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            {item.icon && <LauncherIcon name={item.icon} />}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="utility-menu" ref={menuRef}>
        <button
          type="button"
          className="btn ghost utility-trigger"
          aria-label="Mở menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <LauncherIcon name="more" />
          <span>Menu</span>
          <LauncherIcon name="chevron" className="chevron-icon" />
        </button>
        {open && (
          <div className="utility-dropdown">
            {moreLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  ['utility-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
                }
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function MobileLauncherMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const links = [
    { label: 'Play Center', path: '/app' },
    { label: 'Máy', path: '/app/machines' },
    { label: 'Khởi tạo', path: '/app/wizard' },
    { label: 'Gói dịch vụ', path: '/app/subscriptions' },
    { label: 'Lịch sử', path: '/app/history' },
    { label: 'Hỗ trợ', path: '/app/support' },
  ]

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="mobile-launcher-menu" ref={menuRef}>
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Mở menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <LauncherIcon name="menu" />
      </button>
      {open && (
        <div className="mobile-menu-dropdown">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/app'}
              className={({ isActive }) =>
                ['utility-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
              }
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function SideNav({ session, user }) {
  return (
    <aside className="sidenav">
      <div className="brand">VPN Gaming</div>
      <div className="minutes">
        <p>Giờ còn lại</p>
        <h3>{session.remainingMinutes} phút</h3>
        <span className="badge">Chế độ an toàn</span>
        <div className="balance-display">
          <p className="muted">Số dư tài khoản</p>
          <p className="balance-amount">{formatBalance(user?.balance)}</p>
        </div>
      </div>
      <AppNav />
    </aside>
  )
}

function AdminShell({ ctx, children }) {
  if (!ctx.user?.id || ctx.user?.role !== 'admin') return <Navigate to="/admin-portal/login" replace />
  return <div className="app-main">{children}</div>
}

function PostLoginRedirect({ user }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) return
    const storedRedirect = window.sessionStorage?.getItem('post_login_redirect')
    if (!storedRedirect) return
    window.sessionStorage.removeItem('post_login_redirect')
    navigate(getSafeRedirect(storedRedirect, user.role), { replace: true })
  }, [user, navigate])

  return null
}

function formatBalance(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ'
}

function formatCompactBalance(amount) {
  const value = Number(amount || 0)
  if (value >= 1000000) {
    const millions = value / 1000000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}tr`
  }
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return `${value}đ`
}

function TopBar({ user, session, onTopup, onLogout, onProfile, onPassword }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const menuRef = useRef(null)

  const getRoleLabel = (role) => {
    if (role === 'admin') return 'Quản trị viên'
    return 'Khách hàng'
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAccountOpen(false)
      }
    }
    if (accountOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [accountOpen])

  return (
    <header className="topbar launcher-topbar">
      <div className="launcher-topline">
        <MobileLauncherMenu />

        <div className="launcher-brand">
          <span className="brand-mark">VG</span>
          <div>
            <strong>VPN Gaming</strong>
            <span>Cloud play network</span>
          </div>
        </div>

        <div className="topbar-nav-group">
          <AppNav />
        </div>

        <div className="topbar-actions">
          <div className="topbar-status-group" aria-label="Trạng thái tài khoản">
            <div className="launcher-chip">
              <LauncherIcon name="clock" />
              <strong>
                <span className="desktop-value">{session?.remainingMinutes || 0}m</span>
                <span className="mobile-value">{session?.remainingMinutes || 0}p</span>
              </strong>
            </div>
            <div className="launcher-chip balance">
              <LauncherIcon name="wallet" />
              <strong>
                <span className="desktop-value">{formatBalance(user?.balance)}</span>
                <span className="mobile-value">{formatCompactBalance(user?.balance)}</span>
              </strong>
            </div>
          </div>
          <div className="topbar-command-group">
            <button className="btn primary topup-button" onClick={onTopup}>
              <LauncherIcon name="plus" />
              <span>Nạp tiền</span>
            </button>
            <div className="account-menu" ref={menuRef}>
              <button
                className="account-avatar-button"
                aria-label="Mở tài khoản"
                onClick={() => setAccountOpen((prev) => !prev)}
              >
                <span className="account-avatar">
                  <LauncherIcon name="user" />
                  <span className="account-status-dot" />
                </span>
                <div className="account-user-info">
                  <span className="account-name">{user?.name || 'Tài khoản'}</span>
                  <span className="account-plan-badge">{getRoleLabel(user?.role)}</span>
                </div>
                <LauncherIcon name="chevron" className="chevron-icon" />
              </button>
              {accountOpen && (
                <div className="account-dropdown card">
                  <div className="account-row">
                    <div>
                      <p className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tài khoản</p>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{user.name}</h4>
                    </div>
                    <span className="pill ghost" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                      {getRoleLabel(user.role)}
                    </span>
                  </div>
                  <div className="stack">
                    <div className="row-between">
                      <span className="muted">Email</span>
                      <span style={{ fontSize: '0.8rem' }}>{user.email}</span>
                    </div>
                    <div className="row-between">
                      <span className="muted">Mã tài khoản</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }} title={user.id}>{user.id.substring(0, 18)}...</span>
                    </div>
                  </div>
                  <div className="account-actions">
                    <button className="btn ghost" onClick={() => { onProfile(); setAccountOpen(false); }}>
                      Cập nhật thông tin
                    </button>
                    <button className="btn ghost" onClick={() => { onPassword(); setAccountOpen(false); }}>
                      {user?.has_password === false ? 'Đặt mật khẩu đăng nhập' : 'Đổi mật khẩu'}
                    </button>
                  </div>
                  <div className="account-divider" />
                  <div style={{ display: 'flex', inlineSize: '100%' }}>
                    <button className="btn-logout" onClick={() => { onLogout(); setAccountOpen(false); }}>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

const PRESET_AMOUNTS = [
  { value: 20000, label: '20.000đ' },
  { value: 50000, label: '50.000đ' },
  { value: 100000, label: '100.000đ' },
  { value: 200000, label: '200.000đ' },
  { value: 500000, label: '500.000đ' },
  { value: 1000000, label: '1.000.000đ' },
]

function TopupModal({ open, onClose, amount, setAmount, description, setDescription, error, loading, onSubmit }) {
  const [isCustom, setIsCustom] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onClose])

  if (!open) return null

  const handlePresetClick = (value) => {
    setIsCustom(false)
    setCustomAmount('')
    setAmount(value)
  }

  const handleCustomClick = () => {
    setIsCustom(true)
    setCustomAmount('')
    setAmount('')
  }

  const handleCustomAmountChange = (e) => {
    const val = e.target.value
    setCustomAmount(val)
    setAmount(val)
  }

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num) + 'đ'
  }

  const displayAmount = amount ? formatCurrency(Number(amount)) : '0đ'

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose()
        }
      }}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget && !loading) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div className="modal topup-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Nạp tiền</h3>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
        <form className="stack" onSubmit={onSubmit}>
          {/* Hiển thị số tiền đã chọn */}
          <div className="topup-display">
            <p className="muted">Số tiền nạp</p>
            <h2 className="topup-amount">{displayAmount}</h2>
          </div>

          {/* Các mức tiền có sẵn */}
          <div className="field">
            <span>Chọn mức tiền</span>
            <div className="amount-presets">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`amount-btn ${!isCustom && Number(amount) === preset.value ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className={`amount-btn custom ${isCustom ? 'active' : ''}`}
                onClick={handleCustomClick}
              >
                Số khác
              </button>
            </div>
          </div>

          {/* Input nhập số tiền tùy chọn */}
          {isCustom && (
            <label className="field">
              Nhập số tiền (VND)
              <input
                type="number"
                min="10000"
                step="1000"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Nhập số tiền bạn muốn nạp"
                autoFocus
              />
              <span className="muted hint">Tối thiểu 10.000đ</span>
            </label>
          )}

          <label className="field">
            Ghi chú (tuỳ chọn)
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ví dụ: nạp tháng 1" />
          </label>

          <div className="card info">
            <p className="muted"><strong>Hướng dẫn nạp tiền MoMo</strong></p>
            <ol className="bullet">
              <li>Chọn mức tiền có sẵn hoặc nhập số tiền khác.</li>
              <li>Bấm "Thanh toán" để mở cổng thanh toán MoMo.</li>
              <li>Quét QR hoặc xác nhận trên ứng dụng MoMo.</li>
              <li>Thanh toán thành công sẽ tự chuyển về hệ thống.</li>
            </ol>
          </div>

          {error ? <div className="alert error">{error}</div> : null}

          <div className="actions row-between">
            <div className="muted">Thanh toán qua MoMo</div>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !amount || Number(amount) < 10000}
              >
                {loading ? 'Đang xử lý...' : `Thanh toán ${displayAmount}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function AccountSettingsModal({ open, onClose, user, token, onUpdated }) {
  const modalRef = useRef(null)
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const hasPassword = user?.has_password !== false

  useEffect(() => {
    if (user?.name) {
      setDisplayName(user.name)
    }
    setCurrentPassword('')
    setShowPassword(false)
    setError('')
    setSuccess('')
  }, [open, user])

  useEffect(() => {
    if (!open) return

    const handleOutside = (event) => {
      if (loading) return
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose()
      }
    }

    const handleOutsideContext = (event) => {
      if (loading) return
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('contextmenu', handleOutsideContext)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('contextmenu', handleOutsideContext)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!displayName.trim()) {
      setError('Tên hiển thị không được để trống')
      return
    }
    if (hasPassword && !currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để xác thực thay đổi')
      return
    }
    setLoading(true)
    try {
      const payload = { display_name: displayName.trim() }
      if (hasPassword) payload.current_password = currentPassword
      const updated = await updateProfile(payload, token)
      const normalized = normalizeUser(updated, user.email)
      if (onUpdated && normalized) {
        onUpdated(normalized)
      }
      setSuccess('Cập nhật thông tin thành công!')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Không thể cập nhật thông tin. Vui lòng kiểm tra lại mật khẩu hiện tại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose()
        }
      }}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget && !loading) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div className="modal" ref={modalRef}>
        <div className="modal-header">
          <h3>Cập nhật thông tin tài khoản</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng"
            title="Đóng"
          >
            ×
          </button>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email (Không thể thay đổi)</span>
            <input type="email" value={user?.email || ''} readOnly disabled style={{ opacity: 0.7 }} />
          </label>
          <label className="field">
            <span>Tên hiển thị</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị mới"
              required
              disabled={loading}
            />
          </label>

          {hasPassword ? (
            <label className="field">
              <span>Mật khẩu hiện tại (bắt buộc)</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại của bạn"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>
          ) : (
            <div className="alert">
              Bạn đang đăng nhập bằng Google, có thể đổi tên mà không cần mật khẩu.
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="actions" style={{ justifyContent: 'flex-end', marginInsetBlockStart: '10px' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Đang cập nhật...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordModal({ open, onClose, user, token, onUpdated }) {
  const modalRef = useRef(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const hasPassword = user?.has_password !== false

  useEffect(() => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
    setShowOld(false)
    setShowNew(false)
    setShowConfirm(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleOutside = (event) => {
      if (loading) return
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose()
      }
    }

    const handleOutsideContext = (event) => {
      if (loading) return
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('contextmenu', handleOutsideContext)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('contextmenu', handleOutsideContext)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newPassword || !confirmPassword || (hasPassword && !oldPassword)) {
      setError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không trùng khớp')
      return
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự')
      return
    }

    setLoading(true)
    try {
      if (hasPassword) {
        await changePassword(user.email, oldPassword, newPassword)
        setSuccess('Đổi mật khẩu thành công!')
      } else {
        if (!token) {
          setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
          return
        }
        const updated = await setPassword(newPassword, token)
        const normalized = normalizeUser(updated, user?.email)
        if (onUpdated && normalized) {
          onUpdated(normalized)
        }
        setSuccess('Đặt mật khẩu thành công!')
      }
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      const fallback = hasPassword
        ? 'Không thể đổi mật khẩu, vui lòng kiểm tra lại mật khẩu hiện tại'
        : 'Không thể đặt mật khẩu, vui lòng thử lại'
      setError(err.message || fallback)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      <div className="modal" ref={modalRef}>
        <div className="modal-header">
          <h3>{hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu đăng nhập'}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng"
            title="Đóng"
          >
            ×
          </button>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          {!hasPassword && (
            <div className="alert">
              Bạn đang đăng nhập bằng Google. Hãy tạo mật khẩu mới để có thể đăng nhập bằng email/mật khẩu.
            </div>
          )}

          {hasPassword && (
            <label className="field">
              <span>Mật khẩu hiện tại</span>
              <div className="password-field">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowOld(!showOld)}
                >
                  {showOld ? '🙈' : '👁'}
                </button>
              </div>
            </label>
          )}

          <label className="field">
            <span>Mật khẩu mới</span>
            <div className="password-field">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Xác nhận mật khẩu mới</span>
            <div className="password-field">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="actions" style={{ justifyContent: 'flex-end', marginBlockStart: '10px' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading
                ? (hasPassword ? 'Đang đổi mật khẩu...' : 'Đang đặt mật khẩu...')
                : (hasPassword ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
