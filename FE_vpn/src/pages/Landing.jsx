import './landing.css'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { listMachines } from '../api/machines'
import { buildLoginRedirect, buildRegisterRedirect } from '../utils/redirect'

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


const steps = [
    'Chọn máy với ping thấp',
    'Clone/Resume snapshot',
    'Start VM & kiểm tra',
    'VPN + Sunshine pairing',
    'Stream qua Moonlight',
]

const tiers = [
    {
        name: 'Gói Cơ Bản',
        badge: 'Dùng thử',
        price: 50000,
        duration: '30 ngày',
        quota: '50GB băng thông',
        note: 'Phù hợp để trải nghiệm cloud gaming, kiểm tra ping và thử quy trình VM/VPN.',
        features: ['Máy khu vực gần nhất', 'Resume snapshot cơ bản', 'Hỗ trợ qua ticket'],
        cta: 'Bắt đầu thử',
    },
    {
        name: 'Gói Pro',
        badge: 'Phổ biến',
        price: 100000,
        duration: '30 ngày',
        quota: '100GB băng thông',
        note: 'Dành cho người chơi thường xuyên, cần hàng đợi ưu tiên và phiên ổn định hơn.',
        features: ['Ưu tiên máy ping thấp', 'Snapshot resume nhanh', 'Theo dõi phiên và lịch sử'],
        cta: 'Chọn Pro',
        featured: true,
    },
    {
        name: 'Gói Premium',
        badge: 'Hiệu năng cao',
        price: 200000,
        duration: '30 ngày',
        quota: 'Không giới hạn dung lượng',
        note: 'Dành cho người chơi nhiều, stream thường xuyên và cần hỗ trợ nhanh hơn.',
        features: ['Ưu tiên GPU mạnh', 'Hỗ trợ nhanh', 'Tối ưu cho Moonlight/Sunshine'],
        cta: 'Nâng cấp Premium',
    },
]

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ'

const protectedLinks = {
    app: '/app',
    faq: '/app/support#faq',
    flow: '/app/wizard',
    plans: '/app/subscriptions',
    support: '/app/support',
}

function Landing({ ctx }) {
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const data = await listMachines({ page: 1, page_size: 12 })
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

    const idle = machines.filter((m) => (m.status || '').toLowerCase() === 'idle')
    const topPicks = idle.length ? idle : machines
    const topThree = topPicks
        .slice()
        .sort((a, b) => (a.ping_ms ?? a.ping ?? 9999) - (b.ping_ms ?? b.ping ?? 9999))
        .slice(0, 3)
    const handleAuthEntry = () => {
        ctx?.clearAuth?.()
    }

    return (
        <div className="landing">
            <header className="landing-nav">
                <div className="brand">VPN Gaming</div>
                <div className="nav-links">
                    <NavLink to={protectedLinks.faq}>FAQ</NavLink>
                    <NavLink to={protectedLinks.flow}>Quy trình</NavLink>
                    <NavLink to={protectedLinks.plans}>Gói</NavLink>
                    <NavLink to={protectedLinks.support}>Support</NavLink>
                    <NavLink className="btn ghost" to={buildLoginRedirect(protectedLinks.app)} onClick={handleAuthEntry}>
                        Đăng nhập
                    </NavLink>
                </div>
            </header>

            <section className="hero">
                <div className="hero-copy">
                    <p className="pill ghost">VPN-first · Snapshot resume</p>
                    <h1>Ping thấp, vào game nhanh</h1>
                    <p className="muted">
                        Chọn máy gần bạn, resume từ snapshot, kết nối VPN an toàn và stream qua Moonlight trong vài bước.
                    </p>
                    <div className="actions">
                        <NavLink className="btn primary" to={buildLoginRedirect(protectedLinks.app)} onClick={handleAuthEntry}>
                            Đăng nhập
                        </NavLink>
                        <NavLink className="btn ghost" to={buildRegisterRedirect(protectedLinks.app)} onClick={handleAuthEntry}>
                            Đăng ký
                        </NavLink>
                    </div>
                    <div className="hero-badges">
                        <span className="badge">Rate-limit & MFA</span>
                        <span className="badge">Cookie HttpOnly</span>
                        <span className="badge">Encrypt snapshot</span>
                    </div>
                </div>
                <div className="hero-panel" style={{ width: '100%' }}>
                <div className="card" style={{ background: 'rgba(20, 20, 35, 0.6)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--muted)', letterSpacing: '0.5px' }}>🖥️ MÁY KHẢ DỤNG GẦN BẠN</span>
                        <span className="badge success" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>3 Sẵn sàng</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {loading && <p className="muted">Đang tải danh sách máy...</p>}
                        {!loading && !topThree.length && (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                <p className="muted">Chưa có máy nào từ hệ thống.</p>
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
                                <div key={m.id} className="machine-compact-row">
                                    {/* Left: Flag & Location info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                        {country.flagUrl ? (
                                            <img 
                                                src={country.flagUrl} 
                                                alt={country.name} 
                                                style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} 
                                            />
                                        ) : (
                                            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{country.flag}</span>
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    {m.location || m.name || m.code}
                                                </span>
                                                <span className="machine-code-pill" style={{ margin: 0 }}>{m.code}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <span className="pulsing-dot" style={{ width: '6px', height: '6px', backgroundColor: isIdle ? '#00e396' : '#feb019', boxShadow: isIdle ? '0 0 8px #00e396' : '0 0 8px #feb019' }}></span>
                                                <span style={{ fontSize: '0.7rem', color: isIdle ? '#00e396' : '#feb019', fontWeight: '600', textTransform: 'uppercase' }}>
                                                    {isIdle ? 'Trống' : 'Bận'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Middle: GPU & Ping */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', fontWeight: '500' }}>
                                            {m.spec || m.gpu || 'RTX 3070'}
                                        </span>
                                        <div className={`ping-indicator-pill ${pingClass}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                                            <span className="ping-dot" style={{ width: '5px', height: '5px' }} />
                                            <span className="ping-val" style={{ fontSize: '0.75rem' }}>{ping > 0 ? `${ping} ms` : '? ms'}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Right: Start Button */}
                                    <NavLink
                                        className="btn primary"
                                        to="/app"
                                        style={{ 
                                            padding: '6px 12px', 
                                            fontSize: '0.75rem', 
                                            fontWeight: '600', 
                                            borderRadius: '8px',
                                            flexShrink: 0,
                                            background: 'linear-gradient(135deg, #F45D48 0%, #d83d28 100%)',
                                            border: 'none',
                                            boxShadow: '0 2px 8px rgba(244, 93, 72, 0.2)'
                                        }}
                                    >
                                        Chạy ⚡
                                    </NavLink>
                                </div>
                            )
                        })}
                    </div>
                </div>
                </div>
            </section>

            <section id="flow" className="section">
                <div className="section-head">
                    <div>
                        <p className="muted">5 bước</p>
                        <h2>Luồng khởi tạo</h2>
                    </div>
                    <NavLink className="btn secondary" to={protectedLinks.flow}>
                        Xem wizard
                    </NavLink>
                </div>
                <div className="timeline landing-timeline">
                    {steps.map((step, idx) => (
                        <div key={step} className="card border">
                            <span className="pill ghost">Bước {idx + 1}</span>
                            <h4>{step}</h4>
                            <p className="muted">Minimal downtime · rõ trạng thái</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="plans" className="section">
                <div className="section-head">
                    <div>
                        <p className="muted">Bảng giá VND</p>
                        <h2>Chọn gói cloud gaming phù hợp</h2>
                        <p className="muted small pricing-note">
                            Giá hiển thị bằng VND, trừ trực tiếp từ số dư tài khoản sau khi đăng nhập.
                        </p>
                    </div>
                    <NavLink className="btn ghost" to={protectedLinks.plans}>
                        Đăng ký gói
                    </NavLink>
                </div>
                <div className="plan-grid">
                    {tiers.map((tier) => (
                        <div key={tier.name} className={`card plan ${tier.featured ? 'featured' : ''}`}>
                            <div className="plan-top">
                                <div>
                                    <span className="plan-badge">{tier.badge}</span>
                                    <h3>{tier.name}</h3>
                                </div>
                                {tier.featured && <span className="pill">Nên chọn</span>}
                            </div>
                            <div className="plan-price">
                                <strong>{formatVnd(tier.price)}</strong>
                                <span>/ gói</span>
                            </div>
                            <p className="muted small plan-summary">{tier.note}</p>
                            <div className="plan-metrics">
                                <div>
                                    <span>Thời hạn</span>
                                    <strong>{tier.duration}</strong>
                                </div>
                                <div>
                                    <span>Dung lượng</span>
                                    <strong>{tier.quota}</strong>
                                </div>
                            </div>
                            <ul className="plan-features">
                                {tier.features.map((feature) => (
                                    <li key={feature}>{feature}</li>
                                ))}
                            </ul>
                            <NavLink className="btn secondary" to={protectedLinks.plans}>
                                {tier.cta}
                            </NavLink>
                        </div>
                    ))}
                </div>
            </section>

            <section id="faq" className="section faq">
                <div>
                    <p className="muted">FAQ</p>
                    <h2>Những câu hỏi hay gặp</h2>
                </div>
                <div className="faq-grid">
                    <div className="card border">
                        <h4>Ping thấp nhất ở đâu?</h4>
                        <p className="muted">SG/JP thường &lt;50ms, US ~160ms tuỳ ISP.</p>
                    </div>
                    <div className="card border">
                        <h4>Snapshot lưu bao lâu?</h4>
                        <p className="muted">Giữ phiên gần nhất, xoá cũ theo quota, luôn có golden image.</p>
                    </div>
                    <div className="card border">
                        <h4>Tải file .ovpn thế nào?</h4>
                        <p className="muted">Wizard cung cấp link và QR; cần client OpenVPN/Moonlight.</p>
                    </div>
                    <div className="card border">
                        <h4>An toàn đăng nhập?</h4>
                        <p className="muted">Rate-limit, lockout tạm, MFA, cookie HttpOnly, CSRF token.</p>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-left">
                    <div className="brand">VPN Gaming</div>
                    <p className="muted small">Portal VM/VPN/Streaming · 2026</p>
                </div>
                <div className="footer-links">
                    <NavLink to={protectedLinks.plans}>Gói</NavLink>
                    <NavLink to={protectedLinks.faq}>FAQ</NavLink>
                    <NavLink to={protectedLinks.support}>Support</NavLink>
                    <NavLink to={protectedLinks.support}>Email</NavLink>
                </div>
            </footer>
        </div>
    )
}

export default Landing
