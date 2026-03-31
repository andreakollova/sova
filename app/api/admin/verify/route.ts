import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return NextResponse.json({ ok: false, error: 'No admin password configured' })
  return NextResponse.json({ ok: password === adminPassword })
}
