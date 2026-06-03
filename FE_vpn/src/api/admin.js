import { API_BASE_URL, request } from './client'

function buildQuery(params = {}) {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    const search = new URLSearchParams(entries)
    const query = search.toString()
    return query ? `?${query}` : ''
}

// ===== Dashboard API =====
export async function getDashboard(token) {
    return request('/admin/dashboard', { token })
}

// ===== User APIs =====
export async function listUsers(params, token) {
    const query = buildQuery(params)
    return request(`/admin/users${query}`, { token })
}

export async function updateUser(userId, payload, token) {
    return request(`/admin/users/${userId}`, { method: 'PATCH', body: payload, token })
}

export async function adminTopupUser(userId, amount, description, token) {
    return request(`/admin/users/${userId}/topup`, { method: 'POST', body: { amount, description }, token })
}

// ===== Machine APIs =====
export async function listAdminMachines(params, token) {
    const query = buildQuery(params)
    return request(`/admin/machines${query}`, { token })
}

export async function createMachine(payload, token) {
    return request('/admin/machines', { method: 'POST', body: payload, token })
}

export async function updateMachine(machineId, payload, token) {
    return request(`/admin/machines/${machineId}`, { method: 'PATCH', body: payload, token })
}

export async function deleteMachine(machineId, token) {
    return request(`/admin/machines/${machineId}`, { method: 'DELETE', token })
}

export async function getMachineStatistics(token) {
    return request('/admin/machines/statistics', { token })
}

// ===== Admin Settings APIs =====
export async function getAdminSettings(token) {
    return request('/admin/settings', { token })
}

export async function updateAdminSettings(payload, token) {
    return request('/admin/settings', { method: 'PUT', body: payload, token })
}

// ===== Session APIs =====
export async function listSessions(params, token) {
    const query = buildQuery(params)
    return request(`/admin/sessions${query}`, { token })
}

export async function stopSession(sessionId, token) {
    return request(`/admin/sessions/${sessionId}/stop`, { method: 'POST', token })
}

export async function failSession(sessionId, payload, token) {
    return request(`/admin/sessions/${sessionId}/fail`, { method: 'POST', body: payload, token })
}

// ===== Transaction/Revenue APIs =====
export async function adminListTopupTransactions(params, token) {
    const query = buildQuery(params)
    return request(`/admin/transactions${query}`, { token })
}

export async function getTransactionDetail(transactionId, token) {
    return request(`/admin/transactions/${transactionId}`, { token })
}

export async function getRevenueStatistics(params, token) {
    const query = buildQuery(params)
    return request(`/admin/revenue/statistics${query}`, { token })
}

export async function exportTransactionsCSV(params, token) {
    const query = buildQuery(params)
    const finalHeaders = {}
    if (token) finalHeaders.Authorization = `Bearer ${token}`
    const url = API_BASE_URL ? `${API_BASE_URL}/admin/transactions/export${query}` : `/admin/transactions/export${query}`
    const response = await fetch(url, { headers: finalHeaders })
    if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed (${response.status})`)
    }
    return response.blob()
}
