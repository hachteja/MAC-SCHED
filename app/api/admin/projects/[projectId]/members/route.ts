import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generateTempPassword() {
  return randomBytes(12).toString('base64url') + 'A1!'
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const { name, email } = await req.json()

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const fullName = String(name || '').trim()

  if (!normalizedEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 400 })
  }

  if (!adminRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 400 })
  }

  let profileId = existingProfile?.id
  let created = false
  let tempPassword: string | null = null

  if (!profileId) {
    tempPassword = generateTempPassword()

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    profileId = data.user.id
    created = true

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: fullName || null,
        force_password_change: true,
        invited_at: new Date().toISOString(),
        invited_by: user.id,
      })
      .eq('id', profileId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
  }

  const { error: membershipError } = await admin
    .from('project_members')
    .upsert(
      {
        project_id: projectId,
        user_id: profileId,
      },
      {
        onConflict: 'project_id,user_id',
      }
    )

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    created,
    tempPassword,
  })
}
