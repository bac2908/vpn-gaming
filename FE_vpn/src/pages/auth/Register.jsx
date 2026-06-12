import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, User } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthConfig, normalizeUser, register as registerApi } from '../../api/auth'
import { googleLogin } from '../../api/oauth'
import { buildLoginRedirect, getRedirectFromSearch } from '../../utils/redirect'
import AuthSessionNotice from './AuthSessionNotice'

const defaultAuthConfig = {
    google_oauth_enabled: false,
    email_verification_required: true,
    registration_auto_active: false,
}

function Register({ ctx }) {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const userRedirect = getRedirectFromSearch(searchParams, 'user')
    const adminRedirect = getRedirectFromSearch(searchParams, 'admin')
    const [form, setForm] = useState({ email: '', fullName: '', password: '', confirm: '' })
    const [authConfig, setAuthConfig] = useState(defaultAuthConfig)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingGoogle, setLoadingGoogle] = useState(false)
    const [success, setSuccess] = useState('')
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

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
        if (success) setSuccess('')
    }

    const validateForm = () => {
        const email = form.email.trim()
        const fullName = form.fullName.trim()
        if (!fullName || fullName.length < 2) return 'Vui lòng nhập họ tên tối thiểu 2 ký tự.'
        if (!email) return 'Vui lòng nhập email.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
        if (!form.password) return 'Vui lòng nhập mật khẩu.'
        if (form.password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.'
        if (!/[A-Z]/.test(form.password)) return 'Mật khẩu cần có ít nhất 1 chữ hoa.'
        if (!/[a-z]/.test(form.password)) return 'Mật khẩu cần có ít nhất 1 chữ thường.'
        if (!/\d/.test(form.password)) return 'Mật khẩu cần có ít nhất 1 chữ số.'
        if (form.password !== form.confirm) return 'Mật khẩu nhập lại không khớp.'
        if (!acceptedTerms) return 'Vui lòng đồng ý với điều khoản sử dụng và chính sách riêng tư.'
        return ''
    }

    const onSubmit = (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        const validationError = validateForm()
        if (validationError) {
            setError(validationError)
            return
        }

        const email = form.email.trim()
        setLoading(true)
        registerApi(email, form.password, form.fullName.trim())
            .then((data) => {
                if (authConfig.registration_auto_active && data?.access_token) {
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
                    setSuccess('Đăng ký thành công. Đang mở trang web...')
                    window.setTimeout(() => navigate(userRedirect, { replace: true }), 350)
                    return
                }
                setSuccess('Đăng ký thành công. Vui lòng kiểm tra email để xác thực trước khi đăng nhập.')
            })
            .catch((err) => setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.'))
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
    if (hasSession && !success) {
        return (
            <AuthSessionNotice
                user={ctx.user}
                continueTo={ctx.user.role === 'admin' ? adminRedirect : userRedirect}
                onSwitchAccount={ctx.clearAuth}
                title="Bạn đang đăng nhập bằng tài khoản khác"
            />
        )
    }

    return (
        <div className="auth">
            <div className="auth-card">
                <p className="muted">Tạo tài khoản</p>
                <h2>VPN Gaming Portal</h2>
                <p className="muted small">Mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.</p>
                {authConfig.email_verification_required ? (
                    <p className="muted small">
                        Sau khi đăng ký, bạn sẽ nhận email xác thực và cần xác thực trước khi đăng nhập.
                    </p>
                ) : (
                    <p className="muted small">Tài khoản mới sẽ được kích hoạt ngay sau khi đăng ký.</p>
                )}
                <form onSubmit={onSubmit} className="stack" noValidate>
                    <label className="field">
                        <span>Họ và tên</span>
                        <div className="auth-input-field">
                            <User className="auth-input-icon" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Nguyễn Văn A"
                                value={form.fullName}
                                onChange={(e) => updateField('fullName', e.target.value)}
                                autoComplete="name"
                            />
                        </div>
                    </label>
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
                                autoComplete="new-password"
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
                    </label>
                    <label className="field">
                        <span>Nhập lại mật khẩu</span>
                        <div className="auth-input-field auth-password-field">
                            <LockKeyhole className="auth-input-icon" aria-hidden="true" />
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={form.confirm}
                                onChange={(e) => updateField('confirm', e.target.value)}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowConfirm((value) => !value)}
                                title={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                                aria-label={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                            >
                                {showConfirm ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                            </button>
                        </div>
                    </label>
                    <label className="auth-check-row">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(event) => {
                                setAcceptedTerms(event.target.checked)
                                if (error) setError('')
                            }}
                        />
                        <span>
                            Tôi đồng ý với <Link to="/support#terms">Điều khoản sử dụng</Link> và{' '}
                            <Link to="/support#privacy">Chính sách riêng tư</Link>.
                        </span>
                    </label>
                    {error && <div className="alert error">{error}</div>}
                    {success && <div className="alert success">{success}</div>}
                    <button className="btn primary" type="submit" disabled={loading || !acceptedTerms}>
                        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                    </button>
                    {authConfig.google_oauth_enabled ? (
                        <>
                            <div className="auth-divider"><span>Hoặc</span></div>
                            <button className="btn ghost" type="button" onClick={onGoogle} disabled={loadingGoogle || !acceptedTerms}>
                                {loadingGoogle ? 'Đang chuyển tới Google...' : 'Tiếp tục với Google'}
                            </button>
                        </>
                    ) : null}
                    <div className="auth-link-line">
                        <span className="muted">Đã có tài khoản?</span>
                        <Link to={buildLoginRedirect(userRedirect)}>Đăng nhập</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Register
