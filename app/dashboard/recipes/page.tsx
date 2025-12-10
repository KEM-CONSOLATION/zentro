import { redirect } from 'next/navigation'

export default async function RecipesPage() {
  // Temporarily disabled: redirect users away from recipes
  redirect('/dashboard')
}
