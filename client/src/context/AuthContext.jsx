
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import {
  api,
  ensureCsrfToken,
  clearCsrfToken
} from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the existing authenticated session.
  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const res = await api.get('/auth/me')
        const currentUser = res.data.user || null

        if (currentUser) {
          await ensureCsrfToken()
        }

        if (active) setUser(currentUser)
      } catch (err) {
        clearCsrfToken()
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  // Login does not require a CSRF token.
  // After login, fetch a token for the new session.
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', {
      email,
      password
    })

    clearCsrfToken()
    await ensureCsrfToken()

    setUser(res.data.user)
  }, [])

  // Registration also creates a new authenticated session.
  const register = useCallback(async (
    name,
    email,
    password
  ) => {
    const res = await api.post('/auth/register', {
      name,
      email,
      password
    })

    clearCsrfToken()
    await ensureCsrfToken()

    setUser(res.data.user)
  }, [])

  // The server must validate CSRF before clearing the cookie.
  const logout = useCallback(async () => {
    await api.post('/auth/logout')

    clearCsrfToken()
    setUser(null)

    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error(
      'useAuth must be used within <AuthProvider>'
    )
  }

  return ctx
}
