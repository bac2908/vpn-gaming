import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMachines, getMachine, startMachine, resumeMachine } from '../api/machines'

const MACHINE_CARD_IMAGES = [
    '/gpu-banner-1.png',
    '/gpu-banner-2.png',
    '/gpu-banner-3.png',
    '/gpu-banner-4.png',
    '/gpu-banner-5.png',
    '/vpn_image_1.png',
    '/vpn_image_2.png',
    '/vpn_image_3.png',
    '/vpn_image_4.png',
    '/vpn_image_5.png',
    '/vpn_image_6.png',
    '/vpn_image_7.png',
    '/vpn_image_8.png',
    '/vpn_image_9.png',
    '/vpn_image_10.png',
    '/vpn_image_11.png',
    '/vpn_image_12.png',
    '/vpn_image_13.png',
    '/vpn_image_14.png',
    '/vpn_image_15.png',
]

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

const normalizeMachineActionError = (err, fallback) => {
    const message = err?.message || fallback
    const lower = message.toLowerCase()
    if (lower.includes('so du')) return 'Số dư không đủ để chơi phút tiếp theo. Vui lòng nạp thêm tiền.'
    if (lower.includes('membership')) return message
    if (message.toLowerCase().includes('goi dich vu')) {
        return 'Membership chỉ là quyền lợi giảm giá; bạn vẫn có thể chơi bằng số dư ví.'
    }
    if (message.toLowerCase().includes('phien active')) {
        return 'Bạn đang có một phiên hoạt động. Hãy tiếp tục hoặc dừng phiên hiện tại trước khi mở máy mới.'
    }
    return message
}

const formatDateTime = (value) => {
    if (!value) return 'Chưa có dữ liệu'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Không hợp lệ'
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}

const formatSessionDuration = (session) => {
    const start = session?.started_at ? new Date(session.started_at) : null
    const end = session?.ended_at ? new Date(session.ended_at) : new Date()
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Chưa rõ'

    const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours <= 0) return `${minutes} phút`
    return `${hours} giờ ${minutes} phút`
}

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(Number(amount || 0)) + 'đ'
const formatRate = (rate) => `${formatCurrency(rate)}/phút`
const formatHourly = (amount) => `${formatCurrency(amount)}/giờ`
const getStartLabel = (machine, isIdle) => {
    if (!isIdle) return 'Máy đang bận'
    if (machine.can_start) return 'Khởi tạo máy này'
    const reason = String(machine.access_reason || '').toLowerCase()
    if (reason.includes('so du')) return 'Nạp tiền để chơi'
    if (reason.includes('cooldown')) return 'Đang cooldown'
    return 'Nạp tiền để chơi'
}

const getStatusView = (status) => {
    if (status === 'idle') return { label: 'Trống', tone: 'success' }
    if (status === 'busy' || status === 'running') return { label: 'Đang chạy', tone: 'warning' }
    if (status === 'suspended') return { label: 'Cooldown', tone: 'warning' }
    if (status === 'maintenance') return { label: 'Bảo trì', tone: 'danger' }
    if (status === 'offline') return { label: 'Offline', tone: 'danger' }
    return { label: status || 'Chưa rõ', tone: 'muted' }
}

const getPingView = (ping) => {
    const value = Number(ping)
    if (!Number.isFinite(value) || value <= 0) return { label: 'Chưa đo', tone: 'muted' }
    if (value < 30) return { label: 'Cực nhanh', tone: 'success' }
    if (value <= 80) return { label: 'Khá tốt', tone: 'warning' }
    return { label: 'Chậm', tone: 'danger' }
}

function Machines({ ctx }) {
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(12)
    const [total, setTotal] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)
    const [filters, setFilters] = useState({
        region: '',
        gpu: '',
        minPing: '',
        maxPing: '',
        sort: 'best',
        status: 'idle',
    })
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    const [detail, setDetail] = useState(null)
    const [detailVisual, setDetailVisual] = useState(MACHINE_CARD_IMAGES[0])
    const token = ctx?.token

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                setLoading(true)
                setError('')
                const minPing = filters.minPing === '' ? undefined : Number(filters.minPing)
                const maxPing = filters.maxPing === '' ? undefined : Number(filters.maxPing)
                if (Number.isFinite(minPing) && Number.isFinite(maxPing) && minPing > maxPing) {
                    if (!cancelled) {
                        setError('Ping từ không được lớn hơn Ping đến.')
                        setMachines([])
                        setTotal(0)
                    }
                    return
                }

                const data = await listMachines({
                    page,
                    page_size: pageSize,
                    region: filters.region,
                    gpu: filters.gpu,
                    status: filters.status || undefined,
                    min_ping: Number.isFinite(minPing) ? minPing : undefined,
                    max_ping: Number.isFinite(maxPing) ? maxPing : undefined,
                    sort: filters.sort,
                }, token)
                if (!cancelled) {
                    setMachines(data.items || [])
                    setTotal(data.total || 0)
                }
            } catch (err) {
                console.error('Load machines failed', err)
                if (!cancelled) {
                    setError(err.message || 'Không tải được danh sách máy')
                    setMachines([])
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [page, pageSize, filters, refreshKey, token])

    const display = machines
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const navigate = useNavigate()
    const hasActiveFilters = Boolean(
        filters.region ||
        filters.gpu ||
        filters.minPing ||
        filters.maxPing ||
        filters.status !== 'idle' ||
        filters.sort !== 'best' ||
        pageSize !== 12
    )

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
        setPage(1)
    }

    const resetFilters = () => {
        setFilters({
            region: '',
            gpu: '',
            minPing: '',
            maxPing: '',
            sort: 'best',
            status: 'idle',
        })
        setPageSize(12)
        setPage(1)
    }

    const handleStart = async (machineId) => {
        try {
            setError('')
            const session = await startMachine(machineId, token)
            localStorage.setItem('active_session', JSON.stringify(session))
            navigate(`/app/wizard?sessionId=${session.id}&machineId=${session.machine_id}`)
            setRefreshKey((v) => v + 1)
        } catch (err) {
            setError(normalizeMachineActionError(err, 'Không thể bắt đầu phiên'))
        }
    }

    const handleResume = async (machineId) => {
        try {
            setError('')
            const session = await resumeMachine(machineId, token)
            localStorage.setItem('active_session', JSON.stringify(session))
            navigate(`/app/wizard?sessionId=${session.id}&machineId=${session.machine_id}`)
            setRefreshKey((v) => v + 1)
        } catch (err) {
            setError(normalizeMachineActionError(err, 'Không thể tiếp tục snapshot'))
        }
    }

    const handleDetail = async (machineId, visualSrc = MACHINE_CARD_IMAGES[0]) => {
        setDetailError('')
        setDetailLoading(true)
        setDetailOpen(true)
        setDetailVisual(visualSrc)
        try {
            const data = await getMachine(machineId, token)
            setDetail(data)
        } catch (err) {
            setDetailError(err.message || 'Không tải được chi tiết máy')
        } finally {
            setDetailLoading(false)
        }
    }

    return (
        <div className="stack machines-page">
            <div className="section-head">
                <div>
                    <p className="muted">Chọn máy cloud phù hợp</p>
                    <h2>Máy chơi game</h2>
                </div>
                <div className="actions">
                    <a className="btn ghost" href="/app/history">
                        Lịch sử
                    </a>
                    <a className="btn primary" href="/app/wizard">
                        Khởi tạo nhanh
                    </a>
                </div>
            </div>

            <div className="card filters machine-filter-panel">
                <div className="machine-filter-head">
                    <div>
                        <p className="muted">Bộ lọc máy</p>
                        <h4>Ưu tiên ping thấp và máy đang trống</h4>
                    </div>
                    <div className="machine-filter-meta">
                        <span className="pill ghost">{total} máy</span>
                        <button type="button" className="btn ghost" onClick={resetFilters} disabled={!hasActiveFilters}>
                            Đặt lại
                        </button>
                    </div>
                </div>
                <div className="filter-grid">
                    <label className="field">
                        Khu vực
                        <input
                            placeholder="VD: Việt Nam"
                            value={filters.region}
                            onChange={(e) => updateFilter('region', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        Card đồ họa
                        <input
                            placeholder="VD: RTX 4080"
                            value={filters.gpu}
                            onChange={(e) => updateFilter('gpu', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        Ping từ
                        <input
                            type="number"
                            min="0"
                            max={filters.maxPing || undefined}
                            placeholder="VD: 20"
                            value={filters.minPing}
                            onChange={(e) => updateFilter('minPing', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        Ping đến
                        <input
                            type="number"
                            min={filters.minPing || '0'}
                            placeholder="VD: 50"
                            value={filters.maxPing}
                            onChange={(e) => updateFilter('maxPing', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        Trạng thái
                        <select
                            value={filters.status}
                            onChange={(e) => updateFilter('status', e.target.value)}
                        >
                            <option value="idle">Chỉ máy trống</option>
                            <option value="">Tất cả</option>
                        </select>
                    </label>
                    <label className="field">
                        Sắp xếp
                        <select
                            value={filters.sort}
                            onChange={(e) => updateFilter('sort', e.target.value)}
                        >
                            <option value="best">Tốt nhất</option>
                            <option value="ping">Ping thấp</option>
                        </select>
                    </label>
                    <label className="field">
                        Hiển thị
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value))
                                setPage(1)
                            }}
                        >
                            <option value={8}>8</option>
                            <option value={12}>12</option>
                            <option value={16}>16</option>
                        </select>
                    </label>
                </div>
            </div>

            {error && (
                <div className="alert error machine-action-alert">
                    <span>{error}</span>
                    {error.includes('gói dịch vụ') && (
                        <button type="button" className="btn secondary" onClick={() => navigate('/app/subscriptions')}>
                            Xem gói dịch vụ
                        </button>
                    )}
                </div>
            )}

            <div className="grid grid-3">
                {loading && <p className="muted">Đang tải danh sách máy...</p>}
                {!loading && !display.length && (
                    <div className="card border">
                        <p className="muted">Chưa có máy nào từ hệ thống.</p>
                    </div>
                )}
                {!loading && display.map((m, machineIndex) => {
                    const globalMachineIndex = (page - 1) * pageSize + machineIndex
                    const visualSrc = MACHINE_CARD_IMAGES[globalMachineIndex % MACHINE_CARD_IMAGES.length]
                    const country = getCountryData(m.region)
                    const isIdle = m.status === 'idle'
                    const statusView = getStatusView(m.status)
                    const ping = m.ping_ms ?? m.ping ?? 0
                    const rate = Number(m.play_rate_per_minute || 0)
                    const standardRate = Number(m.standard_rate_per_minute ?? m.base_rate_per_minute ?? rate)
                    const discountPercent = Number(m.discount_percent || 0)
                    const trialRemaining = Number(m.trial_minutes_remaining || 0)
                    const hasTrialQuota = Boolean(m.trial_eligible && trialRemaining > 0)
                    const hourly = Number(m.hourly_estimate || rate * 60)
                    const needsTopup = Boolean(m.access_allowed && !m.can_start && String(m.access_reason || '').toLowerCase().includes('so du'))
                    const primaryActionIsResume = Boolean(m.can_resume)
                    const startDisabled = !isIdle || (!m.can_start && !needsTopup)
                    const startLabel = needsTopup
                        ? getStartLabel(m, isIdle)
                        : primaryActionIsResume
                            ? 'Resume Snapshot'
                            : '⚡ Start Now'

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
                            <div className="machine-card-visual-wrapper">
                                <img className="machine-banner-image" src={visualSrc} alt="" />
                                {m.trial_eligible && (
                                    <div className="machine-trial-badge">
                                        <strong>FREE TRIAL</strong>
                                        <span>{m.trial_daily_minutes || 15} phút/ngày</span>
                                    </div>
                                )}

                                <div className="machine-floating-flag" title={country.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {country.flagUrl ? (
                                        <img
                                            src={country.flagUrl}
                                            alt={country.name}
                                            style={{ inlineSize: '20px', blockSize: '14px', objectFit: 'cover', borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                                        />
                                    ) : (
                                        <span className="flag-icon" style={{ display: 'inline-block', verticalAlign: 'middle' }}>{country.flag}</span>
                                    )}
                                    <span className="flag-label">{country.name}</span>
                                </div>

                                <div className={`machine-floating-status ${isIdle ? 'idle' : 'busy'}`}>
                                    {isIdle && <span className="pulsing-dot" />}
                                    <span>{isIdle ? 'Trống' : statusView.label}</span>
                                </div>
                            </div>

                            <div className="machine-card-content">
                                <div className="machine-card-title-row">
                                    <h3 className="machine-name">{m.location || m.name || m.code}</h3>
                                    <span className="machine-code-pill">{m.code || m.id?.slice(0, 8)}</span>
                                </div>

                                <div className="machine-gpu-box">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="gpu-icon">
                                        <rect x="2" y="2" width="20" height="20" rx="4" />
                                        <path d="M6 12h12" />
                                        <path d="M12 6v12" />
                                    </svg>
                                    <span className="gpu-label">{m.spec || m.gpu || 'Core i7 · RAM 16GB'}</span>
                                </div>

                                <div className="machine-network-row">
                                    <span className="network-label">Độ trễ</span>
                                    <div className={`ping-indicator-pill ${pingClass}`}>
                                        <span className="ping-dot" />
                                        <span className="ping-val">{ping > 0 ? `${ping} ms` : '? ms'}</span>
                                        <span className="ping-txt">({pingLabel})</span>
                                    </div>
                                </div>
                                <div className="machine-network-row">
                                    <span className="network-label">PAYG</span>
                                    <div className="ping-indicator-pill ping-mid" title={formatHourly(hourly)}>
                                        <span className="ping-dot" />
                                        <span className="ping-val">{formatRate(rate)}</span>
                                        <span className="ping-txt">{`≈ ${formatHourly(hourly)}`}</span>
                                    </div>
                                </div>
                                <div className="machine-network-row">
                                    <span className="network-label">Giá gốc</span>
                                    <div className="ping-indicator-pill ping-low" title={m.access_reason || ''}>
                                        <span className="ping-dot" />
                                        <span className="ping-val">{formatRate(standardRate)}</span>
                                        <span className="ping-txt">
                                            {discountPercent > 0 ? `-${discountPercent}%` : (m.membership_tier || m.billing_tier || 'free')}
                                        </span>
                                    </div>
                                </div>
                                {m.trial_eligible && (
                                    <div className="machine-network-row">
                                        <span className="network-label">Trial</span>
                                        <div className="ping-indicator-pill ping-low">
                                            <span className="ping-dot" />
                                            <span className="ping-val">{hasTrialQuota ? `${trialRemaining} phút free` : 'Đã hết hôm nay'}</span>
                                            <span className="ping-txt">({m.trial_daily_minutes || 15}p/ngày)</span>
                                        </div>
                                    </div>
                                )}
                                <div className="machine-network-row">
                                    <span className="network-label">Ước tính</span>
                                    <div className="ping-indicator-pill ping-low" title={m.access_reason || ''}>
                                        <span className="ping-dot" />
                                        <span className="ping-val">{Number.isFinite(Number(m.estimated_minutes)) ? `${m.estimated_minutes} phút` : '--'}</span>
                                        <span className="ping-txt">(ví + trial)</span>
                                    </div>
                                </div>
                                {m.access_reason && (
                                    <p className="muted small" title={m.access_reason}>{m.access_reason}</p>
                                )}
                            </div>

                            <div className="machine-card-actions">
                                <button
                                    className="btn primary action-start"
                                    onClick={() => {
                                        if (needsTopup) {
                                            ctx?.openTopup?.()
                                            return
                                        }
                                        if (primaryActionIsResume) {
                                            handleResume(m.id)
                                            return
                                        }
                                        handleStart(m.id)
                                    }}
                                    disabled={startDisabled}
                                    title={m.access_reason || ''}
                                >
                                    {startLabel}
                                </button>
                                <button className="btn ghost action-detail" onClick={() => handleDetail(m.id, visualSrc)}>
                                    Chi tiết
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {detailOpen && (
                <div
                    className="modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setDetailOpen(false)
                        }
                    }}
                >
                    <div className="modal machine-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Chi tiết máy</h3>
                            <button className="modal-close" onClick={() => setDetailOpen(false)} aria-label="Đóng">×</button>
                        </div>
                        {detailLoading && <p className="muted">Đang tải...</p>}
                        {!detailLoading && detailError && <div className="alert error">{detailError}</div>}
                        {!detailLoading && !detailError && detail?.machine && (() => {
                            const machine = detail.machine
                            const country = getCountryData(machine.region || machine.location)
                            const statusView = getStatusView(machine.status)
                            const ping = machine.ping_ms ?? machine.ping
                            const pingView = getPingView(ping)
                            const isIdle = machine.status === 'idle'
                            const activeSession = detail.active_session
                            const lastSession = detail.last_session

                            return (
                                <div className="machine-detail-content">
                                    <div className="machine-detail-hero">
                                        <img src={detailVisual} alt="" />
                                        <div className="machine-detail-hero-overlay">
                                            <span className={`machine-detail-status ${statusView.tone}`}>{statusView.label}</span>
                                            <div>
                                                <p>{country.name}</p>
                                                <h2>{machine.location || machine.region || machine.code}</h2>
                                                <span>{machine.gpu || 'Chưa cấu hình GPU'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="machine-detail-stats">
                                        <div>
                                            <span>Mã máy</span>
                                            <strong>{machine.code || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <span>Ping</span>
                                            <strong className={`detail-tone ${pingView.tone}`}>{Number.isFinite(Number(ping)) ? `${ping} ms` : pingView.label}</strong>
                                            <em>{pingView.label}</em>
                                        </div>
                                        <div>
                                            <span>Khu vực</span>
                                            <strong>{country.name}</strong>
                                            <em>{machine.region || machine.location || 'Global'}</em>
                                        </div>
                                        <div>
                                            <span>PAYG</span>
                                            <strong>{formatRate(machine.play_rate_per_minute || machine.base_rate_per_minute || 0)}</strong>
                                            <em>{machine.discount_percent ? `Giảm ${machine.discount_percent}%` : 'Standard'}</em>
                                        </div>
                                    </div>

                                    <div className="machine-detail-grid">
                                        <section className="machine-detail-panel">
                                            <div className="machine-detail-panel-head">
                                                <p>Thông số vận hành</p>
                                                <span className={`machine-detail-status ${statusView.tone}`}>{statusView.label}</span>
                                            </div>
                                            <dl className="machine-detail-list">
                                                <div>
                                                    <dt>GPU</dt>
                                                    <dd>{machine.gpu || 'Chưa cấu hình'}</dd>
                                                </div>
                                                <div>
                                                    <dt>ID hệ thống</dt>
                                                    <dd title={machine.id}>{String(machine.id || 'N/A').slice(0, 18)}...</dd>
                                                </div>
                                                <div>
                                                    <dt>Trạng thái chọn</dt>
                                                    <dd>{isIdle ? 'Có thể khởi tạo ngay' : 'Tạm thời chưa thể chọn'}</dd>
                                                </div>
                                            </dl>
                                        </section>

                                        <section className="machine-detail-panel">
                                            <div className="machine-detail-panel-head">
                                                <p>Phiên đang chạy</p>
                                                <span className={`machine-detail-status ${activeSession ? 'success' : 'muted'}`}>
                                                    {activeSession ? 'Đang có phiên' : 'Không có'}
                                                </span>
                                            </div>
                                            {activeSession ? (
                                                <dl className="machine-detail-list">
                                                    <div>
                                                        <dt>Bắt đầu</dt>
                                                        <dd>{formatDateTime(activeSession.started_at)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Thời lượng</dt>
                                                        <dd>{formatSessionDuration(activeSession)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>VPN / Moonlight</dt>
                                                        <dd>{activeSession.vpn_online ? 'VPN online' : 'VPN chưa online'} · {activeSession.moonlight_ready || activeSession.sunshine_paired ? 'Moonlight sẵn sàng' : 'Chờ pairing'}</dd>
                                                    </div>
                                                </dl>
                                            ) : (
                                                <p className="muted">Máy chưa có phiên active. Nếu máy đang trống, bạn có thể khởi tạo ngay.</p>
                                            )}
                                        </section>
                                    </div>

                                    <section className="machine-detail-panel">
                                        <div className="machine-detail-panel-head">
                                            <p>Snapshot gần nhất của bạn</p>
                                            <span className={`machine-detail-status ${lastSession ? 'success' : 'muted'}`}>
                                                {lastSession ? 'Có thể tiếp tục' : 'Chưa có'}
                                            </span>
                                        </div>
                                        {lastSession ? (
                                            <dl className="machine-detail-list two-col">
                                                <div>
                                                    <dt>Bắt đầu</dt>
                                                    <dd>{formatDateTime(lastSession.started_at)}</dd>
                                                </div>
                                                <div>
                                                    <dt>Kết thúc</dt>
                                                    <dd>{formatDateTime(lastSession.ended_at)}</dd>
                                                </div>
                                                <div>
                                                    <dt>Thời lượng</dt>
                                                    <dd>{formatSessionDuration(lastSession)}</dd>
                                                </div>
                                                <div>
                                                    <dt>IP VPN</dt>
                                                    <dd>{lastSession.ip_address || 'Chưa ghi nhận'}</dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <p className="muted">Bạn chưa có snapshot trên máy này. Hãy khởi tạo phiên mới để bắt đầu.</p>
                                        )}
                                    </section>

                                    <div className="machine-detail-actions">
                                        <button className="btn primary" onClick={() => handleStart(machine.id)} disabled={!isIdle}>
                                            Khởi tạo máy này
                                        </button>
                                        {lastSession && (
                                            <button className="btn secondary" onClick={() => handleResume(machine.id)} disabled={!isIdle}>
                                                Tiếp tục snapshot
                                            </button>
                                        )}
                                        <button className="btn ghost" onClick={() => setDetailOpen(false)}>
                                            Đóng
                                        </button>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}

            <div className="pagination">
                <div className="muted">
                    Tổng {total} máy · Trang {page}/{totalPages}
                </div>
                <div className="actions">
                    <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Trước
                    </button>
                    <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Sau
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Machines
