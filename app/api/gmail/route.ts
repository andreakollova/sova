import { NextResponse } from 'next/server'
import { getNewEmailsFromWatchedAddresses } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const emails = await getNewEmailsFromWatchedAddresses()
    return NextResponse.json(emails)
  } catch (err) {
    console.error('Gmail route error:', err)
    return NextResponse.json([])
  }
}
