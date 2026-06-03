import { API_BASE_URL, request } from './client'

function buildQuery(params = {}) {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    const search = new URLSearchParams(entries)
    const query = search.toString()
    return query ? `?${query}` : ''
}

export async function listMachines(params, token) {
    const query = buildQuery(params)
    return request(`/machines${query}`, { token })
}

export async function getMachine(machineId, token) {
    return request(`/machines/${machineId}`, { token })
}

export async function startMachine(machineId, token) {
    return request(`/machines/${machineId}/start`, { method: 'POST', token })
}

export async function resumeMachine(machineId, token) {
    return request(`/machines/${machineId}/resume`, { method: 'POST', token })
}

export async function getActiveSession(token) {
    return request('/machines/sessions/active', { token })
}

export async function getSessionHistory(params = {}, token) {
    const query = buildQuery({
        page: params.page,
        page_size: params.pageSize,
        status: params.status,
        machine_id: params.machineId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        sort: params.sort,
    })
    return request(`/machines/sessions/history${query}`, { token })
}

export async function getSessionHistorySummary(token) {
    return request('/machines/sessions/history/summary', { token })
}

export async function stopSession(sessionId, token, options = {}) {
    const query = buildQuery({ retain_snapshot: options.retainSnapshot ? true : undefined })
    return request(`/machines/sessions/${sessionId}/stop${query}`, { method: 'POST', token })
}

export async function heartbeatSession(sessionId, payload = {}, token) {
    return request(`/machines/sessions/${sessionId}/heartbeat`, { method: 'POST', body: payload, token })
}

export async function checkVpnConnection(sessionId, token) {
    return request(`/machines/sessions/${sessionId}/vpn/check`, { method: 'POST', token })
}

export async function markSunshinePaired(sessionId, token) {
    return request(`/machines/sessions/${sessionId}/sunshine/pair`, { method: 'POST', token })
}

function parseDownloadFilename(disposition, fallback) {
    const match = disposition?.match(/filename="?([^"]+)"?/i)
    return match?.[1] || fallback
}

export async function downloadOvpn(sessionId, token) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const path = `/machines/sessions/${sessionId}/ovpn`
    const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
    const response = await fetch(url, { headers })

    if (!response.ok) {
        const text = await response.text()
        let data = null
        try {
            data = text ? JSON.parse(text) : null
        } catch {
            data = text
        }
        const message = data?.detail || data?.message || `Request failed (${response.status})`
        throw new Error(message)
    }

    const blob = await response.blob()
    const filename = parseDownloadFilename(
        response.headers.get('Content-Disposition'),
        `vpngaming-${String(sessionId).slice(0, 8)}.ovpn`,
    )
    return { blob, filename }
}
