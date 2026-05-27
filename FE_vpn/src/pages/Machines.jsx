import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMachines, getMachine, startMachine, resumeMachine } from '../api/machines'
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
    if (message.toLowerCase().includes('goi dich vu')) {
        return 'Bạn cần mua gói dịch vụ đang hoạt động trước khi khởi tạo phiên chơi.'
    }
    if (message.toLowerCase().includes('phien active')) {
        return 'Bạn đang có một phiên hoạt động. Hãy tiếp tục hoặc dừng phiên hiện tại trước khi mở máy mới.'
    }
    return message
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
                })
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
    }, [page, pageSize, filters, refreshKey])

    const display = machines
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const token = ctx?.token
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

    const handleDetail = async (machineId) => {
        setDetailError('')
        setDetailLoading(true)
        setDetailOpen(true)
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
        <div className="stack">
            <div className="section-head">
                <div>
                    <p className="muted">Máy & phiên của bạn</p>
                    <h2>Quản lý máy</h2>
                </div>
                <div className="actions">
                    <a className="btn ghost" href="/app/history">
                        Lịch sử
                    </a>
                    <a className="btn primary" href="/app/wizard">
                        Khởi tạo phiên
                    </a>
                </div>
            </div>

            <div className="card filters machine-filter-panel">
                <div className="machine-filter-head">
                    <div>
                        <p className="muted">Bộ lọc</p>
                        <h4>Tìm máy phù hợp</h4>
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
                        Region
                        <input
                            placeholder="VD: Singapore"
                            value={filters.region}
                            onChange={(e) => updateFilter('region', e.target.value)}
                        />
                    </label>
                    <label className="field">
                        GPU
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
                {!loading && display.map((m) => {
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
                                    <h3 className="machine-name">{m.location || m.name || m.code}</h3>
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
                            <div className="machine-card-actions">
                                <button
                                    className="btn primary action-start"
                                    onClick={() => handleStart(m.id)}
                                    disabled={!isIdle}
                                >
                                    🎮 Bắt đầu
                                </button>
                                <button
                                    className="btn secondary action-resume"
                                    onClick={() => handleResume(m.id)}
                                    disabled={!isIdle}
                                >
                                    💾 Tiếp tục snapshot
                                </button>
                                <button className="btn ghost action-detail" onClick={() => handleDetail(m.id)}>
                                    ℹ️ Chi tiết
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {detailOpen && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Chi tiết máy</h3>
                            <button className="btn ghost" onClick={() => setDetailOpen(false)}>Đóng</button>
                        </div>
                        {detailLoading && <p className="muted">Đang tải...</p>}
                        {!detailLoading && detailError && <div className="alert error">{detailError}</div>}
                        {!detailLoading && !detailError && detail?.machine && (
                            <div className="stack">
                                <div className="row-between">
                                    <div>
                                        <p className="muted">Region</p>
                                        <h4>{detail.machine.region || 'N/A'}</h4>
                                    </div>
                                    <span className={`badge ${detail.machine.status === 'idle' ? 'success' : 'warning'}`}>
                                        {detail.machine.status === 'idle' ? 'Trống' : 'Đang bận'}
                                    </span>
                                </div>
                                <div className="row-between">
                                    <span className="muted">GPU</span>
                                    <span>{detail.machine.gpu || 'N/A'}</span>
                                </div>
                                <div className="row-between">
                                    <span className="muted">Ping</span>
                                    <span>{detail.machine.ping_ms ?? '?'} ms</span>
                                </div>
                                <div className="row-between">
                                    <span className="muted">Code</span>
                                    <span>{detail.machine.code}</span>
                                </div>
                                <div className="card info">
                                    <p className="muted"><strong>Phiên gần nhất của bạn</strong></p>
                                    {detail.last_session ? (
                                        <div className="stack">
                                            <div className="row-between">
                                                <span className="muted">Bắt đầu</span>
                                                <span>{detail.last_session.started_at || 'N/A'}</span>
                                            </div>
                                            <div className="row-between">
                                                <span className="muted">Kết thúc</span>
                                                <span>{detail.last_session.ended_at || 'N/A'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="muted">Chưa có snapshot.</p>
                                    )}
                                </div>
                            </div>
                        )}
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
