import { useEffect, useMemo, useState } from 'react'
import { listPlans, purchasePlan, getMySubscription } from '../api/subscriptions'

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

const getPlanView = (plan = {}) => {
    return {
        displayName: plan.name || 'Gói dịch vụ',
        badge: plan.active ? 'Đang mở bán' : 'Tạm ẩn',
        useCase: plan.description || 'Thông tin gói được lấy từ hệ thống.',
        benefits: [
            `Mã gói: ${plan.code || 'Chưa có mã'}`,
            `Thời hạn: ${plan.duration_days ? `${plan.duration_days} ngày` : 'Chưa cấu hình'}`,
            `Dung lượng: ${formatQuota(plan)}`,
        ],
        featured: false,
    }
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
        () => [...plans].sort((a, b) => (a.price_cents ?? a.price ?? 0) - (b.price_cents ?? b.price ?? 0)),
        [plans],
    )

    const recommendedPlan = sortedPlans[0]
    const currentPlan = mySub?.plan || sortedPlans.find((plan) => plan.id === mySub?.plan_id)

    useEffect(() => {
        let cancelled = false

        async function load() {
            setLoading(true)
            setError('')
            try {
                const [plansData, subData] = await Promise.all([
                    listPlans(),
                    token ? getMySubscription(token) : Promise.resolve(null),
                ])
                if (!cancelled) {
                    const items = Array.isArray(plansData?.items)
                        ? plansData.items
                        : Array.isArray(plansData)
                            ? plansData
                            : []
                    setPlans(items)
                    setMySub(subData)
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Không tải được danh sách gói cước')
            } finally {
                if (!cancelled) setLoading(false)
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
                        Tất cả giá đều là VND và được trừ từ số dư tài khoản. Gói có hiệu lực ngay sau khi mua thành công.
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
                    const isRecommended = recommendedPlan?.id === plan.id
                    const price = plan.price_cents ?? plan.price ?? 0
                    const hasEnoughBalance = balance >= price
                    const isBuying = buyingPlanId === plan.id
                    const actionLabel = isCurrent
                        ? 'Đang sở hữu'
                        : hasEnoughBalance
                            ? mySub ? 'Đổi sang gói này' : 'Mua gói này'
                            : 'Nạp tiền để mua'

                    return (
                        <div
                            key={plan.id}
                            className={`card subscription-plan ${isRecommended ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                            <div className="plan-top">
                                <div>
                                    <span className="plan-badge">{view.badge}</span>
                                    <h3>{view.displayName}</h3>
                                </div>
                                {isRecommended && !isCurrent && <span className="pill ghost">Khuyên dùng</span>}
                                {isCurrent && <span className="pill">Hiện tại</span>}
                            </div>

                            <div className="plan-price">
                                <strong>{formatCurrency(price)}</strong>
                                <span>/ gói</span>
                            </div>

                            <p className="muted small plan-summary">{view.useCase}</p>

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

                            <ul className="plan-features">
                                {view.benefits.map((benefit) => (
                                    <li key={benefit}>{benefit}</li>
                                ))}
                            </ul>

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
                    )
                })}
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
    const price = plan.price_cents ?? plan.price ?? 0
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
