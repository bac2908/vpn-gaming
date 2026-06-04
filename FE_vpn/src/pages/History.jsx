import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Clock3, CreditCard, Gamepad2, RotateCcw, Server, Wallet } from 'lucide-react'
import { getSessionHistory, getSessionHistorySummary, resumeMachine } from '../api/machines'
import { getTopupHistory, getTopupSummary } from '../api/payments'

const TOPUP_PAGE_SIZE = 10
const SESSION_PAGE_SIZE = 10
const RECENT_ACTIVITY_PAGE_SIZE = 8
const HISTORY_EXPORT_PAGE_SIZE = 50

function History({ ctx }) {
    const [activeTab, setActiveTab] = useState('sessions')
    const navigate = useNavigate()
    const [sessionHistory, setSessionHistory] = useState([])
    const [sessionLoading, setSessionLoading] = useState(false)
    const [sessionError, setSessionError] = useState('')
    const [sessionPage, setSessionPage] = useState(1)
    const [sessionTotalPages, setSessionTotalPages] = useState(1)
    const [sessionTotal, setSessionTotal] = useState(0)
    const [sessionStatusFilter, setSessionStatusFilter] = useState('')
    const [sessionSort, setSessionSort] = useState('recent')
    const [resumeLoadingId, setResumeLoadingId] = useState('')
    const [sessionActionError, setSessionActionError] = useState('')
    const [topupHistory, setTopupHistory] = useState([])
    const [topupLoading, setTopupLoading] = useState(false)
    const [topupError, setTopupError] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [topupTotal, setTopupTotal] = useState(0)
    const [statusFilter, setStatusFilter] = useState('')
    const [overviewSessions, setOverviewSessions] = useState([])
    const [overviewTopups, setOverviewTopups] = useState([])
    const [sessionSummary, setSessionSummary] = useState(null)
    const [topupSummary, setTopupSummary] = useState(null)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryError, setSummaryError] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadDashboardData() {
            setSummaryLoading(true)
            setSummaryError('')
            const results = await Promise.allSettled([
                getSessionHistorySummary(ctx?.token),
                getTopupSummary(ctx?.token),
                getSessionHistory({ page: 1, pageSize: RECENT_ACTIVITY_PAGE_SIZE, sort: 'recent' }, ctx?.token),
                getTopupHistory({ page: 1, pageSize: RECENT_ACTIVITY_PAGE_SIZE }, ctx?.token),
            ])

            if (cancelled) return
            const authFailed = results.some((result) => result.status === 'rejected' && result.reason?.status === 401)
            if (authFailed) {
                setSummaryLoading(false)
                return
            }

            const [sessionSummaryResult, topupSummaryResult, sessionsResult, topupsResult] = results
            if (sessionSummaryResult.status === 'fulfilled') {
                setSessionSummary(sessionSummaryResult.value)
            }
            if (topupSummaryResult.status === 'fulfilled') {
                setTopupSummary(topupSummaryResult.value)
            }
            if (sessionsResult.status === 'fulfilled') {
                setOverviewSessions(sessionsResult.value.items || [])
            }
            if (topupsResult.status === 'fulfilled') {
                setOverviewTopups(topupsResult.value.items || [])
            }

            const hasFailure = results.some((result) => result.status === 'rejected')
            if (hasFailure) {
                setSummaryError('Một phần dữ liệu tổng quan chưa tải được. Bảng lịch sử vẫn có thể xem bình thường.')
                if (sessionSummaryResult.status === 'rejected') {
                    setSessionSummary(null)
                }
                if (topupSummaryResult.status === 'rejected') {
                    setTopupSummary(null)
                }
            } else {
                setSummaryError('')
            }
            setSummaryLoading(false)
        }

        loadDashboardData()
        return () => { cancelled = true }
    }, [ctx?.token])

    useEffect(() => {
        if (activeTab !== 'sessions') return
        let cancelled = false

        async function load() {
            setSessionLoading(true)
            setSessionError('')
            try {
                const data = await getSessionHistory(
                    {
                        page: sessionPage,
                        pageSize: SESSION_PAGE_SIZE,
                        status: sessionStatusFilter || undefined,
                        sort: sessionSort,
                    },
                    ctx?.token,
                )
                if (!cancelled) {
                    setSessionHistory(data.items || [])
                    const totalItems = data.total || 0
                    const size = data.page_size || SESSION_PAGE_SIZE
                    setSessionTotal(totalItems)
                    setSessionTotalPages(Math.max(1, Math.ceil(totalItems / size)))
                }
            } catch (err) {
                if (!cancelled) {
                    if (err?.status === 401) return
                    setSessionError(err.message || 'Không tải được lịch sử phiên')
                }
            } finally {
                if (!cancelled) setSessionLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [activeTab, sessionPage, sessionStatusFilter, sessionSort, ctx?.token])

    useEffect(() => {
        if (activeTab !== 'topup') return
        let cancelled = false

        async function load() {
            setTopupLoading(true)
            setTopupError('')
            try {
                const data = await getTopupHistory(
                    { page, pageSize: TOPUP_PAGE_SIZE, status: statusFilter || undefined },
                    ctx?.token
                )
                if (!cancelled) {
                    setTopupHistory(data.items || [])
                    const totalItems = data.total || 0
                    const size = data.page_size || TOPUP_PAGE_SIZE
                    setTopupTotal(totalItems)
                    setTotalPages(Math.max(1, Math.ceil(totalItems / size)))
                }
            } catch (err) {
                if (!cancelled) {
                    if (err?.status === 401) return
                    setTopupError(err.message || 'Không tải được lịch sử nạp tiền')
                }
            } finally {
                if (!cancelled) setTopupLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [activeTab, page, statusFilter, ctx?.token])

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ'
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        const date = new Date(dateStr)
        if (Number.isNaN(date.getTime())) return 'N/A'
        return date.toLocaleString('vi-VN')
    }

    const formatShortDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        if (Number.isNaN(date.getTime())) return ''
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }

    const formatDurationSeconds = (value) => {
        const total = Number(value)
        if (!Number.isFinite(total) || total < 0) return '—'
        const hours = Math.floor(total / 3600)
        const minutes = Math.floor((total % 3600) / 60)
        const seconds = Math.floor(total % 60)
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
    }

    const formatCompactDuration = (value) => {
        const total = Number(value)
        if (!Number.isFinite(total) || total <= 0) return '0m'
        const hours = Math.floor(total / 3600)
        const minutes = Math.round((total % 3600) / 60)
        if (hours <= 0) return `${Math.max(1, minutes)}m`
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }

    const formatCompactMoney = (amount) => {
        const value = Number(amount || 0)
        if (value >= 1_000_000) {
            const millions = value / 1_000_000
            return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}tr`
        }
        if (value >= 1000) return `${Math.round(value / 1000)}k`
        return formatMoney(value)
    }

    const makeDayKey = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const getSessionSeconds = (session) => {
        const value = Number(session?.duration_seconds)
        if (Number.isFinite(value) && value >= 0) return value
        if (!session?.started_at) return 0
        const start = new Date(session.started_at)
        if (Number.isNaN(start.getTime())) return 0
        const end = session.ended_at ? new Date(session.ended_at) : new Date()
        if (Number.isNaN(end.getTime())) return 0
        return Math.max(0, Math.floor((end - start) / 1000))
    }

    const formatSessionDuration = (session) => {
        if (Number.isFinite(Number(session?.duration_seconds))) {
            return formatDurationSeconds(session.duration_seconds)
        }
        if (!session?.started_at) return '—'
        const start = new Date(session.started_at)
        if (Number.isNaN(start.getTime())) return '—'
        const end = session.ended_at ? new Date(session.ended_at) : new Date()
        if (Number.isNaN(end.getTime())) return '—'
        const seconds = Math.max(0, Math.floor((end - start) / 1000))
        return formatDurationSeconds(seconds)
    }

    const getSessionNetAmount = (session) => {
        const charged = Number(session?.charged_amount || 0)
        const refunded = Number(session?.refunded_amount || 0)
        return Math.max(0, (Number.isFinite(charged) ? charged : 0) - (Number.isFinite(refunded) ? refunded : 0))
    }

    const getSessionStatusBadge = (session) => {
        if (session?.status === 'active' && !session?.ended_at) {
            return <span className="badge warning">Đang chạy</span>
        }
        if (session?.status === 'stopped') {
            return <span className="badge success">Đã dừng</span>
        }
        if (session?.status === 'ended') {
            return <span className="badge success">Hoàn tất</span>
        }
        if (session?.status === 'failed') {
            return <span className="badge error">Lỗi</span>
        }
        return <span className="badge">{session?.status || '—'}</span>
    }

    const getMachineLabel = (session) => {
        const machine = session?.machine
        if (!machine) return 'Chưa có máy'
        const parts = [machine.code, machine.location || machine.region].filter(Boolean)
        return parts.join(' • ')
    }

    const getMachineDetail = (session) => {
        const machine = session?.machine
        if (!machine) return '—'
        return [machine.gpu, machine.location || machine.region].filter(Boolean).join(' • ') || '—'
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'succeeded':
            case 'completed':
                return <span className="badge success">Thành công</span>
            case 'pending':
                return <span className="badge warning">Đang xử lý</span>
            case 'failed':
                return <span className="badge error">Thất bại</span>
            default:
                return <span className="badge">{status}</span>
        }
    }

    const handleOpenWizard = (session) => {
        const params = new URLSearchParams()
        if (session?.id) params.set('sessionId', session.id)
        const machineId = session?.machine_id || session?.machine?.id
        if (machineId) params.set('machineId', machineId)
        navigate(`/app/wizard?${params.toString()}`)
    }

    const handleResumeSession = async (session) => {
        const machineId = session?.machine_id || session?.machine?.id
        if (!machineId) {
            setSessionActionError('Phiên này chưa gắn máy để tiếp tục.')
            return
        }

        setSessionActionError('')
        setResumeLoadingId(session.id)
        try {
            const data = await resumeMachine(machineId, ctx?.token)
            localStorage.setItem('active_session', JSON.stringify(data))
            navigate(`/app/wizard?sessionId=${data.id}&machineId=${data.machine_id}`)
        } catch (err) {
            if (err?.status === 401) return
            setSessionActionError(err.message || 'Không thể tiếp tục phiên chơi')
        } finally {
            setResumeLoadingId('')
        }
    }

    const [exportOpen, setExportOpen] = useState(false)
    const recentSessions = overviewSessions.length ? overviewSessions : sessionHistory
    const recentTopups = overviewTopups.length ? overviewTopups : topupHistory
    const fallbackStreamedSessions = recentSessions.filter((session) => getSessionSeconds(session) > 0)
    const fallbackTotalSessionSeconds = recentSessions.reduce((sum, session) => sum + getSessionSeconds(session), 0)
    const fallbackNetSessionAmount = recentSessions.reduce((sum, session) => sum + getSessionNetAmount(session), 0)
    const fallbackTotalTopupAmount = recentTopups.reduce((sum, tx) => {
        if (tx?.status && tx.status !== 'succeeded') return sum
        const amount = Number(tx?.amount)
        return Number.isFinite(amount) ? sum + amount : sum
    }, 0)

    const totalSessionsCount = sessionSummary?.total_sessions ?? sessionTotal ?? recentSessions.length
    const activeSessionsCount = sessionSummary?.active_sessions ?? recentSessions.filter((session) => session.status === 'active' && !session.ended_at).length
    const streamedSessionsCount = sessionSummary?.streamed_sessions ?? fallbackStreamedSessions.length
    const preStreamSessionsCount = sessionSummary?.pre_stream_sessions ?? Math.max(0, recentSessions.length - fallbackStreamedSessions.length)
    const resumableSessionsCount = sessionSummary?.resumable_sessions ?? recentSessions.filter((session) => session.can_resume).length
    const stoppedSessionsCount = sessionSummary?.stopped_sessions ?? recentSessions.filter((session) => ['stopped', 'ended'].includes(session.status)).length
    const failedSessionsCount = sessionSummary?.failed_sessions ?? recentSessions.filter((session) => session.status === 'failed').length
    const totalSessionSeconds = sessionSummary?.total_play_seconds ?? fallbackTotalSessionSeconds
    const averageSessionSeconds = sessionSummary?.average_play_seconds ?? (fallbackStreamedSessions.length ? Math.round(fallbackTotalSessionSeconds / fallbackStreamedSessions.length) : 0)
    const totalSessionAmount = sessionSummary?.net_charged_amount ?? fallbackNetSessionAmount
    const totalFreeMinutes = sessionSummary?.total_free_minutes ?? recentSessions.reduce((sum, session) => sum + Number(session?.free_minutes_used || 0), 0)
    const totalChargedMinutes = sessionSummary?.total_charged_minutes ?? recentSessions.reduce((sum, session) => sum + Number(session?.charged_minutes || 0), 0)
    const totalTopupAmount = topupSummary?.total_succeeded_amount ?? fallbackTotalTopupAmount
    const pendingTopupAmount = topupSummary?.pending_amount ?? recentTopups.reduce((sum, tx) => tx?.status === 'pending' ? sum + Number(tx?.amount || 0) : sum, 0)
    const completionRate = totalSessionsCount ? Math.round((stoppedSessionsCount / totalSessionsCount) * 100) : 0

    const sessionBuckets = useMemo(() => {
        if (sessionSummary?.daily_buckets?.length) {
            return sessionSummary.daily_buckets.map((bucket) => ({
                key: bucket.date,
                date: new Date(`${bucket.date}T00:00:00`),
                label: new Date(`${bucket.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' }),
                dateLabel: formatShortDate(`${bucket.date}T00:00:00`),
                seconds: Number(bucket.play_seconds || 0),
                count: Number(bucket.session_count || 0),
                amount: Number(bucket.charged_amount || 0),
            }))
        }

        const recentDays = Array.from({ length: 7 }, (_, idx) => {
            const day = new Date()
            day.setHours(0, 0, 0, 0)
            day.setDate(day.getDate() - (6 - idx))
            return day
        })
        const buckets = recentDays.map((day) => ({
            key: makeDayKey(day),
            date: day,
            label: day.toLocaleDateString('vi-VN', { weekday: 'short' }),
            dateLabel: day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            seconds: 0,
            count: 0,
            amount: 0,
        }))
        const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))
        recentSessions.forEach((session) => {
            const seconds = getSessionSeconds(session)
            if (seconds <= 0) return
            if (!session?.started_at) return
            const started = new Date(session.billing_started_at || session.started_at)
            if (Number.isNaN(started.getTime())) return
            const bucket = bucketMap.get(makeDayKey(started))
            if (!bucket) return
            bucket.seconds += seconds
            bucket.count += 1
            bucket.amount += getSessionNetAmount(session)
        })
        return buckets
    }, [sessionSummary, recentSessions])
    const maxSessionActivity = Math.max(1, ...sessionBuckets.map((bucket) => bucket.seconds || bucket.count * 60))
    const weekTotalSeconds = sessionBuckets.reduce((sum, bucket) => sum + bucket.seconds, 0)
    const weekTotalAmount = sessionBuckets.reduce((sum, bucket) => sum + bucket.amount, 0)
    const weekSessionCount = sessionBuckets.reduce((sum, bucket) => sum + bucket.count, 0)

    const topMachines = useMemo(() => {
        if (sessionSummary?.top_machines?.length) {
            return sessionSummary.top_machines.map((machine) => ({
                key: machine.machine_id || machine.code,
                label: machine.code || 'Chưa gắn máy',
                detail: [machine.gpu, machine.location || machine.region].filter(Boolean).join(' • ') || '—',
                seconds: Number(machine.play_seconds || 0),
                count: Number(machine.session_count || 0),
                amount: Number(machine.charged_amount || 0),
            }))
        }

        const map = new Map()
        recentSessions.forEach((session) => {
            const seconds = getSessionSeconds(session)
            if (seconds <= 0) return
            const machine = session?.machine
            const key = machine?.code || session?.machine_id || 'unknown'
            const current = map.get(key) || {
                key,
                label: machine?.code || 'Chưa gắn máy',
                detail: [machine?.gpu, machine?.location || machine?.region].filter(Boolean).join(' • ') || '—',
                seconds: 0,
                count: 0,
                amount: 0,
            }
            current.seconds += seconds
            current.count += 1
            current.amount += getSessionNetAmount(session)
            map.set(key, current)
        })
        return Array.from(map.values())
            .sort((a, b) => (b.seconds - a.seconds) || (b.count - a.count))
            .slice(0, 4)
    }, [sessionSummary, recentSessions])
    const maxMachineSeconds = Math.max(1, ...topMachines.map((machine) => machine.seconds || machine.count * 60))

    const statusBreakdown = sessionSummary?.status_counts?.length
        ? sessionSummary.status_counts
        : [
            { key: 'streamed', label: 'Đã stream', count: streamedSessionsCount },
            { key: 'pre_stream', label: 'Chưa stream', count: preStreamSessionsCount },
            { key: 'active', label: 'Đang chạy', count: activeSessionsCount },
            { key: 'resume', label: 'Có snapshot', count: resumableSessionsCount },
            { key: 'failed', label: 'Lỗi', count: failedSessionsCount },
        ]
    const maxStatusCount = Math.max(1, ...statusBreakdown.map((item) => item.count))

    const timelineItems = [
        ...recentSessions.map((session) => ({
            id: `session-${session.id}`,
            type: 'session',
            date: session.billing_started_at || session.started_at || session.ended_at,
            title: session?.machine?.gpu ? `${session.machine.gpu} Gaming VM` : 'Phiên chơi',
            subtitle: getMachineLabel(session),
            meta: getSessionSeconds(session) > 0 ? `Stream ${formatDate(session.billing_started_at || session.started_at)}` : `Khởi tạo ${formatDate(session.started_at)}`,
            duration: formatSessionDuration(session),
        })),
        ...recentTopups.map((tx) => ({
            id: `topup-${tx.id}`,
            type: 'topup',
            date: tx.created_at,
            title: 'Nạp tiền',
            subtitle: tx.description || 'Nạp vào ví',
            meta: formatDate(tx.created_at),
            amount: formatMoney(tx.amount),
        })),
    ]
        .filter((item) => item.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 8)

    return (
        <div className="stack history-page">
            <div className="section-head history-hero">
                <div>
                    <p className="muted">Các hoạt động gần đây</p>
                    <h2>Lịch sử</h2>
                    <span>Theo dõi phiên chơi, giao dịch và các hành động có thể tiếp tục.</span>
                </div>
                <div className="actions">
                    <button className="btn ghost" onClick={() => setExportOpen(true)}>
                        Xuất báo cáo
                    </button>
                </div>
            </div>

            {summaryError && <div className="alert warning">{summaryError}</div>}

            <div className="history-summary-grid">
                <div className="history-summary-card">
                    <div className="history-stat-icon cyan"><Gamepad2 size={20} /></div>
                    <div>
                        <span>Tổng phiên khởi tạo</span>
                        <strong>{summaryLoading ? '...' : totalSessionsCount}</strong>
                        <p>{streamedSessionsCount} đã stream · {preStreamSessionsCount} chưa stream</p>
                    </div>
                </div>
                <div className="history-summary-card">
                    <div className="history-stat-icon violet"><Clock3 size={20} /></div>
                    <div>
                        <span>Thời gian stream</span>
                        <strong>{summaryLoading ? '...' : formatDurationSeconds(totalSessionSeconds)}</strong>
                        <p>TB {formatCompactDuration(averageSessionSeconds)}/phiên đã stream</p>
                    </div>
                </div>
                <div className="history-summary-card">
                    <div className="history-stat-icon emerald"><RotateCcw size={20} /></div>
                    <div>
                        <span>Có thể tiếp tục</span>
                        <strong>{summaryLoading ? '...' : resumableSessionsCount}</strong>
                        <p>{activeSessionsCount} đang chạy · {completionRate}% đã dừng</p>
                    </div>
                </div>
                <div className="history-summary-card">
                    <div className="history-stat-icon amber"><Wallet size={20} /></div>
                    <div>
                        <span>Chi phí stream</span>
                        <strong>{summaryLoading ? '...' : formatMoney(totalSessionAmount)}</strong>
                        <p>Nạp ví {formatCompactMoney(totalTopupAmount)}{pendingTopupAmount > 0 ? ` · chờ ${formatCompactMoney(pendingTopupAmount)}` : ''} · free {totalFreeMinutes}p · trả phí {totalChargedMinutes}p</p>
                    </div>
                </div>
            </div>

            <div className="history-insights">
                <div className="card history-chart">
                    <div className="history-panel-head">
                        <div>
                            <p className="muted">Tổng quan 7 ngày</p>
                            <h3>Thời lượng chơi theo ngày</h3>
                        </div>
                        <div className="history-chart-legend">
                            <span><i /> Phút chơi</span>
                            <strong>{weekSessionCount} phiên</strong>
                        </div>
                    </div>
                    <div className="history-bars">
                        {sessionBuckets.map((bucket) => {
                            const activity = bucket.seconds || bucket.count * 60
                            const height = activity > 0 ? Math.max(12, Math.round((activity / maxSessionActivity) * 100)) : 4
                            return (
                                <div
                                    key={bucket.key}
                                    className="history-bar"
                                    title={`${bucket.dateLabel}: ${bucket.count} phiên, ${formatCompactDuration(bucket.seconds)}, ${formatMoney(bucket.amount)}`}
                                >
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ height: `${height}%` }} />
                                    </div>
                                    <em>{formatCompactDuration(bucket.seconds)}</em>
                                    <span>{bucket.label}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="history-chart-meta">
                        <div>
                            <span>Tổng giờ tuần</span>
                            <strong>{formatCompactDuration(weekTotalSeconds)}</strong>
                        </div>
                        <div>
                            <span>Chi phí tuần</span>
                            <strong>{formatMoney(weekTotalAmount)}</strong>
                        </div>
                        <div>
                            <span>Phiên tuần</span>
                            <strong>{weekSessionCount}</strong>
                        </div>
                    </div>
                </div>

                <div className="history-side-grid">
                    <div className="card history-breakdown-card">
                        <div className="history-panel-head compact">
                            <div>
                                <p className="muted">Phân bổ máy</p>
                                <h3>Máy dùng nhiều</h3>
                            </div>
                            <Server size={18} />
                        </div>
                        <div className="history-ranking-list">
                            {topMachines.length === 0 && <div className="history-empty">Chưa có dữ liệu máy.</div>}
                            {topMachines.map((machine) => {
                                const width = Math.max(8, Math.round(((machine.seconds || machine.count * 60) / maxMachineSeconds) * 100))
                                return (
                                    <div className="history-rank-row" key={machine.key}>
                                        <div>
                                            <strong>{machine.label}</strong>
                                            <span>{machine.detail}</span>
                                        </div>
                                        <em>{formatCompactDuration(machine.seconds)}</em>
                                        <div className="rank-track"><i style={{ width: `${width}%` }} /></div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="card history-breakdown-card">
                        <div className="history-panel-head compact">
                            <div>
                                <p className="muted">Tình trạng</p>
                                <h3>Trạng thái phiên</h3>
                            </div>
                            <BarChart3 size={18} />
                        </div>
                        <div className="history-status-bars">
                            {statusBreakdown.map((item) => (
                                <div key={item.key} className={`history-status-row ${item.key}`}>
                                    <span>{item.label}</span>
                                    <div><i style={{ width: `${Math.round((item.count / maxStatusCount) * 100)}%` }} /></div>
                                    <strong>{item.count}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card history-timeline">
                    <div className="history-panel-head compact">
                        <div>
                            <p className="muted">Gần đây</p>
                            <h3>Timeline hoạt động</h3>
                        </div>
                        <CreditCard size={18} />
                    </div>
                    {timelineItems.length === 0 && (
                        <div className="history-empty">Chưa có hoạt động gần đây.</div>
                    )}
                    {timelineItems.length > 0 && (
                        <div className="timeline-list">
                            {timelineItems.map((item) => (
                                <div key={item.id} className={`timeline-item ${item.type}`}>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <p className="muted">{item.subtitle}</p>
                                    </div>
                                    <div className="timeline-meta">
                                        <span>{item.meta}</span>
                                        {item.duration && <strong>{item.duration}</strong>}
                                        {item.amount && <strong>+{item.amount}</strong>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="tab-nav">
                <button
                    className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                >
                    Phiên chơi
                </button>
                <button
                    className={`tab-btn ${activeTab === 'topup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('topup')}
                >
                    Nạp tiền
                </button>
            </div>

            {/* Session History */}
            {activeTab === 'sessions' && (
                <div className="history-content">
                    <div className="history-toolbar">
                        <div>
                            <strong>Phiên chơi</strong>
                            <span>{sessionTotal} phiên trong lịch sử</span>
                        </div>
                        <div className="history-filters">
                            <label className="field">
                                Trạng thái
                                <select
                                    value={sessionStatusFilter}
                                    onChange={(e) => {
                                        setSessionStatusFilter(e.target.value)
                                        setSessionPage(1)
                                    }}
                                >
                                    <option value="">Tất cả</option>
                                    <option value="active">Đang chạy</option>
                                    <option value="stopped">Đã dừng</option>
                                </select>
                            </label>
                            <label className="field">
                                Sắp xếp
                                <select
                                    value={sessionSort}
                                    onChange={(e) => {
                                        setSessionSort(e.target.value)
                                        setSessionPage(1)
                                    }}
                                >
                                    <option value="recent">Mới nhất</option>
                                    <option value="oldest">Cũ nhất</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {sessionLoading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p className="muted">Đang tải lịch sử phiên...</p>
                        </div>
                    )}

                    {sessionError && <div className="alert error">{sessionError}</div>}
                    {sessionActionError && <div className="alert error">{sessionActionError}</div>}

                    {!sessionLoading && !sessionError && sessionHistory.length === 0 && (
                        <div className="empty-state compact">
                            <div className="empty-icon">🎮</div>
                            <div>
                                <h3>Chưa có phiên chơi nào</h3>
                                <p className="muted">Bắt đầu phiên chơi đầu tiên để xem lịch sử tại đây.</p>
                            </div>
                            <a className="btn primary" href="/app/machines">Bắt đầu ngay</a>
                        </div>
                    )}

                    {!sessionLoading && !sessionError && sessionHistory.length > 0 && (
                        <>
                            <div className="history-table session-table">
                                <div className="table-header">
                                    <div className="col-date">Thời gian</div>
                                    <div className="col-machine">Máy</div>
                                    <div className="col-duration">Thời lượng</div>
                                    <div className="col-cost">Chi phí</div>
                                    <div className="col-status">Trạng thái</div>
                                    <div className="col-actions">Thao tác</div>
                                </div>
                                {sessionHistory.map((session) => {
                                    const isActive = session.status === 'active' && !session.ended_at
                                    const canResume = Boolean(session.can_resume)
                                    const sessionCost = getSessionNetAmount(session)
                                    return (
                                        <div key={session.id} className="table-row">
                                            <div className="col-date">
                                                <div>Khởi tạo: {formatDate(session.started_at)}</div>
                                                <div className="muted">Stream: {session.billing_started_at ? formatDate(session.billing_started_at) : 'Chưa bắt đầu'}</div>
                                                <div className="muted">Kết thúc: {formatDate(session.ended_at)}</div>
                                            </div>
                                            <div className="col-machine">
                                                <div>{getMachineLabel(session)}</div>
                                                <div className="muted">{getMachineDetail(session)}</div>
                                                <div className="history-session-flags">
                                                    <span className={session.vpn_online ? 'ok' : ''}>VPN</span>
                                                    <span className={session.sunshine_paired ? 'ok' : ''}>Sunshine</span>
                                                    <span className={session.moonlight_ready ? 'ok' : ''}>Moonlight</span>
                                                </div>
                                            </div>
                                            <div className="col-duration">{formatSessionDuration(session)}</div>
                                            <div className="col-cost">
                                                <strong>{formatMoney(sessionCost)}</strong>
                                                <span className="muted">{Number(session.free_minutes_used || 0)}p free · {Number(session.charged_minutes || 0)}p phí</span>
                                            </div>
                                            <div className="col-status">{getSessionStatusBadge(session)}</div>
                                            <div className="col-actions">
                                                {isActive && (
                                                    <button
                                                        className="btn ghost small"
                                                        onClick={() => handleOpenWizard(session)}
                                                    >
                                                        Mở khởi tạo
                                                    </button>
                                                )}
                                                {canResume && (
                                                    <button
                                                        className="btn primary small"
                                                        onClick={() => handleResumeSession(session)}
                                                        disabled={resumeLoadingId === session.id}
                                                    >
                                                        {resumeLoadingId === session.id ? 'Đang xử lý...' : 'Tiếp tục'}
                                                    </button>
                                                )}
                                                {!isActive && !canResume && <span className="muted">—</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="pagination">
                                <div className="muted">Trang {sessionPage}/{sessionTotalPages} · {sessionTotal} phiên</div>
                                <div className="actions">
                                    <button
                                        className="btn ghost"
                                        disabled={sessionPage <= 1}
                                        onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                                    >
                                        Trước
                                    </button>
                                    <button
                                        className="btn ghost"
                                        disabled={sessionPage >= sessionTotalPages}
                                        onClick={() => setSessionPage((p) => Math.min(sessionTotalPages, p + 1))}
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Topup History */}
            {activeTab === 'topup' && (
                <div className="history-content">
                    {/* Filters */}
                    <div className="history-toolbar">
                        <div>
                            <strong>Nạp tiền</strong>
                            <span>{topupTotal} giao dịch trong lịch sử</span>
                        </div>
                        <div className="history-filters">
                            <label className="field">
                                Trạng thái
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value)
                                        setPage(1)
                                    }}
                                >
                                    <option value="">Tất cả</option>
                                    <option value="succeeded">Thành công</option>
                                    <option value="pending">Đang xử lý</option>
                                    <option value="failed">Thất bại</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {topupLoading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p className="muted">Đang tải...</p>
                        </div>
                    )}

                    {topupError && <div className="alert error">{topupError}</div>}

                    {!topupLoading && !topupError && topupHistory.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">💸</div>
                            <h3>Chưa có giao dịch nào</h3>
                            <p className="muted">Nạp tiền để bắt đầu sử dụng dịch vụ</p>
                            <button className="btn primary" onClick={ctx?.openTopup}>Nạp tiền ngay</button>
                        </div>
                    )}

                    {!topupLoading && topupHistory.length > 0 && (
                        <>
                            <div className="history-table">
                                <div className="table-header">
                                    <div className="col-date">Thời gian</div>
                                    <div className="col-amount">Số tiền</div>
                                    <div className="col-status">Trạng thái</div>
                                    <div className="col-desc">Ghi chú</div>
                                </div>
                                {topupHistory.map((tx) => (
                                    <div key={tx.id} className="table-row">
                                        <div className="col-date">{formatDate(tx.created_at)}</div>
                                        <div className={`col-amount amount-value ${tx.status === 'succeeded' ? '' : 'muted-amount'}`}>
                                            {tx.status === 'succeeded' ? '+' : ''}{formatMoney(tx.amount)}
                                        </div>
                                        <div className="col-status">{getStatusBadge(tx.status)}</div>
                                        <div className="col-desc muted">{tx.description || '—'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            <div className="pagination">
                                <div className="muted">Trang {page}/{totalPages} · {topupTotal} giao dịch</div>
                                <div className="actions">
                                    <button
                                        className="btn ghost"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Trước
                                    </button>
                                    <button
                                        className="btn ghost"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Info Card */}
            <details className="history-policy">
                <summary>Chính sách lưu trữ</summary>
                <ul className="info-list">
                    <li>Lưu snapshot phiên gần nhất kèm timestamp để resume.</li>
                    <li>Xoá snapshot cũ theo quota; luôn ưu tiên golden image fallback.</li>
                    <li>Log hoạt động tối giản, ẩn thông tin nhạy cảm khỏi UI.</li>
                    <li>Lịch sử giao dịch được lưu trữ vĩnh viễn để tra cứu.</li>
                </ul>
            </details>

            {/* Export Report Modal */}
            <ExportReportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                activeTab={activeTab}
                token={ctx?.token}
            />
        </div>
    )
}

function ExportReportModal({ open, onClose, activeTab, token }) {
    const [reportType, setReportType] = useState(activeTab)
    const [format, setFormat] = useState('csv')
    const [timeRange, setTimeRange] = useState('30')
    const [exporting, setExporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [statusText, setStatusText] = useState('')
    const [success, setSuccess] = useState(false)
    const [exportError, setExportError] = useState('')
    const [lastFilename, setLastFilename] = useState('')

    useEffect(() => {
        if (open) {
            setReportType(activeTab)
            setExporting(false)
            setProgress(0)
            setStatusText('')
            setSuccess(false)
            setExportError('')
            setLastFilename('')
        }
    }, [open, activeTab])

    if (!open) return null

    const rangeStart = () => {
        if (timeRange === 'all') return null
        const days = Number(timeRange)
        if (!Number.isFinite(days)) return null
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        start.setDate(start.getDate() - (days - 1))
        return start
    }

    const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const exportDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : ''
    const exportDuration = (seconds) => {
        const total = Number(seconds || 0)
        const hours = Math.floor(total / 3600)
        const minutes = Math.floor((total % 3600) / 60)
        const sec = Math.floor(total % 60)
        return [hours, minutes, sec].map((part) => String(part).padStart(2, '0')).join(':')
    }
    const sessionAmount = (session) => Math.max(0, Number(session?.charged_amount || 0) - Number(session?.refunded_amount || 0))
    const statusLabel = (status) => {
        if (status === 'succeeded') return 'Thành công'
        if (status === 'pending') return 'Đang xử lý'
        if (status === 'failed') return 'Thất bại'
        if (status === 'active') return 'Đang chạy'
        if (status === 'stopped') return 'Đã dừng'
        return status || ''
    }

    const fetchAllSessions = async () => {
        const items = []
        let page = 1
        let totalPages = 1
        const start = rangeStart()
        do {
            const data = await getSessionHistory({
                page,
                pageSize: HISTORY_EXPORT_PAGE_SIZE,
                sort: 'recent',
                dateFrom: start ? start.toISOString() : undefined,
            }, token)
            items.push(...(data.items || []))
            const size = data.page_size || HISTORY_EXPORT_PAGE_SIZE
            totalPages = Math.max(1, Math.ceil((data.total || 0) / size))
            page += 1
        } while (page <= totalPages && page <= 40)
        return items
    }

    const fetchAllTopups = async () => {
        const items = []
        let page = 1
        let totalPages = 1
        do {
            const data = await getTopupHistory({ page, pageSize: HISTORY_EXPORT_PAGE_SIZE }, token)
            items.push(...(data.items || []))
            const size = data.page_size || HISTORY_EXPORT_PAGE_SIZE
            totalPages = Math.max(1, Math.ceil((data.total || 0) / size))
            page += 1
        } while (page <= totalPages && page <= 40)

        const start = rangeStart()
        if (!start) return items
        return items.filter((item) => {
            const created = new Date(item.created_at)
            return !Number.isNaN(created.getTime()) && created >= start
        })
    }

    const buildSessionCsv = (sessions) => {
        const header = [
            'Mã phiên', 'Mã máy', 'GPU', 'Khu vực', 'Trạng thái', 'Khởi tạo', 'Bắt đầu stream',
            'Kết thúc', 'Thời gian stream', 'Free phút', 'Trả phí phút', 'Chi phí', 'Hoàn tiền',
            'IP VPN', 'VPN', 'Sunshine', 'Moonlight', 'Snapshot', 'Lý do dừng',
        ]
        const rows = sessions.map((session) => [
            session.id,
            session.machine?.code || session.machine_id || '',
            session.machine?.gpu || '',
            session.machine?.location || session.machine?.region || '',
            statusLabel(session.status),
            exportDate(session.started_at),
            exportDate(session.billing_started_at),
            exportDate(session.ended_at),
            exportDuration(session.duration_seconds),
            session.free_minutes_used || 0,
            session.charged_minutes || 0,
            sessionAmount(session),
            session.refunded_amount || 0,
            session.ip_address || '',
            session.vpn_online ? 'Online' : 'Chưa online',
            session.sunshine_paired ? 'Đã pair' : 'Chưa pair',
            session.moonlight_ready ? 'Ready' : 'Chưa ready',
            session.snapshot_retained ? 'Có' : 'Không',
            session.stop_reason || '',
        ])
        return `\uFEFF${header.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}`
    }

    const buildTopupCsv = (topups) => {
        const header = ['Mã giao dịch', 'Thời gian tạo', 'Hoàn thành', 'Số tiền', 'Trạng thái', 'Số dư trước', 'Số dư sau', 'Nhà cung cấp', 'Mã cổng thanh toán', 'Ghi chú']
        const rows = topups.map((tx) => [
            tx.id,
            exportDate(tx.created_at),
            exportDate(tx.completed_at),
            tx.amount || 0,
            statusLabel(tx.status),
            tx.balance_before || 0,
            tx.balance_after || 0,
            tx.provider || '',
            tx.trans_id || '',
            tx.description || '',
        ])
        return `\uFEFF${header.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}`
    }

    const buildAllCsv = (sessions, topups) => {
        const header = ['Loại', 'Thời gian', 'Mã', 'Thông tin', 'Trạng thái', 'Thời gian chơi', 'Giá trị']
        const sessionRows = sessions.map((session) => ({
            sortDate: session.billing_started_at || session.started_at,
            row: [
                'Phiên chơi',
                exportDate(session.billing_started_at || session.started_at),
                session.id,
                `${session.machine?.code || 'Chưa gắn máy'} ${session.machine?.gpu || ''}`.trim(),
                statusLabel(session.status),
                exportDuration(session.duration_seconds),
                sessionAmount(session),
            ],
        }))
        const topupRows = topups.map((tx) => ({
            sortDate: tx.completed_at || tx.created_at,
            row: [
                'Nạp tiền',
                exportDate(tx.completed_at || tx.created_at),
                tx.id,
                tx.description || tx.provider || '',
                statusLabel(tx.status),
                '',
                tx.amount || 0,
            ],
        }))
        const rows = [...sessionRows, ...topupRows]
            .sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0))
            .map((item) => item.row)
        return `\uFEFF${header.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}`
    }

    const downloadFile = (content, filename) => {
        const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;'
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleStartExport = async () => {
        if (!token) {
            setExportError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
            return
        }

        setExporting(true)
        setSuccess(false)
        setExportError('')
        setProgress(10)
        setStatusText('Đang lấy dữ liệu báo cáo...')

        try {
            let sessions = []
            let topups = []
            if (reportType === 'sessions' || reportType === 'all') {
                sessions = await fetchAllSessions()
            }
            setProgress(55)
            if (reportType === 'topup' || reportType === 'all') {
                topups = await fetchAllTopups()
            }
            setProgress(82)
            setStatusText('Đang tạo file tải xuống...')

            const dateString = new Date().toISOString().slice(0, 10)
            const extension = format === 'csv' ? 'csv' : 'json'
            const filename = `bao-cao-${reportType}-${timeRange}-${dateString}.${extension}`
            let content = ''

            if (format === 'json') {
                content = JSON.stringify({
                    report_type: reportType,
                    time_range: timeRange,
                    exported_at: new Date().toISOString(),
                    sessions,
                    topups,
                }, null, 2)
            } else if (reportType === 'sessions') {
                content = buildSessionCsv(sessions)
            } else if (reportType === 'topup') {
                content = buildTopupCsv(topups)
            } else {
                content = buildAllCsv(sessions, topups)
            }

            downloadFile(content, filename)
            setLastFilename(filename)
            setProgress(100)
            setStatusText('Xuất báo cáo thành công.')
            setSuccess(true)
        } catch (err) {
            setExportError(err.message || 'Không thể xuất báo cáo. Vui lòng thử lại.')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ animation: 'fadeIn 0.2s ease' }}>
            <div className="modal" style={{ width: 'min(520px, 100%)' }}>
                <div className="modal-header">
                    <h3>Xuất báo cáo dữ liệu</h3>
                    <button className="btn ghost" onClick={onClose} disabled={exporting}>Đóng</button>
                </div>

                <div className="export-modal-body">
                    {!exporting && !success && (
                        <>
                            <div className="export-grid">
                                <div>
                                    <span className="export-section-title">Loại báo cáo</span>
                                    <div className="option-cards">
                                        <button className={`option-card-btn ${reportType === 'sessions' ? 'active' : ''}`} onClick={() => setReportType('sessions')}>
                                            <span className="option-card-label">Phiên chơi</span>
                                        </button>
                                        <button className={`option-card-btn ${reportType === 'topup' ? 'active' : ''}`} onClick={() => setReportType('topup')}>
                                            <span className="option-card-label">Giao dịch</span>
                                        </button>
                                        <button className={`option-card-btn ${reportType === 'all' ? 'active' : ''}`} onClick={() => setReportType('all')}>
                                            <span className="option-card-label">Tất cả</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <span className="export-section-title">Định dạng</span>
                                    <div className="option-cards">
                                        <button className={`option-card-btn ${format === 'csv' ? 'active' : ''}`} onClick={() => setFormat('csv')}>
                                            <span className="option-card-label">CSV</span>
                                        </button>
                                        <button className={`option-card-btn ${format === 'json' ? 'active' : ''}`} onClick={() => setFormat('json')}>
                                            <span className="option-card-label">JSON</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <span className="export-section-title">Khoảng thời gian</span>
                                    <div className="option-cards">
                                        <button className={`option-card-btn ${timeRange === '7' ? 'active' : ''}`} onClick={() => setTimeRange('7')}>
                                            <span className="option-card-label">7 ngày</span>
                                        </button>
                                        <button className={`option-card-btn ${timeRange === '30' ? 'active' : ''}`} onClick={() => setTimeRange('30')}>
                                            <span className="option-card-label">30 ngày</span>
                                        </button>
                                        <button className={`option-card-btn ${timeRange === 'all' ? 'active' : ''}`} onClick={() => setTimeRange('all')}>
                                            <span className="option-card-label">Tất cả</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="card info export-note">
                                Báo cáo lấy dữ liệu trực tiếp từ API lịch sử, gồm phiên chơi thật, chi phí, trạng thái VPN/Sunshine/Moonlight và giao dịch nạp tiền.
                            </div>

                            {exportError && <div className="alert error">{exportError}</div>}

                            <button className="btn primary full-width export-submit" onClick={handleStartExport}>
                                Bắt đầu xuất báo cáo
                            </button>
                        </>
                    )}

                    {exporting && (
                        <div className="export-progress-area">
                            <span className="spinner" style={{ width: '28px', height: '28px' }} />
                            <span className="export-progress-status">{statusText}</span>
                            <div className="export-progress-track">
                                <div className="export-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="export-progress-percent">{progress}% hoàn tất</span>
                        </div>
                    )}

                    {success && (
                        <div className="export-success-message">
                            <h4>Tải xuống thành công</h4>
                            <p>File <strong>{lastFilename}</strong> đã được tạo từ dữ liệu lịch sử hiện tại.</p>
                            <button className="btn secondary full-width" style={{ marginTop: '8px' }} onClick={onClose}>
                                Hoàn tất
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default History
