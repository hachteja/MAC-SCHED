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
        Project Dashboard
      </Link>

      <Link
        href="/available-days"
        className="rounded-md border px-3 py-2 text-sm font-medium"
      >
        Available Days
      </Link>

      {isAdmin ? (
        <>
          <div className="mx-2 h-6 self-center border-l border-gray-300" />

          <span className="flex items-center text-sm font-semibold text-gray-600">
            Admin Only:
          </span>

          <Link
            href="/admin/projects"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Project Management
          </Link>

          <Link
            href="/admin/requests"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Booking Requests
          </Link>

	  <Link
	    href="/admin/pas-access"
	    className="rounded-md border px-3 py-2 text-sm font-medium"
	  >
	    PAS and Access
	  </Link>

          <Link
            href="/admin/available_days"
            className="rounded-md border px-3 py-2 text-sm font-medium"
          >
            Change Available Days
          </Link>
        </>
      ) : null}
    </div>
  )
}
