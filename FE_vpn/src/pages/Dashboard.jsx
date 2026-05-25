import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listMachines } from '../api/machines'

const getCountryData = (region) => {
    const r = String(region || '').toLowerCase()
    if (r.includes('singapore') || r.includes('sg')) {
        return { flag: '🇸🇬', code: 'sg', name: 'Singapore', flagUrl: 'https://flagcdn.com/sg.svg' }
    }
    if (
        r.includes('vietnam') || r.includes('việt nam') || r.includes('vn') || 
        r.includes('hanoi') || r.includes('hà nội') || r.includes('hcmc') || 
        r.includes('hồ chí minh') || r.includes('ho chi minh') || r.includes('saigon') || r.includes('sài gòn')
    ) {
        return { flag: '🇻🇳', code: 'vn', name: 'Việt Nam', flagUrl: 'https://flagcdn.com/vn.svg' }
    }
    if (r.includes('japan') || r.includes('nhat') || r.includes('jp') || r.includes('tokyo')) {
        return { flag: '🇯🇵', code: 'jp', name: 'Japan', flagUrl: 'https://flagcdn.com/jp.svg' }
    }
    if (r.includes('usa') || r.includes('us') || r.includes('mỹ') || r.includes('america')) {
        return { flag: '🇺🇸', code: 'us', name: 'USA', flagUrl: 'https://flagcdn.com/us.svg' }
    }
    if (r.includes('hong kong') || r.includes('hongkong') || r.includes('hk')) {
        return { flag: '🇭🇰', code: 'hk', name: 'Hong Kong', flagUrl: 'https://flagcdn.com/hk.svg' }
    }
    if (r.includes('korea') || r.includes('kr') || r.includes('seoul')) {
        return { flag: '🇰🇷', code: 'kr', name: 'Korea', flagUrl: 'https://flagcdn.com/kr.svg' }
    }
    return { flag: '🌐', code: null, name: region || 'Global', flagUrl: null }
}


function Stat({ label, value, hint, icon }) {
    return (
        <div className="card stat">
            <div className="stat-header">
                {icon && <span className="stat-icon">{icon}</span>}
                <p className="muted">{label}</p>
            </div>
            <h3>{value}</h3>
            {hint && <span className="pill ghost">{hint}</span>}
        </div>
    )
}

function Dashboard({ ctx }) {
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const location = useLocation()

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const data = await listMachines({ page: 1, page_size: 50 })
                if (!cancelled) setMachines(data.items || [])
            } catch (err) {
                console.error('Load machines failed', err)
                if (!cancelled) setMachines([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (location.hash === '#security-policy-card') {
            const timer = setTimeout(() => {
                const el = document.getElementById('security-policy-card')
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
            }, 150)
            return () => clearTimeout(timer)
        }
    }, [location])

    const display = machines
    const idle = display.filter((m) => (m.status || '').toLowerCase() === 'idle')
    const topPicks = idle.length ? idle : display
    const topThree = topPicks
        .slice()
        .sort((a, b) => (a.ping_ms ?? a.ping ?? 9999) - (b.ping_ms ?? b.ping ?? 9999))
        .slice(0, 3)

    const formatBalance = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ'
    }

    return (
        <div className="dashboard">
            {/* Welcome Section */}
            <section className="card welcome-card">
                <div className="welcome-content">
                    <div className="welcome-text">
                        <span className="welcome-badge">🎮 Sẵn sàng</span>
                        <h2>Chào mừng trở lại, {ctx.user?.name || 'Game thủ'}!</h2>
                        <p className="muted">
                            Bạn có thể khởi tạo máy mới hoặc tiếp tục từ snapshot cũ.
                            Hãy đảm bảo bạn còn đủ giờ chơi và chuẩn bị file VPN.
                        </p>
                        <div className="actions">
                            <a className="btn primary" href="/app/wizard">
                                🚀 Khởi tạo phiên mới
                            </a>
                            <a className="btn ghost" href="/app/machines">
                                Xem máy đang trống
                            </a>
                        </div>
                    </div>
                    <div className="welcome-features">
                        <div className="feature-tag">
                            <span className="feature-icon">🔐</span>
                            <span>VPN-first</span>
                        </div>
                        <div className="feature-tag">
                            <span className="feature-icon">💾</span>
                            <span>Snapshot resume</span>
                        </div>
                        <div className="feature-tag">
                            <span className="feature-icon">⚡</span>
                            <span>Low latency</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Grid */}
            <section className="stats-grid">
                <Stat
                    icon="⏱️"
                    label="Giờ còn lại"
                    value={`${ctx.session.remainingMinutes} phút`}
                    hint="Tính phí khi VM sẵn sàng"
                />
                <Stat
                    icon="💰"
                    label="Số dư tài khoản"
                    value={formatBalance(ctx.user?.balance)}
                    hint="Nạp thêm để chơi"
                />
                <Stat
                    icon="🖥️"
                    label="Máy trống"
                    value={`${idle.length}/${display.length || 0}`}
                    hint="Sẵn sàng sử dụng"
                />
            </section>

            {/* Quick Pick Section */}
            <section className="card">
                <div className="section-head">
                    <div>
                        <p className="muted">Máy có ping tốt nhất</p>
                        <h3>Chọn nhanh</h3>
                    </div>
                    <a className="btn ghost" href="/app/machines">
                        Xem tất cả →
                    </a>
                </div>
                <div className="grid grid-3" style={{ marginTop: '20px' }}>
                    {loading && (
                        <div className="loading-state" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px 0' }}>
                            <div className="spinner"></div>
                            <p className="muted">Đang tải danh sách máy...</p>
                        </div>
                    )}
                    {!loading && !topThree.length && (
                        <div className="empty-state" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px 0' }}>
                            <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: '10px' }}>🖥️</div>
                            <h4>Chưa có máy nào</h4>
                            <p className="muted">Hệ thống đang bảo trì hoặc chưa có máy trống</p>
                        </div>
                    )}
                    {!loading && topThree.map((m) => {
                        const country = getCountryData(m.region)
                        const isIdle = m.status === 'idle'
                        const ping = m.ping_ms ?? m.ping ?? 0
                        
                        let pingClass = 'ping-high'
                        let pingLabel = 'Chậm'
                        if (ping > 0 && ping < 30) {
                            pingClass = 'ping-low'
                            pingLabel = 'Cực nhanh'
                        } else if (ping >= 30 && ping <= 80) {
                            pingClass = 'ping-mid'
                            pingLabel = 'Khá tốt'
                        }
                        
                        return (
                            <div key={m.id} className="machine-premium-card card">
                                {/* Khối Ảnh Visual & Badge nổi */}
                                <div className="machine-card-visual-wrapper">
                                    {/* Đồ họa SVG Server */}
                                    <svg viewBox="0 0 300 150" className="machine-svg-graphic">
                                        <defs>
                                            <linearGradient id={`server-grad-${m.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#1a1a35" />
                                                <stop offset="100%" stopColor="#0b0b18" />
                                            </linearGradient>
                                            <linearGradient id={`led-grad-${m.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#F45D48" />
                                                <stop offset="100%" stopColor="#00B8D9" />
                                            </linearGradient>
                                            <filter id={`glow-led-${m.id}`} x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur stdDeviation="3" result="blur" />
                                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                            </filter>
                                        </defs>
                                        <rect width="300" height="150" rx="12" fill={`url(#server-grad-${m.id})`} />
                                        <line x1="20" y1="35" x2="280" y2="35" stroke="#242442" strokeWidth="2" />
                                        <line x1="20" y1="75" x2="280" y2="75" stroke="#242442" strokeWidth="2" />
                                        <line x1="20" y1="115" x2="280" y2="115" stroke="#242442" strokeWidth="2" />
                                        
                                        {/* CPU / Glow node */}
                                        <rect x="245" y="45" width="22" height="22" rx="4" fill="#090a18" stroke="#313159" strokeWidth="1" />
                                        <circle cx="256" cy="56" r="4.5" fill="#00B8D9" filter={`url(#glow-led-${m.id})`} />
                                        
                                        <rect x="245" y="85" width="22" height="22" rx="4" fill="#090a18" stroke="#313159" strokeWidth="1" />
                                        <circle cx="256" cy="96" r="4.5" fill="#F45D48" filter={`url(#glow-led-${m.id})`} />
 
                                        <g opacity="0.9">
                                            {/* Rack Slot 1 */}
                                            <rect x="25" y="48" width="165" height="16" rx="4" fill="#101021" stroke="#252549" strokeWidth="1" />
                                            <rect x="35" y="54" width="70" height="4" rx="2" fill={`url(#led-grad-${m.id})`} />
                                            <circle cx="130" cy="56" r="3.5" fill="#00ffcc" />
                                            <circle cx="145" cy="56" r="3.5" fill="#00ffcc" />
                                            <circle cx="160" cy="56" r="3.5" fill="#ff3b30" />
                                            
                                            {/* Rack Slot 2 */}
                                            <rect x="25" y="88" width="165" height="16" rx="4" fill="#101021" stroke="#252549" strokeWidth="1" />
                                            <rect x="35" y="94" width="90" height="4" rx="2" fill={`url(#led-grad-${m.id})`} />
                                            <circle cx="130" cy="96" r="3.5" fill="#00ffcc" />
                                            <circle cx="145" cy="96" r="3.5" fill="#ffcc00" />
                                            <circle cx="160" cy="96" r="3.5" fill="#00ffcc" />
                                        </g>
                                        
                                        {/* Lưới Grid */}
                                        <path d="M 0,10 L 300,10 M 0,20 L 300,20 M 0,30 L 300,30 M 0,40 L 300,40 M 0,50 L 300,50 M 0,60 L 300,60 M 0,70 L 300,70 M 0,80 L 300,80 M 0,90 L 300,90 M 0,100 L 300,100 M 0,110 L 300,110 M 0,120 L 300,120 M 0,130 L 300,130 M 0,140 L 300,140" stroke="#ffffff" strokeWidth="1" opacity="0.015" />
                                        <path d="M 10,0 L 10,150 M 20,0 L 20,150 M 30,0 L 30,150 M 40,0 L 40,150 M 50,0 L 50,150 M 60,0 L 60,150 M 70,0 L 70,150 M 80,0 L 80,150 M 90,0 L 90,150 M 100,0 L 100,150 M 110,0 L 110,150 M 120,0 L 120,150 M 130,0 L 130,150 M 140,0 L 140,150 M 150,0 L 150,150 M 160,0 L 160,150 M 170,0 L 170,150 M 180,0 L 180,150 M 190,0 L 190,150 M 200,0 L 200,150 M 210,0 L 210,150 M 220,0 L 220,150 M 230,0 L 230,150 M 240,0 L 240,150 M 250,0 L 250,150 M 260,0 L 260,150 M 270,0 L 270,150 M 280,0 L 280,150 M 290,0 L 290,150" stroke="#ffffff" strokeWidth="1" opacity="0.015" />
                                    </svg>
                                    
                                    {/* Country Badge nổi bên góc */}
                                    <div className="machine-floating-flag" title={country.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {country.flagUrl ? (
                                            <img 
                                                src={country.flagUrl} 
                                                alt={country.name} 
                                                style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} 
                                            />
                                        ) : (
                                            <span className="flag-icon" style={{ display: 'inline-block', verticalAlign: 'middle' }}>{country.flag}</span>
                                        )}
                                        <span className="flag-label">{country.name}</span>
                                    </div>
                                    
                                    {/* Badge Trạng thái nổi */}
                                    <div className={`machine-floating-status ${isIdle ? 'idle' : 'busy'}`}>
                                        {isIdle && <span className="pulsing-dot" />}
                                        <span>{isIdle ? 'Trống' : 'Bận'}</span>
                                    </div>
                                </div>
                                
                                {/* Khối Thông tin máy */}
                                <div className="machine-card-content">
                                    <div className="machine-card-title-row">
                                        <h3 className="machine-name">{m.name || m.code}</h3>
                                        <span className="machine-code-pill">{m.code || m.id?.slice(0, 8)}</span>
                                    </div>
                                    
                                    {/* Khung GPU chuyên nghiệp */}
                                    <div className="machine-gpu-box">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="gpu-icon">
                                            <rect x="2" y="2" width="20" height="20" rx="4" />
                                            <path d="M6 12h12" />
                                            <path d="M12 6v12" />
                                        </svg>
                                        <span className="gpu-label">{m.spec || m.gpu || 'Core i7 · RAM 16GB'}</span>
                                    </div>
                                    
                                    {/* Khối Ping & Network */}
                                    <div className="machine-network-row">
                                        <span className="network-label">Độ trễ (Ping)</span>
                                        <div className={`ping-indicator-pill ${pingClass}`}>
                                            <span className="ping-dot" />
                                            <span className="ping-val">{ping > 0 ? `${ping} ms` : '? ms'}</span>
                                            <span className="ping-txt">({pingLabel})</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Các nút Hành động */}
                                <div className="machine-card-actions" style={{ gridTemplateColumns: '1fr' }}>
                                    <a
                                        className="btn primary action-start"
                                        href={`/app/wizard?machineId=${m.id}`}
                                        style={{ textAlign: 'center', display: 'block' }}
                                    >
                                        🎮 Bắt đầu chơi
                                    </a>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* Quick Actions */}
            <section className="quick-actions">
                <div className="action-card" onClick={ctx.openTopup}>
                    <div className="action-icon">💳</div>
                    <div className="action-info">
                        <h4>Nạp tiền</h4>
                        <p className="muted">Thanh toán qua MoMo</p>
                    </div>
                </div>
                <a className="action-card" href="/app/history">
                    <div className="action-icon">📊</div>
                    <div className="action-info">
                        <h4>Lịch sử</h4>
                        <p className="muted">Xem giao dịch & phiên</p>
                    </div>
                </a>
                <a className="action-card" href="/app/support">
                    <div className="action-icon">💬</div>
                    <div className="action-info">
                        <h4>Hỗ trợ</h4>
                        <p className="muted">FAQ & liên hệ</p>
                    </div>
                </a>
            </section>

            {/* Chính sách & bảo mật */}
            <section className="card" id="security-policy-card">
                <div className="section-head">
                    <div>
                        <p className="muted">An tâm trải nghiệm</p>
                        <h3>Chính sách & bảo mật</h3>
                    </div>
                </div>
                <ul className="bullet" style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <li>Form auth có rate-limit giả lập, lockout tạm thời, policy mật khẩu.</li>
                    <li>JWT/refresh dự kiến để HttpOnly; tránh lưu token ở localStorage.</li>
                    <li>CSRF token với các form nhạy cảm (mock sẵn trong auth pages).</li>
                    <li>Chỉ hiển thị thông tin tối thiểu cho user; log kỹ thuật ở trang Hỗ trợ.</li>
                </ul>
            </section>
        </div>
    )
}

export default Dashboard
