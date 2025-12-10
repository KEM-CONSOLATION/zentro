import { redirect } from 'next/navigation'

export default async function MenuPage() {
  // Temporarily disabled: redirect users away from menu
  redirect('/dashboard')
}
