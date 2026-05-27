import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    CheckCircle2,
    Circle,
    Cpu,
    ExternalLink,
    FileText,
    Gamepad2,
    Loader2,
    Lock,
    Moon,
    RefreshCw,
    Rocket,
    Server,
    ShieldCheck,
    Sun,
    Wifi
} from 'lucide-react'
import {
    checkVpnConnection,
    downloadOvpn,
    getActiveSession,
    getMachine,
    listMachines,
    markSunshinePaired,
    startMachine,
    stopSession,
} from '../api/machines'

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
    if (r.includes('singapore') || r.includes('sg')) return { flag: '🇸🇬', code: 'sg', name: 'Singapore', flagUrl: 'https://flagcdn.com/sg.svg' }
    if (
        r.includes('vietnam') || r.includes('việt nam') || r.includes('vn') ||
        r.includes('hanoi') || r.includes('hà nội') || r.includes('hcmc') ||
        r.includes('hồ chí minh') || r.includes('ho chi minh') || r.includes('saigon') || r.includes('sài gòn')
    ) {
        return { flag: '🇻🇳', code: 'vn', name: 'Việt Nam', flagUrl: 'https://flagcdn.com/vn.svg' }
    }
    if (r.includes('japan') || r.includes('nhật') || r.includes('nhat') || r.includes('jp') || r.includes('tokyo')) return { flag: '🇯🇵', code: 'jp', name: 'Japan', flagUrl: 'https://flagcdn.com/jp.svg' }
    if (r.includes('korea') || r.includes('kr') || r.includes('seoul')) return { flag: '🇰🇷', code: 'kr', name: 'Korea', flagUrl: 'https://flagcdn.com/kr.svg' }
    if (r.includes('hong kong') || r.includes('hongkong') || r.includes('hk')) return { flag: '🇭🇰', code: 'hk', name: 'Hong Kong', flagUrl: 'https://flagcdn.com/hk.svg' }
    if (r.includes('usa') || r.includes('us') || r.includes('mỹ') || r.includes('america') || r.includes('san jose')) return { flag: '🇺🇸', code: 'us', name: 'USA', flagUrl: 'https://flagcdn.com/us.svg' }
    if (r.includes('australia') || r.includes('au') || r.includes('sydney')) return { flag: '🇦🇺', code: 'au', name: 'Australia', flagUrl: 'https://flagcdn.com/au.svg' }
    if (r.includes('germany') || r.includes('de') || r.includes('frankfurt')) return { flag: '🇩🇪', code: 'de', name: 'Germany', flagUrl: 'https://flagcdn.com/de.svg' }
    if (r.includes('taiwan') || r.includes('tw') || r.includes('taipei')) return { flag: '🇹🇼', code: 'tw', name: 'Taiwan', flagUrl: 'https://flagcdn.com/tw.svg' }
    if (r.includes('thailand') || r.includes('thai') || r.includes('bangkok')) return { flag: '🇹🇭', code: 'th', name: 'Thailand', flagUrl: 'https://flagcdn.com/th.svg' }
    if (r.includes('united kingdom') || r.includes('uk') || r.includes('london')) return { flag: '🇬🇧', code: 'gb', name: 'United Kingdom', flagUrl: 'https://flagcdn.com/gb.svg' }
    if (r.includes('canada') || r.includes('ca') || r.includes('toronto')) return { flag: '🇨🇦', code: 'ca', name: 'Canada', flagUrl: 'https://flagcdn.com/ca.svg' }
    return { flag: '🌐', code: null, name: region || 'Global', flagUrl: null }
}

const formatDurationFrom = (value) => {
    if (!value) return '--:--:--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--:--:--'
    const totalSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

const formatLogTime = (value) => {
    if (!value) return '--:--:--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--:--:--'
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date)
}

const formatPing = (machine) => {
    const ping = machine?.ping_ms ?? machine?.ping
    return Number.isFinite(Number(ping)) ? `${ping} ms` : 'Chưa đo'
}

const getMachineVisual = (machine, machines) => {
    if (machine?.image_url || machine?.image) return machine.image_url || machine.image
    const machineIndex = machines.findIndex((item) => String(item.id) === String(machine?.id))
    const safeIndex = machineIndex >= 0 ? machineIndex : 0
    return MACHINE_CARD_IMAGES[safeIndex % MACHINE_CARD_IMAGES.length]
}

const getGpuBrand = (gpu) => {
    const value = String(gpu || '').toLowerCase()
    if (value.includes('radeon') || value.includes('rx ')) return 'AMD'
    if (value.includes('intel') || value.includes('arc')) return 'INTEL'
    if (value.includes('rtx') || value.includes('gtx') || value.includes('nvidia')) return 'NVIDIA'
    return ''
}

const cockpitSteps = [
    { key: 'machine', title: 'Cloud rig', label: 'Chọn máy' },
    { key: 'session', title: 'Boot VM', label: 'Khởi động' },
    { key: 'vpn', title: 'VPN route', label: 'Kết nối' },
    { key: 'moonlight', title: 'Moonlight', label: 'Vào chơi' },
]

function HelpModal({ type, session, onClose, onCopyIp, onOpenSunshine, onMarkSunshinePaired, pairingSunshine }) {
    const isPlay = type === 'play'
    const title = isPlay ? 'Moonlight / Sunshine' : 'VPN route'
    const lines = isPlay
        ? [
            'Mở Moonlight trên thiết bị chơi.',
            'Nếu chưa thấy máy, thêm thủ công bằng IP local.',
            'Khi Moonlight hiện PIN, mở Sunshine và nhập PIN đó.',
            'Sau khi pair xong, đánh dấu Sunshine đã ghép pin.',
        ]
        : [
            'Tải file VPN profile của phiên hiện tại.',
            'Import profile vào OpenVPN Connect.',
            'Kết nối VPN rồi quay lại web nhấn VPN đã kết nối.',
            'Sau khi online, IP local sẽ hiện trong cockpit.',
        ]

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
            <div className="modal wizard-help-modal" onMouseDown={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <p className="muted">Hướng dẫn nhanh</p>
                        <h3>{title}</h3>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
                </div>
                <ol className="wizard-help-list">
                    {lines.map((line) => <li key={line}>{line}</li>)}
                </ol>
                {isPlay && (
                    <div className="actions">
                        <button type="button" className="btn secondary" onClick={onCopyIp} disabled={!session?.ip_address}>Copy IP</button>
                        <button type="button" className="btn ghost" onClick={onOpenSunshine} disabled={!session?.ip_address}>Mở Sunshine</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={onMarkSunshinePaired}
                            disabled={!session?.ip_address || session?.sunshine_paired || pairingSunshine}
                        >
                            {pairingSunshine ? 'Đang cập nhật...' : 'Đã ghép Sunshine'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function Wizard({ ctx }) {
    const location = useLocation()
    const navigate = useNavigate()
    const [machine, setMachine] = useState(null)
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [session, setSession] = useState(null)
    const [actionMessage, setActionMessage] = useState('')
    const [activeGuide, setActiveGuide] = useState(null)
    const [booting, setBooting] = useState(false)
    const [stopping, setStopping] = useState(false)
    const [downloadingOvpn, setDownloadingOvpn] = useState(false)
    const [checkingVpn, setCheckingVpn] = useState(false)
    const [pairingSunshine, setPairingSunshine] = useState(false)

    const params = useMemo(() => new URLSearchParams(location.search), [location.search])
    const machineId = params.get('machineId')
    const sessionId = params.get('sessionId')

    useEffect(() => {
        let cancelled = false

        async function load() {
            setError('')
            setLoading(true)
            try {
                let sessionData = null
                const raw = localStorage.getItem('active_session')
                if (raw) {
                    try {
                        sessionData = JSON.parse(raw)
                    } catch {
                        sessionData = null
                    }
                }
                if (!sessionData && ctx?.token) {
                    sessionData = await getActiveSession(ctx.token)
                    if (sessionData) localStorage.setItem('active_session', JSON.stringify(sessionData))
                }

                const machineListData = await listMachines({ page: 1, page_size: 20, sort: 'best' })
                const items = machineListData.items || []
                const resolvedMachineId = machineId || sessionData?.machine_id || items[0]?.id

                if (!cancelled) setMachines(items)
                if (resolvedMachineId) {
                    const data = await getMachine(resolvedMachineId, ctx?.token)
                    if (!cancelled) setMachine(data.machine)
                } else if (!cancelled) {
                    setMachine(null)
                    setError('Chưa chọn máy. Hãy chọn một cloud rig có ping tốt trước khi khởi tạo.')
                }

                if (!cancelled) setSession(sessionData)
            } catch (err) {
                if (!cancelled) setError(err.message || 'Không tải được thông tin phiên')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [machineId, sessionId, ctx?.token])

    const isActiveSession = session?.status === 'active' && !session?.ended_at
    const vpnOnline = Boolean(session?.ip_address)
    const sunshinePaired = Boolean(session?.sunshine_paired)
    const moonlightReady = Boolean(session?.moonlight_ready || (vpnOnline && sunshinePaired))
    const sessionStartedAt = session?.started_at || session?.start_time || session?.created_at
    const sessionDuration = isActiveSession ? formatDurationFrom(sessionStartedAt) : '--:--:--'
    const activeSessionMatchesMachine = Boolean(session?.machine_id && machine?.id && String(session.machine_id) === String(machine.id))
    const currentMachineLabel = isActiveSession && activeSessionMatchesMachine ? 'MÁY ĐANG DÙNG' : machine ? 'MÁY ĐÃ CHỌN' : 'CHƯA CHỌN MÁY'
    const currentMachineState = isActiveSession && activeSessionMatchesMachine ? 'Đang chạy' : machine ? 'Sẵn sàng khởi tạo' : 'Chưa chọn máy'
    const machineVisualSrc = useMemo(() => getMachineVisual(machine, machines), [machine, machines])
    const gpuBrand = getGpuBrand(machine?.gpu)
    const flowState = {
        machine: Boolean(machine),
        session: Boolean(isActiveSession),
        vpn: vpnOnline,
        moonlight: moonlightReady,
    }
    const currentStepIndex = moonlightReady ? 3 : vpnOnline ? 2 : isActiveSession ? 1 : machine ? 0 : -1
    const normalizeError = (err, fallback) => {
        const message = err?.message || fallback
        if (message.toLowerCase().includes('goi dich vu')) {
            return 'Bạn cần mua gói dịch vụ đang hoạt động trước khi khởi động cloud rig.'
        }
        if (message.toLowerCase().includes('phien active')) {
            return 'Bạn đang có một phiên hoạt động. Hãy tiếp tục hoặc dừng phiên hiện tại trước.'
        }
        return message
    }

    const handleBootSession = async () => {
        if (!machine?.id) {
            setError('Chưa chọn máy để khởi động.')
            return
        }

        setError('')
        setActionMessage('')
        setBooting(true)
        try {
            const started = await startMachine(machine.id, ctx?.token)
            setSession(started)
            localStorage.setItem('active_session', JSON.stringify(started))
            setMachine((prev) => prev ? { ...prev, status: 'busy' } : prev)
            setActionMessage('Cloud rig đã boot. Tải VPN profile và kết nối để lấy IP local.')
        } catch (err) {
            setError(normalizeError(err, 'Không thể khởi động cloud rig'))
        } finally {
            setBooting(false)
        }
    }

    const handleDownloadOvpn = async () => {
        if (!session?.id || !isActiveSession) {
            setError('Chưa có phiên active để tải VPN profile.')
            return
        }

        setError('')
        setActionMessage('')
        setDownloadingOvpn(true)
        try {
            const { blob, filename } = await downloadOvpn(session.id, ctx?.token)
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            setActionMessage('Đã tải VPN profile cho phiên hiện tại.')
        } catch (err) {
            setError(err.message || 'Không thể tải VPN profile')
        } finally {
            setDownloadingOvpn(false)
        }
    }

    const handleCheckVpnConnection = async () => {
        if (!session?.id || !isActiveSession) {
            setError('Chưa có phiên active để kiểm tra VPN.')
            return
        }

        setError('')
        setActionMessage('')
        setCheckingVpn(true)
        try {
            const checked = await checkVpnConnection(session.id, ctx?.token)
            setSession(checked)
            localStorage.setItem('active_session', JSON.stringify(checked))
            setActionMessage(`VPN online. IP local: ${checked.ip_address || 'đang cập nhật'}.`)
        } catch (err) {
            setError(err.message || 'Không thể kiểm tra kết nối VPN')
        } finally {
            setCheckingVpn(false)
        }
    }

    const handleCopyIp = async () => {
        if (!session?.ip_address) {
            setError('Chưa có IP local để copy.')
            return
        }

        try {
            await navigator.clipboard.writeText(session.ip_address)
            setError('')
            setActionMessage(`Đã copy IP local: ${session.ip_address}.`)
        } catch {
            setError('Không thể copy tự động. Hãy copy IP local trực tiếp trên màn hình.')
        }
    }

    const handleOpenSunshine = () => {
        if (!session?.ip_address) {
            setError('Chưa có IP local để mở Sunshine.')
            return
        }

        window.open(`https://${session.ip_address}:47990`, '_blank', 'noopener,noreferrer')
        setError('')
        setActionMessage('Đã mở Sunshine. Nếu trình duyệt báo chứng chỉ không tin cậy, hãy tiếp tục theo hướng dẫn.')
    }

    const handleMarkSunshinePaired = async () => {
        if (!session?.id || !vpnOnline) {
            setError('Cần VPN online trước khi đánh dấu Sunshine đã ghép pin.')
            return
        }

        setError('')
        setActionMessage('')
        setPairingSunshine(true)
        try {
            const paired = await markSunshinePaired(session.id, ctx?.token)
            setSession(paired)
            localStorage.setItem('active_session', JSON.stringify(paired))
            setActionMessage('Sunshine đã ghép pin. Phiên đã sẵn sàng chơi qua Moonlight.')
        } catch (err) {
            setError(err.message || 'Không thể cập nhật trạng thái Sunshine')
        } finally {
            setPairingSunshine(false)
        }
    }

    const handleStopSession = async () => {
        if (!session?.id) {
            setError('Chưa có phiên active để dừng.')
            return
        }

        const confirmed = window.confirm('Bạn chắc chắn muốn dừng phiên hiện tại?')
        if (!confirmed) return

        setError('')
        setActionMessage('')
        setStopping(true)
        try {
            const stopped = await stopSession(session.id, ctx?.token)
            localStorage.removeItem('active_session')
            setSession(stopped)
            setMachine((prev) => prev ? { ...prev, status: 'idle' } : prev)
            setActionMessage('Đã dừng phiên. Máy đã được trả về trạng thái trống.')
        } catch (err) {
            setError(err.message || 'Không thể dừng phiên')
        } finally {
            setStopping(false)
        }
    }

    const processRows = [
        { title: 'Boot VM', desc: 'Khởi động máy ảo', time: isActiveSession ? 'OK' : '--:--:--', state: isActiveSession ? 'done' : machine ? 'active' : 'wait' },
        { title: 'VPN routing', desc: 'Kết nối VPN và thiết lập route', time: vpnOnline ? 'OK' : isActiveSession ? 'Đang chờ' : '--:--:--', state: vpnOnline ? 'done' : isActiveSession ? 'active' : 'wait' },
        { title: 'Sunshine pairing', desc: 'Ghép nối Sunshine', time: sunshinePaired ? 'OK' : '--:--:--', state: sunshinePaired ? 'done' : vpnOnline ? 'active' : 'wait' },
        { title: 'Moonlight stream', desc: 'Sẵn sàng vào chơi', time: moonlightReady ? 'OK' : '--:--:--', state: moonlightReady ? 'done' : 'wait' },
    ]
    const logs = [
        { time: formatLogTime(sessionStartedAt), subject: `VM ${machine?.code || 'cloud rig'}`, message: 'khởi động phiên', state: isActiveSession ? 'OK' : 'WAIT' },
        { time: formatLogTime(sessionStartedAt), subject: 'VPN profile', message: 'cấp theo phiên hiện tại', state: isActiveSession ? 'OK' : 'WAIT' },
        { time: formatLogTime(session?.updated_at || sessionStartedAt), subject: 'VPN route', message: 'kiểm tra kết nối', state: vpnOnline ? 'OK' : 'WAIT' },
    ]

    return (
        <div className="session-launcher">
            {activeGuide && (
                <HelpModal
                    type={activeGuide}
                    session={session}
                    pairingSunshine={pairingSunshine}
                    onClose={() => setActiveGuide(null)}
                    onCopyIp={handleCopyIp}
                    onOpenSunshine={handleOpenSunshine}
                    onMarkSunshinePaired={handleMarkSunshinePaired}
                />
            )}

            <section className="sl-hero">
                <div className="sl-cloud-art" aria-hidden="true">
                    <img src="/cloud_3d_launcher.png" alt="Cloud Rig" className="sl-cloud-img" />
                </div>
                <div className="sl-hero-copy">
                    <span className="gd-kicker sl-kicker">Session launcher</span>
                    <h1>Đưa cloud rig vào <span>trạng thái chơi</span></h1>
                    <p>Boot máy, tải VPN profile, xác nhận route và pair Moonlight trong một flow duy nhất.</p>
                    <div className="gd-actions">
                        <button className="btn primary" onClick={handleBootSession} disabled={booting || isActiveSession || !machine}>
                            ▶ {booting ? 'Đang khởi tạo...' : isActiveSession ? 'Phiên đang chạy' : 'Khởi tạo phiên'}
                        </button>
                        <button className="btn ghost" onClick={() => navigate('/app/machines')}>Chọn máy khác</button>
                        {isActiveSession && (
                            <button type="button" className="btn ghost" onClick={handleStopSession} disabled={stopping}>
                                {stopping ? 'Đang dừng...' : 'Dừng phiên'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="sl-current-machine">
                    <div className="sl-panel-head">
                        <strong>{currentMachineLabel}</strong>
                        <span><i className="status-dot" /> {currentMachineState}</span>
                    </div>
                    <div className="sl-current-grid">
                        <div className="sl-gpu-card">
                            <img src={machineVisualSrc} alt={machine?.gpu || 'Cloud rig'} className="sl-gpu-img" />
                        </div>
                        <div className="sl-gpu-details">
                            <div className="sl-gpu-header">
                                <h2>{machine?.gpu || 'Chưa cấu hình GPU'}</h2>
                                {gpuBrand && (
                                    <span className="nvidia-brand">
                                        <span className="nvidia-logo-dot" /> {gpuBrand}
                                    </span>
                                )}
                            </div>
                            <p className="sl-gpu-spec">{machine?.spec || machine?.code || 'Chưa có mô tả cấu hình'}</p>
                            <div className="sl-mini-metrics">
                                <div>
                                    <span>Ping</span>
                                    <strong className="text-green-400">{formatPing(machine)}</strong>
                                </div>
                                <div>
                                    <span>VPN</span>
                                    <strong className="text-cyan-400">{vpnOnline ? 'Online' : 'Chưa kết nối'}</strong>
                                </div>
                                <div>
                                    <span>Moonlight</span>
                                    <strong className="text-cyan-400">{moonlightReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="sl-specs">
                        <div><span>Mã máy</span><strong>{machine?.code || 'Chưa chọn'}</strong></div>
                        <div><span>Khu vực</span><strong>{machine?.location || machine?.region || 'Chưa cấu hình'}</strong></div>
                        <div><span>Trạng thái máy</span><strong>{machine?.status || 'Chưa rõ'}</strong></div>
                        <div><span>Session ID</span><strong>{session?.id ? session.id.slice(0, 8) : '--'}</strong></div>
                        <div><span>IP Local</span><strong>{session?.ip_address || '--'}</strong></div>
                        <div><span>Thời gian chạy</span><strong>{sessionDuration}</strong></div>
                    </div>
                </div>
            </section>

            {error && (
                <div className="alert error wizard-alert">
                    <span>{error}</span>
                    {error.includes('gói dịch vụ') && (
                        <button type="button" className="btn secondary" onClick={() => navigate('/app/subscriptions')}>Xem gói</button>
                    )}
                </div>
            )}
            {actionMessage && <div className="alert success">{actionMessage}</div>}

            <section className="sl-stepper">
                {cockpitSteps.map((step, index) => {
                    const done = flowState[step.key]
                    const active = index === currentStepIndex
                    const locked = index > currentStepIndex
                    return (
                        <div key={step.key} className={`sl-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}>
                            <span className="sl-step-number">{index + 1}</span>
                            <div className="sl-step-info">
                                <strong>{step.title}</strong>
                                <p className={active ? 'text-cyan-300' : ''}>{step.label}</p>
                            </div>
                            <span className="sl-step-status-icon">
                                {done && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                                {active && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
                                {locked && <Lock className="h-5 w-5 text-slate-500" />}
                            </span>
                        </div>
                    )
                })}
            </section>

            <section className="sl-workspace">
                <div className="sl-panel sl-rig-list">
                    <div className="sl-panel-head">
                        <strong>CHỌN MÁY (CLOUD RIG)</strong>
                        <button type="button" className="btn ghost" onClick={() => navigate('/app/machines')}>Tất cả vùng ⌄</button>
                    </div>
                    <div className="sl-rig-options">
                        {loading && <p className="muted">Đang tải danh sách máy...</p>}
                        {!loading && machines.map((rig) => {
                            const country = getCountryData(rig.region || rig.location)
                            const selected = rig.id === machine?.id
                            const ping = rig.ping_ms ?? rig.ping ?? 0
                            return (
                                <button
                                    type="button"
                                    key={rig.id}
                                    className={`sl-rig-option ${selected ? 'selected' : ''}`}
                                    onClick={() => navigate(`/app/wizard?machineId=${rig.id}`)}
                                >
                                    <span>{country.flagUrl ? <img src={country.flagUrl} alt={country.name} /> : country.flag}</span>
                                    <div>
                                        <strong>{country.name} - {rig.code}</strong>
                                        <p>{rig.gpu || 'Chưa cấu hình GPU'} - {rig.status || 'Chưa rõ trạng thái'}</p>
                                    </div>
                                    <em className={ping <= 55 ? 'text-green-400' : ping <= 70 ? 'text-yellow-400' : 'text-red-400'}>
                                    <Wifi className="inline mr-1 h-4 w-4" /> {Number.isFinite(Number(ping)) ? `${ping} ms` : 'Chưa đo'}
                                    </em>
                                    <span className="sl-rig-radio">
                                        {selected ? <CheckCircle2 className="h-5 w-5 text-cyan-300" /> : <Circle className="h-5 w-5 text-slate-600" />}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <button type="button" className="sl-ping-all">
                        <Wifi className="inline mr-2 h-4 w-4" /> Kiểm tra ping tất cả máy <RefreshCw className="inline ml-auto h-4 w-4" />
                    </button>
                </div>

                <div className="sl-panel sl-process">
                    <div className="sl-panel-head">
                        <strong>QUÁ TRÌNH KHỞI TẠO</strong>
                        <span className="sl-live">● Live</span>
                    </div>
                    <div className="sl-process-list">
                        {processRows.map((row) => (
                            <div key={row.title} className={`sl-process-row ${row.state}`}>
                                <span className="sl-process-icon-container">
                                    {row.state === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                                    {row.state === 'active' && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
                                    {row.state === 'wait' && <Circle className="h-5 w-5 text-slate-600" />}
                                </span>
                                <div>
                                    <strong>{row.title}</strong>
                                    <p>{row.desc}</p>
                                </div>
                                <time>{row.time}</time>
                            </div>
                        ))}
                    </div>
                    <div className="sl-console">
                        {logs.map((line) => (
                            <p key={`${line.subject}-${line.message}`}>
                                <span className="log-time">[{line.time}]</span>{' '}
                                <span className="log-highlight">{line.subject}</span> {line.message} ...{' '}
                                <span className={line.state === 'OK' ? 'log-success' : ''}>{line.state}</span>
                            </p>
                        ))}
                    </div>
                </div>

                <div className="sl-right-stack">
                    <div className="sl-panel sl-readiness">
                        <div className="sl-panel-head">
                            <strong>KIỂM TRA SẴN SÀNG</strong>
                        </div>
                        <div className="sl-ready-list">
                            <div className={isActiveSession ? 'ready' : ''}>
                                <span className="sl-ready-icon"><Server className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>VM {isActiveSession ? 'đang chạy' : 'chưa chạy'}</strong>
                                    <p className="sl-ready-desc">{isActiveSession ? 'Máy ảo đã khởi động thành công' : 'Chưa có phiên active'}</p>
                                </div>
                                <em className={`sl-ready-status ${isActiveSession ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {isActiveSession ? 'Sẵn sàng' : 'Chờ xử lý'}
                                    {isActiveSession ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={vpnOnline ? 'ready' : isActiveSession ? 'active' : ''}>
                                <span className="sl-ready-icon"><ShieldCheck className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>VPN {vpnOnline ? 'online' : 'chưa online'}</strong>
                                    <p className="sl-ready-desc">{vpnOnline ? 'Đã kết nối VPN thành công' : 'Đang kết nối VPN...'}</p>
                                </div>
                                <em className={`sl-ready-status ${vpnOnline ? 'text-emerald-400' : isActiveSession ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {vpnOnline ? 'Sẵn sàng' : isActiveSession ? 'Đang kết nối' : 'Chờ xử lý'}
                                    {vpnOnline ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : isActiveSession ? <Loader2 className="h-4 w-4 animate-spin inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={sunshinePaired ? 'ready' : vpnOnline ? 'active' : ''}>
                                <span className="sl-ready-icon"><Sun className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>Sunshine {sunshinePaired ? 'đã pairing' : 'chờ pairing'}</strong>
                                    <p className="sl-ready-desc">{sunshinePaired ? 'Thiết bị đã được ghép nối' : 'Chờ ghép nối Sunshine'}</p>
                                </div>
                                <em className={`sl-ready-status ${sunshinePaired ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {sunshinePaired ? 'Sẵn sàng' : 'Chờ xử lý'}
                                    {sunshinePaired ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={moonlightReady ? 'ready' : ''}>
                                <span className="sl-ready-icon"><Moon className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>Moonlight {moonlightReady ? 'sẵn sàng' : 'chưa sẵn sàng'}</strong>
                                    <p className="sl-ready-desc">{moonlightReady ? 'Sẵn sàng truyền phát game' : 'Chưa thể stream'}</p>
                                </div>
                                <em className={`sl-ready-status ${moonlightReady ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {moonlightReady ? 'Sẵn sàng' : 'Chờ xử lý'}
                                    {moonlightReady ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                        </div>
                    </div>

                    <div className="sl-panel sl-next-card">
                        <div>
                            <p className="sl-next-kicker">TIẾP THEO</p>
                            <h3>{vpnOnline ? 'Mở Moonlight' : 'Kết nối VPN'}</h3>
                            <span>{vpnOnline ? 'Mở Sunshine để pair thiết bị rồi vào Moonlight.' : 'Tải VPN profile, import vào OpenVPN và quay lại xác nhận.'}</span>
                            <div className="gd-actions">
                                {!vpnOnline && (
                                    <>
                                        <button type="button" className="btn secondary" onClick={handleDownloadOvpn} disabled={!isActiveSession || downloadingOvpn}>
                                            {downloadingOvpn ? 'Đang tải...' : 'Tải VPN'}
                                        </button>
                                        <button type="button" className="btn primary" onClick={handleCheckVpnConnection} disabled={!isActiveSession || checkingVpn}>
                                            {checkingVpn ? 'Đang kiểm tra...' : 'VPN đã kết nối'}
                                        </button>
                                    </>
                                )}
                                {vpnOnline && (
                                    <>
                                        <button type="button" className="btn primary outline-violet" onClick={() => setActiveGuide('play')}>
                                            Mở Moonlight <ExternalLink className="h-4 w-4 inline ml-1" />
                                        </button>
                                        {!sunshinePaired && (
                                            <button type="button" className="btn secondary" onClick={handleMarkSunshinePaired} disabled={pairingSunshine}>
                                                {pairingSunshine ? 'Đang cập nhật...' : 'Đã ghép Sunshine'}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="sl-lock-container">
                            <img src="/lock_3d_neon.png" alt="Lock" className="sl-lock-img" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="sl-tech-flow">
                <div className="sl-flow-container">
                    <div className="sl-flow-head">
                        <p className="sl-tech-title">LUỒNG KỸ THUẬT</p>
                        <span>5 bước để máy sẵn sàng stream</span>
                    </div>
                    <div className="sl-flow-items">
                        <div className="sl-flow-item purple">
                            <em>01</em>
                            <span className="sl-flow-icon"><Rocket className="h-5 w-5" /></span>
                            <div className="sl-flow-text">
                                <strong>Boot VM</strong>
                                <p>Khởi động máy ảo</p>
                            </div>
                        </div>
                        <div className="sl-flow-item blue">
                            <em>02</em>
                            <span className="sl-flow-icon"><FileText className="h-5 w-5" /></span>
                            <div className="sl-flow-text">
                                <strong>VPN profile</strong>
                                <p>Tải và import profile</p>
                            </div>
                        </div>
                        <div className="sl-flow-item green">
                            <em>03</em>
                            <span className="sl-flow-icon"><ShieldCheck className="h-5 w-5" /></span>
                            <div className="sl-flow-text">
                                <strong>VPN check</strong>
                                <p>Kiểm tra kết nối</p>
                            </div>
                        </div>
                        <div className="sl-flow-item yellow">
                            <em>04</em>
                            <span className="sl-flow-icon"><Sun className="h-5 w-5" /></span>
                            <div className="sl-flow-text">
                                <strong>Sunshine pair</strong>
                                <p>Ghép nối Sunshine</p>
                            </div>
                        </div>
                        <div className="sl-flow-item purple">
                            <em>05</em>
                            <span className="sl-flow-icon"><Gamepad2 className="h-5 w-5" /></span>
                            <div className="sl-flow-text">
                                <strong>Moonlight stream</strong>
                                <p>Bắt đầu stream</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="sl-note">
                    <p className="sl-next-kicker">LƯU Ý PHIÊN</p>
                    <h3>Giữ kết nối ổn định</h3>
                    <p>Giữ ứng dụng chạy nền để duy trì phiên ổn định.</p>
                </div>
            </section>
        </div>
    )
}

export default Wizard
