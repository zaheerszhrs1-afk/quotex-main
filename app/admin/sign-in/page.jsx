import AuthPage from '@/components/site/AuthPage'

export const metadata = { title: 'Admin Login — Quotex' }

export default function AdminSignInPage() {
  return <AuthPage mode="login" admin />
}
