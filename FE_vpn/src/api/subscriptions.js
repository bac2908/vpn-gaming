import { request } from './client'

export async function listPlans() {
    return request('/subscriptions/plans', {
        method: 'GET',
    })
}

export async function getMySubscription(token) {
    return request('/subscriptions/me', {
        method: 'GET',
        token,
    })
}

export async function purchasePlan(planId, token) {
    return request('/subscriptions/purchase', {
        method: 'POST',
        body: { plan_id: planId },
        token,
    })
}
