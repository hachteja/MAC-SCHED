'use client'

import { useState } from 'react'

type Cycle = {
  id: string
  code: string
  start_date: string
  end_date: string
}

export default function CycleDateFields({
  cycles,
}: {
  cycles: Cycle[]
}) {
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function handleCycleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newCycleId = event.target.value
    setSelectedCycleId(newCycleId)

    const selectedCycle = cycles.find((cycle) => cycle.id === newCycleId)

    if (selectedCycle) {
      setStartDate(selectedCycle.start_date)
      setEndDate(selectedCycle.end_date)
    }
  }

  return (
    <>
      <label className="space-y-1">
        <span className="text-sm font-medium">Proposal Cycle</span>
        <select
          name="cycleId"
          className="w-full rounded border px-3 py-2"
          required
          value={selectedCycleId}
          onChange={handleCycleChange}
        >
          <option value="" disabled>
            Select a cycle
          </option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.code} ({cycle.start_date} to {cycle.end_date})
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">Start Date</span>
        <input
          name="start_date"
          type="date"
          className="w-full rounded border px-3 py-2"
          required
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">End Date</span>
        <input
          name="end_date"
          type="date"
          className="w-full rounded border px-3 py-2"
          required
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </label>
    </>
  )
}
