// Cron-ready hold sweep endpoint (decision #22, S5). Vercel cron attaches at
// M7 with Authorization: Bearer CRON_SECRET; until then the sweep also runs
// lazily on portal/trip/My Okim loads. Rejects everything without the secret.
import { NextResponse } from 'next/server'
import { sweepHolds } from '@/lib/seamless-actions'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const result = await sweepHolds()
  return NextResponse.json(result)
}