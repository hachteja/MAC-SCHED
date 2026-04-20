'use client'

import { useState } from 'react'

export default function AddMemberForm({ projectId }: { projectId: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    setTempPassword(null)

    try {
      const res = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      if (data.created) {
        setMessage('New user created and added to project.')
        setTempPassword(data.tempPassword)
      } else {
        setMessage('Existing user added to project.')
      }

      setName('')
      setEmail('')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <h2 className="font-medium">Add member</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full border rounded p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2"
        >
          {loading ? 'Adding...' : 'Add member'}
        </button>
      </form>

      {message && <p className="text-sm">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tempPassword && (
        <div className="rounded border p-3">
          <p className="text-sm font-medium">Temporary password</p>
          <p className="font-mono text-sm break-all">{tempPassword}</p>
          <p className="text-xs text-gray-600 mt-1">
            Copy this now. It will not be shown again.
          </p>
        </div>
      )}
    </div>
  )
}
