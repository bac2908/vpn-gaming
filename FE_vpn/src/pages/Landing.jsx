import './landing.css'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { listMachines } from '../api/machines'
import { listPlans } from '../api/subscriptions'
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

const HERO_MACHINE_IMAGES = [
    '/gpu-banner-1.png',
    '/gpu-banner-2.png',
    '/gpu-banner-3.png',
    '/gpu-banner-4.png',
    '/gpu-banner-5.png',
]

const steps = [
    { title: 'Chọn máy', desc: 'Ưu tiên vùng gần Việt Nam và ping thấp nhất.' },
    { title: 'Giữ snapshot', desc: 'Tiếp tục phiên cũ hoặc tạo môi trường mới.' },
    { title: 'Khởi động VM', desc: 'Máy cloud được chuẩn bị theo gói của bạn.' },
    { title: 'Kết nối VPN', desc: 'Tải profile, xác nhận route và IP local.' },
    { title: 'Vào Moonlight', desc: 'Pair Sunshine rồi bắt đầu stream game.' },
]

const formatVnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ'

const formatQuota = (plan) => {
    if (plan?.data_limit_gb == null) return 'Không giới hạn'
    return `${plan.data_limit_gb}GB băng thông`
}

const protectedLinks = {
    app: '/app',
    flow: '/app/wizard',
    plans: '/app/subscriptions',
}

function Landing({ ctx }) {
    const [machines, setMachines] = useState([])
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [plansLoading, setPlansLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            const [machineResult, planResult] = await Promise.allSettled([
                listMachines({ page: 1, page_size: 12 }),
                listPlans(),
            ])

            if (cancelled) return

            if (machineResult.status === 'fulfilled') {
                setMachines(machineResult.value?.items || [])
            } else {
                console.error('Load machines failed', machineResult.reason)
                setMachines([])
            }

            if (planResult.status === 'fulfilled') {
                const planData = planResult.value
                const items = Array.isArray(planData?.items)
                    ? planData.items
                    : Array.isArray(planData)
                        ? planData
                        : []
                setPlans(items)
            } else {
                console.error('Load plans failed', planResult.reason)
                setPlans([])
            }

            setLoading(false)
            setPlansLoading(false)
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
    const featuredMachine = topThree[0] || machines[0]
    const featuredCountry = getCountryData(featuredMachine?.region || featuredMachine?.location)
    const featuredPing = featuredMachine?.ping_ms ?? featuredMachine?.ping
    const handleAuthEntry = () => {
        ctx?.clearAuth?.()
    }

    return (
        <div className="landing">
            <header className="landing-nav">
                <div className="brand">VPN Gaming</div>
                <div className="nav-links">
                    <a href="#faq">FAQ</a>
                    <a href="#flow">Quy trình</a>
                    <a href="#plans">Gói</a>
                    <a href="#faq">Support</a>
                    <NavLink className="btn ghost" to={buildLoginRedirect(protectedLinks.app)} onClick={handleAuthEntry}>
                        Đăng nhập
                    </NavLink>
                </div>
            </header>

            <section className="hero">
                <div className="hero-copy">
                    <p className="pill ghost">Cloud gaming cho game thủ Việt</p>
                    <h1>Thuê máy GPU, ping thấp, vào game nhanh</h1>
                    <p className="muted">
                        Chọn máy gần Việt Nam, khởi tạo phiên chơi, kết nối VPN an toàn và stream qua Moonlight trong vài bước rõ ràng.
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
                        <span className="badge">VPN riêng cho phiên</span>
                        <span className="badge">Snapshot tiếp tục nhanh</span>
                        <span className="badge">Moonlight / Sunshine</span>
                    </div>
                </div>
                <div className="hero-panel">
                <div className="landing-machine-preview">
                    <div className="landing-preview-visual">
                        <img src={HERO_MACHINE_IMAGES[0]} alt="Cloud gaming GPU" />
                        <div className="landing-preview-overlay">
                            <span className="badge success">Máy đề xuất</span>
                            <div>
                                <p>{featuredCountry.name}</p>
                                <h2>{featuredMachine?.gpu || 'RTX cloud rig'}</h2>
                                <span>{featuredMachine?.code || 'Chọn máy sau khi đăng nhập'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="landing-machine-head">
                        <div>
                            <p className="muted">{idle.length} máy sẵn sàng</p>
                            <h3>3 máy ping thấp nhất</h3>
                        </div>
                        <strong>{Number.isFinite(Number(featuredPing)) ? `${featuredPing} ms` : 'Đang đo'}</strong>
                    </div>
                    <div className="landing-machine-list">
                        {loading && <p className="muted">Đang tải danh sách máy...</p>}
                        {!loading && !topThree.length && (
                            <div className="landing-empty">
                                <p className="muted">Chưa có máy nào từ hệ thống.</p>
                            </div>
                        )}
                        {!loading && topThree.map((m) => {
                            const country = getCountryData(m.region || m.location)
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
                                    <div className="machine-row-main">
                                        {country.flagUrl ? (
                                            <img 
                                                src={country.flagUrl} 
                                                alt={country.name} 
                                            />
                                        ) : (
                                            <span>{country.flag}</span>
                                        )}
                                        <div>
                                            <strong>{m.location || m.name || country.name}</strong>
                                            <p>
                                                <span className={`state-dot ${isIdle ? 'idle' : 'busy'}`} />
                                                {m.code} · {isIdle ? 'Trống' : 'Bận'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="machine-row-meta">
                                        <span>{m.gpu || 'GPU cloud'}</span>
                                        <div className={`ping-indicator-pill ${pingClass}`}>
                                            <span className="ping-dot" />
                                            <span className="ping-val">{pingLabel}</span>
                                        </div>
                                    </div>
                                    <NavLink
                                        className="btn primary"
                                        to={buildLoginRedirect(`/app/wizard?machineId=${m.id}`)}
                                        onClick={handleAuthEntry}
                                    >
                                        Chạy
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
                    <NavLink className="btn secondary" to={buildLoginRedirect(protectedLinks.flow)} onClick={handleAuthEntry}>
                        Xem khởi tạo
                    </NavLink>
                </div>
                <div className="landing-flow">
                    {steps.map((step, idx) => (
                        <div key={step.title} className="landing-flow-card">
                            <em>{String(idx + 1).padStart(2, '0')}</em>
                            <h4>{step.title}</h4>
                            <p>{step.desc}</p>
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
                    <NavLink className="btn ghost" to={buildRegisterRedirect(protectedLinks.plans)} onClick={handleAuthEntry}>
                        Đăng ký gói
                    </NavLink>
                </div>
                <div className="plan-grid">
                    {plansLoading && <p className="muted">Đang tải bảng giá...</p>}
                    {!plansLoading && !plans.length && <p className="muted">Chưa có gói dịch vụ từ hệ thống.</p>}
                    {!plansLoading && plans.map((plan, index) => (
                        <div key={plan.id || plan.code} className={`card plan ${index === 0 ? 'featured' : ''}`}>
                            <div className="plan-top">
                                <div>
                                    <span className="plan-badge">{plan.active ? 'Đang mở bán' : 'Tạm ẩn'}</span>
                                    <h3>{plan.name}</h3>
                                </div>
                                {index === 0 && <span className="pill">Gói đầu tiên</span>}
                            </div>
                            <div className="plan-price">
                                <strong>{formatVnd(plan.price_cents ?? plan.price ?? 0)}</strong>
                                <span>/ gói</span>
                            </div>
                            <p className="muted small plan-summary">{plan.description || 'Thông tin gói được lấy từ hệ thống.'}</p>
                            <div className="plan-metrics">
                                <div>
                                    <span>Thời hạn</span>
                                    <strong>{plan.duration_days ? `${plan.duration_days} ngày` : 'Chưa cấu hình'}</strong>
                                </div>
                                <div>
                                    <span>Dung lượng</span>
                                    <strong>{formatQuota(plan)}</strong>
                                </div>
                            </div>
                            <ul className="plan-features">
                                <li>Mã gói: {plan.code || 'Chưa có mã'}</li>
                                <li>Tiền tệ: {plan.currency || 'VND'}</li>
                                <li>Trạng thái: {plan.active ? 'Đang hoạt động' : 'Không hoạt động'}</li>
                            </ul>
                            <NavLink className="btn secondary" to={buildRegisterRedirect(protectedLinks.plans)} onClick={handleAuthEntry}>
                                Chọn gói
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
                        <p className="muted">Ping phụ thuộc máy, khu vực và ISP; danh sách máy luôn hiển thị số đo từ hệ thống.</p>
                    </div>
                    <div className="card border">
                        <h4>Snapshot lưu bao lâu?</h4>
                        <p className="muted">Thời gian giữ snapshot phụ thuộc chính sách gói và cấu hình quản trị.</p>
                    </div>
                    <div className="card border">
                        <h4>Tải file .ovpn thế nào?</h4>
                        <p className="muted">Trang khởi tạo cung cấp link và QR; cần client OpenVPN/Moonlight.</p>
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
                    <p className="muted small">Portal VM/VPN/Streaming</p>
                </div>
                <div className="footer-links">
                    <a href="#plans">Gói</a>
                    <a href="#faq">FAQ</a>
                    <a href="#faq">Support</a>
                    <a href="#faq">Email</a>
                </div>
            </footer>
        </div>
    )
}

export default Landing
