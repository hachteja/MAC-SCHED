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
  const startDate = String(formData.get('start_date') || '').trim()
  const endDate = String(formData.get('end_date') || '').trim()
  const memberEmailsRaw = String(formData.get('member_emails') || '').trim()

  if (!title || !proposalNumber || !startDate || !endDate || !allocatedDays) {
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
