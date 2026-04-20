import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function TopNav() {
  const supabase = await createClient()

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  let isAdmin = false

  if (claims?.sub) {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', claims.sub)
      .maybeSingle()

    isAdmin = !!adminRow
  }

  return (
    <div className="flex gap-3 border-b pb-3">
      <Link
        href="/dashboard"
        className="rounded-md border px-3 py-2 text-sm font-medium"
      >
        Project Summary
      </Link>

      <Link
        href="/available-days"
        className="rounded-md border px-3 py-2 text-sm font-medium"
      >
        Available Days
      </Link>

      {isAdmin ? (
        <>
          <Link
            href="/admin/projects"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Admin Projects
          </Link>

          <Link
            href="/admin/requests"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Admin Requests
          </Link>

          <Link
            href="/admin/available_days"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Admin Availability
          </Link>
        </>
      ) : null}
    </div>
  )
}
