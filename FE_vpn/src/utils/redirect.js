const DEFAULT_USER_PATH = '/app'
const DEFAULT_ADMIN_PATH = '/admin'

function decodeRedirect(value) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

export function getSafeRedirect(value, role = 'user') {
    const fallback = role === 'admin' ? DEFAULT_ADMIN_PATH : DEFAULT_USER_PATH
    if (!value || typeof value !== 'string') return fallback

    const redirect = decodeRedirect(value).trim()
    if (!redirect.startsWith('/') || redirect.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(redirect)) {
        return fallback
    }

    if (role === 'admin') {
        return redirect.startsWith('/admin') ? redirect : DEFAULT_ADMIN_PATH
    }

    return redirect.startsWith('/app') ? redirect : DEFAULT_USER_PATH
}

export function getRedirectFromSearch(searchParams, role = 'user') {
    return getSafeRedirect(searchParams.get('redirect'), role)
}

export function buildLoginRedirect(target) {
    return `/login?redirect=${encodeURIComponent(getSafeRedirect(target, 'user'))}`
}

export function buildRegisterRedirect(target) {
    return `/register?redirect=${encodeURIComponent(getSafeRedirect(target, 'user'))}`
}
