import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import {
  approveRequest,
  rejectRequest,
  cancelApprovedRequest,
} from './actions'

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
  projects: {
    id: string
    title: string
    proposal_number: string
  } | {
    id: string
    title: string
    proposal_number: string
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

  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims()

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
      created_at,
      projects:project_id (
        id,
        title,
        proposal_number
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

  const { data: bookedRequests, error: bookedError } = await supabase
    .from('booking_requests')
    .select(`
      id,
      status,
      project_id,
      requested_by_user_id,
      created_at,
      projects:project_id (
        id,
        title,
        proposal_number
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
    .eq('status', 'booked')

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

  const pendingRows = ((pendingRequests as RequestRow[] | null) ?? []).sort((a, b) => {
    const aDay = getInstrumentDay(a)?.day ?? ''
    const bDay = getInstrumentDay(b)?.day ?? ''
    return aDay.localeCompare(bDay)
  })

  const bookedRows = ((bookedRequests as RequestRow[] | null) ?? []).sort((a, b) => {
    const aDay = getInstrumentDay(a)?.day ?? ''
    const bDay = getInstrumentDay(b)?.day ?? ''
    return aDay.localeCompare(bDay)
  })

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
              const requester = getProfile(row)
              const project = getProject(row)
              const instrumentDay = getInstrumentDay(row)

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-8 text-gray-700">
                    <span className="font-semibold">
                      {formatShortDate(instrumentDay?.day ?? '')}
                    </span>

                    <span>
                      Proposal: {project?.proposal_number}
                    </span>
      
                    <span>
                      User: {requester?.full_name || requester?.email || 'Unknown User'}
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Approved Requests</h2>

        {bookedRows.length === 0 ? (
          <p className="text-sm text-gray-600">No approved requests.</p>
        ) : (
          <div className="space-y-2">
            {bookedRows.map((row) => {
              const requester = getProfile(row)
              const project = getProject(row)
              const instrumentDay = getInstrumentDay(row)

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >

		<div className="min-w-0 flex-1 flex items-center gap-8 text-gray-700">
		  <span className="font-semibold">
		    {formatShortDate(instrumentDay?.day ?? '')}
		  </span>

		  <span>
		    Proposal: {project?.proposal_number}
		  </span>

		  <span>
		    User: {requester?.full_name || requester?.email || 'Unknown User'}
		  </span>
		</div>

                  <div className="shrink-0">
                    <form action={cancelApprovedRequest}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button
                        type="submit"
                        className="rounded border px-3 py-1 text-xs font-medium"
                      >
                        Cancel Booking
                      </button>
                    </form>
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
