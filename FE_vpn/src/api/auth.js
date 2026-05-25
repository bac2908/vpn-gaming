import { request } from './client'

export async function login(email, password) {
    return request('/auth/login', {
        method: 'POST',
        body: { email, password },
    })
}

export async function register(email, password, display_name) {
    return request('/auth/register', {
        method: 'POST',
        body: { email, password, display_name },
    })
}

export async function forgotPassword(email) {
    return request('/auth/forgot', {
        method: 'POST',
        body: { email },
    })
}

export async function resetPassword(token, new_password) {
    return request('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password },
    })
}

export async function changePassword(email, old_password, new_password) {
    return request('/auth/change-password', {
        method: 'POST',
        body: { email, old_password, new_password },
    })
}

export async function updateProfile(payload, token) {
    return request('/auth/profile', {
        method: 'PATCH',
        body: payload,
        token,
    })
}

export async function fetchMe(token) {
    return request('/auth/me', { token })
}

export async function logout(token) {
    return request('/auth/logout', { method: 'POST', token })
}

export function normalizeUser(user, fallbackEmail) {
    if (!user) return null
    const email = user.email || fallbackEmail || 'unknown@example.com'
    return {
        id: user.id,
        email,
        name: user.display_name || user.name || email.split('@')[0] || 'User',
        role: user.role || 'user',
        balance: user.balance || 0,
    }
}
