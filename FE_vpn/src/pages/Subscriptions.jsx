import { useEffect, useMemo, useState } from 'react'
import { listPlans, purchasePlan, getMySubscription } from '../api/subscriptions'

const formatRate = (amount) => `${formatCurrency(amount)}/phút`

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ'

const formatDate = (value) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('vi-VN')
}

const remainingDays = (value) => {
    if (!value) return 0
    const diff = new Date(value).getTime() - Date.now()
    return diff > 0 ? Math.ceil(diff / 86400000) : 0
}

const formatQuota = (plan) => {
    if (!plan?.data_limit_gb) return 'Không giới hạn'
    return `${plan.data_limit_gb}GB`
}

const getErrorMessage = (err, fallback) => {
    if (!err) return fallback
    if (typeof err === 'string') return err
    if (err.message) return err.message
    if (err.detail) return err.detail
    try {
        return JSON.stringify(err)
    } catch {
        return fallback
    }
}

const PLAN_CONTENT = {
    basic: {
        displayName: 'BASIC',
        badge: 'BASIC',
        tagline: 'Dành cho người mới bắt đầu trải nghiệm cloud gaming với chi phí thấp.',
        suitableFor: ['Sinh viên', 'Casual gamer', 'Người mới dùng hệ thống'],
        benefits: [
            { label: 'Giảm giá chơi', value: '~15-20%' },
            { label: 'Trial mỗi ngày', value: '15 phút miễn phí' },
            { label: 'Snapshot', value: '2 snapshot' },
            { label: 'Queue Priority', value: 'Cấp 1' },
            { label: 'VPN Gaming', value: 'Standard' },
            { label: 'Resume Session', value: 'Có' },
            { label: 'Region', value: 'VN + Trial Regions' },
            { label: 'Hỗ trợ', value: 'Thường' },
        ],
        savingsNote: 'Tiết kiệm tới 20% chi phí chơi game',
        rates: [
            { gpu: 'RTX 3070', price: 65 },
            { gpu: 'RTX 3080', price: 85 },
            { gpu: 'RTX 4080', price: 120 },
            { gpu: 'T4', price: 45 },
        ],
        price: 59000,
        featured: false,
    },
    pro: {
        displayName: 'PRO',
        badge: 'PRO',
        tagline: 'Lựa chọn tốt nhất cho đa số game thủ với mức giá hợp lý và hiệu năng tối ưu.',
        suitableFor: ['Game thủ chơi thường xuyên', 'Đa số người dùng'],
        benefits: [
            { label: 'Giảm giá chơi', value: '~30-35%' },
            { label: 'Snapshot', value: '5 snapshot' },
            { label: 'Queue Priority', value: 'Cấp 2' },
            { label: 'VPN Gaming', value: 'Advanced' },
            { label: 'Resume nhanh', value: 'Có' },
            { label: 'Region', value: 'VN + SG + Asia' },
            { label: 'Session Max', value: '8 giờ' },
            { label: 'Smart Routing', value: 'Có' },
            { label: 'Hỗ trợ', value: 'Ưu tiên' },
        ],
        savingsNote: 'Tiết kiệm tới 35% chi phí chơi game',
        rates: [
            { gpu: 'RTX 3070', price: 55 },
            { gpu: 'RTX 3080', price: 75 },
            { gpu: 'RTX 4080', price: 100 },
            { gpu: 'T4', price: 40 },
        ],
        price: 119000,
        featured: true,
        featuredLabel: 'Khuyên dùng',
    },
    premium: {
        displayName: 'PREMIUM',
        badge: 'PREMIUM',
        tagline: 'Trải nghiệm cloud gaming cao cấp với ưu tiên cao nhất và kết nối nhanh nhất.',
        suitableFor: ['Hardcore gamer', 'Người muốn ping tốt nhất'],
        benefits: [
            { label: 'Giảm giá chơi', value: '~45-50%' },
            { label: 'Snapshot', value: '20 snapshot' },
            { label: 'Queue Priority', value: 'Cao nhất' },
            { label: 'VPN Gaming', value: 'Fastest Route' },
            { label: 'Resume cực nhanh', value: 'Có' },
            { label: 'Region', value: 'Global' },
            { label: 'Session Max', value: '24 giờ' },
            { label: 'Smart Routing', value: 'Có' },
            { label: 'VIP Support', value: '24/7' },
            { label: 'Dedicated Queue', value: 'Có' },
            { label: 'Daily Cap', value: 'Tùy chỉnh' },
        ],
        savingsNote: 'Tiết kiệm tới 50% chi phí chơi game',
        rates: [
            { gpu: 'RTX 3070', price: 45 },
            { gpu: 'RTX 3080', price: 65 },
            { gpu: 'RTX 4080', price: 85 },
            { gpu: 'T4', price: 35 },
        ],
        price: 249000,
        featured: false,
    },
}

const COMPARISON_ROWS = [
    {
        feature: 'Trial mỗi ngày',
        note: 'Áp dụng trên máy trial',
        values: { free: '15 phút', basic: '15 phút', pro: '15 phút', premium: '15 phút' },
    },
    {
        feature: 'Snapshot',
        note: 'Số snapshot đang giữ',
        values: { free: '0', basic: '2', pro: '5', premium: '20' },
    },
    {
        feature: 'Region',
        note: 'Phạm vi ưu tiên',
        values: { free: 'Trial Regions', basic: 'VN + Trial Regions', pro: 'VN + SG + Asia', premium: 'Global' },
    },
    {
        feature: 'Smart Routing',
        note: 'Tối ưu đường truyền',
        values: { free: 'Không', basic: 'Không', pro: 'Có', premium: 'Có' },
    },
    {
        feature: 'Queue Priority',
        note: 'Thứ tự xếp hàng',
        values: { free: 'Thấp', basic: 'Cấp 1', pro: 'Cấp 2', premium: 'Cao nhất' },
    },
]

const getPlanKey = (plan = {}) => {
    const raw = `${plan.code || ''} ${plan.name || ''}`.toLowerCase()
    if (raw.includes('basic')) return 'basic'
    if (raw.includes('pro')) return 'pro'
    if (raw.includes('premium')) return 'premium'
    return 'generic'
}

const getPlanView = (plan = {}) => {
    const key = getPlanKey(plan)
    const content = PLAN_CONTENT[key]
    if (content) {
        return {
            ...content,
            displayName: content.displayName,
            price: content.price,
        }
    }

    const standardSample = plan.standard_sample_rate_per_minute || 250
    const memberSample = plan.member_sample_rate_per_minute || plan.play_rate_per_minute || standardSample
    const discount = Number(plan.discount_percent || 0)
    return {
        displayName: plan.name || 'Gói dịch vụ',
        badge: plan.active ? 'Đang mở bán' : 'Tạm ẩn',
        tagline: plan.description || 'Thông tin gói được lấy từ hệ thống.',
        suitableFor: [],
        benefits: [
            { label: 'Giảm giá PAYG', value: `${discount}%` },
            { label: 'Ví dụ RTX 4090', value: `${formatRate(standardSample)} -> ${formatRate(memberSample)}` },
            { label: 'Queue Priority', value: `+${plan.queue_priority || 0}` },
            { label: 'Snapshot', value: `${plan.snapshot_active_limit || 0}` },
            { label: 'Region ưu tiên', value: (plan.allowed_regions || []).join(', ') || '-' },
            {
                label: 'Max session',
                value: plan.max_session_seconds ? `${Math.round(plan.max_session_seconds / 3600 * 10) / 10} giờ` : '-',
            },
        ],
        rates: [],
        featured: false,
    }
}

const pickHighlights = (benefits = []) => {
    const preferred = ['Giảm giá chơi', 'Snapshot', 'Region', 'Queue Priority']
    const picked = benefits.filter((item) => preferred.includes(item.label))
    if (picked.length >= 3) return picked.slice(0, 4)
    return benefits.slice(0, 4)
}

function Subscriptions({ ctx }) {
    const token = ctx?.token
    const balance = Number(ctx?.user?.balance || 0)
    const [plans, setPlans] = useState([])
    const [mySub, setMySub] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [buyingPlanId, setBuyingPlanId] = useState('')
    const [selectedPlan, setSelectedPlan] = useState(null)

    const sortedPlans = useMemo(
        () => [...plans].sort((a, b) => {
            const aView = getPlanView(a)
            const bView = getPlanView(b)
            const aPrice = aView.price ?? a.price_cents ?? a.price ?? 0
            const bPrice = bView.price ?? b.price_cents ?? b.price ?? 0
            return aPrice - bPrice
        }),
        [plans],
    )
    const currentPlan = mySub?.plan || sortedPlans.find((plan) => plan.id === mySub?.plan_id)

    useEffect(() => {
        let cancelled = false

        async function load() {
            setLoading(true)
            setError('')
            try {
                const [plansResult, subResult] = await Promise.allSettled([
                    listPlans(),
                    token ? getMySubscription(token) : Promise.resolve(null),
                ])
                if (cancelled) return

                if (plansResult.status === 'fulfilled') {
                    const plansData = plansResult.value
                    const items = Array.isArray(plansData?.items)
                        ? plansData.items
                        : Array.isArray(plansData)
                            ? plansData
                            : []
                    setPlans(items)
                } else {
                    setPlans([])
                    setError(getErrorMessage(plansResult.reason, 'Không tải được danh sách gói cước'))
                }

                if (subResult.status === 'fulfilled') {
                    setMySub(subResult.value)
                }

            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [token])

    const openPurchaseDialog = (plan) => {
        setError('')
        setSuccess('')
        setSelectedPlan(plan)
    }

    const closePurchaseDialog = () => {
        if (buyingPlanId) return
        setSelectedPlan(null)
    }

    const handlePurchase = async () => {
        if (!selectedPlan) return
        setError('')
        setSuccess('')
        setBuyingPlanId(selectedPlan.id)
        try {
            const res = await purchasePlan(selectedPlan.id, token)
            setMySub(res)
            if (ctx?.refreshBalance) ctx.refreshBalance()
            setSuccess(`Mua ${getPlanView(selectedPlan).displayName} thành công. Gói đã được kích hoạt cho phiên VM/VPN của bạn.`)
            setSelectedPlan(null)
        } catch (err) {
            setError(err.message || 'Giao dịch thất bại')
        } finally {
            setBuyingPlanId('')
        }
    }

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner" />
                <p className="muted">Đang tải gói dịch vụ...</p>
            </div>
        )
    }

    return (
        <div className="stack subscription-page">
            <div className="subscription-compact-head">
                <div className="subscription-title">
                    <p className="muted">Gói dịch vụ</p>
                    <h2>Nâng cấp trải nghiệm cloud gaming</h2>
                    <p className="muted small">
                        Giá gói tính theo tháng, trừ trực tiếp từ số dư. PAYG tính theo phút và áp dụng cho tất cả máy.
                    </p>
                </div>
            </div>

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            {mySub && (
                <div className="card highlight subscription-status-card">
                    <div className="subscription-status-main">
                        <span className="badge success">Đang sử dụng</span>
                        <h3>{getPlanView(currentPlan || {}).displayName || 'Gói cước active'}</h3>
                    </div>
                    <div className="subscription-status-metrics">
                        <div>
                            <span>Hết hạn</span>
                            <strong>{formatDate(mySub.end_at)}</strong>
                        </div>
                        <div>
                            <span>Còn lại</span>
                            <strong>{remainingDays(mySub.end_at)} ngày</strong>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-3 subscription-plan-grid">
                {sortedPlans.map((plan) => {
                    const view = getPlanView(plan)
                    const isCurrent = mySub?.plan_id === plan.id
                    const isRecommended = view.featured
                    const price = view.price ?? plan.price_cents ?? plan.price ?? 0
                    const hasEnoughBalance = balance >= price
                    const isBuying = buyingPlanId === plan.id
                    const actionLabel = isCurrent
                        ? 'Đang sở hữu'
                        : hasEnoughBalance
                            ? mySub ? 'Đổi sang gói này' : 'Mua gói này'
                            : 'Nạp tiền để mua'
                    const badgeLabel = plan.active ? view.badge : 'Tạm ẩn'
                    const hasBenefitPairs = Array.isArray(view.benefits) && view.benefits.length > 0
                    const hasRates = Array.isArray(view.rates) && view.rates.length > 0
                    const highlights = hasBenefitPairs ? pickHighlights(view.benefits) : []

                    return (
                        <div
                            key={plan.id}
                            className={`card subscription-plan ${isRecommended ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                            <div className="plan-top">
                                <div>
                                    <span className="plan-badge">{badgeLabel}</span>
                                    <h3>{view.displayName}</h3>
                                </div>
                                {isRecommended && !isCurrent && <span className="pill ghost">{view.featuredLabel || 'Khuyên dùng'}</span>}
                                {isCurrent && <span className="pill">Hiện tại</span>}
                            </div>

                            <div className="plan-price">
                                <strong>{formatCurrency(price)}</strong>
                                <span>/ tháng</span>
                            </div>

                            <p className="muted small plan-tagline">{view.tagline}</p>

                            {view.suitableFor?.length > 0 && (
                                <div className="plan-section">
                                    <div className="plan-section-title">Phù hợp</div>
                                    <div className="plan-chip-list">
                                        {view.suitableFor.map((item) => (
                                            <span key={item} className="plan-chip">{item}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {highlights.length > 0 && (
                                <div className="plan-section">
                                    <div className="plan-section-title">Điểm nổi bật</div>
                                    <div className="plan-benefit-grid">
                                        {highlights.map((benefit) => (
                                            <div key={benefit.label} className="plan-benefit">
                                                <span>{benefit.label}</span>
                                                <strong>{benefit.value}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {view.savingsNote && (
                                <div className="plan-section">
                                    <div className="plan-section-title">Tiết kiệm</div>
                                    <div className="plan-savings">
                                        <strong>{view.savingsNote}</strong>
                                    </div>
                                </div>
                            )}

                            {hasRates && (
                                <div className="plan-section">
                                    <div className="plan-section-title">Giá chơi sau khi mua</div>
                                    <div className="plan-rate-table compact">
                                        {view.rates.slice(0, 2).map((rate) => (
                                            <div key={`${view.displayName}-${rate.gpu}`} className="plan-rate-row">
                                                <span>{rate.gpu}</span>
                                                <strong>{formatRate(rate.price)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="muted small">Xem đầy đủ tại trang Máy.</span>
                                </div>
                            )}


                            <div className="plan-actions">
                                {!isCurrent && !hasEnoughBalance && (
                                    <div className="plan-balance-warning">
                                        Cần thêm {formatCurrency(price - balance)} để mua gói này.
                                    </div>
                                )}

                                <button
                                    className={`btn ${isRecommended ? 'primary' : 'secondary'}`}
                                    onClick={() => (hasEnoughBalance ? openPurchaseDialog(plan) : ctx?.openTopup?.())}
                                    disabled={Boolean(buyingPlanId) || isCurrent}
                                >
                                    {isBuying ? 'Đang xử lý...' : actionLabel}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="card plan-compare">
                <div className="plan-compare-head">
                    <div>
                        <p className="muted">So sánh nhanh</p>
                        <h3>Lợi ích theo từng gói</h3>
                    </div>
                </div>
                <div className="plan-compare-grid">
                    {COMPARISON_ROWS.map((row) => (
                        <div key={row.feature} className="compare-item">
                            <div className="compare-feature">
                                <strong>{row.feature}</strong>
                                <span className="muted small">{row.note}</span>
                            </div>
                            <div className="compare-cells">
                                <div className="compare-cell">
                                    <span className="compare-tier">Free</span>
                                    <strong>{row.values.free}</strong>
                                </div>
                                <div className="compare-cell">
                                    <span className="compare-tier">Basic</span>
                                    <strong>{row.values.basic}</strong>
                                </div>
                                <div className="compare-cell">
                                    <span className="compare-tier">Pro</span>
                                    <strong>{row.values.pro}</strong>
                                </div>
                                <div className="compare-cell highlight">
                                    <span className="compare-tier">Premium</span>
                                    <strong>{row.values.premium}</strong>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!plans.length && (
                <div className="card">
                    <h3>Chưa có gói khả dụng</h3>
                    <p className="muted">Admin cần bật ít nhất một gói dịch vụ trong database.</p>
                </div>
            )}

            <div className="card info-card">
                <div className="info-header">
                    <span className="info-icon">i</span>
                    <h4>Lưu ý dịch vụ</h4>
                </div>
                <ul className="info-list">
                    <li>Gói cước có hiệu lực ngay sau khi mua thành công.</li>
                    <li>Mỗi tài khoản tại một thời điểm chỉ có thể sở hữu một gói active.</li>
                    <li>Tiền được trừ trực tiếp từ số dư tài khoản, không dùng USD.</li>
                </ul>
            </div>

            {selectedPlan && (
                <PurchasePlanDialog
                    plan={selectedPlan}
                    currentPlan={currentPlan}
                    balance={balance}
                    buying={buyingPlanId === selectedPlan.id}
                    onClose={closePurchaseDialog}
                    onConfirm={handlePurchase}
                />
            )}
        </div>
    )
}

function PurchasePlanDialog({ plan, currentPlan, balance, buying, onClose, onConfirm }) {
    const view = getPlanView(plan)
    const price = view.price ?? plan.price_cents ?? plan.price ?? 0
    const balanceAfter = balance - price
    const isChangingPlan = Boolean(currentPlan?.id && currentPlan.id !== plan.id)

    return (
        <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="modal subscription-confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <p className="muted">Xác nhận mua gói</p>
                        <h3>{view.displayName}</h3>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={buying} aria-label="Đóng">
                        ×
                    </button>
                </div>

                <div className="stack">
                    {isChangingPlan && (
                        <div className="alert info">
                            Gói hiện tại sẽ được dừng và thay bằng gói mới ngay sau khi giao dịch thành công.
                        </div>
                    )}

                    <div className="subscription-confirm-summary">
                        <div>
                            <span>Giá gói</span>
                            <strong>{formatCurrency(price)}</strong>
                        </div>
                        <div>
                            <span>Số dư hiện tại</span>
                            <strong>{formatCurrency(balance)}</strong>
                        </div>
                        <div>
                            <span>Số dư sau mua</span>
                            <strong>{formatCurrency(balanceAfter)}</strong>
                        </div>
                    </div>

                    <div className="plan-metrics">
                        <div>
                            <span>Thời hạn</span>
                            <strong>{plan.duration_days ? `${plan.duration_days} ngày` : '-'}</strong>
                        </div>
                        <div>
                            <span>Dung lượng</span>
                            <strong>{formatQuota(plan)}</strong>
                        </div>
                    </div>

                    <div className="actions row-between">
                        <button type="button" className="btn ghost" onClick={onClose} disabled={buying}>
                            Hủy
                        </button>
                        <button type="button" className="btn primary" onClick={onConfirm} disabled={buying}>
                            {buying ? 'Đang kích hoạt...' : 'Xác nhận mua'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Subscriptions
