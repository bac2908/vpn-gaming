import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock3, Loader2, ReceiptText, RotateCcw, Wallet, XCircle } from 'lucide-react'
import { getMomoPaymentStatus } from '../api/payments'

const POLL_DELAY_MS = 2000
const MAX_POLL_ATTEMPTS = 12

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

const getReturnStatus = (searchParams) => {
    const resultCode = searchParams.get('resultCode')
    if (resultCode === null || resultCode === undefined || resultCode === '') return null
    return Number(resultCode) === 0 ? 'succeeded' : 'failed'
}

function TopupResult({ ctx }) {
    const location = useLocation()
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
    const orderId = searchParams.get('orderId') || searchParams.get('order_id')
    const requestId = searchParams.get('requestId') || searchParams.get('request_id')
    const gatewayMessage = searchParams.get('message') || searchParams.get('localMessage') || ''
    const gatewayStatus = getReturnStatus(searchParams)
    const [payment, setPayment] = useState(null)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        if (!orderId || !ctx?.token) return undefined

        let cancelled = false
        let timer = null

        const load = async () => {
            try {
                const data = await getMomoPaymentStatus(orderId, ctx.token)
                if (cancelled) return
                setPayment(data)
                setError('')
                if (data.status === 'succeeded') {
                    ctx?.refreshBalance?.()
                    return
                }
                if (data.status === 'pending' && attempt < MAX_POLL_ATTEMPTS) {
                    timer = window.setTimeout(() => setAttempt((value) => value + 1), POLL_DELAY_MS)
                }
            } catch (err) {
                if (cancelled) return
                setError(err.message || 'Không kiểm tra được trạng thái giao dịch')
            }
        }

        load()
        return () => {
            cancelled = true
            if (timer) window.clearTimeout(timer)
        }
    }, [attempt, ctx, orderId])

    const paymentStatus = payment?.status
    const effectiveStatus = paymentStatus === 'pending' && gatewayStatus === 'failed'
        ? 'failed'
        : paymentStatus || gatewayStatus || 'pending'
    const isSuccess = effectiveStatus === 'succeeded'
    const isFailed = effectiveStatus === 'failed' || effectiveStatus === 'cancelled'
    const isPending = !isSuccess && !isFailed && !error
    const amount = payment?.amount || Number(searchParams.get('amount') || 0)

    const title = !orderId
        ? 'Thiếu mã giao dịch'
        : isSuccess
            ? 'Nạp tiền thành công'
            : isFailed
                ? 'Thanh toán chưa hoàn tất'
                : 'Đang xác minh thanh toán'

    const description = !orderId
        ? 'Không tìm thấy mã giao dịch từ MoMo. Bạn có thể kiểm tra lại lịch sử hoặc tạo giao dịch mới.'
        : isSuccess
            ? 'Số dư ví đã được cập nhật sau khi hệ thống nhận xác nhận từ MoMo.'
            : isFailed
                ? (payment?.message || gatewayMessage || 'MoMo báo giao dịch không thành công hoặc đã bị hủy.')
                : 'Hệ thống đang chờ IPN xác nhận từ MoMo. Trang này sẽ tự cập nhật trong giây lát.'

    const StatusIcon = !orderId
        ? AlertCircle
        : isSuccess
            ? CheckCircle2
            : isFailed
                ? XCircle
                : Loader2

    return (
        <div className="topup-result-page">
            <section className={`topup-result-card ${isSuccess ? 'success' : isFailed || error || !orderId ? 'failed' : 'pending'}`}>
                <div className="topup-result-icon">
                    <StatusIcon className={isPending ? 'spin' : ''} />
                </div>
                <div className="topup-result-copy">
                    <span className="eyebrow">MoMo payment</span>
                    <h2>{title}</h2>
                    <p>{error || description}</p>
                </div>

                <div className="topup-result-grid">
                    <div>
                        <span>Số tiền</span>
                        <strong>{amount ? formatMoney(amount) : '--'}</strong>
                    </div>
                    <div>
                        <span>Trạng thái</span>
                        <strong>{isSuccess ? 'Thành công' : isFailed ? 'Thất bại' : 'Đang xác minh'}</strong>
                    </div>
                    <div>
                        <span>Mã giao dịch</span>
                        <strong title={orderId || ''}>{orderId || '--'}</strong>
                    </div>
                    <div>
                        <span>Mã yêu cầu</span>
                        <strong title={payment?.request_id || requestId || ''}>{payment?.request_id || requestId || '--'}</strong>
                    </div>
                    {payment?.balance_after !== null && payment?.balance_after !== undefined && (
                        <div>
                            <span>Số dư sau nạp</span>
                            <strong>{formatMoney(payment.balance_after)}</strong>
                        </div>
                    )}
                    {payment?.trans_id && (
                        <div>
                            <span>Mã MoMo</span>
                            <strong>{payment.trans_id}</strong>
                        </div>
                    )}
                </div>

                {isPending && (
                    <div className="topup-result-wait">
                        <Clock3 />
                        <span>Đang kiểm tra lần {Math.min(attempt + 1, MAX_POLL_ATTEMPTS)}/{MAX_POLL_ATTEMPTS}. Nếu MoMo xử lý chậm, giao dịch sẽ tự cập nhật trong lịch sử.</span>
                    </div>
                )}

                <div className="topup-result-actions">
                    <Link className="btn primary" to="/app/history?tab=topup">
                        <ReceiptText className="h-4 w-4" />
                        Xem lịch sử nạp
                    </Link>
                    <button type="button" className="btn secondary" onClick={() => ctx?.openTopup?.()}>
                        <RotateCcw className="h-4 w-4" />
                        Nạp lại
                    </button>
                    <Link className="btn ghost" to="/app">
                        <Wallet className="h-4 w-4" />
                        Về Play Center
                    </Link>
                </div>
            </section>
        </div>
    )
}

export default TopupResult
