import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import {
  togglePasConfirmed,
  toggleAccessDatesConfirmed,
  updateRequestParticipation,
} from '../requests/actions'
import EditRequestUsersButton from '../requests/edit-request-users-button'

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
}

type ProjectRow = {
  id: string
  title: string
  proposal_number: string
  principal_investigator_id: string | null
}

type InstrumentDayRow = {
  id: string
  day: string
  status: string
}

type RequestRow = {
  id: string
  status: string
  project_id: string
  requested_by_user_id: string
  created_at: string
  onsite_participant_ids: string[] | null
  remote_participant_ids: string[] | null
  pas_confirmed: boolean
  access_dates_confirmed: boolean
  projects: ProjectRow | ProjectRow[] | null
  instrument_days: InstrumentDayRow | InstrumentDayRow[] | null
}

type ProjectMemberRow = {
  project_id: string
  user_id: string
  profiles: ProfileRow | ProfileRow[] | null
}

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getProject(row: RequestRow) {
  return getSingle(row.projects)
}

function getInstrumentDay(row: RequestRow) {
  return getSingle(row.instrument_days)
}

function formatShortDate(day: string) {
  if (!day) return 'Unknown date'

  const date = new Date(`${day}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(date)
}

function isUpcomingOrCurrent(row: RequestRow) {
  const instrumentDay = getInstrumentDay(row)

  if (!instrumentDay?.day) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const bookingDay = new Date(`${instrumentDay.day}T00:00:00`)
  bookingDay.setHours(0, 0, 0, 0)

  return bookingDay >= today
}

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

function getSingleParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function PasAccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const successCode = getSingleParam(params.success)

  const supabase = await createClient()

  const { data, error: claimsError } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (claimsError || !claims) {
    redirect('/login')
  }

  const userId = claims.sub

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (adminError || !adminRow) {
    redirect('/dashboard')
  }

  const { data: requests, error: requestsError } = await supabase
    .from('booking_requests')
    .select(`
      id,
      status,
      project_id,
      requested_by_user_id,
      created_at,
      onsite_participant_ids,
      remote_participant_ids,
      pas_confirmed,
      access_dates_confirmed,
      projects:project_id (
        id,
        title,
        proposal_number,
        principal_investigator_id
      ),
      instrument_days:instrument_day_id (
        id,
        day,
        status
      )
    `)
    .eq('status', 'booked')
    .order('created_at', { ascending: true })

  if (requestsError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading PAS/access bookings: {requestsError.message}
        </p>
      </main>
    )
  }

  const requestRows =
    (((requests as unknown) as RequestRow[] | null) ?? [])
      .filter(isUpcomingOrCurrent)
      .sort((a, b) => {
        const aDay = getInstrumentDay(a)?.day ?? ''
        const bDay = getInstrumentDay(b)?.day ?? ''
        return aDay.localeCompare(bDay)
      })

  const projectIds = Array.from(
    new Set(requestRows.map((row) => row.project_id).filter(Boolean))
  )

  const { data: projectMembers, error: projectMembersError } = projectIds.length
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
        .in('project_id', projectIds)
        .order('user_id', { ascending: true })
    : { data: [], error: null }

  if (projectMembersError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading project members: {projectMembersError.message}
        </p>
      </main>
    )
  }

  const projectMemberRows =
    (((projectMembers as unknown) as ProjectMemberRow[] | null) ?? [])

  const participantNameById = new Map<string, string>()

  for (const member of projectMemberRows) {
    const profile = getSingle(member.profiles)

    if (profile) {
      participantNameById.set(profile.id, profile.full_name || profile.email)
    }
  }

  function formatParticipantList(ids: string[] | null | undefined) {
    if (!ids || ids.length === 0) return 'None listed'

    return ids
      .map((id) => participantNameById.get(id))
      .filter(Boolean)
      .join(', ') || 'None listed'
  }

  function getProjectMembers(projectId: string) {
    return projectMemberRows
      .filter((member) => member.project_id === projectId)
      .map((member) => getSingle(member.profiles))
      .filter((profile): profile is ProfileRow => Boolean(profile))
  }

  function getProjectPiName(row: RequestRow) {
    const project = getProject(row)

    if (!project?.principal_investigator_id) {
      return 'None listed'
    }

    const piMember = projectMemberRows.find(
      (member) =>
        member.project_id === row.project_id &&
        member.user_id === project.principal_investigator_id
    )

    const profile = piMember ? getSingle(piMember.profiles) : null

    return profile?.full_name || profile?.email || 'None listed'
  }

  const pendingRows = requestRows.filter(
    (row) => !row.pas_confirmed || !row.access_dates_confirmed
  )

  const approvedRows = requestRows.filter(
    (row) => row.pas_confirmed && row.access_dates_confirmed
  )

  function renderRow(row: RequestRow) {
    const project = getProject(row)
    const instrumentDay = getInstrumentDay(row)
    const projectMembersForRow = getProjectMembers(row.project_id)
    const piName = getProjectPiName(row)

    return (
      <li
        key={row.id}
        className="rounded-lg border p-2"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 flex items-center gap-4 text-sm text-gray-700">
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
            <form action={togglePasConfirmed}>
              <input type="hidden" name="request_id" value={row.id} />
              <input
                type="hidden"
                name="current_value"
                value={String(row.pas_confirmed)}
              />
              <button
                type="submit"
                className={
                  row.pas_confirmed
                    ? 'rounded border border-green-600 bg-green-50 px-3 py-1 text-xs font-medium text-green-700'
                    : 'rounded border px-3 py-1 text-xs font-medium'
                }
              >
                {row.pas_confirmed ? 'PAS Confirmed' : 'Confirm PAS?'}
              </button>
            </form>

            <form action={toggleAccessDatesConfirmed}>
              <input type="hidden" name="request_id" value={row.id} />
              <input
                type="hidden"
                name="current_value"
                value={String(row.access_dates_confirmed)}
              />
              <button
                type="submit"
                className={
                  row.access_dates_confirmed
                    ? 'rounded border border-green-600 bg-green-50 px-3 py-1 text-xs font-medium text-green-700'
                    : 'rounded border px-3 py-1 text-xs font-medium'
                }
              >
                {row.access_dates_confirmed
                  ? 'Access Dates Confirmed'
                  : 'Confirm Access Dates?'}
              </button>
            </form>

            <EditRequestUsersButton
              requestId={row.id}
              projectMembers={projectMembersForRow}
              initialOnsiteParticipantIds={row.onsite_participant_ids ?? []}
              initialRemoteParticipantIds={row.remote_participant_ids ?? []}
 	      returnTo="/admin/pas-access"
              action={updateRequestParticipation}
            />
          </div>
        </div>
      </li>
    )
  }

  return (
    <main className="p-6 space-y-6">
      <TopNav />

      <div>
        <h1 className="text-3xl font-bold">PAS and Access</h1>
        <p className="text-sm text-gray-600">
          Track PAS completion and ORNL access-date confirmation for upcoming approved bookings.
        </p>
      </div>

      {successCode === 'confirmed' ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          PAS and Access Dates Have Now Been Confirmed
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pending PAS and Access Dates</h2>

        {pendingRows.length ? (
          <ul className="space-y-2">
            {pendingRows.map(renderRow)}
          </ul>
        ) : (
          <p className="text-gray-600">
            No upcoming bookings are waiting on PAS or access-date confirmation.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Upcoming Bookings with PAS and Access Dates approved
        </h2>

        {approvedRows.length ? (
          <ul className="space-y-3">
            {approvedRows.map(renderRow)}
          </ul>
        ) : (
          <p className="text-gray-600">
            No upcoming bookings have both PAS and access dates confirmed yet.
          </p>
        )}
      </section>
    </main>
  )
}
