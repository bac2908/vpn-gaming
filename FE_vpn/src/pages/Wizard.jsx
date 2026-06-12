import { useEffect, useMemo, useRef, useState } from 'react'
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
    heartbeatSession,
    listMachines,
    markSunshinePaired,
    startMachine,
    stopSession,
} from '../api/machines'
import { CLIENT_TOOL_LINKS, CLIENT_TOOL_STEPS, SUNSHINE_HOST_NOTE } from '../utils/clientTools'

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

const MAX_VISIBLE_PLAY_SECONDS = 36 * 60 * 60

const getElapsedSecondsFrom = (value, currentTime = Date.now()) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return Math.max(0, Math.floor((currentTime - date.getTime()) / 1000))
}

const formatDurationFrom = (value, options = {}) => {
    const currentTime = Number.isFinite(options.now) ? options.now : Date.now()
    const totalSeconds = getElapsedSecondsFrom(value, currentTime)
    if (totalSeconds === null) return '--:--:--'
    if (options.maxSeconds && totalSeconds > options.maxSeconds) {
        return options.staleLabel || '--:--:--'
    }
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

const formatDurationBetween = (startValue, endValue) => {
    if (!startValue || !endValue) return '--:--:--'
    const start = new Date(startValue)
    const end = new Date(endValue)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '--:--:--'
    const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
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

const formatDateTime = (value) => {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--'
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date)
}

const formatPing = (machine) => {
    const ping = machine?.ping_ms ?? machine?.ping
    return Number.isFinite(Number(ping)) ? `${ping} ms` : 'Chưa đo'
}

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(Number(amount || 0)) + 'đ'
const formatRate = (amount) => `${formatCurrency(amount)}/phút`

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

const initialLaunchFlow = {
    machine: 'wait',
    session: 'wait',
    vpn: 'wait',
    moonlight: 'wait',
}

function HelpModal({ type, session, onClose, onCopyIp, onOpenSunshine, onMarkSunshinePaired, pairingSunshine }) {
    const isPlay = type === 'play'
    const title = isPlay ? 'Pair Moonlight / Sunshine' : 'VPN route'
    const lines = isPlay
        ? [
            'Copy IP local của Gaming VM.',
            'Nếu chưa có Moonlight, tải và cài Moonlight trên thiết bị chơi trước.',
            'Mở app Moonlight, chọn Add PC và nhập IP local.',
            'Khi Moonlight hiện PIN, mở Sunshine Web và nhập PIN đó.',
            'Sau khi pair thành công, quay lại web bấm Xác nhận đã ghép Sunshine.',
        ]
        : [
            'Nếu chưa có OpenVPN Connect, tải và cài ứng dụng trước.',
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
                <p className="wizard-help-note">
                    {isPlay ? SUNSHINE_HOST_NOTE : 'File .ovpn chỉ dùng cho phiên hiện tại. Khi tạo phiên mới, hãy tải profile mới rồi import lại vào OpenVPN Connect.'}
                </p>
                {!isPlay && (
                    <div className="actions">
                        <a className="btn secondary" href={CLIENT_TOOL_LINKS.openvpn} target="_blank" rel="noopener noreferrer">Tải OpenVPN Connect</a>
                        <a className="btn ghost" href={CLIENT_TOOL_LINKS.openvpnGuide}>Xem hướng dẫn VPN</a>
                    </div>
                )}
                {isPlay && (
                    <div className="actions">
                        <a className="btn secondary" href={CLIENT_TOOL_LINKS.moonlight} target="_blank" rel="noopener noreferrer">Tải Moonlight</a>
                        <button type="button" className="btn secondary" onClick={onCopyIp} disabled={!session?.ip_address}>Copy IP VM</button>
                        <button type="button" className="btn ghost" onClick={onOpenSunshine} disabled={!session?.ip_address}>Mở Sunshine Web</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={onMarkSunshinePaired}
                            disabled={!session?.ip_address || session?.sunshine_paired || pairingSunshine}
                        >
                            {pairingSunshine ? 'Đang cập nhật...' : 'Xác nhận đã ghép Sunshine'}
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
    const [checkingPingAll, setCheckingPingAll] = useState(false)
    const [launchFlow, setLaunchFlow] = useState(initialLaunchFlow)
    const [launchLogs, setLaunchLogs] = useState([])
    const [lastEndedSession, setLastEndedSession] = useState(null)
    const [now, setNow] = useState(() => Date.now())
    const [toolsReady, setToolsReady] = useState(() => localStorage.getItem('vpn_gaming_client_tools_ready') === 'true')
    const launchTimersRef = useRef([])

    const params = useMemo(() => new URLSearchParams(location.search), [location.search])
    const machineId = params.get('machineId')
    const sessionId = params.get('sessionId')

    const clearLaunchTimers = () => {
        launchTimersRef.current.forEach((timer) => window.clearTimeout(timer))
        launchTimersRef.current = []
    }

    const scheduleLaunchStep = (delay, callback) => {
        const timer = window.setTimeout(callback, delay)
        launchTimersRef.current.push(timer)
    }

    const addLaunchLog = (subject, message, state = 'RUN') => {
        setLaunchLogs((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${prev.length}`,
                time: formatLogTime(new Date()),
                subject,
                message,
                state,
            },
        ])
    }

    const handleToolsReadyChange = (event) => {
        const checked = event.target.checked
        setToolsReady(checked)
        localStorage.setItem('vpn_gaming_client_tools_ready', checked ? 'true' : 'false')
    }

    useEffect(() => () => {
        launchTimersRef.current.forEach((timer) => window.clearTimeout(timer))
        launchTimersRef.current = []
    }, [])

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
                        if (sessionData?.is_demo_launch) {
                            localStorage.removeItem('active_session')
                            sessionData = null
                        }
                    } catch {
                        sessionData = null
                    }
                }
                if (ctx?.token) {
                    const activeFromServer = await getActiveSession(ctx.token)
                    sessionData = activeFromServer || null
                    if (sessionData) {
                        localStorage.setItem('active_session', JSON.stringify(sessionData))
                    } else {
                        localStorage.removeItem('active_session')
                    }
                }

                const machineListData = await listMachines({ page: 1, page_size: 20, sort: 'best' }, ctx?.token)
                const items = machineListData.items || []
                const resolvedMachineId = sessionData?.machine_id || machineId || items[0]?.id

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
    const vpnProfileDownloaded = Boolean(session?.vpn_profile_downloaded)
    const sunshinePaired = Boolean(session?.sunshine_paired)
    const moonlightReady = Boolean(session?.moonlight_ready || (vpnOnline && sunshinePaired))
    const sessionStartedAt = session?.started_at || session?.start_time || session?.created_at
    const playStartedAt = session?.billing_started_at || null
    const sessionDuration = isActiveSession
        ? playStartedAt
            ? formatDurationFrom(playStartedAt, { now, maxSeconds: MAX_VISIBLE_PLAY_SECONDS, staleLabel: 'Phiên cũ' })
            : moonlightReady
                ? 'Đang đồng bộ'
                : 'Chưa stream'
        : '--:--:--'
    const activeSessionMatchesMachine = Boolean(session?.machine_id && machine?.id && String(session.machine_id) === String(machine.id))
    const currentMachineLabel = isActiveSession && activeSessionMatchesMachine ? 'MÁY ĐANG DÙNG' : machine ? 'MÁY ĐÃ CHỌN' : 'CHƯA CHỌN MÁY'
    const currentMachineState = isActiveSession && activeSessionMatchesMachine ? 'Đang chạy' : machine ? 'Sẵn sàng khởi tạo' : 'Chưa chọn máy'
    const machineVisualSrc = useMemo(() => getMachineVisual(machine, machines), [machine, machines])
    const gpuBrand = getGpuBrand(machine?.gpu)
    const userBalance = Number(ctx?.user?.balance || 0)
    const selectedMachineRate = Number(machine?.play_rate_per_minute ?? machine?.base_rate_per_minute ?? 0)
    const selectedMachineTrialRemaining = Number(machine?.trial_minutes_remaining || 0)
    const selectedMachineHasTrial = Boolean(machine?.trial_eligible && selectedMachineTrialRemaining > 0)
    const selectedMachineCanPay = selectedMachineRate <= 0 || userBalance >= selectedMachineRate
    const selectedMachineIdle = machine?.status === 'idle'
    const blockedByBalance = Boolean(machine && selectedMachineIdle && !selectedMachineHasTrial && !selectedMachineCanPay)
    const canStartSelectedMachine = Boolean(
        machine
        && selectedMachineIdle
        && machine.can_start !== false
        && (selectedMachineHasTrial || selectedMachineCanPay)
    )
    const startBlockReason = blockedByBalance
        ? `Số dư ${formatCurrency(userBalance)} chưa đủ để khởi tạo máy này. Cần tối thiểu ${formatCurrency(selectedMachineRate)} cho phút đầu tiên.`
        : machine?.access_reason || ''
    const stepStates = {
        machine: launchFlow.machine !== 'wait' ? launchFlow.machine : machine ? 'done' : 'wait',
        session: launchFlow.session !== 'wait' ? launchFlow.session : isActiveSession ? 'done' : booting ? 'active' : 'wait',
        vpn: launchFlow.vpn !== 'wait' ? launchFlow.vpn : vpnOnline ? 'done' : checkingVpn || downloadingOvpn ? 'active' : 'wait',
        moonlight: launchFlow.moonlight !== 'wait' ? launchFlow.moonlight : moonlightReady ? 'done' : pairingSunshine ? 'active' : 'wait',
    }
    const stepLabels = {
        machine: stepStates.machine === 'done' ? 'Selected' : 'Chọn máy',
        session: stepStates.session === 'done' ? 'Hoàn thành' : stepStates.session === 'active' ? 'Đang khởi động VM...' : 'Khởi động',
        vpn: stepStates.vpn === 'done' ? 'Connected' : stepStates.vpn === 'active' ? (downloadingOvpn ? 'Đang tải VPN...' : 'Checking route...') : vpnProfileDownloaded ? 'Chờ OpenVPN' : 'Chờ tải VPN',
        moonlight: stepStates.moonlight === 'done' ? 'Ready' : stepStates.moonlight === 'active' ? 'Waiting Sunshine...' : 'Vào chơi',
    }

    useEffect(() => {
        if (!isActiveSession || !playStartedAt) return undefined

        setNow(Date.now())
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [isActiveSession, playStartedAt])

    useEffect(() => {
        if (!session?.id || !isActiveSession || session?.is_demo_launch || !ctx?.token) return undefined

        let cancelled = false
        const tick = async () => {
            try {
                const streamReady = Boolean(session?.moonlight_ready || (session?.ip_address && session?.sunshine_paired))
                const updated = await heartbeatSession(
                    session.id,
                    { connection_state: session?.ip_address ? 'connected' : 'idle', stream_active: streamReady },
                    ctx.token,
                )
                if (!cancelled) {
                    setSession(updated)
                    localStorage.setItem('active_session', JSON.stringify(updated))
                }
            } catch (err) {
                console.warn('Session heartbeat failed', err)
            }
        }

        tick()
        const timer = window.setInterval(tick, 30000)
        return () => {
            cancelled = true
            window.clearInterval(timer)
        }
    }, [session?.id, session?.is_demo_launch, session?.ip_address, session?.sunshine_paired, session?.moonlight_ready, isActiveSession, ctx?.token])

    const handleBootSession = async () => {
        if (!machine?.id) {
            setError('Chưa chọn máy để khởi động.')
            return
        }
        if (!canStartSelectedMachine) {
            setError(startBlockReason || 'Máy chưa sẵn sàng để khởi tạo.')
            if (blockedByBalance) ctx?.openTopup?.()
            return
        }

        clearLaunchTimers()
        setError('')
        setActionMessage('')
        setBooting(true)
        setDownloadingOvpn(false)
        setCheckingVpn(false)
        setPairingSunshine(false)
        setLaunchLogs([])
        setLastEndedSession(null)
        setLaunchFlow({
            machine: 'done',
            session: 'active',
            vpn: 'wait',
            moonlight: 'wait',
        })
        addLaunchLog(`${machine.code || 'VN-01'} selected`, 'Cloud rig selected', 'OK')
        addLaunchLog('Boot VM', 'Đang khởi động VM', 'RUN')
        setActionMessage(toolsReady ? 'Đang khởi động VM...' : 'Đang khởi động VM. Trong lúc chờ, hãy cài OpenVPN Connect và Moonlight nếu chưa có.')

        try {
            const [started] = await Promise.all([
                startMachine(machine.id, ctx?.token),
                new Promise((resolve) => window.setTimeout(resolve, 1200)),
            ])
            const startedWithUiState = {
                ...started,
                vpn_profile_downloaded: false,
            }
            setSession(startedWithUiState)
            localStorage.setItem('active_session', JSON.stringify(startedWithUiState))
            setMachine((prev) => prev ? { ...prev, status: 'running' } : prev)
            setBooting(false)
            setLaunchFlow({
                machine: 'done',
                session: 'done',
                vpn: 'wait',
                moonlight: 'wait',
            })
            addLaunchLog('VM boot', 'VM boot successful', 'OK')
            addLaunchLog('VPN profile', 'VPN profile created', 'OK')
            addLaunchLog('VPN route', 'Waiting for user VPN import', 'WAIT')
            setActionMessage('VM Online. Hãy tải VPN profile, import vào OpenVPN Connect rồi bấm Tôi đã kết nối VPN. Sau đó mở Moonlight để thêm PC bằng IP local.')
        } catch (err) {
            setBooting(false)
            setLaunchFlow({
                machine: 'done',
                session: 'wait',
                vpn: 'wait',
                moonlight: 'wait',
            })
            addLaunchLog('Boot VM', 'VM boot failed', 'ERR')
            setError(err.message || 'Không thể khởi động cloud rig')
        }
    }

    const handleSelectRig = (rigId) => {
        clearLaunchTimers()
        if (session?.is_demo_launch) {
            localStorage.removeItem('active_session')
            setSession(null)
            setLaunchFlow(initialLaunchFlow)
            setLaunchLogs([])
            setLastEndedSession(null)
            setBooting(false)
            setCheckingVpn(false)
            setPairingSunshine(false)
            setActionMessage('')
            setError('')
        }
        navigate(`/app/wizard?machineId=${rigId}`)
    }

    const handleDownloadOvpn = async () => {
        if (!session?.id || !isActiveSession) {
            setError('Chưa có phiên active để tải VPN profile.')
            return
        }

        setError('')
        setActionMessage('')
        setDownloadingOvpn(true)
        setLaunchFlow((prev) => ({ ...prev, vpn: 'active' }))
        addLaunchLog('VPN profile', 'Downloading VPN profile', 'RUN')
        if (session?.is_demo_launch) {
            scheduleLaunchStep(700, () => {
                const profile = [
                    'client',
                    'dev tun',
                    'proto udp',
                    'remote demo.vpn-gaming.local 1194',
                    'resolv-retry infinite',
                    'nobind',
                    'persist-key',
                    'persist-tun',
                ].join('\n')
                const blob = new Blob([profile], { type: 'application/x-openvpn-profile' })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${machine?.code || 'vpn-gaming'}-${session.id}.ovpn`
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)

                setSession((prev) => {
                    const updated = { ...(prev || session), vpn_profile_downloaded: true, updated_at: new Date().toISOString() }
                    localStorage.setItem('active_session', JSON.stringify(updated))
                    return updated
                })
                setLaunchFlow((prev) => ({ ...prev, vpn: 'wait' }))
                setDownloadingOvpn(false)
                addLaunchLog('VPN profile', 'VPN profile downloaded', 'OK')
                setActionMessage('Đã tải VPN profile. Import vào OpenVPN, kết nối xong rồi bấm VPN đã kết nối.')
            })
            return
        }
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
            setSession((prev) => {
                if (!prev) return prev
                const updated = { ...prev, vpn_profile_downloaded: true, updated_at: new Date().toISOString() }
                localStorage.setItem('active_session', JSON.stringify(updated))
                return updated
            })
            setLaunchFlow((prev) => ({ ...prev, vpn: 'wait' }))
            addLaunchLog('VPN profile', 'VPN profile downloaded', 'OK')
            setActionMessage('Đã tải VPN profile. Import file .ovpn vào OpenVPN, bật kết nối rồi quay lại bấm Tôi đã kết nối VPN.')
        } catch (err) {
            setLaunchFlow((prev) => ({ ...prev, vpn: 'wait' }))
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
        if (!session?.vpn_profile_downloaded) {
            setError('Bạn cần tải VPN profile và import vào OpenVPN trước khi xác nhận kết nối.')
            return
        }

        clearLaunchTimers()
        setError('')
        setActionMessage('')
        setCheckingVpn(true)
        setLaunchFlow((prev) => ({ ...prev, vpn: 'active' }))
        addLaunchLog('VPN route', 'Checking route', 'RUN')
        if (session?.is_demo_launch) {
            const localIp = machine?.ip_address || machine?.local_ip || '10.8.0.24'
            setActionMessage('Đang kiểm tra route VPN...')
            scheduleLaunchStep(900, () => {
                addLaunchLog('VPN route', 'Assigning local IP', 'RUN')
            })
            scheduleLaunchStep(2000, () => {
                setCheckingVpn(false)
                setLaunchFlow((prev) => ({ ...prev, vpn: 'done', moonlight: 'wait' }))
                setSession((prev) => {
                    const updated = {
                        ...(prev || session),
                        ip_address: localIp,
                        vpn_online: true,
                        updated_at: new Date().toISOString(),
                    }
                    localStorage.setItem('active_session', JSON.stringify(updated))
                    return updated
                })
                addLaunchLog('VPN route', 'VPN route established', 'OK')
                setActionMessage(`VPN Online. IP local: ${localIp}. Bây giờ hãy mở Moonlight, thêm PC bằng IP này rồi nhập PIN trong Sunshine Web.`)
            })
            return
        }
        try {
            const checked = await checkVpnConnection(session.id, ctx?.token)
            setSession(checked)
            localStorage.setItem('active_session', JSON.stringify(checked))
            setLaunchFlow((prev) => ({ ...prev, vpn: 'done' }))
            addLaunchLog('VPN route', 'VPN route established', 'OK')
            setActionMessage(`VPN online. IP local: ${checked.ip_address || 'đang cập nhật'}. Mở Moonlight, thêm PC bằng IP này rồi nhập PIN trong Sunshine Web.`)
        } catch (err) {
            setLaunchFlow((prev) => ({ ...prev, vpn: 'wait' }))
            setError(err.message || 'Không thể kiểm tra kết nối VPN')
        } finally {
            setCheckingVpn(false)
        }
    }

    const handleCheckPingAll = async () => {
        if (loading) {
            setError('Danh sách máy đang tải, vui lòng thử lại sau vài giây.')
            return
        }

        setError('')
        setActionMessage('Đang kiểm tra ping tất cả máy...')
        setCheckingPingAll(true)
        try {
            const machineListData = await listMachines({ page: 1, page_size: 20, sort: 'best' }, ctx?.token)
            const items = machineListData.items || []
            setMachines(items)
            setMachine((prev) => {
                if (!prev?.id) return prev
                const refreshed = items.find((item) => String(item.id) === String(prev.id))
                return refreshed ? { ...prev, ...refreshed } : prev
            })
            setActionMessage('Đã cập nhật ping cho tất cả máy.')
        } catch (err) {
            setError(err.message || 'Không thể kiểm tra ping tất cả máy')
        } finally {
            setCheckingPingAll(false)
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
            setError('Cần VPN online trước khi xác nhận Sunshine đã ghép pin.')
            return
        }

        setError('')
        setActionMessage('')
        setPairingSunshine(true)
        setLaunchFlow((prev) => ({ ...prev, moonlight: 'active' }))
        addLaunchLog('Sunshine', 'Waiting Sunshine', 'RUN')
        if (session?.is_demo_launch) {
            clearLaunchTimers()
            setActionMessage('Đang pair Sunshine/Moonlight...')
            scheduleLaunchStep(700, () => {
                addLaunchLog('Moonlight', 'Pairing Moonlight', 'RUN')
            })
            scheduleLaunchStep(1400, () => {
                addLaunchLog('Moonlight', 'Testing stream', 'RUN')
            })
            scheduleLaunchStep(2200, () => {
                setPairingSunshine(false)
                setLaunchFlow((prev) => ({ ...prev, moonlight: 'done' }))
                setSession((prev) => {
                    const updated = {
                        ...(prev || session),
                        sunshine_paired: true,
                        moonlight_ready: true,
                        updated_at: new Date().toISOString(),
                    }
                    localStorage.setItem('active_session', JSON.stringify(updated))
                    return updated
                })
                addLaunchLog('Sunshine', 'Sunshine ready', 'OK')
                addLaunchLog('Moonlight', 'Moonlight available', 'OK')
                setActionMessage('Moonlight Ready. Phiên đã sẵn sàng chơi.')
            })
            return
        }
        try {
            const paired = await markSunshinePaired(session.id, ctx?.token)
            setSession(paired)
            localStorage.setItem('active_session', JSON.stringify(paired))
            setLaunchFlow((prev) => ({ ...prev, moonlight: 'done' }))
            addLaunchLog('Sunshine', 'Sunshine ready', 'OK')
            addLaunchLog('Moonlight', 'Moonlight available', 'OK')
            setActionMessage('Sunshine đã ghép pin. Phiên đã sẵn sàng chơi qua Moonlight.')
        } catch (err) {
            setLaunchFlow((prev) => ({ ...prev, moonlight: 'wait' }))
            setError(err.message || 'Không thể cập nhật trạng thái Sunshine')
        } finally {
            setPairingSunshine(false)
        }
    }

    const handleStopSession = async (mode = 'stop') => {
        if (!session?.id) {
            setError('Chưa có phiên active để dừng.')
            return
        }

        const confirmed = window.confirm(
            mode === 'snapshot'
                ? 'Tạm dừng phiên và lưu snapshot nếu gói của bạn có quota?'
                : 'Bạn chắc chắn muốn dừng phiên hiện tại?',
        )
        if (!confirmed) return

        clearLaunchTimers()
        setError('')
        setActionMessage('')
        if (session?.is_demo_launch) {
            localStorage.removeItem('active_session')
            setSession(null)
            setLaunchFlow(initialLaunchFlow)
            setLaunchLogs([])
            setBooting(false)
            setCheckingVpn(false)
            setPairingSunshine(false)
            setMachine((prev) => prev ? { ...prev, status: 'available' } : prev)
            setActionMessage('Đã dừng phiên mô phỏng. Máy đã sẵn sàng khởi tạo lại.')
            return
        }

        setStopping(true)
        try {
            const stopped = await stopSession(session.id, ctx?.token, { retainSnapshot: mode === 'snapshot' })
            localStorage.removeItem('active_session')
            setSession(stopped)
            setLastEndedSession(stopped)
            setMachine((prev) => prev ? {
                ...prev,
                status: stopped?.snapshot_retained ? 'suspended' : 'idle',
                cooldown_until: stopped?.snapshot_retained ? stopped?.ended_at : null,
            } : prev)
            setActionMessage(
                stopped?.snapshot_retained
                    ? 'Đã tạm dừng phiên và lưu snapshot. Bạn có thể resume từ lịch sử hoặc danh sách máy.'
                    : 'Đã dừng phiên. Lần sau bạn sẽ khởi tạo phiên mới từ đầu.',
            )
        } catch (err) {
            setError(err.message || 'Không thể dừng phiên')
        } finally {
            setStopping(false)
        }
    }

    const launchStarted = launchLogs.length > 0
    const bootState = launchFlow.session !== 'wait' ? launchFlow.session : isActiveSession ? 'done' : booting ? 'active' : 'wait'
    const bootTime = bootState === 'done' ? 'Hoàn thành' : bootState === 'active' ? 'Đang khởi động VM...' : '--:--:--'
    const vpnState = launchFlow.vpn !== 'wait' ? launchFlow.vpn : vpnOnline ? 'done' : downloadingOvpn || checkingVpn ? 'active' : 'wait'
    const vpnTime = vpnOnline
        ? 'Connected'
        : downloadingOvpn
            ? 'Đang tải profile'
            : checkingVpn
                ? 'Checking route...'
                : vpnProfileDownloaded
                    ? 'Chờ kết nối'
                    : isActiveSession
                        ? 'Chờ tải VPN'
                        : '--:--:--'
    const vpnActiveDesc = downloadingOvpn ? 'Đang tải VPN profile...' : 'Checking route...'
    const vpnWaitingDesc = vpnProfileDownloaded ? 'Đã tải profile, chờ OpenVPN kết nối' : isActiveSession ? 'Chờ tải VPN profile' : 'Kết nối VPN và thiết lập route'
    const vpnDisplayTime = vpnState === 'done' ? 'Connected' : vpnState === 'active' ? vpnTime : vpnTime
    const sunshineState = sunshinePaired ? 'done' : pairingSunshine ? 'active' : 'wait'
    const sunshineTime = sunshinePaired ? 'Ready' : pairingSunshine ? 'Waiting Sunshine...' : '--:--:--'
    const moonlightState = launchFlow.moonlight !== 'wait' ? launchFlow.moonlight : moonlightReady ? 'done' : 'wait'
    const moonlightTime = moonlightState === 'done' ? 'Ready' : moonlightState === 'active' ? 'Pairing Moonlight...' : '--:--:--'

    const processRows = [
        { title: 'Cloud Rig', desc: machine ? 'Selected' : 'Chưa chọn máy', time: machine ? 'Selected' : '--:--:--', state: machine ? 'done' : 'wait' },
        { title: 'Boot VM', desc: bootState === 'active' ? 'Đang khởi động VM...' : 'Khởi động máy ảo', time: bootTime, state: bootState },
        { title: 'VPN Route', desc: vpnState === 'active' ? vpnActiveDesc : vpnWaitingDesc, time: vpnDisplayTime, state: vpnState },
        { title: 'Sunshine pairing', desc: 'Nhập PIN từ Moonlight vào Sunshine Web', time: sunshineTime, state: sunshineState },
        { title: 'Moonlight stream', desc: 'Sẵn sàng vào chơi', time: moonlightTime, state: moonlightState },
    ]
    const fallbackLogs = [
        {
            time: formatLogTime(sessionStartedAt),
            subject: `VM ${machine?.code || 'cloud rig'}`,
            message: booting ? 'đang khởi động phiên' : 'khởi động phiên',
            state: isActiveSession ? 'OK' : booting ? 'RUN' : 'WAIT',
        },
        {
            time: formatLogTime(sessionStartedAt),
            subject: 'VPN profile',
            message: downloadingOvpn ? 'đang tải profile' : 'cấp theo phiên hiện tại',
            state: downloadingOvpn ? 'RUN' : isActiveSession ? 'OK' : 'WAIT',
        },
        {
            time: formatLogTime(session?.updated_at || sessionStartedAt),
            subject: 'VPN route',
            message: checkingVpn ? 'đang kiểm tra' : 'kiểm tra kết nối',
            state: vpnOnline ? 'OK' : checkingVpn ? 'RUN' : 'WAIT',
        },
        {
            time: formatLogTime(session?.updated_at || sessionStartedAt),
            subject: 'Sunshine',
            message: pairingSunshine ? 'đang ghép nối' : 'chờ ghép nối',
            state: sunshinePaired ? 'OK' : pairingSunshine ? 'RUN' : 'WAIT',
        },
    ]
    const logs = launchStarted ? launchLogs : fallbackLogs
    const playRate = Number(session?.play_rate_per_minute || machine?.play_rate_per_minute || machine?.base_rate_per_minute || 0)
    const completedPlayMinutes = Math.floor((getElapsedSecondsFrom(playStartedAt, now) ?? 0) / 60)
    const chargedMinutes = Number(session?.charged_minutes || 0)
    const freeMinutesUsed = Number(session?.free_minutes_used || 0)
    const countedMinutes = chargedMinutes + freeMinutesUsed
    const pendingCompletedMinutes = isActiveSession && playStartedAt
        ? Math.max(0, completedPlayMinutes - countedMinutes)
        : 0
    const freeMinutesRemaining = session?.trial_eligible
        ? Math.max(0, Number(session?.free_minutes_remaining ?? session?.trial_minutes_remaining ?? 0))
        : 0
    const pendingPaidMinutes = Math.max(0, pendingCompletedMinutes - freeMinutesRemaining)
    const currentSessionCost = Number(session?.charged_amount || 0) + (pendingPaidMinutes * playRate)
    const snapshotLimit = Number(session?.snapshot_active_limit || machine?.snapshot_active_limit || 0)
    const canRetainSnapshot = snapshotLimit > 0
    const showRunningPanel = isActiveSession && moonlightReady
    const endedSummary = !isActiveSession && lastEndedSession
    const endedDuration = endedSummary
        ? formatDurationBetween(endedSummary.started_at || endedSummary.created_at, endedSummary.ended_at || new Date())
        : '--:--:--'

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
                        <button
                            className="btn primary"
                            onClick={handleBootSession}
                            disabled={booting || isActiveSession || !machine || (!canStartSelectedMachine && !blockedByBalance)}
                            title={startBlockReason}
                        >
                            ▶ {booting ? 'Đang khởi tạo...' : isActiveSession ? 'Phiên đang chạy' : blockedByBalance ? 'Nạp tiền để khởi tạo' : 'Khởi tạo phiên'}
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
                        <div><span>PAYG</span><strong>{formatRate(machine?.play_rate_per_minute || machine?.base_rate_per_minute || 0)}</strong></div>
                        <div><span>Trial</span><strong>{machine?.trial_eligible ? `${machine?.trial_minutes_remaining || 0} phút còn lại` : 'Không áp dụng'}</strong></div>
                        <div><span>Session ID</span><strong>{session?.id ? session.id.slice(0, 8) : '--'}</strong></div>
                        <div><span>IP Local</span><strong>{session?.ip_address || '--'}</strong></div>
                        <div><span>Thời gian chơi</span><strong>{sessionDuration}</strong></div>
                    </div>
                </div>
            </section>

            <section className="sl-tool-prep" aria-labelledby="sl-tool-prep-title">
                <div className="sl-tool-prep-copy">
                    <p className="sl-next-kicker">CẦN CÀI TRÊN MÁY CỦA BẠN</p>
                    <h2 id="sl-tool-prep-title">OpenVPN Connect trước, Moonlight sau</h2>
                    <span>{SUNSHINE_HOST_NOTE}</span>
                    <label className="sl-tool-ready-check">
                        <input type="checkbox" checked={toolsReady} onChange={handleToolsReadyChange} />
                        Tôi đã cài OpenVPN Connect và Moonlight trên thiết bị chơi.
                    </label>
                </div>
                <div className="sl-tool-prep-list">
                    {CLIENT_TOOL_STEPS.slice(0, 2).map((step, index) => (
                        <article key={step.id}>
                            <strong>{index + 1}</strong>
                            <div>
                                <h3>{step.title}</h3>
                                <p>{step.desc}</p>
                            </div>
                        </article>
                    ))}
                </div>
                <div className="sl-tool-prep-actions">
                    <a className="btn secondary" href={CLIENT_TOOL_LINKS.openvpn} target="_blank" rel="noopener noreferrer">
                        Tải OpenVPN
                    </a>
                    <a className="btn secondary" href={CLIENT_TOOL_LINKS.moonlight} target="_blank" rel="noopener noreferrer">
                        Tải Moonlight
                    </a>
                    <a className="btn ghost" href={CLIENT_TOOL_LINKS.openvpnGuide}>
                        Xem hướng dẫn
                    </a>
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
            {blockedByBalance && !isActiveSession && (
                <div className="alert info wizard-alert">
                    <span>{startBlockReason}</span>
                    <button type="button" className="btn secondary" onClick={() => ctx?.openTopup?.()}>Nạp tiền</button>
                </div>
            )}

            <section className="sl-stepper">
                {cockpitSteps.map((step, index) => {
                    const state = stepStates[step.key]
                    const done = state === 'done'
                    const active = state === 'active'
                    const locked = state === 'wait'
                    return (
                        <div key={step.key} className={`sl-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}>
                            <span className="sl-step-number">{index + 1}</span>
                            <div className="sl-step-info">
                                <strong>{step.title}</strong>
                                <p className={active ? 'text-cyan-300' : done ? 'text-emerald-400' : ''}>{stepLabels[step.key] || step.label}</p>
                            </div>
                            <span className="sl-step-status-icon">
                                {done && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                                {active && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
                                {locked && (step.key === 'machine' ? <Circle className="h-5 w-5 text-slate-500" /> : <Lock className="h-5 w-5 text-slate-500" />)}
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
                                    onClick={() => handleSelectRig(rig.id)}
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
                    <button
                        type="button"
                        className="sl-ping-all"
                        onClick={handleCheckPingAll}
                        disabled={checkingPingAll}
                        aria-busy={checkingPingAll}
                        title={checkingPingAll ? 'Đang kiểm tra ping' : 'Cập nhật ping cho tất cả máy'}
                    >
                        <Wifi className="inline mr-2 h-4 w-4" />
                        {checkingPingAll ? 'Đang kiểm tra ping...' : 'Kiểm tra ping tất cả máy'}
                        <RefreshCw className={`inline ml-auto h-4 w-4 ${checkingPingAll ? 'animate-spin' : ''}`} />
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
                            <p key={line.id || `${line.subject}-${line.message}`}>
                                <span className="log-time">[{line.time}]</span>{' '}
                                <span className="log-highlight">{line.subject}</span> {line.message}{' '}
                                <span className={line.state === 'OK' ? 'log-success' : ''}>{line.state}</span>
                            </p>
                        ))}
                        {launchStarted && <p><span className="log-cursor">_</span></p>}
                    </div>
                </div>

                <div className="sl-right-stack">
                    <div className="sl-panel sl-readiness">
                        <div className="sl-panel-head">
                            <strong>KIỂM TRA SẴN SÀNG</strong>
                        </div>
                        <div className="sl-ready-list">
                            <div className={bootState === 'done' ? 'ready' : bootState === 'active' ? 'active' : ''}>
                                <span className="sl-ready-icon"><Server className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>{bootState === 'done' ? 'VM Online' : bootState === 'active' ? 'VM đang khởi động...' : 'VM chưa chạy'}</strong>
                                    <p className="sl-ready-desc">{bootState === 'done' ? 'Máy ảo đã khởi động thành công' : bootState === 'active' ? 'Đang khởi động VM...' : 'Chưa có phiên active'}</p>
                                </div>
                                <em className={`sl-ready-status ${bootState === 'done' ? 'text-emerald-400' : bootState === 'active' ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {bootState === 'done' ? 'Online' : bootState === 'active' ? 'Đang xử lý' : 'Chờ xử lý'}
                                    {bootState === 'done' ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : bootState === 'active' ? <Loader2 className="h-4 w-4 animate-spin inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={vpnState === 'done' ? 'ready' : vpnState === 'active' ? 'active' : ''}>
                                <span className="sl-ready-icon"><ShieldCheck className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>{vpnState === 'done' ? 'VPN Online' : vpnState === 'active' ? (downloadingOvpn ? 'Đang tải profile...' : 'Đang kiểm tra VPN...') : 'VPN chưa online'}</strong>
                                    <p className="sl-ready-desc">{vpnState === 'done' ? 'Đã kết nối VPN thành công' : vpnState === 'active' ? (downloadingOvpn ? 'Tải file .ovpn về máy' : 'Checking route và cấp IP local') : vpnProfileDownloaded ? 'Đã tải profile, chờ OpenVPN kết nối' : 'Chưa tải VPN profile'}</p>
                                </div>
                                <em className={`sl-ready-status ${vpnState === 'done' ? 'text-emerald-400' : vpnState === 'active' ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {vpnState === 'done' ? 'Online' : vpnState === 'active' ? 'Đang xử lý' : 'Chờ xử lý'}
                                    {vpnState === 'done' ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : vpnState === 'active' ? <Loader2 className="h-4 w-4 animate-spin inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={sunshinePaired ? 'ready' : pairingSunshine ? 'active' : ''}>
                                <span className="sl-ready-icon"><Sun className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>Sunshine {sunshinePaired ? 'đã pairing' : 'chờ pairing'}</strong>
                                    <p className="sl-ready-desc">{sunshinePaired ? 'Thiết bị đã được ghép nối' : 'Sunshine chạy trên máy cloud, chờ PIN từ Moonlight'}</p>
                                </div>
                                <em className={`sl-ready-status ${sunshinePaired ? 'text-emerald-400' : pairingSunshine ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {sunshinePaired ? 'Sẵn sàng' : pairingSunshine ? 'Đang ghép' : 'Chờ xử lý'}
                                    {sunshinePaired ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : pairingSunshine ? <Loader2 className="h-4 w-4 animate-spin inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                            <div className={moonlightState === 'done' ? 'ready' : moonlightState === 'active' ? 'active' : ''}>
                                <span className="sl-ready-icon"><Moon className="h-5 w-5" /></span>
                                <div className="sl-ready-copy">
                                    <strong>{moonlightState === 'done' ? 'Moonlight sẵn sàng' : moonlightState === 'active' ? 'Moonlight đang pairing...' : 'Moonlight chưa sẵn sàng'}</strong>
                                    <p className="sl-ready-desc">{moonlightState === 'done' ? 'Sẵn sàng truyền phát game' : moonlightState === 'active' ? 'Testing stream...' : 'Cần app Moonlight để thêm PC bằng IP local'}</p>
                                </div>
                                <em className={`sl-ready-status ${moonlightState === 'done' ? 'text-emerald-400' : moonlightState === 'active' ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {moonlightState === 'done' ? 'Ready' : moonlightState === 'active' ? 'Đang xử lý' : 'Chờ xử lý'}
                                    {moonlightState === 'done' ? <CheckCircle2 className="h-4 w-4 inline ml-1" /> : moonlightState === 'active' ? <Loader2 className="h-4 w-4 animate-spin inline ml-1" /> : <Circle className="h-4 w-4 inline ml-1" />}
                                </em>
                            </div>
                        </div>
                    </div>

                    <div className="sl-panel sl-next-card">
                        <div>
                            <p className="sl-next-kicker">TIẾP THEO</p>
                            <h3>{vpnOnline ? 'Pair Moonlight' : 'Kết nối VPN'}</h3>
                            <span>{vpnOnline ? 'Copy IP, thêm PC trong Moonlight, nhập PIN trong Sunshine rồi xác nhận đã pair.' : vpnProfileDownloaded ? 'Import profile vào OpenVPN, bật kết nối rồi quay lại xác nhận.' : 'Tải VPN profile trước, sau đó import vào OpenVPN.'}</span>
                            <div className="sl-tool-mini">
                                <strong>{vpnOnline ? 'Dùng Moonlight trên thiết bị chơi' : 'Dùng OpenVPN Connect để mở file .ovpn'}</strong>
                                <p>{vpnOnline ? 'Moonlight là app người chơi mở để nhập IP local. Sunshine là host đã có trên máy cloud và chỉ dùng để nhập PIN pairing.' : 'Nếu chưa cài OpenVPN Connect, tải trước rồi mới import file .ovpn của phiên này.'}</p>
                                <div className="sl-tool-mini-actions">
                                    {!vpnOnline && (
                                        <a href={CLIENT_TOOL_LINKS.openvpn} target="_blank" rel="noopener noreferrer">Tải OpenVPN Connect</a>
                                    )}
                                    {vpnOnline && (
                                        <a href={CLIENT_TOOL_LINKS.moonlight} target="_blank" rel="noopener noreferrer">Tải Moonlight</a>
                                    )}
                                    <a href={vpnOnline ? CLIENT_TOOL_LINKS.moonlightGuide : CLIENT_TOOL_LINKS.openvpnGuide}>Xem hướng dẫn</a>
                                </div>
                            </div>
                            {!vpnOnline && vpnProfileDownloaded && (
                                <ol className="vpn-import-steps" aria-label="Các bước kết nối VPN">
                                    <li><strong>1</strong><span>Mở file .ovpn vừa tải trong OpenVPN Connect.</span></li>
                                    <li><strong>2</strong><span>Import profile, bật Connect và chờ trạng thái Connected.</span></li>
                                    <li><strong>3</strong><span>Quay lại web, bấm Tôi đã kết nối VPN.</span></li>
                                </ol>
                            )}
                            <div className="gd-actions">
                                {!vpnOnline && (
                                    <>
                                        <button type="button" className="btn secondary" onClick={handleDownloadOvpn} disabled={!isActiveSession || downloadingOvpn}>
                                            {downloadingOvpn ? 'Đang tải...' : 'Tải VPN'}
                                        </button>
                                        <button type="button" className="btn primary" onClick={handleCheckVpnConnection} disabled={!isActiveSession || checkingVpn || !vpnProfileDownloaded}>
                                            {checkingVpn ? 'Đang kiểm tra...' : vpnProfileDownloaded ? 'Tôi đã kết nối VPN' : 'Chưa tải VPN'}
                                        </button>
                                    </>
                                )}
                                {vpnOnline && (
                                    <>
                                        <button type="button" className="btn primary outline-violet" onClick={() => setActiveGuide('play')}>
                                            Hướng dẫn pair <ExternalLink className="h-4 w-4 inline ml-1" />
                                        </button>
                                        {!sunshinePaired && (
                                            <button type="button" className="btn secondary" onClick={handleMarkSunshinePaired} disabled={pairingSunshine}>
                                                {pairingSunshine ? 'Đang cập nhật...' : 'Xác nhận đã ghép Sunshine'}
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

            {(showRunningPanel || endedSummary) && (
                <section className={`sl-session-board ${showRunningPanel && !endedSummary ? 'single' : ''} ${endedSummary && !showRunningPanel ? 'single' : ''}`}>
                    {showRunningPanel && (
                        <div className="sl-session-card sl-session-running">
                            <div className="sl-session-card-head">
                                <div>
                                    <p className="sl-next-kicker">PHIÊN CHƠI ĐANG DIỄN RA</p>
                                    <h3>Kết nối Gaming VM</h3>
                                </div>
                                <span className="sl-session-live"><i className="status-dot" /> Đang chơi</span>
                            </div>
                            <div className="sl-session-metrics">
                                <div>
                                    <span>Máy chủ</span>
                                    <strong>{machine?.code || 'Cloud rig'}</strong>
                                </div>
                                <div>
                                    <span>Thời gian chơi</span>
                                    <strong>{sessionDuration}</strong>
                                </div>
                                <div>
                                    <span>Chi phí hiện tại</span>
                                    <strong>{formatCurrency(currentSessionCost)}</strong>
                                </div>
                                <div>
                                    <span>Đơn giá</span>
                                    <strong>{formatRate(playRate)}</strong>
                                </div>
                            </div>
                            <div className="sl-session-status-list">
                                <span><CheckCircle2 className="h-4 w-4" /> VM Online</span>
                                <span><CheckCircle2 className="h-4 w-4" /> VPN Connected</span>
                                <span><CheckCircle2 className="h-4 w-4" /> Moonlight Ready</span>
                            </div>
                            <div className="gd-actions">
                                <button type="button" className="btn primary outline-violet" onClick={() => setActiveGuide('play')}>
                                    Hướng dẫn mở Moonlight <ExternalLink className="h-4 w-4 inline ml-1" />
                                </button>
                                <button type="button" className="btn secondary" onClick={() => handleStopSession('snapshot')} disabled={stopping}>
                                    {stopping ? 'Đang xử lý...' : 'Tạm dừng / lưu snapshot'}
                                </button>
                                <button type="button" className="btn danger" onClick={() => handleStopSession('stop')} disabled={stopping}>
                                    {stopping ? 'Đang dừng...' : 'Dừng phiên'}
                                </button>
                            </div>
                            <p className="sl-session-note">
                                {canRetainSnapshot
                                    ? `Gói hiện tại có thể giữ tối đa ${snapshotLimit} snapshot để resume phiên sau.`
                                    : 'Gói hiện tại chưa có quota snapshot; dừng phiên sẽ không bảo đảm resume trạng thái game.'}
                            </p>
                        </div>
                    )}

                    {endedSummary && (
                        <div className="sl-session-card sl-session-summary">
                            <div className="sl-session-card-head">
                                <div>
                                    <p className="sl-next-kicker">KẾT THÚC PHIÊN</p>
                                    <h3>Phiên chơi đã kết thúc</h3>
                                </div>
                                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="sl-session-metrics">
                                <div>
                                    <span>Thời gian chơi</span>
                                    <strong>{endedDuration}</strong>
                                </div>
                                <div>
                                    <span>Tổng chi phí</span>
                                    <strong>{formatCurrency(endedSummary.charged_amount)}</strong>
                                </div>
                                <div>
                                    <span>Trung bình</span>
                                    <strong>{formatRate(endedSummary.play_rate_per_minute || playRate)}</strong>
                                </div>
                                <div>
                                    <span>Snapshot</span>
                                    <strong>{endedSummary.snapshot_retained ? 'Đã lưu' : 'Không lưu'}</strong>
                                </div>
                            </div>
                            <div className="sl-summary-detail">
                                <div><span>Máy chủ</span><strong>{machine?.code || endedSummary.machine_id || '--'}</strong></div>
                                <div><span>Kết thúc lúc</span><strong>{formatDateTime(endedSummary.ended_at)}</strong></div>
                                <div><span>Lý do</span><strong>{endedSummary.stop_reason || 'user_stopped'}</strong></div>
                            </div>
                            <div className="gd-actions">
                                <button type="button" className="btn primary" onClick={() => navigate('/app/history')}>Xem lịch sử phiên</button>
                                <button type="button" className="btn ghost" onClick={() => navigate('/app/machines')}>Chọn máy khác</button>
                            </div>
                        </div>
                    )}
                </section>
            )}

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
