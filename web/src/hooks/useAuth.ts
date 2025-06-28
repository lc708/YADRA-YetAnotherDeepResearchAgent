import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '~/lib/supa'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    // 获取初始会话
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
          error: null,
        }))
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Authentication error',
          loading: false,
        }))
      }
    }

    getInitialSession()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
          error: null,
        }))
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 登出功能
  const signOut = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }))
        return false
      }

      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        loading: false,
        error: null,
      }))
      return true
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Sign out failed',
        loading: false,
      }))
      return false
    }
  }

  // 刷新会话
  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      
      if (error) {
        setState(prev => ({ ...prev, error: error.message }))
        return false
      }

      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        error: null,
      }))
      return true
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Refresh failed',
      }))
      return false
    }
  }

  return {
    ...state,
    isAuthenticated: !!state.session && !!state.user,
    signOut,
    refreshSession,
  }
} 