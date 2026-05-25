import { useEffect, useState } from 'react'
import { listPlans, purchasePlan, getMySubscription } from '../api/subscriptions'

const PLAN_PRESENTATION = {
    basic: {
        displayName: 'Gói Cơ Bản',
        badge: 'Tiết kiệm',
        useCase: 'Phù hợp để thử hệ thống, test ping và chơi các phiên ngắn.',
        benefits: ['Máy khu vực gần nhất', 'Resume snapshot cơ bản', 'Hỗ trợ qua ticket'],
    },
    pro: {
        displayName: 'Gói Pro',
        badge: 'Phổ biến',
        useCase: 'Dành cho người chơi thường xuyên, cần phiên ổn định và ưu tiên hơn.',
        benefits: ['Ưu tiên máy ping thấp', 'Snapshot resume nhanh', 'Theo dõi phiên và lịch sử'],
        featured: true,
    },
    premium: {
        displayName: 'Gói Premium',
        badge: 'Hiệu năng cao',
        useCase: 'Dành cho người chơi nhiều, stream thường xuyên và cần hỗ trợ nhanh.',
        benefits: ['Ưu tiên GPU mạnh', 'Không giới hạn dung lượng', 'Tối ưu Moonlight/Sunshine'],
    },
}

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
    const view = PLAN_PRESENTATION[plan.code] || {}
    return {
        displayName: view.displayName || plan.name || 'Gói dịch vụ',
        badge: view.badge || 'Gói dịch vụ',
        useCase: view.useCase || plan.description || 'Gói dịch vụ giúp tối ưu trải nghiệm.',
        benefits: view.benefits || ['Kích hoạt ngay sau khi mua', 'Trừ trực tiếp từ số dư', 'Quản lý trong lịch sử'],
        featured: view.featured,
    }
}

function Subscriptions({ ctx }) {
    const token = ctx?.token
    const [plans, setPlans] = useState([])
    const [mySub, setMySub] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [buying, setBuying] = useState(false)

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

    const handlePurchase = async (plan) => {
        const view = getPlanView(plan)
        const price = plan.price_cents ?? plan.price ?? 0
        const confirmed = window.confirm(`Bạn có chắc muốn mua "${view.displayName}" với giá ${formatCurrency(price)}?`)
        if (!confirmed) return

        setBuying(true)
        setError('')
        try {
            const res = await purchasePlan(plan.id, token)
            setMySub(res)
            if (ctx?.refreshBalance) ctx.refreshBalance()
            alert(`Mua ${view.displayName} thành công!`)
        } catch (err) {
            setError(err.message || 'Giao dịch thất bại')
        } finally {
            setBuying(false)
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
            <div className="section-head">
                <div>
                    <p className="muted">Gói dịch vụ</p>
                    <h2>Nâng cấp trải nghiệm cloud gaming</h2>
                    <p className="muted small">
                        Tất cả giá đều là VND và được trừ từ số dư tài khoản. Gói có hiệu lực ngay sau khi mua thành công.
                    </p>
                </div>
            </div>

            {error && <div className="alert error">{error}</div>}

            {mySub && (
                <div className="card highlight subscription-status-card">
                    <div>
                        <span className="badge success">Đang sử dụng</span>
                        <h3>{getPlanView(mySub.plan || {}).displayName || 'Gói cước active'}</h3>
                        <p className="muted">Gói hiện tại của bạn đang được áp dụng cho toàn bộ phiên VM/VPN.</p>
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
                {plans.map((plan) => {
                    const view = getPlanView(plan)
                    const isCurrent = mySub?.plan_id === plan.id
                    return (
                        <div
                            key={plan.id}
                            className={`card subscription-plan ${view.featured ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                            <div className="plan-top">
                                <div>
                                    <span className="plan-badge">{view.badge}</span>
                                    <h3>{view.displayName}</h3>
                                </div>
                                {isCurrent && <span className="pill">Hiện tại</span>}
                            </div>

                            <div className="plan-price">
                                <strong>{formatCurrency(plan.price_cents ?? plan.price)}</strong>
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

                            <button
                                className={`btn ${view.featured ? 'primary' : 'secondary'}`}
                                onClick={() => handlePurchase(plan)}
                                disabled={buying || isCurrent}
                            >
                                {buying ? 'Đang xử lý...' : (isCurrent ? 'Đang sở hữu' : 'Mua gói này')}
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
        </div>
    )
}

export default Subscriptions
