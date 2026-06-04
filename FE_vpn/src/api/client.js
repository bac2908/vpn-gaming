// API Base URL configuration:
// - Trong development: sử dụng VITE_API_BASE_URL (vd: http://localhost:8080)
// - Trong production: sử dụng '' (empty) để gọi qua nginx reverse proxy cùng domain
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

class ApiError extends Error {
    constructor(message, { status, data } = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.data = data
    }
}

async function request(path, { method = 'GET', headers = {}, body, token } = {}) {
    const finalHeaders = { ...headers }
    if (body && !finalHeaders['Content-Type']) {
        finalHeaders['Content-Type'] = 'application/json'
    }
    if (token) {
        finalHeaders.Authorization = `Bearer ${token}`
    }

    const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
    const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
    })

    const text = await response.text()
    let data = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = text
    }

    if (!response.ok) {
        const message = data?.detail || data?.message || `Request failed (${response.status})`
        if (token && response.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vpngaming:auth-expired', {
                detail: { message, path, status: response.status },
            }))
        }
        throw new ApiError(message, { status: response.status, data })
    }

    return data
}

export { request, API_BASE_URL, ApiError }
