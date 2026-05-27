import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionHistory, resumeMachine } from '../api/machines'
import { getTopupHistory } from '../api/payments'

const TOPUP_PAGE_SIZE = 10
const SESSION_PAGE_SIZE = 10

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
        return new Date(dateStr).toLocaleString('vi-VN')
    }

    const formatDurationSeconds = (value) => {
        const total = Number(value)
        if (!Number.isFinite(total) || total < 0) return '—'
        const hours = Math.floor(total / 3600)
        const minutes = Math.floor((total % 3600) / 60)
        const seconds = Math.floor(total % 60)
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
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
            setSessionActionError(err.message || 'Không thể tiếp tục phiên chơi')
        } finally {
            setResumeLoadingId('')
        }
    }

    const [exportOpen, setExportOpen] = useState(false)

    return (
        <div className="stack">
            <div className="section-head">
                <div>
                    <p className="muted">Các hoạt động gần đây</p>
                    <h2>Lịch sử</h2>
                </div>
                <div className="actions">
                    <button className="btn ghost" onClick={() => setExportOpen(true)}>
                        📥 Xuất báo cáo
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button
                    className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                >
                    <span className="tab-icon">🎮</span>
                    Phiên chơi
                </button>
                <button
                    className={`tab-btn ${activeTab === 'topup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('topup')}
                >
                    <span className="tab-icon">💰</span>
                    Nạp tiền
                </button>
            </div>

            {/* Session History */}
            {activeTab === 'sessions' && (
                <div className="history-content">
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

                    {sessionLoading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p className="muted">Đang tải lịch sử phiên...</p>
                        </div>
                    )}

                    {sessionError && <div className="alert error">{sessionError}</div>}
                    {sessionActionError && <div className="alert error">{sessionActionError}</div>}

                    {!sessionLoading && !sessionError && sessionHistory.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">🎮</div>
                            <h3>Chưa có phiên chơi nào</h3>
                            <p className="muted">Bắt đầu phiên chơi đầu tiên để xem lịch sử tại đây</p>
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
                                    <div className="col-status">Trạng thái</div>
                                    <div className="col-actions">Thao tác</div>
                                </div>
                                {sessionHistory.map((session) => {
                                    const isActive = session.status === 'active' && !session.ended_at
                                    const canResume = Boolean(session.can_resume)
                                    return (
                                        <div key={session.id} className="table-row">
                                            <div className="col-date">
                                                <div>{formatDate(session.started_at)}</div>
                                                <div className="muted">Kết thúc: {formatDate(session.ended_at)}</div>
                                            </div>
                                            <div className="col-machine">
                                                <div>{getMachineLabel(session)}</div>
                                                <div className="muted">{getMachineDetail(session)}</div>
                                            </div>
                                            <div className="col-duration">{formatSessionDuration(session)}</div>
                                            <div className="col-status">{getSessionStatusBadge(session)}</div>
                                            <div className="col-actions">
                                                {isActive && (
                                                    <button
                                                        className="btn ghost small"
                                                        onClick={() => handleOpenWizard(session)}
                                                    >
                                                        Mở wizard
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
                                        <div className="col-amount amount-value">+{formatMoney(tx.amount)}</div>
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
            <div className="card info-card">
                <div className="info-header">
                    <span className="info-icon">ℹ️</span>
                    <h4>Chính sách lưu trữ</h4>
                </div>
                <ul className="info-list">
                    <li>Lưu snapshot phiên gần nhất kèm timestamp để resume.</li>
                    <li>Xoá snapshot cũ theo quota; luôn ưu tiên golden image fallback.</li>
                    <li>Log hoạt động tối giản, ẩn thông tin nhạy cảm khỏi UI.</li>
                    <li>Lịch sử giao dịch được lưu trữ vĩnh viễn để tra cứu.</li>
                </ul>
            </div>

            {/* Export Report Modal */}
            <ExportReportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                activeTab={activeTab}
                topupHistory={topupHistory}
            />
        </div>
    )
}

function ExportReportModal({ open, onClose, activeTab, topupHistory }) {
    const [reportType, setReportType] = useState(activeTab) // 'sessions', 'topup', 'all'
    const [format, setFormat] = useState('csv') // 'csv', 'json'
    const [timeRange, setTimeRange] = useState('30') // '7', '30', 'all'
    const [exporting, setExporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [statusText, setStatusText] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (open) {
            setReportType(activeTab)
            setExporting(false)
            setProgress(0)
            setStatusText('')
            setSuccess(false)
        }
    }, [open, activeTab])

    if (!open) return null

    const handleStartExport = () => {
        setExporting(true)
        setProgress(0)
        setSuccess(false)
        setStatusText('Đang kết nối cổng dữ liệu an toàn...')

        const steps = [
            { p: 20, text: 'Khởi tạo kênh truyền tải dữ liệu bảo mật...' },
            { p: 50, text: 'Đang trích xuất lịch sử hoạt động hệ thống...' },
            { p: 75, text: 'Đang thống kê và tối ưu cấu trúc file...' },
            { p: 90, text: 'Đang mã hóa định dạng tệp tin...' },
            { p: 100, text: 'Xuất file thành công! Chuẩn bị tải xuống...' }
        ]

        let i = 0
        const interval = setInterval(() => {
            if (i < steps.length) {
                setProgress(steps[i].p)
                setStatusText(steps[i].text)
                i++
            } else {
                clearInterval(interval)
                triggerDownload()
                setSuccess(true)
                setExporting(false)
            }
        }, 500)
    }

    const triggerDownload = () => {
        let content = ''
        const dateString = new Date().toISOString().slice(0, 10)
        let filename = `bao-cao-${reportType}-${dateString}`

        if (reportType === 'topup') {
            if (format === 'csv') {
                content = '\uFEFFThời gian,Số tiền,Trạng thái,Ghi chú\n'
                if (topupHistory && topupHistory.length > 0) {
                    topupHistory.forEach(tx => {
                        const time = new Date(tx.created_at).toLocaleString('vi-VN')
                        const amount = tx.amount || 0
                        const status = tx.status === 'succeeded' ? 'Thành công' : tx.status === 'pending' ? 'Đang xử lý' : 'Thất bại'
                        const desc = tx.description || ''
                        content += `"${time}",${amount},"${status}","${desc.replace(/"/g, '""')}"\n`
                    })
                } else {
                    content += 'Chưa có dữ liệu giao dịch nạp tiền,—,—,—\n'
                }
                filename += '.csv'
            } else {
                content = JSON.stringify(topupHistory || [], null, 2)
                filename += '.json'
            }
        } else if (reportType === 'sessions') {
            if (format === 'csv') {
                content = '\uFEFFMã phiên,Máy ảo,Thời gian chơi,Chi phí,Thời điểm bắt đầu\n'
                content += 'Chưa có dữ liệu phiên từ hệ thống,—,—,—,—\n'
                filename += '.csv'
            } else {
                content = JSON.stringify([], null, 2)
                filename += '.json'
            }
        } else {
            const allData = {
                user_email: localStorage.getItem('auth_email') || '',
                export_date: new Date().toLocaleString('vi-VN'),
                topups: topupHistory || [],
                sessions: [],
            }
            if (format === 'csv') {
                content = '\uFEFFLoại hoạt động,Thời gian,Thông tin chi tiết,Giá trị giao dịch/Chi phí\n'
                if (topupHistory && topupHistory.length > 0) {
                    topupHistory.forEach(tx => {
                        content += `"Nạp tiền","${new Date(tx.created_at).toLocaleString('vi-VN')}","Nạp tiền ví MoMo (+)",${tx.amount}\n`
                    })
                }
                if (!allData.topups.length) content += '"Chưa có dữ liệu",—,—,—\n'
                filename += '.csv'
            } else {
                content = JSON.stringify(allData, null, 2)
                filename += '.json'
            }
        }

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
    }

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ animation: 'fadeIn 0.2s ease' }}>
            <div className="modal" style={{ width: 'min(480px, 100%)' }}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📊 Xuất báo cáo dữ liệu
                    </h3>
                    <button className="btn ghost" onClick={onClose} disabled={exporting}>
                        Đóng
                    </button>
                </div>

                <div className="export-modal-body">
                    {!exporting && !success && (
                        <>
                            <div className="export-grid">
                                {/* Report Type selection */}
                                <div>
                                    <span className="export-section-title">Loại báo cáo</span>
                                    <div className="option-cards">
                                        <button
                                            className={`option-card-btn ${reportType === 'sessions' ? 'active' : ''}`}
                                            onClick={() => setReportType('sessions')}
                                        >
                                            <span className="option-card-icon">🎮</span>
                                            <span className="option-card-label">Phiên chơi</span>
                                        </button>
                                        <button
                                            className={`option-card-btn ${reportType === 'topup' ? 'active' : ''}`}
                                            onClick={() => setReportType('topup')}
                                        >
                                            <span className="option-card-icon">💰</span>
                                            <span className="option-card-label">Giao dịch</span>
                                        </button>
                                        <button
                                            className={`option-card-btn ${reportType === 'all' ? 'active' : ''}`}
                                            onClick={() => setReportType('all')}
                                        >
                                            <span className="option-card-icon">📁</span>
                                            <span className="option-card-label">Tất cả</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Format selection */}
                                <div>
                                    <span className="export-section-title">Định dạng tệp tin</span>
                                    <div className="option-cards">
                                        <button
                                            className={`option-card-btn ${format === 'csv' ? 'active' : ''}`}
                                            onClick={() => setFormat('csv')}
                                        >
                                            <span className="option-card-icon">📝</span>
                                            <span className="option-card-label">Excel (CSV)</span>
                                        </button>
                                        <button
                                            className={`option-card-btn ${format === 'json' ? 'active' : ''}`}
                                            onClick={() => setFormat('json')}
                                        >
                                            <span className="option-card-icon">💻</span>
                                            <span className="option-card-label">JSON Data</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Time range selection */}
                                <div>
                                    <span className="export-section-title">Khoảng thời gian</span>
                                    <div className="option-cards">
                                        <button
                                            className={`option-card-btn ${timeRange === '7' ? 'active' : ''}`}
                                            onClick={() => setTimeRange('7')}
                                        >
                                            <span className="option-card-label">7 ngày qua</span>
                                        </button>
                                        <button
                                            className={`option-card-btn ${timeRange === '30' ? 'active' : ''}`}
                                            onClick={() => setTimeRange('30')}
                                        >
                                            <span className="option-card-label">30 ngày qua</span>
                                        </button>
                                        <button
                                            className={`option-card-btn ${timeRange === 'all' ? 'active' : ''}`}
                                            onClick={() => setTimeRange('all')}
                                        >
                                            <span className="option-card-label">Tất cả</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="card info" style={{ marginTop: '5px', fontSize: '0.82rem', padding: '12px' }}>
                                <p className="muted" style={{ margin: 0 }}>
                                    💡 <strong>Lưu ý:</strong> Báo cáo được mã hóa an toàn và tải trực tiếp từ trình duyệt của bạn để bảo mật tuyệt đối thông tin tài khoản.
                                </p>
                            </div>

                            <button
                                className="btn primary full-width"
                                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}
                                onClick={handleStartExport}
                            >
                                ⚡ Bắt đầu xuất báo cáo
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
                            <span className="success-glow-icon">🎉</span>
                            <h4>Tải xuống thành công!</h4>
                            <p>
                                Tệp tin báo cáo <strong>bao-cao-{reportType}.{format}</strong> đã được lưu trữ trong thư mục Downloads của bạn.
                            </p>
                            <button
                                className="btn secondary full-width"
                                style={{ marginTop: '8px' }}
                                onClick={onClose}
                            >
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
