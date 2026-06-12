import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, User } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { register as registerApi } from '../../api/auth'
import { googleLogin } from '../../api/oauth'
import { buildLoginRedirect, getRedirectFromSearch } from '../../utils/redirect'
import AuthSessionNotice from './AuthSessionNotice'

function Register({ ctx }) {
    const [searchParams] = useSearchParams()
    const userRedirect = getRedirectFromSearch(searchParams, 'user')
    const adminRedirect = getRedirectFromSearch(searchParams, 'admin')
    const [form, setForm] = useState({ email: '', fullName: '', password: '', confirm: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingGoogle, setLoadingGoogle] = useState(false)
    const [success, setSuccess] = useState('')
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const onSubmit = (e) => {
        e.preventDefault()
        setError('')
        if (!acceptedTerms) {
            setError('Vui lòng đồng ý với điều khoản sử dụng và chính sách riêng tư.')
            return
        }
        if (form.password !== form.confirm) {
            setError('Mật khẩu không khớp.')
            return
        }
        setLoading(true)
        registerApi(form.email, form.password, form.fullName.trim())
            .then(() => {
                setSuccess('Đăng ký thành công. Vui lòng kiểm tra email để xác thực trước khi đăng nhập.')
            })
            .catch((err) => setError(err.message || 'Đăng ký thất bại'))
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
                <h2>Bảo mật ưu tiên</h2>
                <p className="muted small">Policy: tối thiểu 8 ký tự, có HOA/thường/số/ký hiệu.</p>
                <p className="muted small">Sau khi đăng ký, bạn sẽ nhận email xác thực và cần xác thực trước khi đăng nhập.</p>
                <form onSubmit={onSubmit} className="stack">
                    <label className="field">
                        <span>Họ và tên</span>
                        <div className="auth-input-field">
                            <User className="auth-input-icon" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Nguyễn Văn A"
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                minLength={2}
                                required
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
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
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
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                minLength={8}
                                required
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
                                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                                minLength={8}
                                required
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
                            onChange={(event) => setAcceptedTerms(event.target.checked)}
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
                    <div className="auth-divider"><span>Hoặc</span></div>
                    <button className="btn ghost" type="button" onClick={onGoogle} disabled={loadingGoogle || !acceptedTerms}>
                        {loadingGoogle ? 'Đang chuyển tới Google...' : 'Tiếp tục với Google'}
                    </button>
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
