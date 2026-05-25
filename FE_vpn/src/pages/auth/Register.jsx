import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { register as registerApi } from '../../api/auth'
import { buildLoginRedirect, getRedirectFromSearch } from '../../utils/redirect'
import AuthSessionNotice from './AuthSessionNotice'

function Register({ ctx }) {
    const [searchParams] = useSearchParams()
    const userRedirect = getRedirectFromSearch(searchParams, 'user')
    const adminRedirect = getRedirectFromSearch(searchParams, 'admin')
    const [form, setForm] = useState({ email: '', fullName: '', password: '', confirm: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')

    const onSubmit = (e) => {
        e.preventDefault()
        setError('')
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
                        <input
                            type="text"
                            placeholder="Nguyễn Văn A"
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            minLength={2}
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Email</span>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Mật khẩu</span>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            minLength={8}
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Nhập lại mật khẩu</span>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={form.confirm}
                            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                            minLength={8}
                            required
                        />
                    </label>
                    {error && <div className="alert error">{error}</div>}
                    {success && <div className="alert success">{success}</div>}
                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                    </button>
                    <div className="row-between small">
                        <Link to={buildLoginRedirect(userRedirect)} className="muted">
                            Đã có tài khoản
                        </Link>
                        <Link to="/forgot" className="muted">
                            Quên mật khẩu
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Register
