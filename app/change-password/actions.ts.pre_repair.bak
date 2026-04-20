'use server'

import { createClient } from '@/lib/supabase/server'

export async function changePassword(newPassword: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Update auth password
  const { error: authError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (authError) throw authError

  // Clear force flag
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ force_password_change: false })
    .eq('id', user.id)

  if (profileError) throw profileError
}
