import { request } from './client'

export async function createMomoPayment({ amount, description }, token) {
    return request('/payments/momo', {
        method: 'POST',
        body: { amount, description },
        token,
    })
}

export async function getBalance(token) {
    return request('/payments/balance', {
        method: 'GET',
        token,
    })
}

export async function getMomoPaymentStatus(orderId, token) {
    const params = new URLSearchParams({ order_id: orderId })
    return request(`/payments/momo/status?${params.toString()}`, {
        method: 'GET',
        token,
    })
}

export async function getTopupHistory({ page = 1, pageSize = 10, status } = {}, token) {
    const params = new URLSearchParams({ page, page_size: pageSize })
    if (status) params.append('status', status)
    return request(`/payments/topup-history?${params.toString()}`, {
        method: 'GET',
        token,
    })
}

export async function getTopupSummary(token) {
    return request('/payments/topup-summary', {
        method: 'GET',
        token,
    })
}
