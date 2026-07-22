import { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const AuthService = {
  getSession: async (): Promise<Session | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  onAuthChange: (callback: (event: string, session: Session | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange(callback)
    return () => data.subscription.unsubscribe()
  },
}
