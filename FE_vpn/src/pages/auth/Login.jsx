import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthConfig, login as loginApi, normalizeUser } from '../../api/auth'
import { googleLogin } from '../../api/oauth'
import { buildRegisterRedirect, getRedirectFromSearch } from '../../utils/redirect'
import AuthSessionNotice from './AuthSessionNotice'

const defaultAuthConfig = {
    google_oauth_enabled: false,
    password_reset_enabled: false,
}

function Login({ ctx }) {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const userRedirect = getRedirectFromSearch(searchParams, 'user')
    const adminRedirect = getRedirectFromSearch(searchParams, 'admin')
    const [form, setForm] = useState({ email: '', password: '' })
    const [authConfig, setAuthConfig] = useState(defaultAuthConfig)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingGoogle, setLoadingGoogle] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        let mounted = true
        getAuthConfig()
            .then((config) => {
                if (mounted) setAuthConfig({ ...defaultAuthConfig, ...config })
            })
            .catch(() => {
                if (mounted) setAuthConfig(defaultAuthConfig)
            })
        return () => {
            mounted = false
        }
    }, [])

    const parseJwt = (token) => {
        try {
            const base64Payload = token.split('.')[1]
            const jsonPayload = atob(base64Payload)
            return JSON.parse(jsonPayload)
        } catch {
            return null
        }
    }

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }))
        if (error) setError('')
    }

    const validateForm = () => {
        const email = form.email.trim()
        if (!email) return 'Vui lòng nhập email.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
        if (!form.password) return 'Vui lòng nhập mật khẩu.'
        if (form.password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.'
        return ''
    }

    const onSubmit = (e) => {
        e.preventDefault()
        setError('')

        const validationError = validateForm()
        if (validationError) {
            setError(validationError)
            return
        }

        const email = form.email.trim()
        setLoading(true)
        loginApi(email, form.password)
            .then((data) => {
                const payload = parseJwt(data.access_token)
                const nextUser =
                    normalizeUser(data.user, email) || {
                        id: payload?.sub || 'unknown',
                        name: email.split('@')[0] || 'User',
                        email,
                        role: 'user',
                    }
                ctx.setToken(data.access_token)
                ctx.setUser(nextUser)
                navigate(nextUser.role === 'admin' ? adminRedirect : userRedirect, { replace: true })
            })
            .catch((err) => {
                setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.')
            })
            .finally(() => setLoading(false))
    }

    const onGoogle = async () => {
        setError('')
        setLoadingGoogle(true)
        try {
            window.sessionStorage?.setItem('post_login_redirect', userRedirect)
            const data = await googleLogin()
            if (data?.auth_url) {
                window.location.href = data.auth_url
            } else {
                setError('Không thể lấy link Google. Vui lòng thử lại.')
            }
        } catch (err) {
            setError(err.message || 'Không thể khởi động Google SSO. Vui lòng thử lại sau.')
        } finally {
            setLoadingGoogle(false)
        }
    }

    const hasSession = ctx?.user?.role === 'user' || ctx?.user?.role === 'admin'
    if (hasSession) {
        return (
            <AuthSessionNotice
                user={ctx.user}
                continueTo={ctx.user.role === 'admin' ? adminRedirect : userRedirect}
                onSwitchAccount={ctx.clearAuth}
                title="Bạn đã đăng nhập"
            />
        )
    }

    return (
        <div className="auth">
            <div className="auth-card">
                <p className="muted">Đăng nhập an toàn</p>
                <h2>VPN Gaming Portal</h2>
                <p className="muted small">
                    Bảo vệ đăng nhập bằng rate-limit, khóa tạm khi sai nhiều lần và chính sách mật khẩu.
                </p>
                <form onSubmit={onSubmit} className="stack" noValidate>
                    <label className="field">
                        <span>Email</span>
                        <div className="auth-input-field">
                            <Mail className="auth-input-icon" aria-hidden="true" />
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={(e) => updateField('email', e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                    </label>
                    <label className="field">
                        <span>Mật khẩu</span>
                        <div className="auth-input-field auth-password-field">
                            <LockKeyhole className="auth-input-icon" aria-hidden="true" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={form.password}
                                onChange={(e) => updateField('password', e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword((value) => !value)}
                                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                            </button>
                        </div>
                        <small className="muted">Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.</small>
                    </label>
                    <div className="auth-form-options">
                        <span className="muted small">Lưu phiên trên thiết bị này.</span>
                        {authConfig.password_reset_enabled ? (
                            <Link to="/forgot" className="muted">
                                Quên mật khẩu?
                            </Link>
                        ) : null}
                    </div>
                    {error && <div className="alert error">{error}</div>}
                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                    {authConfig.google_oauth_enabled ? (
                        <>
                            <div className="auth-divider"><span>Hoặc</span></div>
                            <button className="btn ghost" type="button" onClick={onGoogle} disabled={loadingGoogle}>
                                {loadingGoogle ? 'Đang chuyển tới Google...' : 'Tiếp tục với Google'}
                            </button>
                        </>
                    ) : null}
                    <div className="auth-link-line">
                        <span className="muted">Chưa có tài khoản?</span>
                        <Link to={buildRegisterRedirect(userRedirect)}>Đăng ký ngay</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Login
