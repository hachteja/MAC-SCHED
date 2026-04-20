import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import YearCalendar from './year-calendar'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

type InstrumentDayRow = {
  id: string
  day: string
  status: string
  notes: string | null
  created_at: string
}

type CalendarDayStatusRow = {
  instrument_day_id: string | null
  day: string
  day_status: string | null
  request_status: string | null
  project_id: string | null
  requested_by_user_id: string | null
}

export default async function AdminAvailableDaysPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const yearParam = getSingleParam(params.year)
  const year = Number(yearParam) || new Date().getFullYear()

  const start = `${year}-01-01`
  const end = `${year}-12-31`

  const supabase = await createClient()

  const {
    data: { claims },
    error: claimsError,
  } = await supabase.auth.getClaims()

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

  const { data: instrumentDays, error: instrumentDaysError } = await supabase
    .from('instrument_days')
    .select('id, day, status, notes, created_at')
    .gte('day', start)
    .lte('day', end)
    .order('day', { ascending: true })

  if (instrumentDaysError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading instrument days: {instrumentDaysError.message}
        </p>
      </main>
    )
  }

  const { data: calendarStatuses, error: calendarStatusesError } = await supabase
    .from('calendar_day_status')
    .select(
      'instrument_day_id, day, day_status, request_status, project_id, requested_by_user_id'
    )
    .gte('day', start)
    .lte('day', end)
    .order('day', { ascending: true })

  if (calendarStatusesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading calendar status: {calendarStatusesError.message}
        </p>
      </main>
    )
  }

  return (
    <main className="p-6 space-y-6">
      <TopNav />

      <div>
        <h1 className="text-3xl font-bold">Admin Available Days</h1>
        <p className="text-sm text-gray-600">
          Click unassigned days to add availability. Click green days to remove availability.
        </p>
      </div>

      <YearCalendar
        year={year}
        instrumentDays={Array.isArray(instrumentDays) ? instrumentDays : []}
        calendarStatuses={Array.isArray(calendarStatuses) ? calendarStatuses : []}
      />
    </main>
  )
}
