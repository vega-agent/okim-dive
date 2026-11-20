// /book entry (Auth.js signIn page): booking starts from a trip.
import { redirect } from 'next/navigation'

export default function BookIndex() {
  redirect('/trips')
}