'use client'

import { useEffect, useMemo, useState } from 'react'

type ProjectMember = {
  id: string
  email: string
  full_name: string | null
}

type ParticipationRequestFormProps = {
  projectId: string
  instrumentDayId: string
  projectMembers: ProjectMember[]
  action: (formData: FormData) => void
}

export default function ParticipationRequestForm({
  projectId,
  instrumentDayId,
  projectMembers,
  action,
}: ParticipationRequestFormProps) {
  const storageKey = `mac-sched-participation-${projectId}`

  const [onsiteParticipantIds, setOnsiteParticipantIds] = useState<string[]>([])
  const [remoteParticipantIds, setRemoteParticipantIds] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return

    try {
      const parsed = JSON.parse(stored) as {
        onsiteParticipantIds?: string[]
        remoteParticipantIds?: string[]
      }

      setOnsiteParticipantIds(parsed.onsiteParticipantIds ?? [])
      setRemoteParticipantIds(parsed.remoteParticipantIds ?? [])
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        onsiteParticipantIds,
        remoteParticipantIds,
      })
    )
  }, [storageKey, onsiteParticipantIds, remoteParticipantIds])

  const selectedCount = onsiteParticipantIds.length + remoteParticipantIds.length

  const validProjectMemberIds = useMemo(
    () => new Set(projectMembers.map((member) => member.id)),
    [projectMembers]
  )

  const cleanOnsiteParticipantIds = onsiteParticipantIds.filter((id) =>
    validProjectMemberIds.has(id)
  )

  const cleanRemoteParticipantIds = remoteParticipantIds.filter((id) =>
    validProjectMemberIds.has(id)
  )

  function toggleOnsite(memberId: string) {
    setOnsiteParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    )

    setRemoteParticipantIds((current) => current.filter((id) => id !== memberId))
  }

  function toggleRemote(memberId: string) {
    setRemoteParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    )

    setOnsiteParticipantIds((current) => current.filter((id) => id !== memberId))
  }

  function closeModal() {
    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
      >
        Request
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Select participation</h2>
                <p className="text-sm text-gray-600">
                  Choose who will participate on-site or remotely for this request.
                </p>
                {selectedCount > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedCount} participant{selectedCount === 1 ? '' : 's'} selected
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="instrument_day_id" value={instrumentDayId} />

              {cleanOnsiteParticipantIds.map((id) => (
                <input
                  key={`onsite-${id}`}
                  type="hidden"
                  name="onsite_participant_ids"
                  value={id}
                />
              ))}

              {cleanRemoteParticipantIds.map((id) => (
                <input
                  key={`remote-${id}`}
                  type="hidden"
                  name="remote_participant_ids"
                  value={id}
                />
              ))}

              {projectMembers.length ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {projectMembers.map((member) => {
                    const isOnsite = onsiteParticipantIds.includes(member.id)
                    const isRemote = remoteParticipantIds.includes(member.id)

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {member.full_name || member.email}
                          </div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleOnsite(member.id)}
                            className={
                              isOnsite
                                ? 'rounded-md bg-blue-600 px-3 py-1 text-sm text-white'
                                : 'rounded-md border px-3 py-1 text-sm hover:bg-gray-50'
                            }
                          >
                            On-site
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleRemote(member.id)}
                            className={
                              isRemote
                                ? 'rounded-md bg-purple-600 px-3 py-1 text-sm text-white'
                                : 'rounded-md border px-3 py-1 text-sm hover:bg-gray-50'
                            }
                          >
                            Remote
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No project members found.</p>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Submit request
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
