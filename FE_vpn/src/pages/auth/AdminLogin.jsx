import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { login as loginApi, normalizeUser } from '../../api/auth'

function AdminLogin({ ctx }) {
    const [form, setForm] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const onSubmit = (e) => {
        e.preventDefault()
        if (!form.email || !form.password) {
            setError('Vui lòng nhập đủ email và mật khẩu.')
            return
        }
        setError('')
        setLoading(true)
        loginApi(form.email, form.password)
            .then((data) => {
                const normalized = normalizeUser(data.user, form.email)
                if (normalized?.role !== 'admin') {
                    setError('Tài khoản không có quyền admin')
                    ctx.setToken(null)
                    ctx.setUser(null)
                    return
                }
                ctx.setToken(data.access_token)
                ctx.setUser(normalized)
            })
            .catch((err) => {
                setError(err.message || 'Đăng nhập admin thất bại')
            })
            .finally(() => setLoading(false))
    }

    if (ctx.user?.role === 'admin') return <Navigate to="/admin-portal" replace />

    return (
        <div className="auth">
            <div className="auth-card">
                <p className="muted">Đăng nhập quản trị</p>
                <h2>Admin Portal</h2>
                <p className="muted small">Chỉ dành cho nhân viên được cấp quyền. Có rate-limit và khóa tạm khi đăng nhập sai nhiều lần.</p>
                <form onSubmit={onSubmit} className="stack">
                    <label className="field">
                        <span>Email</span>
                        <input
                            type="email"
                            placeholder="admin@example.com"
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
                        <small className="muted">Có kiểm soát đăng nhập và khóa tạm khi sai nhiều lần.</small>
                    </label>
                    {error && <div className="alert error">{error}</div>}
                    <button className="btn primary" type="submit" disabled={loading}>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập admin'}
                    </button>
                    <div className="row-between small">
                        <Link to="/login" className="muted">
                            Về trang người chơi
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

export default AdminLogin
