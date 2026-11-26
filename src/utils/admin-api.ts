import { ref } from 'vue'

export const adminName = ref<string | null>(null)
export const sessionExpired = 'game-req:session-expired'
export const gamesChanged = 'game-req:games-changed'
export const notifyGamesChanged = () => window.dispatchEvent(new Event(gamesChanged))
export function expireSession() {
    adminName.value = null
    window.dispatchEvent(new Event(sessionExpired))
}

export async function adminFetch(url: string, options?: RequestInit) {
    const headers = new Headers(options?.headers)
    if (options?.method && !['GET', 'HEAD'].includes(options.method)) headers.set('X-Game-Req', '1')
    const response = await fetch(url, { ...options, headers })
    if (response.status === 401 && url !== '/api/auth/login') expireSession()
    return response
}

export async function adminRequest<Result>(url: string, body?: unknown): Promise<Result> {
    const response = await adminFetch(url, body === undefined ? undefined : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (response.status === 204) return undefined as Result
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) throw new Error(data?.message || '无法连接后台服务')
    return data
}

export const authStatus = () => adminRequest<{ setupRequired: boolean; username: string | null }>('/api/auth/status')
