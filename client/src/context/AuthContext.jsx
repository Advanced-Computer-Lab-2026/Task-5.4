
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearCsrfToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the user session using the httpOnly auth cookie.
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Login
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })

    // Clear any CSRF token from the previous session.
    clearCsrfToken()

    setUser(res.data.user)
  }, [])

  // Register
  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', {
      name,
      email,
      password
    })

    // Clear any CSRF token from the previous session.
    clearCsrfToken()

    setUser(res.data.user)
  }, [])

  // Logout
  const logout = useCallback(async () => {
    try {
      // Ask the server to clear the authentication cookie.
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors.
    } finally {
      // Clear the cached CSRF token and local user state.
      clearCsrfToken()
      setUser(null)

      // Redirect to the login page.
      window.location.href = '/login'
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }

  return ctx
}
