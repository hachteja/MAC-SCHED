'use client'

import { useEffect, useMemo, useState } from 'react'

type ProjectMember = {
  id: string
  email: string
  full_name: string | null
}

type EditRequestUsersButtonProps = {
  requestId: string
  projectMembers: ProjectMember[]
  initialOnsiteParticipantIds: string[]
  initialRemoteParticipantIds: string[]
  returnTo?: string
  action: (formData: FormData) => void
}

export default function EditRequestUsersButton({
  requestId,
  projectMembers,
  initialOnsiteParticipantIds,
  initialRemoteParticipantIds,
  returnTo = '/admin/requests',
  action,
}: EditRequestUsersButtonProps) {
  const [onsiteParticipantIds, setOnsiteParticipantIds] = useState<string[]>(
    initialOnsiteParticipantIds
  )
  const [remoteParticipantIds, setRemoteParticipantIds] = useState<string[]>(
    initialRemoteParticipantIds
  )
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setOnsiteParticipantIds(initialOnsiteParticipantIds)
    setRemoteParticipantIds(initialRemoteParticipantIds)
  }, [isOpen, initialOnsiteParticipantIds, initialRemoteParticipantIds])

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

  const selectedCount = cleanOnsiteParticipantIds.length + cleanRemoteParticipantIds.length

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
        className="rounded border px-3 py-1 text-xs font-medium"
      >
        Edit Users
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Edit participation</h2>
                <p className="text-sm text-gray-600">
                  Update who is participating on-site or remotely for this booking.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedCount} participant{selectedCount === 1 ? '' : 's'} selected
                </p>
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
              <input type="hidden" name="request_id" value={requestId} />
	      <input type="hidden" name="return_to" value={returnTo} />

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
                            On Site
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
                  Save users
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
