import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    Activity,
    Camera,
    ChevronRight,
    CheckCircle2,
    Cpu,
    CreditCard,
    FileText,
    Gauge,
    Monitor,
    Play,
    Server,
    Settings,
    ShieldCheck,
    Wifi,
} from 'lucide-react'
import { getActiveSession, listMachines } from '../api/machines'
import { getMySubscription } from '../api/subscriptions'

const securityCards = [
    {
        tag: 'Active',
        title: 'Tài khoản',
        desc: 'Rate-limit đăng nhập, lockout tạm thời và chính sách mật khẩu mạnh.',
        icon: 'shield',
    },
    {
        tag: 'Session accepted',
        title: 'VPN profile',
        desc: 'File VPN được cấp theo từng phiên, tránh dùng lại profile cũ giữa các session.',
        icon: 'file',
    },
    {
        tag: 'Snapshot',
        title: 'Cloud rig',
        desc: 'Dừng phiên để trả máy, ghi nhận thời gian kết thúc và giữ trạng thái snapshot.',
        icon: 'camera',
    },
    {
        tag: 'Minimal',
        title: 'Log kỹ thuật',
        desc: 'Chỉ lưu thông tin cần thiết cho vận hành, hỗ trợ và kiểm tra sự cố kết nối.',
        icon: 'activity',
    },
]

const GPU_BANNER_IMAGES = [
    '/gpu-banner-1.png',
    '/gpu-banner-2.png',
    '/gpu-banner-3.png',
    '/gpu-banner-4.png',
    '/gpu-banner-5.png',
]

function DashIcon({ name, className = '' }) {
    const icons = {
        activity: Activity,
        camera: Camera,
        check: CheckCircle2,
        cpu: Cpu,
        credit: CreditCard,
        file: FileText,
        gauge: Gauge,
        monitor: Monitor,
        play: Play,
        chevron: ChevronRight,
        server: Server,
        settings: Settings,
        shield: ShieldCheck,
        wifi: Wifi,
    }
    const Icon = icons[name] || Server

    return <Icon className={['gd-dash-icon', className].filter(Boolean).join(' ')} aria-hidden="true" />
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(Number(amount || 0)) + 'đ'
}

function formatDate(value) {
    if (!value) return 'Chưa có hạn'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Chưa có hạn'
    return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatDurationFrom(value, now = Date.now()) {
    if (!value) return null
    const start = new Date(value)
    if (Number.isNaN(start.getTime())) return null

    const totalSeconds = Math.max(0, Math.floor((now - start.getTime()) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function getCountryData(region) {
    const r = String(region || '').toLowerCase()
    if (r.includes('singapore') || r.includes('sg')) {
        return { flag: 'SG', flagUrl: 'https://flagcdn.com/sg.svg', name: 'Singapore' }
    }
    if (
        r.includes('vietnam') ||
        r.includes('việt nam') ||
        r.includes('viet') ||
        r.includes('vn') ||
        r.includes('hanoi') ||
        r.includes('hà nội') ||
        r.includes('hcmc') ||
        r.includes('hồ chí minh') ||
        r.includes('ho chi minh') ||
        r.includes('saigon') ||
        r.includes('sài gòn')
    ) {
        return { flag: 'VN', flagUrl: 'https://flagcdn.com/vn.svg', name: 'Việt Nam' }
    }
    return { flag: '🌐', flagUrl: null, name: region || 'Chưa rõ vùng' }
}

function getPingTone(ping) {
    const value = Number(ping)
    if (!Number.isFinite(value)) return 'unknown'
    if (value <= 30) return 'excellent'
    if (value <= 60) return 'good'
    return 'slow'
}

function getMachineLabel(machine) {
    if (!machine) return 'Chưa chọn máy'
    const country = getCountryData(machine.region || machine.location)
    return `${country.name} • ${machine.gpu || machine.code || 'Cloud rig'}`
}

function formatPing(machine) {
    const ping = machine?.ping_ms ?? machine?.ping
    return Number.isFinite(Number(ping)) ? `${ping} ms` : 'Chưa đo'
}

function Metric({ label, value }) {
    return (
        <div className="gd-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function Spec({ label, value }) {
    return (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function MachineVisual({ activeSession, machine, now, bannerIndex = 0, bannerTotal = 1, isActiveMachine = false, imageSrc }) {
    const startedAt = activeSession?.started_at || activeSession?.start_time || activeSession?.created_at || activeSession?.createdAt
    const sessionDuration = formatDurationFrom(startedAt, now)
    const vpnOnline = isActiveMachine && Boolean(activeSession?.vpn_online || activeSession?.ip_address)
    const moonlightReady = isActiveMachine && Boolean(activeSession?.moonlight_ready || activeSession?.sunshine_paired)
    const bannerLabel = isActiveMachine ? 'MÁY ĐANG DÙNG' : `MÁY ĐỀ XUẤT ${bannerIndex + 1}/${bannerTotal}`

    return (
        <section className="gd-machine-card gd-machine-visual" aria-label={isActiveMachine ? 'Máy đang dùng' : 'Máy đề xuất'}>
            <div className="gd-machine-top">
                <span className="gd-active-pill">{bannerLabel}</span>
            </div>

            <div className="gd-machine-body">
                <div className="gd-machine-copy">
                    <h2>{getMachineLabel(machine)}</h2>
                    <p>{isActiveMachine ? 'Phiên hiện tại' : 'Gợi ý ping thấp từ hệ thống'}</p>
                    <div className="gd-metrics">
                        <Metric label="Ping" value={formatPing(machine)} />
                        <Metric label="VPN" value={vpnOnline ? 'Online' : 'Chưa kết nối'} />
                        <Metric label="Moonlight" value={moonlightReady ? 'Sẵn sàng' : 'Chưa pairing'} />
                    </div>
                </div>

                <div className="gd-gpu-visual" aria-hidden="true">
                    <img src={imageSrc || '/gpu-neon-panel.png'} alt="" />
                </div>
            </div>

            <div className="gd-spec-row">
                <Spec label="GPU" value={machine?.gpu || 'Chưa cấu hình'} />
                <Spec label="Mã máy" value={machine?.code || 'Chưa chọn'} />
                <Spec label="Khu vực" value={machine?.location || machine?.region || 'Chưa cấu hình'} />
                <Spec label="Trạng thái" value={machine?.status || 'Chưa rõ'} />
            </div>

            <div className="gd-session-line">
                <span>
                    <DashIcon name="check" />
                    {isActiveMachine ? 'Phiên đang hoạt động' : 'Máy tốt trong danh sách đề xuất'}
                </span>
                <strong>{isActiveMachine && sessionDuration ? `Đã chạy ${sessionDuration}` : 'Tự đổi sau vài giây'}</strong>
            </div>
        </section>
    )
}

function StatusCard({ dot, title, value, icon, href, ariaLabel }) {
    return (
        <Link className="gd-status-card" to={href} aria-label={ariaLabel || title}>
            <span className={dot === 'waiting' ? 'is-waiting' : ''} />
            <div>
                <p>{title}</p>
                <strong>{value}</strong>
            </div>
            <DashIcon name={icon} />
        </Link>
    )
}

function SidePanel({ title, heading, desc, button, href, icon = 'settings' }) {
    return (
        <article className="gd-side-card">
            <div className="gd-side-head">
                <p>{title}</p>
                <DashIcon name={icon} />
            </div>
            <h3>{heading}</h3>
            <span>{desc}</span>
            <Link className="gd-side-button" to={href}>
                {button}
                <DashIcon name="chevron" />
            </Link>
        </article>
    )
}

function Dashboard({ ctx }) {
    const location = useLocation()
    const [machines, setMachines] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [subscription, setSubscription] = useState(null)
    const [now, setNow] = useState(() => Date.now())
    const [bannerIndex, setBannerIndex] = useState(0)

    useEffect(() => {
        let cancelled = false

        async function load() {
            const [machineResult, sessionResult, subscriptionResult] = await Promise.allSettled([
                listMachines({ page: 1, page_size: 5, sort: 'best' }),
                ctx?.token ? getActiveSession(ctx.token) : Promise.resolve(null),
                ctx?.token ? getMySubscription(ctx.token) : Promise.resolve(null),
            ])

            if (cancelled) return

            if (machineResult.status === 'fulfilled') {
                setMachines(machineResult.value?.items || [])
            }
            if (sessionResult.status === 'fulfilled') {
                setActiveSession(sessionResult.value)
            }
            if (subscriptionResult.status === 'fulfilled') {
                setSubscription(subscriptionResult.value)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [ctx?.token])

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (location.hash !== '#security') return
        document.getElementById('security')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [location.hash])

    const routeLinks = useMemo(() => {
        return machines.slice(0, 3).map((machine, index) => {
            const id = machine?.id || machine?.machine_id
            const country = getCountryData(machine?.region || machine?.location)
            return {
                id: id || machine?.code || index + 1,
                rank: index + 1,
                flag: country.flag,
                flagUrl: country.flagUrl,
                name: country.name,
                code: machine?.code || 'Chưa có mã',
                gpu: machine?.gpu || 'Chưa cấu hình GPU',
                ping: machine?.ping_ms ?? machine?.ping,
                active: activeSession?.machine_id && String(activeSession.machine_id) === String(id),
                href: id ? `/app/wizard?machineId=${id}` : '/app/wizard',
            }
        })
    }, [machines, activeSession])

    const topMachines = useMemo(() => machines.slice(0, 5), [machines])

    useEffect(() => {
        if (topMachines.length <= 1) return undefined
        const timer = window.setInterval(() => {
            setBannerIndex((current) => (current + 1) % topMachines.length)
        }, 5200)
        return () => window.clearInterval(timer)
    }, [topMachines.length])

    const firstMachineId = machines[0]?.id || machines[0]?.machine_id
    const activeMachine = machines.find((machine) => String(machine.id || machine.machine_id) === String(activeSession?.machine_id))
    const safeBannerIndex = topMachines.length ? bannerIndex % topMachines.length : 0
    const bannerMachine = topMachines[safeBannerIndex] || activeMachine || machines[0] || null
    const bannerImage = GPU_BANNER_IMAGES[safeBannerIndex % GPU_BANNER_IMAGES.length]
    const bannerMachineId = bannerMachine?.id || bannerMachine?.machine_id
    const isBannerActiveMachine = Boolean(activeSession?.machine_id && String(activeSession.machine_id) === String(bannerMachineId))
    const currentMachine = activeMachine || bannerMachine || machines[0] || null
    const continueHref = activeSession?.id
        ? `/app/wizard?sessionId=${activeSession.id}&machineId=${activeSession.machine_id || firstMachineId || ''}`
        : firstMachineId
            ? `/app/wizard?machineId=${firstMachineId}`
            : '/app/wizard'
    const chooseMachineHref = firstMachineId ? `/app/wizard?machineId=${firstMachineId}` : '/app/machines'
    const packageName = subscription?.plan?.name || subscription?.plan_name || subscription?.name || 'Chưa có gói'
    const expiry = formatDate(subscription?.end_at || subscription?.end_date || subscription?.expires_at || subscription?.expired_at)
    const subscriptionDesc = subscription ? `Hết hạn ${expiry}` : 'Chưa có gói hoạt động'
    const balance = ctx?.user?.balance ?? 0
    const vpnOnline = Boolean(activeSession?.vpn_online || activeSession?.ip_address)
    const moonlightReady = Boolean(activeSession?.moonlight_ready || activeSession?.sunshine_paired)

    return (
        <div className="gaming-dashboard exact-app-dashboard">
            <section className="gd-hero-grid">
                <div className="gd-hero-card">
                    <span className="gd-kicker">
                        <DashIcon name="gauge" />
                        Trung tâm chơi game cloud
                    </span>
                    <h1>
                        Phiên cloud của bạn <span>đang chạy</span>
                    </h1>
                    <p>
                        Chọn route ping thấp, bật VPN, ghép Moonlight và vào game từ một luồng duy nhất.
                    </p>
                    <div className="gd-actions">
                        <Link className="btn primary" to={continueHref}>
                            <DashIcon name="play" />
                            Tiếp tục phiên
                        </Link>
                        <Link className="btn secondary" to={chooseMachineHref}>
                            <DashIcon name="server" />
                            Chọn máy
                        </Link>
                    </div>
                    <p className="gd-system-line">
                        <span />
                        Hệ thống hoạt động ổn định
                    </p>
                </div>

                <MachineVisual
                    key={bannerMachineId || bannerIndex}
                    activeSession={activeSession}
                    machine={bannerMachine}
                    now={now}
                    bannerIndex={safeBannerIndex}
                    bannerTotal={Math.max(topMachines.length, 1)}
                    isActiveMachine={isBannerActiveMachine}
                    imageSrc={bannerImage}
                />
            </section>

            <section className="gd-status-grid" aria-label="Trạng thái phiên">
                <StatusCard
                    dot={activeSession ? 'online' : 'waiting'}
                    title="Máy cloud"
                    value={currentMachine?.code || 'Chưa chọn'}
                    icon="server"
                    href="/app/machines"
                    ariaLabel="Mở trang chọn máy cloud"
                />
                <StatusCard
                    dot={vpnOnline ? 'online' : 'waiting'}
                    title="VPN"
                    value={vpnOnline ? 'Đã kết nối' : 'Chưa kết nối'}
                    icon="shield"
                    href={continueHref}
                    ariaLabel="Mở trang khởi tạo để kiểm tra VPN"
                />
                <StatusCard
                    dot={moonlightReady ? 'online' : 'waiting'}
                    title="Moonlight"
                    value={moonlightReady ? 'Sẵn sàng' : 'Chờ pairing'}
                    icon="monitor"
                    href={continueHref}
                    ariaLabel="Mở trang khởi tạo để ghép Moonlight"
                />
                <StatusCard
                    dot="online"
                    title="Gói / số dư"
                    value={`${packageName} • ${formatCurrency(balance)}`}
                    icon="credit"
                    href="/app/subscriptions"
                    ariaLabel="Mở trang gói dịch vụ và số dư"
                />
            </section>

            <section className="gd-main-grid">
                <div className="gd-route-panel">
                    <div className="gd-panel-head">
                        <div>
                            <p>Route ping thấp</p>
                            <h2>Máy nên chọn</h2>
                        </div>
                        <Link className="gd-view-all" to="/app/machines">
                            Xem tất cả
                            <DashIcon name="chevron" />
                        </Link>
                    </div>

                    <div className="gd-route-list">
                        {routeLinks.map((machine) => (
                            <div
                                className={['gd-route-row', machine.active ? 'active' : ''].filter(Boolean).join(' ')}
                                key={machine.id}
                            >
                                <span className="gd-rank">#{machine.rank}</span>
                                <span className="gd-flag gd-flag-text">
                                    {machine.flagUrl ? <img src={machine.flagUrl} alt={machine.name} /> : machine.flag}
                                </span>
                                <div className="gd-route-name">
                                    <strong>{machine.name}</strong>
                                    <em>{machine.code}</em>
                                </div>
                                <p className="gd-route-gpu">{machine.gpu}</p>
                                <p className={['gd-ping', getPingTone(machine.ping)].filter(Boolean).join(' ')}>
                                    <DashIcon name="wifi" />
                                    {Number.isFinite(Number(machine.ping)) ? `${machine.ping} ms` : 'Chưa đo'}
                                </p>
                                <Link className="gd-select" to={machine.href}>Chọn</Link>
                            </div>
                        ))}
                        {!routeLinks.length && (
                            <p className="gd-empty-row">Chưa có máy từ hệ thống. Hãy thêm máy trong trang quản trị.</p>
                        )}
                    </div>
                </div>

                <aside className="gd-side-stack">
                    <SidePanel
                        title="Phiên hiện tại"
                        heading="Đang hoạt động"
                        desc="Quay lại trang khởi tạo phiên để tải VPN, kiểm tra kết nối và mở Moonlight."
                        button="Mở khởi tạo"
                        href={continueHref}
                        icon="settings"
                    />
                    <SidePanel
                        title="Dịch vụ"
                        heading={packageName}
                        desc={subscriptionDesc}
                        button="Quản lý gói"
                        href="/app/subscriptions"
                        icon="credit"
                    />
                </aside>
            </section>

            <section className="gd-security" id="security">
                <div className="gd-security-intro">
                    <p>An tâm trải nghiệm</p>
                    <h2>Chính sách & bảo mật</h2>
                    <span>Các lớp bảo vệ cho tài khoản, phiên VPN và cloud rig khi chơi từ xa.</span>
                </div>
                <div className="gd-security-grid">
                    {securityCards.map((card) => (
                        <article className="gd-security-card" key={card.title}>
                            <div className="gd-security-icon">
                                <DashIcon name={card.icon} />
                            </div>
                            <span>{card.tag}</span>
                            <h3>{card.title}</h3>
                            <p>{card.desc}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    )
}

export default Dashboard
