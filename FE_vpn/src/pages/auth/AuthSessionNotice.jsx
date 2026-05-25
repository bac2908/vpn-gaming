import { Link } from 'react-router-dom'

function AuthSessionNotice({ user, continueTo, onSwitchAccount, title = 'Bạn đang có phiên đăng nhập' }) {
    const roleLabel = user?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'

    return (
        <div className="auth">
            <div className="auth-card">
                <p className="muted">Phiên hiện tại</p>
                <h2>{title}</h2>
                <p className="muted small">
                    Vì đây là hệ thống VPN, vui lòng xác nhận rõ tài khoản trước khi tiếp tục hoặc đổi sang tài khoản khác.
                </p>
                <div className="card info stack">
                    <div className="row-between">
                        <span className="muted">Tài khoản</span>
                        <strong>{user?.name || 'User'}</strong>
                    </div>
                    <div className="row-between">
                        <span className="muted">Email</span>
                        <span>{user?.email || 'N/A'}</span>
                    </div>
                    <div className="row-between">
                        <span className="muted">Vai trò</span>
                        <span className="pill ghost">{roleLabel}</span>
                    </div>
                </div>
                <div className="actions">
                    <Link className="btn primary" to={continueTo || '/app'}>
                        Tiếp tục
                    </Link>
                    <button type="button" className="btn ghost" onClick={onSwitchAccount}>
                        Dùng tài khoản khác
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AuthSessionNotice
