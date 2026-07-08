import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import {
  approveRequest,
  rejectRequest,
  cancelApprovedRequest,
  updateRequestParticipation,
} from './actions'
import EditRequestUsersButton from './edit-request-users-button'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

type RequestRow = {
  id: string
  status: string
  project_id: string
  requested_by_user_id: string
  created_at: string
  onsite_participant_ids: string[] | null
  remote_participant_ids: string[] | null
  projects: {
    id: string
    title: string
    proposal_number: string
    principal_investigator_id: string | null
  } | {
    id: string
    title: string
    proposal_number: string
    principal_investigator_id: string | null
  }[] | null
  profiles: {
    id: string
    email: string
    full_name: string | null
  } | {
    id: string
    email: string
    full_name: string | null
  }[] | null
  instrument_days: {
    day: string
    status: string
  } | {
    day: string
    status: string
  }[] | null
}

type ProjectMemberRow = {
  project_id: string
  user_id: string
  profiles: {
    id: string
    email: string
    full_name: string | null
  } | {
    id: string
    email: string
    full_name: string | null
  }[] | null
}

function getSingleParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getErrorMessage(errorCode: string | undefined) {
  if (errorCode === 'missing') return 'Missing required information.'
  if (errorCode === 'approve') return 'Unable to approve request.'
  if (errorCode === 'reject') return 'Unable to reject request.'
  if (errorCode === 'cancel') return 'Unable to cancel request.'
  return null
}

function getSuccessMessage(successCode: string | undefined) {
  if (successCode === 'approved') return 'Request approved.'
  if (successCode === 'rejected') return 'Request rejected.'
  if (successCode === 'cancelled') return 'Request cancelled.'
  return null
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(date)
}

function getProject(row: RequestRow) {
  return Array.isArray(row.projects) ? row.projects[0] : row.projects
}

function getProfile(row: RequestRow) {
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
}

function getInstrumentDay(row: RequestRow) {
  return Array.isArray(row.instrument_days) ? row.instrument_days[0] : row.instrument_days
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const errorMessage = getErrorMessage(getSingleParam(params.error))
  const successMessage = getSuccessMessage(getSingleParam(params.success))

  const supabase = await createClient()

  const { data, error: claimsError } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (claimsError || !claims) {
    redirect('/login')
  }

  const userId = claims.sub

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!adminRow) {
    redirect('/dashboard')
  }

  const { data: pendingRequests, error: pendingError } = await supabase
    .from('booking_requests')
    .select(`
      id,
      status,
      project_id,
      requested_by_user_id,
      onsite_participant_ids,
      remote_participant_ids,
      created_at,
      projects:project_id (
        id,
        title,
        proposal_number,
        principal_investigator_id
      ),
      profiles:requested_by_user_id (
        id,
        email,
        full_name
      ),
      instrument_days:instrument_day_id (
        day,
        status
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const today = new Date().toISOString().slice(0, 10)

  const { data: bookedRequests, error: bookedError } = await supabase
    .from('booking_requests')
    .select(`
      id,
      status,
      project_id,
      requested_by_user_id,
      onsite_participant_ids,
      remote_participant_ids,
      created_at,
      projects:project_id (
        id,
        title,
        proposal_number,
        principal_investigator_id
      ),
      profiles:requested_by_user_id (
        id,
        email,
        full_name
      ),
      instrument_days:instrument_day_id!inner (
        day,
        status
      )
    `)
    .eq('status', 'booked')
    .gte('instrument_days.day', today)

  if (pendingError || bookedError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading admin requests: {pendingError?.message || bookedError?.message}
        </p>
      </main>
    )
  }

  const pendingRows = ((((pendingRequests as unknown) as RequestRow[] | null) ?? [])).sort((a, b) => {
    const aDay = getInstrumentDay(a)?.day ?? ''
    const bDay = getInstrumentDay(b)?.day ?? ''
    return aDay.localeCompare(bDay)
  })

  const bookedRows = ((((bookedRequests as unknown) as RequestRow[] | null) ?? [])).sort((a, b) => {
    const aDay = getInstrumentDay(a)?.day ?? ''
    const bDay = getInstrumentDay(b)?.day ?? ''
    return aDay.localeCompare(bDay)
  })

  const displayedRows = [...pendingRows, ...bookedRows]

  const displayedProjectIds = Array.from(
    new Set(displayedRows.map((row) => row.project_id).filter(Boolean))
  )

  const { data: displayedProjectMembers, error: displayedProjectMembersError } =
    displayedProjectIds.length
      ? await supabase
          .from('project_members')
          .select(`
            project_id,
            user_id,
            profiles:user_id (
              id,
              email,
              full_name
            )
          `)
          .in('project_id', displayedProjectIds)
          .order('user_id', { ascending: true })
      : { data: [], error: null }

  if (displayedProjectMembersError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading project members: {displayedProjectMembersError.message}
        </p>
      </main>
    )
  }

  const projectMemberRows =
    (((displayedProjectMembers as unknown) as ProjectMemberRow[] | null) ?? [])

  const participantNameById = new Map<string, string>()

  for (const member of projectMemberRows) {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles

    if (profile) {
      participantNameById.set(profile.id, profile.full_name || profile.email)
    }
  }

  function formatParticipantList(ids: string[] | null | undefined) {
    if (!ids || ids.length === 0) return 'None'

    return ids
      .map((id) => participantNameById.get(id))
      .filter(Boolean)
      .join(', ') || 'None'
  }

  function getProjectMembers(projectId: string) {
    return projectMemberRows
      .filter((member) => member.project_id === projectId)
      .map((member) => {
        const profile = Array.isArray(member.profiles)
          ? member.profiles[0]
          : member.profiles

        return profile
      })
      .filter(
        (
          profile
        ): profile is {
          id: string
          email: string
          full_name: string | null
        } => Boolean(profile)
      )
  }

  function getProjectPiName(row: RequestRow) {
    const project = getProject(row)

    if (!project?.principal_investigator_id) {
      return 'Not Selected Yet'
    }

    const piMember = projectMemberRows.find(
      (member) =>
        member.project_id === row.project_id &&
        member.user_id === project.principal_investigator_id
    )

    const profile = piMember
      ? Array.isArray(piMember.profiles)
        ? piMember.profiles[0]
        : piMember.profiles
      : null

    return profile?.full_name || profile?.email || 'None listed'
  }

  return (
    <main className="p-6 space-y-6">
      <TopNav />

      <div>
        <h1 className="text-3xl font-bold">Admin Requests</h1>
        <p className="text-sm text-gray-600">
          Review and manage pending and approved day requests.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Pending Requests</h2>

        {pendingRows.length === 0 ? (
          <p className="text-sm text-gray-600">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingRows.map((row) => {
              const project = getProject(row)
              const instrumentDay = getInstrumentDay(row)
	      const projectMembers = getProjectMembers(row.project_id)
              const piName = getProjectPiName(row)
	      return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-4 text-gray-700">
                    <span className="shrink-0 font-semibold">
                      {formatShortDate(instrumentDay?.day ?? '')}
                    </span>

                    <span className="shrink-0">
                      ({project?.proposal_number})
                    </span>

		    <span className="min-w-0 truncate">
		      PI: {piName}
		    </span>

                    <span className="min-w-0 truncate">
                      On Site: {formatParticipantList(row.onsite_participant_ids)}
                    </span>

                    <span className="min-w-0 truncate">
                      Remote: {formatParticipantList(row.remote_participant_ids)}
                    </span>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <form action={approveRequest}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button
                        type="submit"
                        className="rounded border px-3 py-1 text-xs font-medium"
                      >
                        Approve
                      </button>
                    </form>

                    <form action={rejectRequest}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button
                        type="submit"
                        className="rounded border px-3 py-1 text-xs font-medium"
                      >
                        Reject
                      </button>
                    </form>

                    <EditRequestUsersButton
                      requestId={row.id}
                      projectMembers={projectMembers}
                      initialOnsiteParticipantIds={row.onsite_participant_ids ?? []}
                      initialRemoteParticipantIds={row.remote_participant_ids ?? []}
		      returnTo="/admin/requests"
                      action={updateRequestParticipation}
		    />

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Upcoming Approved Bookings</h2>

        {bookedRows.length === 0 ? (
          <p className="text-sm text-gray-600">No upcoming approved bookings.</p>
        ) : (
          <div className="space-y-2">
            {bookedRows.map((row) => {
              const project = getProject(row)
              const instrumentDay = getInstrumentDay(row)
	      const projectMembers = getProjectMembers(row.project_id)
	      const piName = getProjectPiName(row)
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >

                <div className="min-w-0 flex-1 flex items-center gap-4 text-gray-700">
                  <span className="shrink-0 font-semibold">
                    {formatShortDate(instrumentDay?.day ?? '')}
                  </span>

                  <span className="shrink-0">
                    ({project?.proposal_number})
                  </span>

		  <span className="min-w-0 truncate">
		    PI: {piName}
		  </span>

                  <span className="min-w-0 truncate">
                    On Site: {formatParticipantList(row.onsite_participant_ids)}
                  </span>

                  <span className="min-w-0 truncate">
                    Remote: {formatParticipantList(row.remote_participant_ids)}
                  </span>
		</div>

                  <div className="flex gap-2 shrink-0">
                    <form action={cancelApprovedRequest}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button
                        type="submit"
                        className="rounded border px-3 py-1 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </form>

                    <EditRequestUsersButton
                      requestId={row.id}
                      projectMembers={projectMembers}
                      initialOnsiteParticipantIds={row.onsite_participant_ids ?? []}
                      initialRemoteParticipantIds={row.remote_participant_ids ?? []}
		      returnTo="/admin/requests"
                      action={updateRequestParticipation}
		    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
