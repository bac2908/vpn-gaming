import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import {
    createMachine,
    listAdminMachines,
    listUsers,
    updateMachine,
    updateUser,
    adminListTopupTransactions,
    getDashboard,
    getMachineStatistics,
    deleteMachine,
    listSessions,
    stopSession,
    getRevenueStatistics,
    adminTopupUser,
    getAdminSettings,
    updateAdminSettings,
} from '../api/admin'
import './admin.css'
import {
    AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

/* ============================================================
   HELPERS
   ============================================================ */

const getCountryData = (region) => {
    const r = String(region || '').toLowerCase()
    if (r.includes('singapore') || r.includes('sg')) return { flag: '🇸🇬', name: 'Singapore', flagUrl: 'https://flagcdn.com/sg.svg' }
    if (r.includes('vietnam') || r.includes('viet') || r.includes('vn') || r.includes('hanoi') || r.includes('saigon') || r.includes('ho chi minh')) return { flag: '🇻🇳', name: 'Việt Nam', flagUrl: 'https://flagcdn.com/vn.svg' }
    if (r.includes('japan') || r.includes('jp') || r.includes('tokyo')) return { flag: '🇯🇵', name: 'Japan', flagUrl: 'https://flagcdn.com/jp.svg' }
    if (r.includes('usa') || r.includes('america')) return { flag: '🇺🇸', name: 'USA', flagUrl: 'https://flagcdn.com/us.svg' }
    if (r.includes('hong kong') || r.includes('hk')) return { flag: '🇭🇰', name: 'Hong Kong', flagUrl: 'https://flagcdn.com/hk.svg' }
    if (r.includes('korea') || r.includes('kr') || r.includes('seoul')) return { flag: '🇰🇷', name: 'Korea', flagUrl: 'https://flagcdn.com/kr.svg' }
    return { flag: '🌐', name: region || 'Global', flagUrl: null }
}

const formatMoney = (amount) => `${(amount || 0).toLocaleString('vi-VN')}đ`

const formatAmountInput = (val) => {
    const num = Number(String(val).replace(/[^0-9]/g, ''))
    return isNaN(num) ? 0 : num
}

/* ============================================================
   SHIMMER SKELETON ROWS
   ============================================================ */

function SkeletonRows({ rowClass, cols = 4, count = 5 }) {
    return (
        <div className="shimmer-wrap">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`shimmer-row ${rowClass}`}>
                    {Array.from({ length: cols }).map((_, j) => (
                        <div key={j} className={`shimmer-item ${j === 0 ? 'wide' : j % 3 === 0 ? 'pill' : 'short'}`} />
                    ))}
                </div>
            ))}
        </div>
    )
}

/* ============================================================
   CUSTOM TOPUP MODAL
   ============================================================ */

const PRESETS = [50000, 100000, 200000, 500000]

function TopupModal({ user, onClose, onConfirm }) {
    const [amount, setAmount] = useState(100000)
    const [description, setDescription] = useState('')
    const [activePreset, setActivePreset] = useState(100000)
    const [loading, setLoading] = useState(false)

    const handlePreset = (val) => {
        setAmount(val)
        setActivePreset(val)
    }

    const handleAmountChange = (e) => {
        const val = formatAmountInput(e.target.value)
        setAmount(val)
        setActivePreset(null)
    }

    const handleSubmit = async () => {
        if (!amount || amount <= 0) return
        setLoading(true)
        try {
            await onConfirm(user.id, amount, description || `Admin topup cho ${user.email}`)
            onClose()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <div className="modal-icon success">💸</div>
                    <div>
                        <p className="modal-title">Nạp tiền thủ công</p>
                        <p className="modal-subtitle">Thêm số dư trực tiếp vào tài khoản người dùng</p>
                    </div>
                </div>
                <div className="modal-body">
                    <div className="topup-target-info">
                        <div className="topup-target-avatar">👤</div>
                        <div>
                            <div className="email">{user.email}</div>
                            <div className="balance">Số dư hiện tại: {formatMoney(user.balance)}</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Chọn nhanh số tiền</label>
                        <div className="preset-group">
                            {PRESETS.map(p => (
                                <button
                                    key={p}
                                    className={`preset-btn ${activePreset === p ? 'active' : ''}`}
                                    onClick={() => handlePreset(p)}
                                >
                                    +{(p / 1000).toFixed(0)}k
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Số tiền tùy chọn (VND)</label>
                        <input
                            className="input-full amount-input"
                            type="number"
                            min="1000"
                            step="1000"
                            value={amount || ''}
                            onChange={handleAmountChange}
                            placeholder="Nhập số tiền..."
                        />
                        {amount > 0 && (
                            <div className="amount-display">= {formatMoney(amount)}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Ghi chú giao dịch</label>
                        <input
                            className="input-full"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={`Admin topup cho ${user.email}`}
                            maxLength={200}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
                    <button
                        className="btn success"
                        onClick={handleSubmit}
                        disabled={loading || !amount || amount <= 0}
                    >
                        {loading ? '⏳ Đang nạp...' : `✅ Nạp ${formatMoney(amount)}`}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ============================================================
   CUSTOM CONFIRM MODAL
   ============================================================ */

function ConfirmModal({ title, subtitle, targetLabel, warningText, onClose, onConfirm, type = 'danger' }) {
    const [loading, setLoading] = useState(false)

    const handleConfirm = async () => {
        setLoading(true)
        try {
            await onConfirm()
            onClose()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <div className={`modal-icon ${type}`}>
                        {type === 'danger' ? '⚠️' : '❓'}
                    </div>
                    <div>
                        <p className="modal-title">{title}</p>
                        <p className="modal-subtitle">{subtitle}</p>
                    </div>
                </div>
                <div className="modal-body">
                    {targetLabel && (
                        <div className="confirm-target-label">{targetLabel}</div>
                    )}
                    {warningText && (
                        <div className="confirm-warning-box">⚠️ {warningText}</div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn ghost" onClick={onClose} disabled={loading}>Giữ lại</button>
                    <button
                        className={`btn ${type}`}
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading ? '⏳ Đang xử lý...' : type === 'danger' ? '🗑️ Xác nhận xóa' : '⏹️ Dừng phiên'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ============================================================
   CUSTOM TOOLTIP FOR CHARTS
   ============================================================ */

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(16, 20, 32, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px 16px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
                <p style={{ margin: '0 0 6px', fontSize: '0.78rem', color: '#5c6578', fontWeight: 600 }}>{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: entry.color || '#3dd598' }}>
                        {formatMoney(entry.value)}
                    </p>
                ))}
            </div>
        )
    }
    return null
}

/* ============================================================
   CUSTOM SWITCH TOGGLE
   ============================================================ */

function SwitchToggle({ checked, onChange }) {
    return (
        <label className="switch-toggle">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="switch-slider" />
        </label>
    )
}

/* ============================================================
   TRANSACTION DETAIL DIALOG
   ============================================================ */

function TransactionDialog({ transaction, dialogRef }) {
    if (!transaction) return null

    const steps = [
        { label: 'Khởi tạo', done: true },
        { label: 'Xử lý', done: transaction.status !== 'pending' },
        { label: transaction.status === 'failed' ? 'Thất bại' : 'Hoàn tất', done: transaction.status === 'succeeded' || transaction.status === 'failed', failed: transaction.status === 'failed' },
    ]

    return (
        <dialog ref={dialogRef} className="admin-dialog" onClose={() => {}}>
            <div className="dialog-content">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>📋 Chi tiết giao dịch</h3>
                    <span className={`pill ${transaction.status === 'succeeded' ? 'success' : transaction.status === 'failed' ? 'error' : 'warning'}`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
                        {transaction.status === 'succeeded' ? '✅ Thành công' : transaction.status === 'failed' ? '❌ Thất bại' : '⏳ Đang xử lý'}
                    </span>
                </div>

                {/* Transaction Timeline */}
                <div className="transaction-timeline" style={{ marginBottom: 20 }}>
                    {steps.map((step, i) => (
                        <div key={i} className={`timeline-step ${step.done ? (step.failed ? 'failed' : 'completed') : ''}`}>
                            <div className={`timeline-node ${step.done ? (step.failed ? 'failed' : 'completed') : ''}`}>
                                {step.done ? (step.failed ? '✕' : '✓') : i + 1}
                            </div>
                            <span className="timeline-label">{step.label}</span>
                        </div>
                    ))}
                </div>

                <div className="detail-grid">
                    <div className="detail-item">
                        <label>Mã giao dịch</label>
                        <span className="truncate" style={{ fontSize: '0.78rem' }}>{transaction.id}</span>
                    </div>
                    <div className="detail-item">
                        <label>Người dùng</label>
                        <span className="truncate" style={{ fontSize: '0.78rem' }}>{transaction.user_id}</span>
                    </div>
                    <div className="detail-item">
                        <label>Số tiền</label>
                        <span className="money" style={{ fontSize: '1.15rem' }}>{formatMoney(transaction.amount)}</span>
                    </div>
                    <div className="detail-item">
                        <label>Phương thức</label>
                        <span className="pill ghost" style={{ alignSelf: 'flex-start' }}>{transaction.provider}</span>
                    </div>
                    <div className="detail-item">
                        <label>Số dư trước</label>
                        <span>{formatMoney(transaction.balance_before)}</span>
                    </div>
                    <div className="detail-item">
                        <label>Số dư sau</label>
                        <span style={{ color: '#3dd598' }}>{formatMoney(transaction.balance_after)}</span>
                    </div>
                    <div className="detail-item">
                        <label>Tạo lúc</label>
                        <span style={{ fontSize: '0.82rem' }}>{transaction.created_at ? new Date(transaction.created_at).toLocaleString('vi-VN') : '-'}</span>
                    </div>
                    <div className="detail-item">
                        <label>Hoàn tất</label>
                        <span style={{ fontSize: '0.82rem' }}>{transaction.completed_at ? new Date(transaction.completed_at).toLocaleString('vi-VN') : '-'}</span>
                    </div>
                    {transaction.trans_id && (
                        <div className="detail-item">
                            <label>Mã GD bên ngoài</label>
                            <span style={{ fontSize: '0.82rem' }}>{transaction.trans_id}</span>
                        </div>
                    )}
                    {transaction.description && (
                        <div className="detail-item full-width">
                            <label>Ghi chú</label>
                            <span style={{ fontSize: '0.88rem' }}>{transaction.description}</span>
                        </div>
                    )}
                </div>
                <div className="dialog-actions">
                    <button className="btn ghost" onClick={() => dialogRef.current?.close()}>Đóng</button>
                </div>
            </div>
        </dialog>
    )
}

/* ============================================================
   MAIN ADMIN COMPONENT
   ============================================================ */

const NAV_ITEMS = [
    { key: 'Overview', label: 'Tổng quan', icon: '📊' },
    { key: 'Users', label: 'Người dùng', icon: '👥' },
    { key: 'Machines', label: 'Máy chủ', icon: '🖥️' },
    { key: 'Sessions', label: 'Phiên kết nối', icon: '🎮' },
    { key: 'Billing', label: 'Hóa đơn', icon: '💰' },
    { key: 'Settings', label: 'Cấu hình', icon: '⚙️' },
]

const PIE_COLORS = ['#3dd598', '#f45d48', '#f2c94c']

function Admin({ ctx }) {
    const token = ctx?.token
    const isAdmin = ctx?.user?.role === 'admin'

    const [activeTab, setActiveTab] = useState('Overview')

    // Dashboard
    const [dashboard, setDashboard] = useState(null)
    const [dashboardLoading, setDashboardLoading] = useState(false)

    // Revenue stats
    const [revenueStats, setRevenueStats] = useState(null)
    const [revenueDateRange, setRevenueDateRange] = useState({ date_from: '', date_to: '' })

    // Machine stats
    const [machineStats, setMachineStats] = useState(null)

    // Users
    const [userPage, setUserPage] = useState(1)
    const [userPageSize, setUserPageSize] = useState(10)
    const [userTotal, setUserTotal] = useState(0)
    const [users, setUsers] = useState([])
    const [userError, setUserError] = useState('')
    const [userLoading, setUserLoading] = useState(false)
    const [userFilters, setUserFilters] = useState({ email: '', role: '', status: '' })

    // Machines
    const [machinePage, setMachinePage] = useState(1)
    const [machinePageSize, setMachinePageSize] = useState(10)
    const [machineTotal, setMachineTotal] = useState(0)
    const [machines, setMachines] = useState([])
    const [machineError, setMachineError] = useState('')
    const [machineLoading, setMachineLoading] = useState(false)
    const [machineFilters, setMachineFilters] = useState({ region: '', gpu: '', status: '' })
    const [newMachine, setNewMachine] = useState({ code: '', region: '', gpu: '', ping_ms: '', status: 'idle', location: '', base_rate_per_minute: '', trial_eligible: false })

    // Sessions
    const [sessionPage, setSessionPage] = useState(1)
    const [sessionPageSize, setSessionPageSize] = useState(10)
    const [sessionTotal, setSessionTotal] = useState(0)
    const [sessions, setSessions] = useState([])
    const [sessionError, setSessionError] = useState('')
    const [sessionLoading, setSessionLoading] = useState(false)
    const [sessionFilters, setSessionFilters] = useState({ status: '' })

    // Billing
    const [billingPage, setBillingPage] = useState(1)
    const [billingPageSize, setBillingPageSize] = useState(10)
    const [billingTotal, setBillingTotal] = useState(0)
    const [billingTransactions, setBillingTransactions] = useState([])
    const [billingError, setBillingError] = useState('')
    const [billingLoading, setBillingLoading] = useState(false)
    const [billingFilters, setBillingFilters] = useState({ status: '', provider: '', user_id: '', date_from: '', date_to: '' })

    // Settings
    const [settingsForm, setSettingsForm] = useState({
        password_min_length: 8,
        password_require_upper: true,
        password_require_lower: true,
        password_require_digit: true,
        lockout_max_attempts: 5,
        lockout_minutes: 10,
        min_topup_amount: 10000,
        session_timeout_hours: 24,
        snapshot_retention_count: 1,
    })
    const [settingsMessage, setSettingsMessage] = useState('')
    const [settingsStatus, setSettingsStatus] = useState('synced') // 'unsaved' | 'synced' | 'saving' | 'error'

    // Transaction dialog
    const [selectedTransaction, setSelectedTransaction] = useState(null)
    const dialogRef = useRef()

    // Custom modals
    const [topupModal, setTopupModal] = useState(null) // { id, email, balance }
    const [confirmModal, setConfirmModal] = useState(null) // { title, subtitle, targetLabel, warningText, onConfirm, type }

    // Toast notification
    const [toast, setToast] = useState(null) // { message, type }
    const toastTimer = useRef()

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 3500)
    }, [])

    // Derived
    const userTotalPages = Math.max(1, Math.ceil(userTotal / userPageSize))
    const machineTotalPages = Math.max(1, Math.ceil(machineTotal / machinePageSize))
    const sessionTotalPages = Math.max(1, Math.ceil(sessionTotal / sessionPageSize))
    const billingTotalPages = Math.max(1, Math.ceil(billingTotal / billingPageSize))

    /* ---- Load Settings ---- */
    useEffect(() => {
        if (!isAdmin) return
        let cancelled = false
        async function loadSettings() {
            try {
                const data = await getAdminSettings(token)
                if (!cancelled && data) setSettingsForm(prev => ({ ...prev, ...data }))
            } catch {
                try {
                    const raw = localStorage.getItem('admin_settings_draft')
                    if (raw && !cancelled) setSettingsForm(prev => ({ ...prev, ...JSON.parse(raw) }))
                } catch { /* fallback silent */ }
            }
        }
        loadSettings()
        return () => { cancelled = true }
    }, [isAdmin, token])

    /* ---- Data loaders ---- */
    const loadDashboard = useCallback(async () => {
        if (!isAdmin) return
        setDashboardLoading(true)
        try { setDashboard(await getDashboard(token)) } catch { /* silent */ }
        finally { setDashboardLoading(false) }
    }, [token, isAdmin])

    const loadRevenueStats = useCallback(async () => {
        if (!isAdmin) return
        try { setRevenueStats(await getRevenueStatistics(revenueDateRange, token)) } catch { /* silent */ }
    }, [token, isAdmin, revenueDateRange])

    const loadMachineStats = useCallback(async () => {
        if (!isAdmin) return
        try { setMachineStats(await getMachineStatistics(token)) } catch { /* silent */ }
    }, [token, isAdmin])

    const loadUsers = useCallback(async () => {
        if (!isAdmin) return
        setUserLoading(true)
        setUserError('')
        try {
            const data = await listUsers({ page: userPage, page_size: userPageSize, ...userFilters }, token)
            setUsers(data.items || [])
            setUserTotal(data.total || 0)
        } catch (err) {
            setUserError(err.message || 'Không tải được danh sách user')
        } finally {
            setUserLoading(false)
        }
    }, [userPage, userPageSize, userFilters, token, isAdmin])

    const loadMachines = useCallback(async () => {
        if (!isAdmin) return
        setMachineLoading(true)
        setMachineError('')
        try {
            const data = await listAdminMachines({ page: machinePage, page_size: machinePageSize, ...machineFilters }, token)
            setMachines(data.items || [])
            setMachineTotal(data.total || 0)
        } catch (err) {
            setMachineError(err.message || 'Không tải được danh sách máy')
        } finally {
            setMachineLoading(false)
        }
    }, [machinePage, machinePageSize, machineFilters, token, isAdmin])

    const loadSessions = useCallback(async () => {
        if (!isAdmin) return
        setSessionLoading(true)
        setSessionError('')
        try {
            const data = await listSessions({ page: sessionPage, page_size: sessionPageSize, status: sessionFilters.status }, token)
            setSessions(data.items || [])
            setSessionTotal(data.total || 0)
        } catch (err) {
            setSessionError(err.message || 'Không tải được session')
        } finally {
            setSessionLoading(false)
        }
    }, [sessionPage, sessionPageSize, sessionFilters, token, isAdmin])

    const loadBilling = useCallback(async () => {
        if (!isAdmin) return
        setBillingLoading(true)
        setBillingError('')
        try {
            const params = {
                page: billingPage, page_size: billingPageSize,
                user_id: billingFilters.user_id || undefined,
                status: billingFilters.status,
                provider: billingFilters.provider,
                date_from: billingFilters.date_from ? new Date(billingFilters.date_from).toISOString() : undefined,
                date_to: billingFilters.date_to ? new Date(billingFilters.date_to).toISOString() : undefined,
            }
            const data = await adminListTopupTransactions(params, token)
            setBillingTransactions(data.items || [])
            setBillingTotal(data.total || 0)
        } catch (err) {
            setBillingError(err.message || 'Không tải được giao dịch')
        } finally {
            setBillingLoading(false)
        }
    }, [billingPage, billingPageSize, billingFilters, token, isAdmin])

    /* ---- Effects ---- */
    useEffect(() => { loadDashboard() }, [loadDashboard])
    useEffect(() => { loadRevenueStats() }, [loadRevenueStats])
    useEffect(() => { loadMachineStats() }, [loadMachineStats])
    useEffect(() => { loadUsers() }, [loadUsers])
    useEffect(() => { loadMachines() }, [loadMachines])
    useEffect(() => { loadSessions() }, [loadSessions])
    useEffect(() => { loadBilling() }, [loadBilling])

    /* ---- Handlers ---- */
    const handleLogout = () => ctx?.logout?.()

    const handleUserUpdate = async (userId, payload) => {
        try {
            setUserError('')
            await updateUser(userId, payload, token)
            loadUsers()
            showToast('Cập nhật người dùng thành công')
        } catch (err) {
            setUserError(err.message || 'Không cập nhật được user')
        }
    }

    const handleMachineUpdate = async (machineId, payload) => {
        try {
            setMachineError('')
            await updateMachine(machineId, payload, token)
            loadMachines(); loadMachineStats(); loadDashboard()
            showToast('Cập nhật máy chủ thành công')
        } catch (err) {
            setMachineError(err.message || 'Không cập nhật được máy')
        }
    }

    const handleDeleteMachine = (machineId, code) => {
        setConfirmModal({
            title: 'Xóa máy chủ',
            subtitle: 'Hành động này không thể hoàn tác',
            targetLabel: `Máy: ${code}`,
            warningText: 'Khi xóa, tất cả dữ liệu liên quan đến máy chủ này (sessions, lịch sử) sẽ bị xóa vĩnh viễn.',
            type: 'danger',
            onConfirm: async () => {
                await deleteMachine(machineId, token)
                loadMachines(); loadMachineStats(); loadDashboard()
                showToast(`Đã xóa máy ${code}`, 'success')
            },
        })
    }

    const handleCreateMachine = async () => {
        try {
            setMachineError('')
            await createMachine({
                code: newMachine.code,
                region: newMachine.region || null,
                gpu: newMachine.gpu || null,
                ping_ms: newMachine.ping_ms ? Number(newMachine.ping_ms) : null,
                status: newMachine.status,
                location: newMachine.location || null,
                base_rate_per_minute: newMachine.base_rate_per_minute ? Number(newMachine.base_rate_per_minute) : null,
                trial_eligible: Boolean(newMachine.trial_eligible),
            }, token)
            setNewMachine({ code: '', region: '', gpu: '', ping_ms: '', status: 'idle', location: '', base_rate_per_minute: '', trial_eligible: false })
            setMachinePage(1)
            loadMachines(); loadMachineStats(); loadDashboard()
            showToast('Tạo máy chủ mới thành công')
        } catch (err) {
            setMachineError(err.message || 'Không tạo được máy')
        }
    }

    const handleStopSession = (sessionId, userEmail) => {
        setConfirmModal({
            title: 'Dừng phiên kết nối',
            subtitle: 'Phiên VPN của người dùng sẽ bị ngắt kết nối ngay lập tức',
            targetLabel: `Session ID: ${sessionId.slice(0, 16)}...`,
            warningText: `Người dùng ${userEmail || sessionId.slice(0, 8)} sẽ bị ngắt kết nối VPN và cần kết nối lại.`,
            type: 'danger',
            onConfirm: async () => {
                await stopSession(sessionId, token)
                loadSessions(); loadMachines(); loadDashboard()
                showToast('Đã dừng phiên kết nối')
            },
        })
    }

    const handleAdminTopup = (user) => {
        setTopupModal({ id: user.id, email: user.email, balance: user.balance })
    }

    const handleTopupConfirm = async (userId, amount, description) => {
        await adminTopupUser(userId, Math.round(amount), description, token)
        loadUsers(); loadBilling(); loadDashboard()
        showToast(`Đã nạp ${formatMoney(amount)} thành công!`)
    }

    const handleSettingsChange = (field, value) => {
        setSettingsStatus('unsaved')
        setSettingsMessage('')
        setSettingsForm(prev => ({ ...prev, [field]: value }))
    }

    const handleSaveSettings = async () => {
        const minLength = Number(settingsForm.password_min_length)
        const minTopup = Number(settingsForm.min_topup_amount)
        const lockoutAttempts = Number(settingsForm.lockout_max_attempts)
        const lockoutMinutes = Number(settingsForm.lockout_minutes)
        const sessionTimeout = Number(settingsForm.session_timeout_hours)
        const retentionCount = Number(settingsForm.snapshot_retention_count)

        if (minLength < 8) return setSettingsMessage('Password min length phải >= 8')
        if (minTopup < 1000) return setSettingsMessage('Mức nạp tối thiểu phải >= 1.000đ')
        if (lockoutAttempts < 1) return setSettingsMessage('Số lần login sai phải >= 1')
        if (lockoutMinutes < 1) return setSettingsMessage('Thời gian lockout phải >= 1 phút')
        if (sessionTimeout < 1) return setSettingsMessage('Session timeout phải >= 1 giờ')
        if (retentionCount < 1) return setSettingsMessage('Snapshot retention phải >= 1')

        const payload = {
            password_min_length: minLength,
            password_require_upper: Boolean(settingsForm.password_require_upper),
            password_require_lower: Boolean(settingsForm.password_require_lower),
            password_require_digit: Boolean(settingsForm.password_require_digit),
            lockout_max_attempts: lockoutAttempts,
            lockout_minutes: lockoutMinutes,
            min_topup_amount: minTopup,
            session_timeout_hours: sessionTimeout,
            snapshot_retention_count: retentionCount,
        }

        setSettingsStatus('saving')
        try {
            const data = await updateAdminSettings(payload, token)
            setSettingsForm(prev => ({ ...prev, ...data }))
            localStorage.setItem('admin_settings_draft', JSON.stringify(data))
            setSettingsStatus('synced')
            setSettingsMessage('')
            showToast('Đã lưu cấu hình thành công!')
        } catch (err) {
            localStorage.setItem('admin_settings_draft', JSON.stringify(payload))
            setSettingsStatus('error')
            setSettingsMessage(`Lưu API thất bại: ${err.message}. Đã lưu draft local.`)
        }
    }

    function exportTransactionsCSV() {
        if (!billingTransactions.length) return
        const header = ['User', 'Số tiền', 'Phương thức', 'Trạng thái', 'Thời gian', 'Ghi chú']
        const rows = billingTransactions.map(t => [
            t.user_id, t.amount, t.provider, t.status,
            t.created_at ? new Date(t.created_at).toLocaleString('vi-VN') : '-',
            t.description || '-',
        ])
        const csv = [header, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        Object.assign(document.createElement('a'), { href: url, download: 'transactions.csv' }).click()
        URL.revokeObjectURL(url)
    }

    /* ---- KPI data ---- */
    const kpis = useMemo(() => {
        if (!dashboard) return []
        return [
            { label: 'Tổng User', value: dashboard.total_users, hint: `${dashboard.active_users} đang hoạt động`, icon: '👥', color: '#00b8d9' },
            { label: 'Máy chủ', value: dashboard.total_machines, hint: `${dashboard.idle_machines} idle · ${dashboard.busy_machines} đang dùng`, icon: '🖥️', color: '#f2c94c' },
            { label: 'Sessions Active', value: dashboard.active_sessions, hint: `Tổng: ${dashboard.total_sessions}`, icon: '🔌', color: '#f45d48' },
            { label: 'Doanh thu hôm nay', value: formatMoney(dashboard.today_revenue), hint: `Tháng: ${formatMoney(dashboard.month_revenue)}`, icon: '💰', color: '#3dd598' },
        ]
    }, [dashboard])

    /* ---- Not admin ---- */
    if (!isAdmin) {
        return (
            <div className="admin-shell">
                <main className="admin-main">
                    <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
                        <h3>Không có quyền truy cập</h3>
                        <p className="muted">Bạn cần đăng nhập bằng tài khoản Admin.</p>
                    </div>
                </main>
            </div>
        )
    }

    /* ============================================================
       RENDER
       ============================================================ */
    return (
        <div className="admin-shell">
            {/* ---- SIDENAV ---- */}
            <aside className="admin-sidenav">
                <div className="brand">🎮 VPN Admin</div>
                <div className="env env-prod">PRODUCTION</div>
                <nav>
                    {NAV_ITEMS.map(item => (
                        <span
                            key={item.key}
                            className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.key)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </span>
                    ))}
                </nav>
                <div className="sidenav-footer">
                    <button className="btn logout-btn" onClick={handleLogout}>🚪 Đăng xuất</button>
                </div>
            </aside>

            {/* ---- MAIN ---- */}
            <main className="admin-main">
                {/* Header */}
                <header className="admin-header">
                    <div>
                        <p className="muted">Bảng điều khiển quản trị</p>
                        <h1>{NAV_ITEMS.find(n => n.key === activeTab)?.label || activeTab}</h1>
                    </div>
                    <div className="actions">
                        <button className="btn ghost" onClick={() => { loadDashboard(); loadMachineStats(); loadRevenueStats() }}>
                            🔄 Làm mới
                        </button>
                        <div className="user-menu">👤 {ctx?.user?.email || 'Admin'}</div>
                    </div>
                </header>

                {/* ===== OVERVIEW TAB ===== */}
                {activeTab === 'Overview' && (
                    <>
                        {dashboardLoading ? (
                            <section className="grid grid-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="card border kpi-card shimmer-kpi">
                                        <div className="line-1" />
                                        <div className="line-2" />
                                    </div>
                                ))}
                            </section>
                        ) : (
                            <section className="grid grid-4">
                                {kpis.map(kpi => (
                                    <div key={kpi.label} className="card border kpi-card">
                                        <span className="kpi-icon">{kpi.icon}</span>
                                        <p className="muted">{kpi.label}</p>
                                        <h3 style={{ color: kpi.color }}>{kpi.value}</h3>
                                        {kpi.hint && <span className="pill ghost">{kpi.hint}</span>}
                                    </div>
                                ))}
                            </section>
                        )}

                        <section className="grid grid-2">
                            {/* Revenue Area Chart */}
                            <div className="card">
                                <div className="section-head">
                                    <div>
                                        <p className="muted">Doanh thu</p>
                                        <h3>Biểu đồ theo ngày</h3>
                                    </div>
                                    <span className="pill success">Tổng: {formatMoney(dashboard?.total_revenue)}</span>
                                </div>
                                <div className="chart-container">
                                    {revenueStats?.daily?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <AreaChart data={revenueStats.daily}>
                                                <defs>
                                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3dd598" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#3dd598" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="date" stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} />
                                                <YAxis stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="amount" stroke="#3dd598" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#3dd598', stroke: 'rgba(61,213,152,0.4)', strokeWidth: 4 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#5c6578' }}>
                                            Chưa có dữ liệu doanh thu
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Machine Status Donut */}
                            <div className="card">
                                <div className="section-head">
                                    <div>
                                        <p className="muted">Máy chủ</p>
                                        <h3>Trạng thái máy</h3>
                                    </div>
                                    <span className="pill ghost">Ping TB: {machineStats?.avg_ping || 0}ms</span>
                                </div>
                                <div className="chart-container">
                                    {machineStats ? (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Idle', value: machineStats.idle || 0 },
                                                        { name: 'Busy', value: machineStats.busy || 0 },
                                                        { name: 'Maintenance', value: machineStats.maintenance || 0 },
                                                    ]}
                                                    cx="50%" cy="50%"
                                                    innerRadius={65} outerRadius={90}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} stroke="transparent" />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'rgba(16,20,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                                                <Legend formatter={(v, entry) => (
                                                    <span style={{ color: entry.color, fontSize: '0.82rem', fontWeight: 600 }}>{v}</span>
                                                )} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#5c6578' }}>Đang tải...</div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Region Bar Chart */}
                        {machineStats?.by_region?.length > 0 && (
                            <section className="card">
                                <div className="section-head">
                                    <div>
                                        <p className="muted">Máy theo khu vực</p>
                                        <h3>Region Statistics</h3>
                                    </div>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={machineStats.by_region}>
                                            <defs>
                                                <linearGradient id="idleGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3dd598" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#3dd598" stopOpacity={0.5} />
                                                </linearGradient>
                                                <linearGradient id="busyGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f45d48" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#f45d48" stopOpacity={0.5} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="region" stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} />
                                            <YAxis stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} />
                                            <Tooltip contentStyle={{ background: 'rgba(16,20,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                                            <Bar dataKey="idle" stackId="a" fill="url(#idleGrad)" name="Idle" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="busy" stackId="a" fill="url(#busyGrad)" name="Busy" />
                                            <Legend formatter={(v, entry) => <span style={{ color: entry.color, fontSize: '0.82rem', fontWeight: 600 }}>{v}</span>} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

                        {/* Recent Transactions */}
                        <section className="card">
                            <div className="section-head">
                                <div>
                                    <p className="muted">Giao dịch gần đây</p>
                                    <h3>Recent Transactions</h3>
                                </div>
                                <button className="btn ghost" onClick={() => setActiveTab('Billing')}>Xem tất cả →</button>
                            </div>
                            <div className="table">
                                <div className="row head simple">
                                    <span>User</span><span>Số tiền</span><span>Trạng thái</span><span>Thời gian</span>
                                </div>
                                {dashboard?.recent_transactions?.map(t => (
                                    <div key={t.id} className="row simple">
                                        <span className="truncate" style={{ fontSize: '0.85rem' }}>{t.user_id?.slice(0, 12)}...</span>
                                        <span className="money">{formatMoney(t.amount)}</span>
                                        <span className={`pill ${t.status === 'succeeded' ? 'success' : t.status === 'failed' ? 'error' : 'warning'}`}>{t.status}</span>
                                        <span style={{ fontSize: '0.82rem', color: '#7a8499' }}>{t.created_at ? new Date(t.created_at).toLocaleString('vi-VN') : '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* ===== USERS TAB ===== */}
                {activeTab === 'Users' && (
                    <section className="card">
                        <div className="section-head">
                            <div>
                                <p className="muted">Users</p>
                                <h3>Quản lý người dùng</h3>
                            </div>
                            <div className="actions">
                                <input className="input-inline" placeholder="🔍 Tìm email..." value={userFilters.email}
                                    onChange={e => { setUserFilters(p => ({ ...p, email: e.target.value })); setUserPage(1) }} />
                                <select className="input-inline" value={userFilters.role}
                                    onChange={e => { setUserFilters(p => ({ ...p, role: e.target.value })); setUserPage(1) }}>
                                    <option value="">Tất cả role</option>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <select className="input-inline" value={userFilters.status}
                                    onChange={e => { setUserFilters(p => ({ ...p, status: e.target.value })); setUserPage(1) }}>
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="active">Active</option>
                                    <option value="pending">Pending</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="table">
                            <div className="row head admin-user-row">
                                <span>Email</span><span>Tên</span><span>Số dư</span><span>Role</span><span>Trạng thái</span><span>Hành động</span>
                            </div>
                            {userLoading
                                ? <SkeletonRows rowClass="admin-user-row" cols={6} count={userPageSize} />
                                : users.map(u => (
                                    <div key={u.id} className="row admin-user-row">
                                        <span className="truncate" style={{ fontSize: '0.86rem' }}>{u.email}</span>
                                        <span style={{ fontSize: '0.88rem' }}>{u.display_name || <span className="muted">-</span>}</span>
                                        <span className="money">{formatMoney(u.balance)}</span>
                                        <span>
                                            <select className="input-inline" style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                value={u.role} onChange={e => handleUserUpdate(u.id, { role: e.target.value })}>
                                                <option value="user">user</option>
                                                <option value="admin">admin</option>
                                            </select>
                                        </span>
                                        <span>
                                            <select className={`status-select ${u.status}`}
                                                value={u.status} onChange={e => handleUserUpdate(u.id, { status: e.target.value })}>
                                                <option value="active">active</option>
                                                <option value="pending">pending</option>
                                                <option value="suspended">suspended</option>
                                            </select>
                                        </span>
                                        <span className="actions">
                                            <button className="btn success small" title="Nạp tiền" onClick={() => handleAdminTopup(u)}>💸 Nạp</button>
                                            <button className="btn ghost small" title="Khóa tài khoản" onClick={() => handleUserUpdate(u.id, { status: 'suspended' })}>🔒</button>
                                            <button className="btn ghost small" title="Mở khóa" onClick={() => handleUserUpdate(u.id, { status: 'active' })}>🔓</button>
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                        {userError && <div className="alert error">⚠️ {userError}</div>}
                        <div className="admin-pagination">
                            <div className="muted" style={{ fontSize: '0.83rem' }}>Trang {userPage}/{userTotalPages} · {userTotal} users</div>
                            <div className="actions">
                                <select className="input-inline" value={userPageSize} onChange={e => { setUserPageSize(Number(e.target.value)); setUserPage(1) }}>
                                    <option value={10}>10/trang</option><option value={20}>20/trang</option><option value={50}>50/trang</option>
                                </select>
                                <button className="btn ghost" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>← Trước</button>
                                <button className="btn ghost" disabled={userPage >= userTotalPages} onClick={() => setUserPage(p => p + 1)}>Sau →</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ===== MACHINES TAB ===== */}
                {activeTab === 'Machines' && (
                    <>
                        <section className="grid grid-4">
                            <div className="card border kpi-card"><span className="kpi-icon">🖥️</span><p className="muted">Tổng máy</p><h3>{machineStats?.total || 0}</h3></div>
                            <div className="card border kpi-card"><span className="kpi-icon">✅</span><p className="muted">Idle</p><h3 className="text-success">{machineStats?.idle || 0}</h3></div>
                            <div className="card border kpi-card"><span className="kpi-icon">⚡</span><p className="muted">Busy</p><h3 className="text-warning">{machineStats?.busy || 0}</h3></div>
                            <div className="card border kpi-card"><span className="kpi-icon">🔧</span><p className="muted">Maintenance</p><h3 className="text-danger">{machineStats?.maintenance || 0}</h3></div>
                        </section>

                        <section className="card">
                            <div className="section-head">
                                <div><p className="muted">Machines</p><h3>Quản lý máy chủ</h3></div>
                                <div className="actions">
                                    <input className="input-inline" placeholder="🔍 Region" value={machineFilters.region}
                                        onChange={e => { setMachineFilters(p => ({ ...p, region: e.target.value })); setMachinePage(1) }} />
                                    <input className="input-inline" placeholder="GPU" value={machineFilters.gpu}
                                        onChange={e => { setMachineFilters(p => ({ ...p, gpu: e.target.value })); setMachinePage(1) }} />
                                    <select className="input-inline" value={machineFilters.status}
                                        onChange={e => { setMachineFilters(p => ({ ...p, status: e.target.value })); setMachinePage(1) }}>
                                        <option value="">Tất cả</option>
                                        <option value="idle">Idle</option>
                                        <option value="running">Running</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="offline">Offline</option>
                                    </select>
                                </div>
                            </div>

                            {/* Create form */}
                            <div className="card border admin-create">
                                <h4>➕ Thêm máy chủ mới</h4>
                                <div className="grid-6">
                                    <input placeholder="Code *" value={newMachine.code} onChange={e => setNewMachine(p => ({ ...p, code: e.target.value }))} />
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input placeholder="Region" style={{ flex: 1, paddingRight: 36 }} value={newMachine.region} onChange={e => setNewMachine(p => ({ ...p, region: e.target.value }))} />
                                        {newMachine.region && (
                                            <span style={{ position: 'absolute', right: 10 }}>
                                                {getCountryData(newMachine.region).flagUrl
                                                    ? <img src={getCountryData(newMachine.region).flagUrl} style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2 }} alt="" />
                                                    : getCountryData(newMachine.region).flag}
                                            </span>
                                        )}
                                    </div>
                                    <input placeholder="GPU" value={newMachine.gpu} onChange={e => setNewMachine(p => ({ ...p, gpu: e.target.value }))} />
                                    <input placeholder="Ping (ms)" type="number" min="0" value={newMachine.ping_ms} onChange={e => setNewMachine(p => ({ ...p, ping_ms: e.target.value }))} />
                                    <input placeholder="Giá/phút" type="number" min="0" value={newMachine.base_rate_per_minute} onChange={e => setNewMachine(p => ({ ...p, base_rate_per_minute: e.target.value }))} />
                                    <label className="field" style={{ margin: 0 }}>
                                        <span>Trial</span>
                                        <input type="checkbox" checked={newMachine.trial_eligible} onChange={e => setNewMachine(p => ({ ...p, trial_eligible: e.target.checked }))} />
                                    </label>
                                    <input placeholder="Location" value={newMachine.location} onChange={e => setNewMachine(p => ({ ...p, location: e.target.value }))} />
                                    <button className="btn primary" onClick={handleCreateMachine} disabled={!newMachine.code}>Thêm máy</button>
                                </div>
                            </div>

                            <div className="table">
                                <div className="row head admin-machine-row-full">
                                    <span>Code</span><span>Region</span><span>GPU</span><span>Ping</span><span>Location</span><span>Status</span><span>Actions</span>
                                </div>
                                {machineLoading
                                    ? <SkeletonRows rowClass="admin-machine-row-full" cols={7} count={machinePageSize} />
                                    : machines.map(m => (
                                        <div key={m.id} className="row admin-machine-row-full">
                                            <span className="code">{m.code}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {getCountryData(m.region).flagUrl
                                                    ? <img src={getCountryData(m.region).flagUrl} style={{ width: 18, height: 12, borderRadius: 2 }} alt="" />
                                                    : getCountryData(m.region).flag}
                                                <span style={{ fontSize: '0.85rem' }}>{m.region || '-'}</span>
                                            </span>
                                            <span style={{ fontSize: '0.85rem' }}>{m.gpu || <span className="muted">-</span>}</span>
                                            <span>
                                                <input type="number" min="0" className="input-small" value={m.ping_ms ?? ''}
                                                    onChange={e => setMachines(prev => prev.map(row => row.id === m.id ? { ...row, ping_ms: e.target.value === '' ? '' : Number(e.target.value) } : row))}
                                                    onBlur={e => handleMachineUpdate(m.id, { ping_ms: e.target.value === '' ? null : Number(e.target.value) })} />
                                            </span>
                                            <span style={{ fontSize: '0.82rem' }}>{m.location || <span className="muted">-</span>}</span>
                                            <span>
                                                <select className={`status-select ${m.status}`} value={m.status}
                                                    onChange={e => handleMachineUpdate(m.id, { status: e.target.value })}>
                                                    <option value="idle">idle</option>
                                                    <option value="running">running</option>
                                                    <option value="suspended">suspended</option>
                                                    <option value="maintenance">maintenance</option>
                                                    <option value="offline">offline</option>
                                                </select>
                                            </span>
                                            <span className="actions">
                                                <button className="btn ghost small" onClick={() => handleMachineUpdate(m.id, { status: 'idle' })}>Reset</button>
                                                <button className="btn danger small" onClick={() => handleDeleteMachine(m.id, m.code)}>🗑️</button>
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                            {machineError && <div className="alert error">⚠️ {machineError}</div>}
                            <div className="admin-pagination">
                                <div className="muted" style={{ fontSize: '0.83rem' }}>Trang {machinePage}/{machineTotalPages} · {machineTotal} máy</div>
                                <div className="actions">
                                    <select className="input-inline" value={machinePageSize} onChange={e => { setMachinePageSize(Number(e.target.value)); setMachinePage(1) }}>
                                        <option value={10}>10/trang</option><option value={20}>20/trang</option><option value={50}>50/trang</option>
                                    </select>
                                    <button className="btn ghost" disabled={machinePage <= 1} onClick={() => setMachinePage(p => p - 1)}>← Trước</button>
                                    <button className="btn ghost" disabled={machinePage >= machineTotalPages} onClick={() => setMachinePage(p => p + 1)}>Sau →</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* ===== SESSIONS TAB ===== */}
                {activeTab === 'Sessions' && (
                    <section className="card">
                        <div className="section-head">
                            <div><p className="muted">Sessions</p><h3>Quản lý phiên kết nối</h3></div>
                            <div className="actions">
                                <select className="input-inline" value={sessionFilters.status}
                                    onChange={e => { setSessionFilters({ status: e.target.value }); setSessionPage(1) }}>
                                    <option value="">Tất cả</option>
                                    <option value="active">Active</option>
                                    <option value="stopped">Stopped</option>
                                    <option value="ended">Ended</option>
                                </select>
                            </div>
                        </div>
                        <div className="table">
                            <div className="row head admin-session-row">
                                <span>User</span><span>Machine</span><span>Status</span><span>Bắt đầu</span><span>Kết thúc</span><span>Traffic</span><span>Actions</span>
                            </div>
                            {sessionLoading
                                ? <SkeletonRows rowClass="admin-session-row" cols={7} count={sessionPageSize} />
                                : sessions.map(s => (
                                    <div key={s.id} className="row admin-session-row">
                                        <span className="truncate" style={{ fontSize: '0.84rem' }}>{s.user_email || (s.user_id?.slice(0, 8) + '...')}</span>
                                        <span className="code">{s.machine_code || '-'}</span>
                                        <span className={`pill ${s.status === 'active' ? 'success' : 'ghost'}`}>{s.status}</span>
                                        <span style={{ fontSize: '0.8rem' }}>{s.started_at ? new Date(s.started_at).toLocaleString('vi-VN') : '-'}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#5c6578' }}>{s.ended_at ? new Date(s.ended_at).toLocaleString('vi-VN') : '-'}</span>
                                        <span style={{ fontSize: '0.78rem' }}>
                                            <span style={{ color: '#00b8d9' }}>↑{((s.bytes_up || 0) / 1048576).toFixed(1)}MB</span>
                                            {' '}
                                            <span style={{ color: '#3dd598' }}>↓{((s.bytes_down || 0) / 1048576).toFixed(1)}MB</span>
                                        </span>
                                        <span>
                                            {s.status === 'active' && (
                                                <button className="btn danger small" onClick={() => handleStopSession(s.id, s.user_email)}>⏹️ Stop</button>
                                            )}
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                        {sessionError && <div className="alert error">⚠️ {sessionError}</div>}
                        <div className="admin-pagination">
                            <div className="muted" style={{ fontSize: '0.83rem' }}>Trang {sessionPage}/{sessionTotalPages} · {sessionTotal} sessions</div>
                            <div className="actions">
                                <select className="input-inline" value={sessionPageSize} onChange={e => { setSessionPageSize(Number(e.target.value)); setSessionPage(1) }}>
                                    <option value={10}>10/trang</option><option value={20}>20/trang</option><option value={50}>50/trang</option>
                                </select>
                                <button className="btn ghost" disabled={sessionPage <= 1} onClick={() => setSessionPage(p => p - 1)}>← Trước</button>
                                <button className="btn ghost" disabled={sessionPage >= sessionTotalPages} onClick={() => setSessionPage(p => p + 1)}>Sau →</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ===== BILLING TAB ===== */}
                {activeTab === 'Billing' && (
                    <>
                        <section className="grid grid-3">
                            <div className="card border kpi-card"><span className="kpi-icon">💵</span><p className="muted">Tổng doanh thu</p><h3 className="text-success">{formatMoney(revenueStats?.total_revenue)}</h3></div>
                            <div className="card border kpi-card"><span className="kpi-icon">✅</span><p className="muted">GD thành công</p><h3>{revenueStats?.total_success || 0}</h3></div>
                            <div className="card border kpi-card"><span className="kpi-icon">❌</span><p className="muted">GD thất bại</p><h3 className="text-danger">{revenueStats?.total_failed || 0}</h3></div>
                        </section>

                        <section className="card">
                            <div className="section-head">
                                <div><p className="muted">Biểu đồ</p><h3>Revenue Chart</h3></div>
                                <div className="actions">
                                    <input type="date" className="input-inline" value={revenueDateRange.date_from}
                                        onChange={e => setRevenueDateRange(p => ({ ...p, date_from: e.target.value }))} />
                                    <input type="date" className="input-inline" value={revenueDateRange.date_to}
                                        onChange={e => setRevenueDateRange(p => ({ ...p, date_to: e.target.value }))} />
                                </div>
                            </div>
                            <div className="chart-container">
                                {revenueStats?.daily?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={revenueStats.daily}>
                                            <defs>
                                                <linearGradient id="billRevGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00b8d9" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#00b8d9" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} />
                                            <YAxis stroke="#5c6578" fontSize={11} tick={{ fill: '#5c6578' }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="amount" stroke="#00b8d9" strokeWidth={2.5} fill="url(#billRevGrad)" dot={false} activeDot={{ r: 5, fill: '#00b8d9', stroke: 'rgba(0,184,217,0.4)', strokeWidth: 4 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#5c6578' }}>Chưa có dữ liệu</div>
                                )}
                            </div>
                        </section>

                        <section className="card">
                            <div className="section-head">
                                <div><p className="muted">Billing</p><h3>Giao dịch nạp tiền</h3></div>
                                <button className="btn secondary" onClick={exportTransactionsCSV}>📥 Xuất CSV</button>
                            </div>
                            <div className="filter-row">
                                <input className="input-inline" placeholder="User ID (UUID)" value={billingFilters.user_id}
                                    onChange={e => { setBillingFilters(f => ({ ...f, user_id: e.target.value })); setBillingPage(1) }} />
                                <select className="input-inline" value={billingFilters.status}
                                    onChange={e => { setBillingFilters(f => ({ ...f, status: e.target.value })); setBillingPage(1) }}>
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="succeeded">Thành công</option>
                                    <option value="pending">Chờ xử lý</option>
                                    <option value="failed">Thất bại</option>
                                </select>
                                <select className="input-inline" value={billingFilters.provider}
                                    onChange={e => { setBillingFilters(f => ({ ...f, provider: e.target.value })); setBillingPage(1) }}>
                                    <option value="">Tất cả phương thức</option>
                                    <option value="momo">MoMo</option>
                                    <option value="admin">Admin</option>
                                    <option value="bank">Ngân hàng</option>
                                </select>
                                <input className="input-inline" type="date" value={billingFilters.date_from}
                                    onChange={e => setBillingFilters(f => ({ ...f, date_from: e.target.value }))} />
                                <input className="input-inline" type="date" value={billingFilters.date_to}
                                    onChange={e => setBillingFilters(f => ({ ...f, date_to: e.target.value }))} />
                            </div>
                            <div className="table">
                                <div className="row head admin-billing-row">
                                    <span>User</span><span>Số tiền</span><span>Số dư trước</span><span>Số dư sau</span><span>Phương thức</span><span>Trạng thái</span><span>Thời gian</span>
                                </div>
                                {billingLoading
                                    ? <SkeletonRows rowClass="admin-billing-row" cols={7} count={billingPageSize} />
                                    : billingTransactions.length === 0
                                        ? <div className="row"><span style={{ color: '#5c6578', gridColumn: 'span 7' }}>Không có giao dịch</span></div>
                                        : billingTransactions.map(t => (
                                            <div key={t.id} className="row admin-billing-row clickable"
                                                onClick={() => { setSelectedTransaction(t); dialogRef.current?.showModal() }}>
                                                <span className="truncate" style={{ fontSize: '0.82rem' }}>{t.user_id?.slice(0, 8)}...</span>
                                                <span className="money">{formatMoney(t.amount)}</span>
                                                <span style={{ fontSize: '0.85rem' }}>{formatMoney(t.balance_before)}</span>
                                                <span style={{ fontSize: '0.85rem', color: '#3dd598' }}>{formatMoney(t.balance_after)}</span>
                                                <span className="pill ghost">{t.provider}</span>
                                                <span className={`pill ${t.status === 'succeeded' ? 'success' : t.status === 'failed' ? 'error' : 'warning'}`}>{t.status}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#7a8499' }}>{t.created_at ? new Date(t.created_at).toLocaleString('vi-VN') : '-'}</span>
                                            </div>
                                        ))
                                }
                            </div>
                            {billingError && <div className="alert error">⚠️ {billingError}</div>}
                            <div className="admin-pagination">
                                <div className="muted" style={{ fontSize: '0.83rem' }}>Trang {billingPage}/{billingTotalPages} · {billingTotal} giao dịch</div>
                                <div className="actions">
                                    <select className="input-inline" value={billingPageSize} onChange={e => { setBillingPageSize(Number(e.target.value)); setBillingPage(1) }}>
                                        <option value={10}>10/trang</option><option value={20}>20/trang</option><option value={50}>50/trang</option>
                                    </select>
                                    <button className="btn ghost" disabled={billingPage <= 1} onClick={() => setBillingPage(p => p - 1)}>← Trước</button>
                                    <button className="btn ghost" disabled={billingPage >= billingTotalPages} onClick={() => setBillingPage(p => p + 1)}>Sau →</button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* ===== SETTINGS TAB ===== */}
                {activeTab === 'Settings' && (
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div>
                                <p className="muted" style={{ margin: '0 0 2px' }}>Hệ thống</p>
                                <h2 style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.4px' }}>Cấu hình chính sách</h2>
                            </div>
                            <button className="btn primary" onClick={handleSaveSettings} disabled={settingsStatus === 'saving'}>
                                {settingsStatus === 'saving' ? '⏳ Đang lưu...' : '💾 Lưu cấu hình'}
                            </button>
                        </div>

                        {/* Status bar */}
                        <div className={`settings-status-bar ${settingsStatus === 'unsaved' ? 'unsaved' : 'saved'}`}>
                            <span>
                                {settingsStatus === 'synced' && '✅ Đã đồng bộ với server'}
                                {settingsStatus === 'unsaved' && '⚠️ Có thay đổi chưa lưu'}
                                {settingsStatus === 'saving' && '⏳ Đang lưu...'}
                                {settingsStatus === 'error' && '❌ Lỗi khi lưu – đã lưu draft local'}
                            </span>
                            {settingsMessage && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{settingsMessage}</span>}
                        </div>

                        <div className="settings-section">
                            {/* Security Card */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div className="settings-card-icon security">🔐</div>
                                    <div>
                                        <p className="settings-card-title">Bảo mật & Mật khẩu</p>
                                        <p className="settings-card-desc">Chính sách mật khẩu và bảo vệ tài khoản</p>
                                    </div>
                                </div>
                                <div className="settings-items">
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Độ dài mật khẩu tối thiểu</p>
                                            <p className="setting-desc">Số ký tự tối thiểu khi đặt mật khẩu mới</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="8" max="32" value={settingsForm.password_min_length}
                                                onChange={e => handleSettingsChange('password_min_length', Number(e.target.value))} />
                                            <span className="setting-unit">ký tự</span>
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Bắt buộc chữ thường (a-z)</p>
                                            <p className="setting-desc">Mật khẩu phải chứa ít nhất 1 chữ cái thường</p>
                                        </div>
                                        <div className="setting-control">
                                            <SwitchToggle checked={settingsForm.password_require_lower}
                                                onChange={v => handleSettingsChange('password_require_lower', v)} />
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Bắt buộc chữ HOA (A-Z)</p>
                                            <p className="setting-desc">Mật khẩu phải chứa ít nhất 1 chữ cái hoa</p>
                                        </div>
                                        <div className="setting-control">
                                            <SwitchToggle checked={settingsForm.password_require_upper}
                                                onChange={v => handleSettingsChange('password_require_upper', v)} />
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Bắt buộc chữ số (0-9)</p>
                                            <p className="setting-desc">Mật khẩu phải chứa ít nhất 1 chữ số</p>
                                        </div>
                                        <div className="setting-control">
                                            <SwitchToggle checked={settingsForm.password_require_digit}
                                                onChange={v => handleSettingsChange('password_require_digit', v)} />
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Số lần login sai tối đa</p>
                                            <p className="setting-desc">Sau số lần này, tài khoản sẽ bị khóa tạm thời</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="1" max="20" value={settingsForm.lockout_max_attempts}
                                                onChange={e => handleSettingsChange('lockout_max_attempts', Number(e.target.value))} />
                                            <span className="setting-unit">lần</span>
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Thời gian khóa tài khoản</p>
                                            <p className="setting-desc">Sau khi vượt quá số lần login sai, tài khoản bị khóa trong bao lâu</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="1" max="1440" value={settingsForm.lockout_minutes}
                                                onChange={e => handleSettingsChange('lockout_minutes', Number(e.target.value))} />
                                            <span className="setting-unit">phút</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Card */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div className="settings-card-icon billing">💳</div>
                                    <div>
                                        <p className="settings-card-title">Chính sách thanh toán</p>
                                        <p className="settings-card-desc">Cấu hình giới hạn và quy tắc nạp tiền</p>
                                    </div>
                                </div>
                                <div className="settings-items">
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Số tiền nạp tối thiểu</p>
                                            <p className="setting-desc">Người dùng phải nạp ít nhất số tiền này mỗi lần giao dịch</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="1000" step="1000" value={settingsForm.min_topup_amount}
                                                onChange={e => handleSettingsChange('min_topup_amount', Number(e.target.value))} style={{ width: 100 }} />
                                            <span className="setting-unit">VND</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Server & Session Card */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <div className="settings-card-icon server">⏱️</div>
                                    <div>
                                        <p className="settings-card-title">Máy chủ & Phiên kết nối</p>
                                        <p className="settings-card-desc">Cấu hình vận hành phiên VPN và lưu trữ snapshot</p>
                                    </div>
                                </div>
                                <div className="settings-items">
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Session timeout</p>
                                            <p className="setting-desc">Phiên kết nối sẽ tự động kết thúc sau khoảng thời gian này</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="1" max="720" value={settingsForm.session_timeout_hours}
                                                onChange={e => handleSettingsChange('session_timeout_hours', Number(e.target.value))} />
                                            <span className="setting-unit">giờ</span>
                                        </div>
                                    </div>
                                    <div className="setting-row">
                                        <div className="setting-info">
                                            <p className="setting-label">Số snapshot tối đa giữ lại</p>
                                            <p className="setting-desc">Giới hạn số lượng bản snapshot được lưu trữ trên mỗi máy</p>
                                        </div>
                                        <div className="setting-control">
                                            <input type="number" min="1" max="20" value={settingsForm.snapshot_retention_count}
                                                onChange={e => handleSettingsChange('snapshot_retention_count', Number(e.target.value))} />
                                            <span className="setting-unit">bản</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Transaction detail dialog */}
                <TransactionDialog transaction={selectedTransaction} dialogRef={dialogRef} />
            </main>

            {/* ---- CUSTOM MODALS ---- */}
            {topupModal && (
                <TopupModal
                    user={topupModal}
                    onClose={() => setTopupModal(null)}
                    onConfirm={handleTopupConfirm}
                />
            )}

            {confirmModal && (
                <ConfirmModal
                    {...confirmModal}
                    onClose={() => setConfirmModal(null)}
                />
            )}

            {/* ---- TOAST NOTIFICATIONS ---- */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: 28,
                    right: 28,
                    zIndex: 2000,
                    background: toast.type === 'success'
                        ? 'linear-gradient(135deg, rgba(22, 45, 35, 0.98), rgba(16, 32, 26, 0.98))'
                        : 'linear-gradient(135deg, rgba(45, 16, 16, 0.98), rgba(32, 12, 12, 0.98))',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(61,213,152,0.3)' : 'rgba(244,93,72,0.3)'}`,
                    borderRadius: 14,
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${toast.type === 'success' ? 'rgba(61,213,152,0.1)' : 'rgba(244,93,72,0.1)'} inset`,
                    animation: 'overlayFadeIn 0.3s ease',
                    maxWidth: 360,
                    backdropFilter: 'blur(16px)',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: toast.type === 'success' ? '#3dd598' : '#ff8d7a',
                    }}>
                        {toast.message}
                    </span>
                </div>
            )}
        </div>
    )
}

export default Admin
