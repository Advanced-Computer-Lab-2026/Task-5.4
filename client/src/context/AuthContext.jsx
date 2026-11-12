import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, refreshCsrfToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Bootstrap the user from the httpOnly auth cookie. There is no token in
  // localStorage anymore — the browser holds the cookie and sends it on /auth/me.
  // The CSRF token is fetched lazily by the api interceptor on the first write.
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    // The server sets the auth cookie in its response; nothing to store here.
    const res = await api.post('/auth/login', { email, password })
    setUser(res.data.user)
    // New session cookie → the CSRF token must be re-issued for this session.
    await refreshCsrfToken()
  }, [])

  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password })
    setUser(res.data.user)
    // Registering logs the user in (new session) → get a matching CSRF token.
    await refreshCsrfToken()
  }, [])

  const logout = useCallback(async () => {
    // Ask the server to clear the auth cookie, then reset local state.
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    setUser(null)
    // Full page reload resets the in-memory CSRF token, so no refresh needed.
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}