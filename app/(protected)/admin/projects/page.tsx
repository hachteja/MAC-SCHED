import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import { addHistoricalUsedDate } from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

type ProjectRow = {
  id: string
  title: string
  proposal_number: string
  allocated_days: number
  start_date: string
  end_date: string
  status: string
  principal_investigator_id: string | null
}

type CalendarDayStatusRow = {
  day: string
  project_id: string | null
}

type ProjectCycleRow = {
  project_id: string
  cycle_id: string
}

type ProposalCycleRow = {
  id: string
  code: string
  year: number
  half: 'A' | 'B'
  start_date: string
  end_date: string
}

type InstrumentDayRow = {
  day: string
}

type ProjectMemberProfile = {
  full_name: string | null
  email: string | null
}

type ProjectMemberRow = {
  project_id: string
  user_id: string
  profiles: ProjectMemberProfile | ProjectMemberProfile[] | null
}

type ProjectMember = {
  project_id: string
  user_id: string
  isPi: boolean
  name: string
  email: string | null
}

type ProjectWithUsage = ProjectRow & {
  usedDays: number
  remainingDays: number
  isExtended: boolean
  members: ProjectMember[]
}

type CycleCard = ProposalCycleRow & {
  role: 'extended' | 'active'
  bookedDays: number
  availableDays: number
  remainingDaysForFinalCycleProjects: number
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getSuccessMessage(code: string | undefined) {
  if (code === 'created') return 'Project created.'
  if (code === 'used-date-added') return 'Historical used date added.'
  return null
}

function getErrorMessage(code: string | undefined) {
  if (code === 'used-date-missing') return 'Choose a project and date.'
  if (code === 'used-date-project') return 'Project not found.'
  if (code === 'used-date-day') return 'Could not create or update that instrument day.'
  if (code === 'used-date-booking') return 'Could not create the booking record.'
  if (code === 'used-date-duplicate') return 'That date is already pending or booked.'
  return null
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const successMessage = getSuccessMessage(getSingleParam(params.success))
  const errorMessage = getErrorMessage(getSingleParam(params.error))

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


  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, title, proposal_number, allocated_days, start_date, end_date, status, principal_investigator_id')
    .order('proposal_number', { ascending: true })

  if (projectsError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">Error loading projects: {projectsError.message}</p>
      </main>
    )
  }

  const { data: projectMembers, error: projectMembersError } = await supabase
    .from('project_members')
    .select('project_id, user_id, profiles(full_name, email)')

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

  const { data: calendarStatuses, error: calendarStatusesError } = await supabase
    .from('calendar_day_status')
    .select('day, project_id')
    .not('project_id', 'is', null)

  if (calendarStatusesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading project day usage: {calendarStatusesError.message}
        </p>
      </main>
    )
  }

  const { data: projectCycles, error: projectCyclesError } = await supabase
    .from('project_cycles')
    .select('project_id, cycle_id')

  if (projectCyclesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading project cycle data: {projectCyclesError.message}
        </p>
      </main>
    )
  }

  const { data: proposalCycles, error: proposalCyclesError } = await supabase
    .from('proposal_cycles')
    .select('id, code, year, half, start_date, end_date')
    .order('year', { ascending: true })
    .order('half', { ascending: true })

  if (proposalCyclesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading proposal cycles: {proposalCyclesError.message}
        </p>
      </main>
    )
  }

  const { data: instrumentDays, error: instrumentDaysError } = await supabase
    .from('instrument_days')
    .select('day')
    .order('day', { ascending: true })

  if (instrumentDaysError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">
          Error loading available days: {instrumentDaysError.message}
        </p>
      </main>
    )
  }

  const projectRows = (((projects as unknown) as ProjectRow[] | null) ?? [])
    .filter((project) => project.status !== 'retired')
  const projectMemberRows = (((projectMembers as unknown) as ProjectMemberRow[] | null) ?? [])
  const statusRows = (((calendarStatuses as unknown) as CalendarDayStatusRow[] | null) ?? [])
  const cycleRows = (((projectCycles as unknown) as ProjectCycleRow[] | null) ?? [])
  const proposalCycleRows = (((proposalCycles as unknown) as ProposalCycleRow[] | null) ?? [])
  const instrumentDayRows = (((instrumentDays as unknown) as InstrumentDayRow[] | null) ?? [])

  const usedDaysByProject = new Map<string, number>()
  for (const row of statusRows) {
    if (!row.project_id) continue
    usedDaysByProject.set(
      row.project_id,
      (usedDaysByProject.get(row.project_id) ?? 0) + 1
    )
  }

  const cycleCountByProject = new Map<string, number>()
  const cycleIdsByProject = new Map<string, Set<string>>()
  const projectIdsByCycle = new Map<string, Set<string>>()

  for (const row of cycleRows) {
    cycleCountByProject.set(
      row.project_id,
      (cycleCountByProject.get(row.project_id) ?? 0) + 1
    )

    const cycleSetForProject = cycleIdsByProject.get(row.project_id) ?? new Set<string>()
    cycleSetForProject.add(row.cycle_id)
    cycleIdsByProject.set(row.project_id, cycleSetForProject)

    const projectSetForCycle = projectIdsByCycle.get(row.cycle_id) ?? new Set<string>()
    projectSetForCycle.add(row.project_id)
    projectIdsByCycle.set(row.cycle_id, projectSetForCycle)
  }

  const membersByProject = new Map<string, ProjectMember[]>()

  for (const row of projectMemberRows) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const name = getMemberDisplayName(profile, row.user_id)

    const member: ProjectMember = {
      project_id: row.project_id,
      user_id: row.user_id,
      isPi: false,
      name,
      email: profile?.email ?? null,
    }

    const members = membersByProject.get(row.project_id) ?? []
    members.push(member)
    membersByProject.set(row.project_id, members)
  }

  const projectsWithUsage: ProjectWithUsage[] = projectRows.map((project) => {
    const usedDays = usedDaysByProject.get(project.id) ?? 0
    const remainingDays = Math.max(project.allocated_days - usedDays, 0)
    const cycleCount = cycleCountByProject.get(project.id) ?? 0
    const isExtended = cycleCount > 1
    const members = (membersByProject.get(project.id) ?? []).map((member) => ({
      ...member,
      isPi: member.user_id === project.principal_investigator_id,
    }))

    return {
      ...project,
      usedDays,
      remainingDays,
      isExtended,
      members: sortProjectMembers(members),
    }
  })

  const activeProjects = projectsWithUsage.filter((project) => project.status === 'active')
  const inactiveProjects = projectsWithUsage.filter((project) => project.status === 'inactive')
  const searchQuery = (getSingleParam(params.q) ?? '').trim()
  const filteredActiveProjects = filterProjectsBySearch(activeProjects, searchQuery)
  const filteredInactiveProjects = filterProjectsBySearch(inactiveProjects, searchQuery)
  const cycleByCode = new Map(proposalCycleRows.map((cycle) => [cycle.code, cycle]))

  const today = getTodayDateString()

  const activeProposalCycles = proposalCycleRows
    .filter((cycle) => isDateInRange(today, cycle.start_date, cycle.end_date))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const activeCycleCodes = activeProposalCycles.map((cycle) => cycle.code)
  const activeCycleCodeSet = new Set(activeCycleCodes)

  const activeProjectsInDateWindow = activeProjects.filter((project) =>
    isDateInRange(today, project.start_date, project.end_date)
  )

  const remainingDaysByOriginalCycle = new Map<string, number>()
  for (const project of activeProjectsInDateWindow) {
    const originalCycleCode = getCycleCodeFromProposalNumber(project.proposal_number)
    if (!originalCycleCode) continue

    remainingDaysByOriginalCycle.set(
      originalCycleCode,
      (remainingDaysByOriginalCycle.get(originalCycleCode) ?? 0) + project.remainingDays
    )
  }

  const extendedCycleCodes = Array.from(remainingDaysByOriginalCycle.keys())
    .filter((code) => !activeCycleCodeSet.has(code))
    .filter((code) => (remainingDaysByOriginalCycle.get(code) ?? 0) > 0)
    .sort(compareCycleCodes)

  const summaryCycleCodes = Array.from(
    new Set([...extendedCycleCodes, ...activeCycleCodes])
  ).sort(compareCycleCodes)

  const usedDaySet = new Set(statusRows.map((row) => row.day))

  const remainingAvailableDaysInCurrentCycles = instrumentDayRows.filter((instrumentDay) => {
    const isInCurrentCycle = activeProposalCycles.some((cycle) =>
      isDateInRange(instrumentDay.day, cycle.start_date, cycle.end_date)
    )

    return isInCurrentCycle && !usedDaySet.has(instrumentDay.day)
  }).length

  const remainingAllocatedDaysInCurrentCycle = activeProjectsInDateWindow.reduce(
    (sum, project) => sum + project.remainingDays,
    0
  )

  const visibleCycles: CycleCard[] = summaryCycleCodes
    .map((code) => {
      const cycle = cycleByCode.get(code)
      if (!cycle) return null

      const availableDays = instrumentDayRows.filter((day) =>
        isDateInRange(day.day, cycle.start_date, cycle.end_date)
      ).length

      const bookedDays = statusRows.filter((row) =>
        isDateInRange(row.day, cycle.start_date, cycle.end_date)
      ).length

      return {
        ...cycle,
        role: activeCycleCodeSet.has(code) ? 'active' as const : 'extended' as const,
        bookedDays,
        availableDays,
        remainingDaysForFinalCycleProjects: remainingDaysByOriginalCycle.get(code) ?? 0,
      }
    })
    .filter(Boolean) as CycleCard[]

  const summaryCycleLabel = summaryCycleCodes.length > 0
    ? summaryCycleCodes
        .map((code) => activeCycleCodeSet.has(code) ? code : `${code} (Ext)`)
        .join(', ')
    : 'None'

  const perCycleRemainingLabel = summaryCycleCodes.length > 0
    ? summaryCycleCodes
        .map((code) => `Remaining for ${code}: ${remainingDaysByOriginalCycle.get(code) ?? 0}`)
        .join(' | ')
    : 'No cycle remaining-day totals available.'

  const totalAvailableDaysAcrossCycles = visibleCycles.reduce(
    (sum, cycle) => sum + cycle.availableDays,
    0
  )

  const totalAllocatedDaysAcrossCycles = activeProjectsInDateWindow.reduce(
    (sum, project) => sum + project.allocated_days,
    0
  )

  return (
    <main className="p-6 space-y-6">
      <TopNav />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Projects</h1>
          <p className="text-sm text-gray-600">
            Create and manage projects, dates, allocations, and members.
          </p>
        </div>

        <Link
          href="/admin/projects/new"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          New Project
        </Link>
      </div>

      {successMessage ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white px-5 py-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="text-base font-bold text-black">Current Cycles</div>
            <div className="mt-1 text-base font-normal text-black">{summaryCycleLabel}</div>
          </div>

          <div>
            <div className="text-base font-bold text-black">
              Remaining Available Days in Current Cycles
            </div>
            <div className="mt-1 text-base font-normal text-black">
              {remainingAvailableDaysInCurrentCycles}
            </div>
          </div>

          <div>
            <div className="text-base font-bold text-black">
              Remaining Allocated Days in Current Cycle
            </div>
            <div className="mt-1 text-base font-normal text-black">
              {remainingAllocatedDaysInCurrentCycle}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 text-sm text-gray-600">
          <div>{perCycleRemainingLabel}</div>
          <div className="mt-1">
            Total Available Days Across Cycles: {totalAvailableDaysAcrossCycles} | Total Allocated
            Days Across Cycles: {totalAllocatedDaysAcrossCycles}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="text-xl font-semibold">Active Proposals</h2>

          <form action="/admin/projects" className="flex w-full gap-2 md:w-auto">
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search title, proposal, PI, or member"
              className="w-full rounded-md border px-3 py-2 text-sm md:w-80"
            />
            <button
              type="submit"
              className="rounded-md border px-4 py-2 text-sm font-medium"
            >
              Search
            </button>
            {searchQuery ? (
              <Link
                href="/admin/projects"
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {activeProjects.length === 0 ? (
          <p className="text-sm text-gray-600">No active proposals found.</p>
        ) : filteredActiveProjects.length === 0 ? (
          <p className="text-sm text-gray-600">No active proposals match that search.</p>
        ) : (
          <div className="space-y-2">
            {filteredActiveProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-xl font-semibold">Inactive Proposals</h2>

        {inactiveProjects.length === 0 ? (
          <p className="text-sm text-gray-600">No deactivated proposals found.</p>
        ) : filteredInactiveProjects.length === 0 ? (
          <p className="text-sm text-gray-600">No deactivated proposals match that search.</p>
        ) : (
          <div className="space-y-2">
            {filteredInactiveProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function CycleCardView({ cycle }: { cycle: CycleCard }) {
  const label = cycle.role === 'extended' ? '(Extended)' : '(Current)'

  const cardClassName =
    cycle.role === 'active'
      ? 'rounded border px-4 py-3'
      : 'rounded border bg-gray-100 px-4 py-3'

  return (
    <div className={cardClassName}>
      <div className="font-semibold">
        {cycle.code} {label}
      </div>
      <div className="mt-2 space-y-1 text-sm text-gray-700">
        <div>
          Booked: {cycle.bookedDays} - Available/Booked Total: {cycle.availableDays}
        </div>
        <div>
          Remaining Days for Original Cycle Projects: {cycle.remainingDaysForFinalCycleProjects}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectWithUsage }) {
  return (
    <div className="rounded border px-4 py-3 hover:bg-gray-50">
      <Link href={`/admin/projects/${project.id}`} className="block">
        <div className="space-y-1 text-sm text-gray-700">
          <div className="font-semibold">{project.proposal_number}</div>
          <div className="text-base font-medium text-gray-900">{project.title}</div>
          <ProjectMemberList members={project.members} />
          <div>Remaining Days: {project.remainingDays}/{project.allocated_days}</div>
          <div>
            {formatShortDate(project.start_date)} - {formatShortDate(project.end_date)}
            {project.isExtended ? ' (Extended)' : ''}
          </div>
        </div>
      </Link>
    </div>
  )
}

function ProjectMemberList({ members }: { members: ProjectMember[] }) {
  if (members.length === 0) {
    return <div className="text-sm text-gray-500">Members: None</div>
  }

  return (
    <div className="text-sm text-gray-700">
      Members:{' '}
      {members.map((member, index) => (
        <span key={member.user_id}>
          {index > 0 ? ', ' : ''}
          <span className={member.isPi ? 'font-bold text-gray-900' : undefined}>
            {member.name}{member.isPi ? ' (PI)' : ''}
          </span>
        </span>
      ))}
    </div>
  )
}


function filterProjectsBySearch(projects: ProjectWithUsage[], searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase()

  if (!normalizedQuery) return projects

  return projects.filter((project) => {
    const searchableText = [
      project.title,
      project.proposal_number,
      ...project.members.flatMap((member) => [member.name, member.email ?? '']),
    ]
      .join(' ')
      .toLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}

function getMemberDisplayName(profile: ProjectMemberProfile | null | undefined, fallbackUserId: string) {
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  const email = profile?.email?.trim()
  if (email) return email

  return fallbackUserId
}

function sortProjectMembers(members: ProjectMember[]) {
  return [...members].sort((a, b) => {
    if (a.isPi !== b.isPi) return a.isPi ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function formatShortDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(date)
}

function isDateInRange(dateStr: string, startStr: string, endStr: string) {
  const date = new Date(`${dateStr}T00:00:00`).getTime()
  const start = new Date(`${startStr}T00:00:00`).getTime()
  const end = new Date(`${endStr}T00:00:00`).getTime()

  return date >= start && date <= end
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function getCycleCodeFromProposalNumber(proposalNumber: string) {
  const match = proposalNumber.match(/CNMS(\d{4})-([AB])-/i)
  if (!match) return null

  return `${match[1]}${match[2].toUpperCase()}`
}

function compareCycleCodes(a: string, b: string) {
  const parsedA = parseCycleCode(a)
  const parsedB = parseCycleCode(b)

  if (!parsedA && !parsedB) return a.localeCompare(b)
  if (!parsedA) return 1
  if (!parsedB) return -1

  if (parsedA.year !== parsedB.year) {
    return parsedA.year - parsedB.year
  }

  return parsedA.half.localeCompare(parsedB.half)
}

function parseCycleCode(code: string) {
  const match = code.match(/^(\d{4})([AB])$/)
  if (!match) return null

  return {
    year: Number(match[1]),
    half: match[2],
  }
}

