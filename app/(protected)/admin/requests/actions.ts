'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims()

  if (claimsError || !claims) {
    redirect('/login')
  }

  const { data: adminRow, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', claims.sub)
    .maybeSingle()

  if (error || !adminRow) {
    redirect('/dashboard')
  }

  return supabase
}

export async function approveRequest(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')

  if (!requestId) {
    redirect('/admin/requests?error=missing')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({ status: 'booked' })
    .eq('id', requestId)

  if (error) {
    redirect('/admin/requests?error=approve')
  }

  revalidatePath('/admin/requests')
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  redirect('/admin/requests?success=approved')
}

export async function rejectRequest(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')

  if (!requestId) {
    redirect('/admin/requests?error=missing')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)

  if (error) {
    redirect('/admin/requests?error=reject')
  }

  revalidatePath('/admin/requests')
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  redirect('/admin/requests?success=rejected')
}

export async function cancelApprovedRequest(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')

  if (!requestId) {
    redirect('/admin/requests?error=missing')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)

  if (error) {
    redirect('/admin/requests?error=cancel')
  }

  revalidatePath('/admin/requests')
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  redirect('/admin/requests?success=cancelled')
}
