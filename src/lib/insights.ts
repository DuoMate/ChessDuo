import { supabase } from './supabase'

export async function getUserInsightsState(userId: string): Promise<{
  revealsUsed: number
  isPremium: boolean
  revealsRemaining: number
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('insights_reveals_used, is_premium')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      return { revealsUsed: 0, isPremium: false, revealsRemaining: 3 }
    }

    const used = data.insights_reveals_used ?? 0
    return {
      revealsUsed: used,
      isPremium: data.is_premium ?? false,
      revealsRemaining: Math.max(0, 3 - used),
    }
  } catch {
    return { revealsUsed: 0, isPremium: false, revealsRemaining: 3 }
  }
}

export async function incrementInsightsReveals(userId: string): Promise<number> {
  try {
    const { data: current } = await supabase
      .from('profiles')
      .select('insights_reveals_used')
      .eq('id', userId)
      .maybeSingle()

    const next = (current?.insights_reveals_used ?? 0) + 1

    await supabase
      .from('profiles')
      .upsert({ id: userId, insights_reveals_used: next }, { onConflict: 'id' })

    return Math.max(0, 3 - next)
  } catch {
    return 0
  }
}

export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle()

    return data?.is_premium ?? false
  } catch {
    return false
  }
}
