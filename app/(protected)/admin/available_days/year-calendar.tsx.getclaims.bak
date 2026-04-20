'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addAvailableDay, removeAvailableDay } from './actions'

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

type DisplayStatus =
  | 'unassigned'
  | 'available'
  | 'pending'
  | 'booked'
  | 'completed'

type Props = {
  year: number
  instrumentDays?: InstrumentDayRow[]
  calendarStatuses?: CalendarDayStatusRow[]
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatDateOnly(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

function isPast(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const today = new Date()
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const candidate = new Date(y, m - 1, d)
  return candidate < todayOnly
}

function getDisplayStatus(args: {
  date: string
  instrumentDay: InstrumentDayRow | undefined
  calendarStatus: CalendarDayStatusRow | undefined
}): DisplayStatus {
  const { date, instrumentDay, calendarStatus } = args

  if (isPast(date)) {
    return 'completed'
  }

  const dayStatus = calendarStatus?.day_status
  const requestStatus = calendarStatus?.request_status

  if (requestStatus === 'booked' || dayStatus === 'booked') {
    return 'booked'
  }

  if (requestStatus === 'pending' || dayStatus === 'pending') {
    return 'pending'
  }

  if (instrumentDay?.status === 'available' || dayStatus === 'available') {
    return 'available'
  }

  return 'unassigned'
}

function getColorClasses(
  type: 'available' | 'pending' | 'booked' | 'other' | 'completed'
) {
  switch (type) {
    case 'available':
      return 'bg-green-50 border-green-200'
    case 'pending':
      return 'bg-yellow-50 border-yellow-200'
    case 'booked':
      return 'bg-blue-50 border-blue-200'
    case 'other':
    case 'completed':
      return 'bg-gray-100 border-gray-300'
    default:
      return 'bg-white'
  }
}

function getDayButtonClasses(status: DisplayStatus, clickable: boolean) {
  const base =
    'h-9 w-full rounded-md border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1'
  const hover = clickable
    ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02]'
    : 'cursor-not-allowed'

  if (status === 'available') {
    return `${base} ${hover} ${getColorClasses('available')} text-gray-900`
  }

  if (status === 'pending') {
    return `${base} ${hover} ${getColorClasses('pending')} text-gray-900`
  }

  if (status === 'booked') {
    return `${base} ${hover} ${getColorClasses('booked')} text-gray-900`
  }

  if (status === 'completed') {
    return `${base} ${hover} ${getColorClasses('completed')} text-gray-700`
  }

  return `${base} ${hover} bg-white border-gray-200 text-gray-900`
}

function Legend({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`inline-block h-4 w-4 rounded border ${className}`} />
      <span>{label}</span>
    </div>
  )
}

export default function YearCalendar({
  year,
  instrumentDays = [],
  calendarStatuses = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const instrumentDayMap = useMemo(() => {
    const map = new Map<string, InstrumentDayRow>()
    for (const row of Array.isArray(instrumentDays) ? instrumentDays : []) {
      map.set(row.day, row)
    }
    return map
  }, [instrumentDays])

  const calendarStatusMap = useMemo(() => {
    const map = new Map<string, CalendarDayStatusRow>()
    for (const row of Array.isArray(calendarStatuses) ? calendarStatuses : []) {
      map.set(row.day, row)
    }
    return map
  }, [calendarStatuses])

  function goToYear(nextYear: number) {
    router.push(`/admin/available_days?year=${nextYear}`)
  }

  function handleDayClick(args: {
    date: string
    displayStatus: DisplayStatus
    instrumentDayId?: string
  }) {
    const { date, displayStatus, instrumentDayId } = args

    if (
      displayStatus === 'pending' ||
      displayStatus === 'booked' ||
      displayStatus === 'completed'
    ) {
      return
    }

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('day', date)

        if (displayStatus === 'available') {
          if (instrumentDayId) {
            formData.set('instrument_day_id', instrumentDayId)
          }
          await removeAvailableDay(formData)
        } else {
          await addAvailableDay(formData)
        }

        router.refresh()
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Something went wrong.'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goToYear(year - 1)}
          className="rounded-md border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Previous year
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-semibold">{year}</h2>
          <p className="text-sm text-gray-600">Instrument availability planner</p>
        </div>

        <button
          type="button"
          onClick={() => goToYear(year + 1)}
          className="rounded-md border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Next year
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Legend label="Unassigned" className="bg-white border-gray-200" />
        <Legend label="Available" className="bg-green-50 border-green-200" />
        <Legend label="Pending" className="bg-yellow-50 border-yellow-200" />
        <Legend label="Booked" className="bg-blue-50 border-blue-200" />
        <Legend label="Past / Completed" className="bg-gray-100 border-gray-300" />
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MONTH_NAMES.map((monthName, index) => {
          const month = index + 1
          const daysInMonth = getDaysInMonth(year, month)
          const firstWeekday = getFirstWeekday(year, month)

          const cells: React.ReactNode[] = []

          for (let i = 0; i < firstWeekday; i++) {
            cells.push(<div key={`empty-${month}-${i}`} />)
          }

          for (let day = 1; day <= daysInMonth; day++) {
            const date = formatDateOnly(year, month, day)
            const instrumentDay = instrumentDayMap.get(date)
            const calendarStatus = calendarStatusMap.get(date)
            const displayStatus = getDisplayStatus({
              date,
              instrumentDay,
              calendarStatus,
            })

            const clickable =
              !isPending &&
              displayStatus !== 'pending' &&
              displayStatus !== 'booked' &&
              displayStatus !== 'completed'

            cells.push(
              <button
                key={date}
                type="button"
                disabled={!clickable}
                title={`${date} - ${displayStatus}`}
                onClick={() =>
                  handleDayClick({
                    date,
                    displayStatus,
                    instrumentDayId: instrumentDay?.id,
                  })
                }
                className={getDayButtonClasses(displayStatus, clickable)}
              >
                {day}
              </button>
            )
          }

          return (
            <div key={month} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h3 className="font-semibold">{monthName}</h3>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div key={`${month}-${label}-${i}`}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">{cells}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
