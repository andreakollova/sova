import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings } from '@/lib/kv'

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const updates = await req.json()
  const settings = await saveSettings(updates)
  return NextResponse.json(settings)
}
