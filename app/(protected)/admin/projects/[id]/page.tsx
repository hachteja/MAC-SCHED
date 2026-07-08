import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/app/components/top-nav'
import {
  addHistoricalUsedDate,
  addProjectAllocation,
  addProjectMembers,
  extendProjectCycle,
  removeProjectMember,
  updateProject,
} from '../actions'
import AddMemberForm from './AddMemberForm'

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

type MemberRow = {
  user_id: string
  profiles:
    | {
        id: string
        email: string
        full_name: string | null
      }
    | {
        id: string
        email: string
        full_name: string | null
      }[]
    | null
}

type ProjectCycleRow = {
  cycle_id: string
  proposal_cycles:
    | {
        id: string
        code: string
        year: number
        half: 'A' | 'B'
        start_date: string
        end_date: string
      }
    | {
        id: string
        code: string
        year: number
        half: 'A' | 'B'
        start_date: string
        end_date: string
      }[]
    | null
}

type AllocationRow = {
  id: string
  allocation_type: 'original' | 'extension' | 'additional'
  days: number
  note: string | null
  created_at: string
}

type UsedDateRow = {
  day: string
  request_status: string | null
}

type HistoryItem =
  | {
      id: string
      kind: 'allocation'
      label: string
      date: string
      note: string | null
    }
  | {
      id: string
      kind: 'used'
      label: string
      date: string
      note: null
    }

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getErrorMessage(code: string | undefined) {
  if (code === 'missing') return 'Please fill in all required fields.'
  if (code === 'dates') return 'End date must be on or after start date.'
  if (code === 'update') return 'Unable to update project.'
  if (code === 'members') return 'Unable to add members.'
  if (code === 'no-matches') return 'No matching existing users were found for those emails.'
  if (code === 'missing-members') return 'Please provide at least one email.'
  if (code === 'remove') return 'Unable to remove member.'
  if (code === 'pi') return 'Unable to update project PI.'
  if (code === 'extend') return 'Unable to extend this project into the next cycle.'
  if (code === 'extend-missing') return 'The next matching cycle does not exist yet.'
  if (code === 'extend-duplicate') return 'This project is already linked to the next matching cycle.'
  if (code === 'extend-limit') return 'Projects can only be extended once.'
  if (code === 'extend-date') return 'Project was extended, but the end date could not be updated.'

  if (code === 'allocation-missing') return 'Please fill in all allocation fields.'
  if (code === 'allocation-type') return 'Invalid allocation type.'
  if (code === 'allocation-days') return 'Days added must be greater than zero.'
  if (code === 'allocation-create') return 'Unable to add allocation record.'
  if (code === 'allocation-update') return 'Unable to update project allocation total.'

  if (code === 'used-date-missing') return 'Choose a used date.'
  if (code === 'used-date-project') return 'Project not found.'
  if (code === 'used-date-day') return 'Could not create or update that instrument day.'
  if (code === 'used-date-booking') return 'Could not create the booking record.'
  if (code === 'used-date-duplicate') return 'That date is already pending or booked.'

  return null
}

function getSuccessMessage(code: string | undefined) {
  if (code === 'updated') return 'Project updated.'
  if (code === 'members-added') return 'Members added.'
  if (code === 'member-removed') return 'Member removed.'
  if (code === 'pi-updated') return 'Project PI updated.'
  if (code === 'extended') return 'Project extended into the next cycle.'
  if (code === 'allocation-added') return 'Allocated days added.'
  if (code === 'used-date-added') return 'Historical used date added.'
  return null
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const { id } = await params
  const qp = await searchParams

  const errorMessage = getErrorMessage(getSingleParam(qp.error))
  const errorDetails = getSingleParam(qp.details)
  const successMessage = getSuccessMessage(getSingleParam(qp.success))

  const supabase = await createClient()

  async function updateProjectPi(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const projectId = String(formData.get('project_id') ?? '')
    const userIdRaw = String(formData.get('principal_investigator_id') ?? '')
    const principalInvestigatorId = userIdRaw.length > 0 ? userIdRaw : null

    if (!projectId) {
      redirect(`/admin/projects/${id}?error=pi`)
    }

    const { error } = await supabase
      .from('projects')
      .update({ principal_investigator_id: principalInvestigatorId })
      .eq('id', projectId)

    if (error) {
      redirect(`/admin/projects/${projectId}?error=pi&details=${encodeURIComponent(error.message)}`)
    }

    redirect(`/admin/projects/${projectId}?success=pi-updated`)
  }

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

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, proposal_number, allocated_days, start_date, end_date, status, principal_investigator_id')
    .eq('id', id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  const { data: allocations, error: allocationsError } = await supabase
    .from('project_allocations')
    .select('id, allocation_type, days, note, created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  if (allocationsError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">Error loading allocations: {allocationsError.message}</p>
      </main>
    )
  }

  const { data: usedDates, error: usedDatesError } = await supabase
    .from('calendar_day_status')
    .select('day, request_status')
    .eq('project_id', id)
    .order('day', { ascending: true })

  if (usedDatesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">Error loading used dates: {usedDatesError.message}</p>
      </main>
    )
  }

  const { data: projectCycles, error: projectCyclesError } = await supabase
    .from('project_cycles')
    .select(`
      cycle_id,
      proposal_cycles:cycle_id (
        id,
        code,
        year,
        half,
        start_date,
        end_date
      )
    `)
    .eq('project_id', id)

  if (projectCyclesError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">Error loading cycles: {projectCyclesError.message}</p>
      </main>
    )
  }

  const { data: members, error: membersError } = await supabase
    .from('project_members')
    .select(`
      user_id,
      profiles:user_id (
        id,
        email,
        full_name
      )
    `)
    .eq('project_id', id)

  if (membersError) {
    return (
      <main className="p-6 space-y-6">
        <TopNav />
        <p className="text-red-600">Error loading members: {membersError.message}</p>
      </main>
    )
  }

  const projectRow = project as ProjectRow
  const memberRows = (((members as unknown) as MemberRow[] | null) ?? [])
  const rawCycleRows = (((projectCycles as unknown) as ProjectCycleRow[] | null) ?? [])
  const allocationRows = (((allocations as unknown) as AllocationRow[] | null) ?? [])
  const usedDateRows = (((usedDates as unknown) as UsedDateRow[] | null) ?? [])

  const memberDisplayRows = [...memberRows].sort((a, b) => {
    if (a.user_id === projectRow.principal_investigator_id) return -1
    if (b.user_id === projectRow.principal_investigator_id) return 1

    const aProfile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    const bProfile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
    const aName = aProfile?.full_name || aProfile?.email || a.user_id
    const bName = bProfile?.full_name || bProfile?.email || b.user_id

    return aName.localeCompare(bName)
  })

  const principalInvestigatorMember = memberRows.find(
    (member) => member.user_id === projectRow.principal_investigator_id
  )
  const principalInvestigatorProfile = principalInvestigatorMember
    ? Array.isArray(principalInvestigatorMember.profiles)
      ? principalInvestigatorMember.profiles[0]
      : principalInvestigatorMember.profiles
    : null
  const principalInvestigatorName =
    principalInvestigatorProfile?.full_name ||
    principalInvestigatorProfile?.email ||
    'No PI assigned'

  const originalDays = allocationRows
    .filter((allocation) => allocation.allocation_type === 'original')
    .reduce((sum, allocation) => sum + Number(allocation.days), 0)

  const extensionDays = allocationRows
    .filter((allocation) => allocation.allocation_type === 'extension')
    .reduce((sum, allocation) => sum + Number(allocation.days), 0)

  const additionalDays = allocationRows
    .filter((allocation) => allocation.allocation_type === 'additional')
    .reduce((sum, allocation) => sum + Number(allocation.days), 0)

  const totalAllocationDays = originalDays + extensionDays + additionalDays
  const usedDays = usedDateRows.length
  const remainingDays = Math.max(projectRow.allocated_days - usedDays, 0)

  const historyItems: HistoryItem[] = [
    ...allocationRows.map((allocation) => ({
      id: `allocation-${allocation.id}`,
      kind: 'allocation' as const,
      label: `${formatAllocationType(allocation.allocation_type)}: ${allocation.days} day${allocation.days === 1 ? '' : 's'}`,
      date: allocation.created_at,
      note: allocation.note,
    })),
    ...usedDateRows.map((usedDate) => ({
      id: `used-${usedDate.day}-${usedDate.request_status ?? 'unknown'}`,
      kind: 'used' as const,
      label: 'Used Day',
      date: usedDate.day,
      note: null,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const cycleRows = rawCycleRows
    .map((row) => {
      const cycle = Array.isArray(row.proposal_cycles)
        ? row.proposal_cycles[0]
        : row.proposal_cycles

      return cycle
        ? {
            id: cycle.id,
            code: cycle.code,
            year: cycle.year,
            half: cycle.half,
            start_date: cycle.start_date,
            end_date: cycle.end_date,
          }
        : null
    })
    .filter(Boolean) as {
      id: string
      code: string
      year: number
      half: 'A' | 'B'
      start_date: string
      end_date: string
    }[]

  const sortedCycles = [...cycleRows].sort((a, b) => a.year - b.year)
  const latestCycle = [...cycleRows].sort((a, b) => b.year - a.year)[0] ?? null
  const nextCycleCode = latestCycle ? `${latestCycle.year + 1}${latestCycle.half}` : null

  return (
    <main className="p-6 space-y-6">
      <TopNav />

      <div>
        <h1 className="text-3xl font-bold">Edit Project</h1>
        <p className="text-sm text-gray-600">{projectRow.proposal_number}</p>
        <p className="text-sm text-gray-600">{projectRow.title}</p>
        <p className="text-sm text-gray-600">PI: {principalInvestigatorName}</p>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {errorDetails ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorDetails}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <section className="space-y-4 rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Proposal Cycles</h2>
            {sortedCycles.length === 0 ? (
              <p className="text-sm text-gray-600">No cycles assigned yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {sortedCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    {cycle.code} ({cycle.start_date} to {cycle.end_date})
                  </div>
                ))}
              </div>
            )}
          </div>

          {nextCycleCode ? (
            <form action={extendProjectCycle}>
              <input type="hidden" name="project_id" value={projectRow.id} />
              <button
                type="submit"
                className="rounded border px-4 py-2 text-sm font-medium"
              >
                Extend to {nextCycleCode}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Allocation Breakdown</h2>

        <div className="grid gap-3 text-sm md:grid-cols-6">
          <div className="rounded border px-3 py-2">
            <div className="font-medium">Original</div>
            <div>{originalDays}</div>
          </div>

          <div className="rounded border px-3 py-2">
            <div className="font-medium">Extension</div>
            <div>{extensionDays}</div>
          </div>

          <div className="rounded border px-3 py-2">
            <div className="font-medium">Additional</div>
            <div>{additionalDays}</div>
          </div>

          <div className="rounded border px-3 py-2">
            <div className="font-medium">Total</div>
            <div>{totalAllocationDays}</div>
          </div>

          <div className="rounded border px-3 py-2">
            <div className="font-medium">Used</div>
            <div>{usedDays}</div>
          </div>

          <div className="rounded border px-3 py-2">
            <div className="font-medium">Remaining</div>
            <div>{remainingDays}</div>
          </div>
        </div>

        <form action={addProjectAllocation} className="space-y-3 border-t pt-4">
          <input type="hidden" name="project_id" value={projectRow.id} />

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">Days to Add</span>
              <input
                name="days"
                type="number"
                min="1"
                className="w-full rounded border px-3 py-2"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Reason</span>
              <select
                name="allocation_type"
                className="w-full rounded border px-3 py-2"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select reason
                </option>
                <option value="extension">Extension</option>
                <option value="additional">Additional</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Note</span>
              <input
                name="note"
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="Optional"
              />
            </label>
          </div>

          <button
            type="submit"
            className="rounded border px-4 py-2 text-sm font-medium"
          >
            Add Allocated Days
          </button>
        </form>

        {historyItems.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Allocation History</h3>
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded border px-3 py-2 text-sm text-gray-700"
                >
                  <div className="font-medium">
                    {item.label} ({formatShortDate(item.date)})
                  </div>
                  {item.note ? (
                    <div className="text-gray-600">{item.note}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <form action={updateProject} className="space-y-4 rounded-2xl border p-6">
        <input type="hidden" name="project_id" value={projectRow.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Project Title</span>
            <input
              name="title"
              type="text"
              defaultValue={projectRow.title}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Proposal Number</span>
            <input
              name="proposal_number"
              type="text"
              defaultValue={projectRow.proposal_number}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Allocated Days</span>
            <input
              name="allocated_days"
              type="number"
              min="1"
              defaultValue={projectRow.allocated_days}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>

          <div />

          <label className="space-y-1">
            <span className="text-sm font-medium">Start Date</span>
            <input
              name="start_date"
              type="date"
              defaultValue={projectRow.start_date}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">End Date</span>
            <input
              name="end_date"
              type="date"
              defaultValue={projectRow.end_date}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>
        </div>

        <div>
          <button
            type="submit"
            className="rounded border px-4 py-2 text-sm font-medium"
          >
            Save Changes
          </button>
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Project Members</h2>

        <form action={updateProjectPi} className="flex flex-wrap items-end gap-3 rounded border bg-gray-50 p-3">
          <input type="hidden" name="project_id" value={projectRow.id} />

          <label className="space-y-1">
            <span className="block text-sm font-medium">Project PI</span>
            <select
              name="principal_investigator_id"
              defaultValue={projectRow.principal_investigator_id ?? ''}
              className="min-w-64 rounded border px-3 py-2 text-sm"
            >
              <option value="">No PI assigned</option>
              {memberRows.map((member) => {
                const profile = Array.isArray(member.profiles)
                  ? member.profiles[0]
                  : member.profiles
                const displayName = profile?.full_name || profile?.email || member.user_id

                return (
                  <option key={member.user_id} value={member.user_id}>
                    {displayName}
                  </option>
                )
              })}
            </select>
          </label>

          <button
            type="submit"
            className="rounded border bg-white px-4 py-2 text-sm font-medium"
          >
            Save PI
          </button>
        </form>

        {memberRows.length === 0 ? (
          <p className="text-sm text-gray-600">No members on this project yet.</p>
        ) : (
          <div className="space-y-2">
            {memberDisplayRows.map((member) => {
              const profile = Array.isArray(member.profiles)
                ? member.profiles[0]
                : member.profiles
              const isPi = member.user_id === projectRow.principal_investigator_id

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                >
                  <div className={`min-w-0 flex-1 ${isPi ? 'font-bold text-black' : ''}`}>
                    {profile?.full_name || profile?.email || member.user_id}
                    {isPi ? ' (PI)' : ''}
                  </div>

                  <div className="shrink-0 text-gray-600">
                    {profile?.email}
                  </div>

                  <form action={removeProjectMember}>
                    <input type="hidden" name="project_id" value={projectRow.id} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <button
                      type="submit"
                      className="rounded border px-3 py-1 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-2 border-t">
          <AddMemberForm projectId={projectRow.id} />
        </div>

        <form action={addProjectMembers} className="space-y-3 pt-4 border-t">
          <input type="hidden" name="project_id" value={projectRow.id} />

          <label className="space-y-1 block">
            <span className="text-sm font-medium">Add Existing Users by Email</span>
            <textarea
              name="member_emails"
              rows={4}
              className="w-full rounded border px-3 py-2"
              placeholder="one@email.com, another@email.com"
            />
          </label>

          <button
            type="submit"
            className="rounded border px-4 py-2 text-sm font-medium"
          >
            Add Members
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border p-6">
        <div>
          <h2 className="text-xl font-semibold">Add Used Date</h2>
          <p className="text-sm text-gray-600">
            Add a historical date this project has already used. This will count against the project&apos;s remaining allocated days.
          </p>
        </div>

        <form action={addHistoricalUsedDate} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="project_id" value={projectRow.id} />

          <label className="space-y-1">
            <span className="text-sm font-medium">Used Date</span>
            <input
              type="date"
              name="used_day"
              min={projectRow.start_date}
              max={projectRow.end_date}
              required
              className="block rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Note</span>
            <input
              type="text"
              name="admin_notes"
              placeholder="Optional"
              className="block rounded border px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="rounded border px-4 py-2 text-sm font-medium"
          >
            Add Used Date
          </button>
        </form>
      </section>
    </main>
  )
}

function formatAllocationType(type: AllocationRow['allocation_type']) {
  if (type === 'original') return 'Original'
  if (type === 'extension') return 'Extension'
  return 'Additional'
}

function formatShortDate(dateStr: string) {
  const dateOnlyMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/)

  const date = dateOnlyMatch
    ? new Date(`${dateStr}T00:00:00`)
    : new Date(dateStr)

  if (Number.isNaN(date.getTime())) {
    return dateStr
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}
