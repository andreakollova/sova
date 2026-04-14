import { NextResponse } from 'next/server'
import { getAiSportsResearch } from '@/lib/kv'

export const dynamic = 'force-dynamic'

export async function GET() {
  const research = await getAiSportsResearch()
  return NextResponse.json(research)
}
