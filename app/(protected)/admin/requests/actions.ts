'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()

  const { data, error: claimsError } = await supabase.auth.getClaims()
  const claims = data?.claims

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

export async function updateRequestParticipation(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')
  const returnToRaw = String(formData.get('return_to') || '/admin/requests')
  const returnTo = returnToRaw.startsWith('/admin/')
    ? returnToRaw
    : '/admin/requests'

  const onsiteParticipantIds = formData
    .getAll('onsite_participant_ids')
    .map((value) => String(value))
    .filter(Boolean)

  const remoteParticipantIds = formData
    .getAll('remote_participant_ids')
    .map((value) => String(value))
    .filter(Boolean)

  if (!requestId) {
    redirect('/admin/requests?error=missing')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({
      onsite_participant_ids: onsiteParticipantIds,
      remote_participant_ids: remoteParticipantIds,
    })
    .eq('id', requestId)

  if (error) {
    redirect(`${returnTo}?success=participation`)
  }

  revalidatePath('/admin/requests')
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  revalidatePath('/admin/pas-access')  

  redirect(`${returnTo}?success=participation`)
}

export async function togglePasConfirmed(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')
  const currentValue = String(formData.get('current_value') || '') === 'true'

  if (!requestId) {
    redirect('/admin/pas-access?error=missing')
  }

  const nextPasConfirmed = !currentValue

  const { data: currentRequest, error: currentRequestError } = await supabase
    .from('booking_requests')
    .select('access_dates_confirmed')
    .eq('id', requestId)
    .single()

  if (currentRequestError) {
    redirect('/admin/pas-access?error=pas')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({
      pas_confirmed: nextPasConfirmed,
    })
    .eq('id', requestId)

  if (error) {
    redirect('/admin/pas-access?error=pas')
  }

  revalidatePath('/admin/pas-access')
  revalidatePath('/admin/requests')

  if (nextPasConfirmed && currentRequest?.access_dates_confirmed) {
    redirect('/admin/pas-access?success=confirmed')
  }

  redirect('/admin/pas-access')
}

export async function toggleAccessDatesConfirmed(formData: FormData) {
  const supabase = await requireAdmin()

  const requestId = String(formData.get('request_id') || '')
  const currentValue = String(formData.get('current_value') || '') === 'true'

  if (!requestId) {
    redirect('/admin/pas-access?error=missing')
  }

  const nextAccessDatesConfirmed = !currentValue

  const { data: currentRequest, error: currentRequestError } = await supabase
    .from('booking_requests')
    .select('pas_confirmed')
    .eq('id', requestId)
    .single()

  if (currentRequestError) {
    redirect('/admin/pas-access?error=access')
  }

  const { error } = await supabase
    .from('booking_requests')
    .update({
      access_dates_confirmed: nextAccessDatesConfirmed,
    })
    .eq('id', requestId)

  if (error) {
    redirect('/admin/pas-access?error=access')
  }

  revalidatePath('/admin/pas-access')
  revalidatePath('/admin/requests')

  if (nextAccessDatesConfirmed && currentRequest?.pas_confirmed) {
    redirect('/admin/pas-access?success=confirmed')
  }

  redirect('/admin/pas-access')
}
