'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims()

  if (claimsError || !claims) {
    throw new Error('You must be signed in.')
  }

  const userId = claims.sub

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (adminError || !adminRow) {
    throw new Error('Admin access required.')
  }

  return { supabase, userId }
}

export async function addAvailableDay(formData: FormData) {
  const { supabase } = await requireAdmin()

  const day = String(formData.get('day') || '').trim()

  if (!day) {
    throw new Error('Missing day.')
  }

  const { data: existing, error: existingError } = await supabase
    .from('instrument_days')
    .select('id, day, status')
    .eq('day', day)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed checking existing day: ${existingError.message}`)
  }

  if (existing) {
    if (existing.status === 'available') {
      revalidatePath('/admin/available_days')
      revalidatePath('/available_days')
      return
    }

    throw new Error(`Day already exists with status "${existing.status}".`)
  }

  const { error } = await supabase.from('instrument_days').insert({
    day,
    status: 'available',
    notes: null,
  })

  if (error) {
    throw new Error(`Failed to add available day: ${error.message}`)
  }

  revalidatePath('/admin/available_days')
  revalidatePath('/available_days')
}

export async function removeAvailableDay(formData: FormData) {
  const { supabase } = await requireAdmin()

  const instrumentDayId = String(formData.get('instrument_day_id') || '').trim()
  const day = String(formData.get('day') || '').trim()

  if (!instrumentDayId && !day) {
    throw new Error('Missing instrument day identifier.')
  }

  if (instrumentDayId) {
    const { data: deletedRow, error } = await supabase
      .from('instrument_days')
      .delete()
      .eq('id', instrumentDayId)
      .eq('status', 'available')
      .select('id, day, status')
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to remove available day: ${error.message}`)
    }

    if (!deletedRow) {
      throw new Error('No available day was removed. It may already be pending, booked, or deleted.')
    }
  } else {
    const { data: deletedRows, error } = await supabase
      .from('instrument_days')
      .delete()
      .eq('day', day)
      .eq('status', 'available')
      .select('id, day, status')

    if (error) {
      throw new Error(`Failed to remove available day: ${error.message}`)
    }

    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('No available day was removed for that date.')
    }
  }

  revalidatePath('/admin/available_days')
  revalidatePath('/available_days')
}
