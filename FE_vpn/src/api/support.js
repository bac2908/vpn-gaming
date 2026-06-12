import { request } from './client'

function buildQuery(params = {}) {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    const search = new URLSearchParams(entries)
    const query = search.toString()
    return query ? `?${query}` : ''
}

export async function createSupportTicket(payload, token) {
    return request('/support/tickets', { method: 'POST', body: payload, token })
}

export async function listMySupportTickets(params = {}, token) {
    const query = buildQuery(params)
    return request(`/support/tickets/me${query}`, { token })
}
