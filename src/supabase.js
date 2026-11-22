import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 登入後由資料庫簽發的 session token。每個請求都會帶在 x-app-session 標頭，
// 由資料庫（RLS 與 RPC）驗證身分。存在 sessionStorage：關閉分頁即失效、重新整理不需重登。
const TOKEN_KEY = 'sldpsy_session_token'
let memoryToken = null

export const getSessionToken = () => {
    try {
        return sessionStorage.getItem(TOKEN_KEY) || memoryToken
    } catch {
        return memoryToken
    }
}

export const setSessionToken = (token) => {
    memoryToken = token || null
    try {
        if (token) sessionStorage.setItem(TOKEN_KEY, token)
        else sessionStorage.removeItem(TOKEN_KEY)
    } catch { /* 無法使用 sessionStorage 時僅保存在記憶體 */ }
}

const fetchWithSession = (input, init = {}) => {
    const token = getSessionToken()
    if (!token) return fetch(input, init)
    const headers = new Headers(init.headers)
    headers.set('x-app-session', token)
    return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchWithSession },
})
