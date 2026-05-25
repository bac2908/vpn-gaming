import { BrowserRouter, Navigate, Route, Routes, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import mock from './utils/mock'
import { createMomoPayment, getBalance } from './api/payments'
import { changePassword, fetchMe, logout as logoutApi, normalizeUser, updateProfile } from './api/auth'
import { buildLoginRedirect, getSafeRedirect } from './utils/redirect'

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
  const [session, setSession] = useState(mock.session)
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState(50000)
  const [topupDesc, setTopupDesc] = useState('')
  const [topupError, setTopupError] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

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
    setSession(mock.session)
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
    setSession(mock.session)
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
        setProfileOpen(true)
      },
      openPassword: () => {
        setPasswordOpen(true)
      },
      logout: handleLogout,
      clearAuth: clearAuthSession,
      refreshBalance,
    }),
    [user, session, token, handleLogout, clearAuthSession, refreshBalance, setProfileOpen, setPasswordOpen],
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
          <Route path="/admin/login" element={<AdminLogin ctx={context} />} />
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
            path="/admin/*"
            element={
              <AdminShell ctx={context}>
                <Routes>
                  <Route index element={<Admin ctx={context} />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
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
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        token={token}
        onUpdated={(nextUser) => setUser(nextUser)}
      />
      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        user={user}
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
    <div className="app-shell">
      <SideNav session={ctx.session} user={ctx.user} />
      <main className="app-main">
        <TopBar
          user={ctx.user}
          onTopup={ctx.openTopup}
          onLogout={ctx.logout}
          onProfile={ctx.openProfile}
          onPassword={ctx.openPassword}
        />
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}

function AdminShell({ ctx, children }) {
  if (!ctx.user?.id || ctx.user?.role !== 'admin') return <Navigate to="/admin/login" replace />
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

function SideNav({ session, user }) {
  const nav = [
    { label: 'Tổng quan', path: '/app' },
    { label: 'Máy & phiên', path: '/app/machines' },
    { label: 'Khởi tạo phiên', path: '/app/wizard' },
    { label: 'Gói dịch vụ', path: '/app/subscriptions' },
    { label: 'Lịch sử', path: '/app/history' },
    { label: 'Hỗ trợ', path: '/app/support' },
  ]
  return (
    <aside className="sidenav">
      <div className="brand">VPN Gaming</div>
      <div className="minutes">
        <p>Giờ còn lại</p>
        <h3>{session.remainingMinutes} phút</h3>
        <span className="badge">Safe mode</span>
        <div className="balance-display">
          <p className="muted">Số dư tài khoản</p>
          <p className="balance-amount">{formatBalance(user?.balance)}</p>
        </div>
      </div>
      <nav>
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              ['nav-item', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function TopBar({ user, onTopup, onLogout, onProfile, onPassword }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const getRoleLabel = (role) => {
    if (role === 'admin') return 'Quản trị viên'
    return 'Khách hàng'
  }

  const handleSecurityClick = () => {
    if (location.pathname === '/app') {
      document.getElementById('security-policy-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate('/app#security-policy-card')
    }
  }

  // Đóng dropdown khi nhấp chuột ra ngoài
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
    <header className="topbar">
      <div className="topbar-left">
        <h2>Xin chào, {user.name}</h2>
        <p className="muted">Quản lý phiên chơi, máy ảo, VPN & streaming</p>
      </div>
      <div className="topbar-actions">
        <button className="btn ghost" onClick={handleSecurityClick}>Chính sách bảo mật</button>
        <button className="btn primary" onClick={onTopup}>Nạp tiền</button>
        <div className="account-menu" ref={menuRef}>
          <button className="btn ghost" onClick={() => setAccountOpen((prev) => !prev)}>
            Tài khoản
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
                  <span className="muted">ID</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }} title={user.id}>{user.id.substring(0, 18)}...</span>
                </div>
              </div>
              <div className="account-actions">
                <button className="btn ghost" onClick={() => { onProfile(); setAccountOpen(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', opacity: 0.8 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Cập nhật thông tin
                </button>
                <button className="btn ghost" onClick={() => { onPassword(); setAccountOpen(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', opacity: 0.8 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Đổi mật khẩu
                </button>
              </div>
              <div className="account-divider" />
              <div style={{ display: 'flex', width: '100%' }}>
                <button className="btn-logout" onClick={() => { onLogout(); setAccountOpen(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
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
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal topup-modal">
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
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.name) {
      setDisplayName(user.name)
    }
    setCurrentPassword('')
    setShowPassword(false)
    setError('')
    setSuccess('')
  }, [open, user])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!displayName.trim()) {
      setError('Tên hiển thị không được để trống')
      return
    }
    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để xác thực thay đổi')
      return
    }
    setLoading(true)
    try {
      const updated = await updateProfile({
        display_name: displayName.trim(),
        current_password: currentPassword
      }, token)
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
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Cập nhật thông tin tài khoản</h3>
          <button className="btn ghost" onClick={onClose} disabled={loading}>Đóng</button>
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

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
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

function ChangePasswordModal({ open, onClose, user }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!oldPassword || !newPassword || !confirmPassword) {
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
      await changePassword(user.email, oldPassword, newPassword)
      setSuccess('Đổi mật khẩu thành công!')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Không thể đổi mật khẩu, vui lòng kiểm tra lại mật khẩu hiện tại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Đổi mật khẩu</h3>
          <button className="btn ghost" onClick={onClose} disabled={loading}>Đóng</button>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
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

          <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Đang đổi mật khẩu...' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
