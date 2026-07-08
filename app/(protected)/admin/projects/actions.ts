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

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', claims.sub)
    .maybeSingle()

  if (!adminRow) {
    redirect('/dashboard')
  }

  return { supabase, userId: claims.sub }
}

function parseEmails(raw: string) {
  return raw
    .split(/[\n,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAdmin()

  const title = String(formData.get('title') || '').trim()
  const proposalNumber = String(formData.get('proposal_number') || '').trim()
  const allocatedDays = Number(formData.get('allocated_days') || 0)
  const cycleId = String(formData.get('cycleId') || '').trim()
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const memberEmailsRaw = String(formData.get('member_emails') || '').trim()

  if (!title || !proposalNumber || !startDate || !endDate || !allocatedDays || !cycleId) {
    redirect('/admin/projects/new?error=missing')
  }

  if (endDate < startDate) {
    redirect('/admin/projects/new?error=dates')
  }

  const memberEmails = parseEmails(memberEmailsRaw)

  let matchedProfiles:
    | { id: string; email: string }[]
    | null = []

  if (memberEmails.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', memberEmails)

    if (profilesError) {
      redirect('/admin/projects/new?error=members')
    }

    matchedProfiles = profiles ?? []
  }

  const ownerUserId = matchedProfiles.length > 0 ? matchedProfiles[0].id : null

  const { data: createdProject, error: projectError } = await supabase
    .from('projects')
    .insert({
      title,
      proposal_number: proposalNumber,
      allocated_days: allocatedDays,
      start_date: startDate,
      end_date: endDate,
      owner_user_id: ownerUserId,
      status: 'active',
    })
    .select('id')
    .single()

  if (projectError || !createdProject) {
    redirect('/admin/projects/new?error=create')
  }

  const { error: cycleInsertError } = await supabase
    .from('project_cycles')
    .insert({
      project_id: createdProject.id,
      cycle_id: cycleId,
    })

  if (cycleInsertError) {
    redirect('/admin/projects/new?error=create')
  }

  const { error: allocationInsertError } = await supabase
    .from('project_allocations')
    .insert({
      project_id: createdProject.id,
      allocation_type: 'original',
      days: allocatedDays,
      note: 'Initial project allocation',
    })

  if (allocationInsertError) {
    redirect('/admin/projects/new?error=create')
  }

  if (matchedProfiles.length > 0) {
    const memberRows = matchedProfiles.map((profile) => ({
      project_id: createdProject.id,
      user_id: profile.id,
    }))

    const { error: memberInsertError } = await supabase
      .from('project_members')
      .insert(memberRows)

    if (memberInsertError) {
      redirect('/admin/projects/new?error=members')
    }
  }

  revalidatePath('/admin/projects')
  redirect('/admin/projects?success=created')
}

export async function updateProject(formData: FormData) {
  const { supabase } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()
  const title = String(formData.get('title') || '').trim()
  const proposalNumber = String(formData.get('proposal_number') || '').trim()
  const allocatedDays = Number(formData.get('allocated_days') || 0)
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()

  if (!projectId || !title || !proposalNumber || !startDate || !endDate || !allocatedDays) {
    redirect(`/admin/projects/${projectId}?error=missing`)
  }

  if (endDate < startDate) {
    redirect(`/admin/projects/${projectId}?error=dates`)
  }

  const { error } = await supabase
    .from('projects')
    .update({
      title,
      proposal_number: proposalNumber,
      allocated_days: allocatedDays,
      start_date: startDate,
      end_date: endDate,
    })
    .eq('id', projectId)

  if (error) {
    redirect(`/admin/projects/${projectId}?error=update`)
  }

  revalidatePath('/admin/projects')
  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  redirect(`/admin/projects/${projectId}?success=updated`)
}

export async function extendProjectCycle(formData: FormData) {
  const { supabase } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()

  if (!projectId) {
    redirect('/admin/projects?error=extend')
  }

  const { data: projectCycles, error: projectCyclesError } = await supabase
    .from('project_cycles')
    .select(`
      cycle_id,
      proposal_cycles:cycle_id (
        id,
        code,
        year,
        half
      )
    `)
    .eq('project_id', projectId)

  if (projectCyclesError || !projectCycles || projectCycles.length === 0) {
    redirect(`/admin/projects/${projectId}?error=extend`)
  }

  const normalizedCycles = projectCycles
    .map((row) => {
      const cycle = Array.isArray(row.proposal_cycles)
        ? row.proposal_cycles[0]
        : row.proposal_cycles

      return cycle
        ? {
            id: cycle.id as string,
            code: cycle.code as string,
            year: cycle.year as number,
            half: cycle.half as 'A' | 'B',
          }
        : null
    })
    .filter(Boolean) as { id: string; code: string; year: number; half: 'A' | 'B' }[]

  if (normalizedCycles.length === 0) {
    redirect(`/admin/projects/${projectId}?error=extend`)
  }

  if (normalizedCycles.length >= 2) {
    redirect(`/admin/projects/${projectId}?error=extend-limit`)
  }

  const latestCycle = normalizedCycles.sort((a, b) => b.year - a.year)[0]
  const nextYear = latestCycle.year + 1
  const nextHalf = latestCycle.half
  const nextCode = `${nextYear}${nextHalf}`

  const { data: nextCycle, error: nextCycleError } = await supabase
    .from('proposal_cycles')
    .select('id, code, end_date')
    .eq('code', nextCode)
    .single()

  if (nextCycleError || !nextCycle) {
    redirect(`/admin/projects/${projectId}?error=extend-missing`)
  }

  const { error: insertError } = await supabase
    .from('project_cycles')
    .insert({
      project_id: projectId,
      cycle_id: nextCycle.id,
    })

  if (insertError) {
    redirect(`/admin/projects/${projectId}?error=extend-duplicate`)
  }

  const { error: projectUpdateError } = await supabase
    .from('projects')
    .update({
      end_date: nextCycle.end_date,
    })
    .eq('id', projectId)

  if (projectUpdateError) {
    redirect(`/admin/projects/${projectId}?error=extend-date`)
  }

  revalidatePath('/admin/projects')
  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/dashboard')
  revalidatePath('/available-days')
  redirect(`/admin/projects/${projectId}?success=extended`)
}

export async function addHistoricalUsedDate(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()
  const usedDay = String(formData.get('used_day') || '').trim()
  const adminNotes = String(formData.get('admin_notes') || '').trim()

  if (!projectId || !usedDay) {
    redirect(`/admin/projects/${projectId || ''}?error=used-date-missing`)
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    redirect(`/admin/projects/${projectId}?error=used-date-project`)
  }

  const note = adminNotes || 'Historical used date added by admin.'

  const { data: existingDay, error: existingDayError } = await supabase
    .from('instrument_days')
    .select('id')
    .eq('day', usedDay)
    .maybeSingle()

  if (existingDayError) {
    redirect(`/admin/projects/${projectId}?error=used-date-day`)
  }

  let instrumentDayId = existingDay?.id

  if (!instrumentDayId) {
    const { data: createdDay, error: createDayError } = await supabase
      .from('instrument_days')
      .insert({
        day: usedDay,
        status: 'available',
        notes: note,
      })
      .select('id')
      .single()

    if (createDayError || !createdDay) {
      redirect(`/admin/projects/${projectId}?error=used-date-day`)
    }

    instrumentDayId = createdDay.id
  } else {
    const { data: existingActiveBooking, error: activeBookingError } = await supabase
      .from('booking_requests')
      .select('id')
      .eq('instrument_day_id', instrumentDayId)
      .in('status', ['pending', 'booked'])
      .maybeSingle()

    if (activeBookingError) {
      redirect(`/admin/projects/${projectId}?error=used-date-booking`)
    }

    if (existingActiveBooking) {
      redirect(`/admin/projects/${projectId}?error=used-date-duplicate`)
    }
  }

  const { error: resetDayError } = await supabase
    .from('instrument_days')
    .update({
      status: 'available',
      notes: note,
    })
    .eq('id', instrumentDayId)
 
  if (resetDayError) {
    redirect(`/admin/projects/${projectId}?error=used-date-day`)
  }

  const { error: bookingError } = await supabase
    .from('booking_requests')
    .insert({
      instrument_day_id: instrumentDayId,
      project_id: projectId,
      requested_by_user_id: null,
      status: 'booked',
      admin_notes: note,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })

  if (bookingError) {
    console.error('Historical used date booking error:', bookingError)

    redirect(
      `/admin/projects/${projectId}?error=used-date-booking&details=${encodeURIComponent(
        bookingError.message
      )}`
    )
  }
  revalidatePath('/admin/projects')
  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/dashboard')
  revalidatePath('/available-days')

  redirect(`/admin/projects/${projectId}?success=used-date-added`)
}

export async function addProjectMembers(formData: FormData) {
  const { supabase } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()
  const memberEmailsRaw = String(formData.get('member_emails') || '').trim()

  if (!projectId || !memberEmailsRaw) {
    redirect(`/admin/projects/${projectId}?error=missing-members`)
  }

  const memberEmails = parseEmails(memberEmailsRaw)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', memberEmails)

  if (profilesError || !profiles) {
    redirect(`/admin/projects/${projectId}?error=members`)
  }

  if (profiles.length === 0) {
    redirect(`/admin/projects/${projectId}?error=no-matches`)
  }

  const rows = profiles.map((profile) => ({
    project_id: projectId,
    user_id: profile.id,
  }))

  const { error: insertError } = await supabase
    .from('project_members')
    .upsert(rows, { onConflict: 'project_id,user_id', ignoreDuplicates: true })

  if (insertError) {
    redirect(`/admin/projects/${projectId}?error=members`)
  }

  revalidatePath(`/admin/projects/${projectId}`)
  redirect(`/admin/projects/${projectId}?success=members-added`)
}

export async function removeProjectMember(formData: FormData) {
  const { supabase } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()
  const userId = String(formData.get('user_id') || '').trim()

  if (!projectId || !userId) {
    redirect(`/admin/projects/${projectId}?error=remove`)
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) {
    redirect(`/admin/projects/${projectId}?error=remove`)
  }

  revalidatePath(`/admin/projects/${projectId}`)
  redirect(`/admin/projects/${projectId}?success=member-removed`)
}

export async function addProjectAllocation(formData: FormData) {
  const { supabase } = await requireAdmin()

  const projectId = String(formData.get('project_id') || '').trim()
  const allocationType = String(formData.get('allocation_type') || '').trim()
  const days = Number(formData.get('days') || 0)
  const note = String(formData.get('note') || '').trim()

  if (!projectId || !allocationType || !days) {
    redirect(`/admin/projects/${projectId}?error=allocation-missing`)
  }

  if (!['extension', 'additional'].includes(allocationType)) {
    redirect(`/admin/projects/${projectId}?error=allocation-type`)
  }

  if (days <= 0) {
    redirect(`/admin/projects/${projectId}?error=allocation-days`)
  }

  const { error: allocationError } = await supabase
    .from('project_allocations')
    .insert({
      project_id: projectId,
      allocation_type: allocationType,
      days,
      note: note || null,
    })

  if (allocationError) {
    redirect(`/admin/projects/${projectId}?error=allocation-create`)
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('allocated_days')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    redirect(`/admin/projects/${projectId}?error=allocation-update`)
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      allocated_days: Number(project.allocated_days) + days,
    })
    .eq('id', projectId)

  if (updateError) {
    redirect(`/admin/projects/${projectId}?error=allocation-update`)
  }

  revalidatePath('/admin/projects')
  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath('/dashboard')
  revalidatePath('/available-days')

  redirect(`/admin/projects/${projectId}?success=allocation-added`)
}
