import { requireInstructor } from '@/lib/portal-actions'
import TripNewForm from '@/components/trip-new-form'

export const dynamic = 'force-dynamic'
export default async function NewTripPage() {
  await requireInstructor()
  return <TripNewForm />
}