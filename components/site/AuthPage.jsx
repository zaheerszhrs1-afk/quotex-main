import { Suspense } from 'react'
import SiteNavbar from '@/components/site/SiteNavbar'
import SiteFooter from '@/components/site/SiteFooter'
import AuthCard from '@/components/site/AuthCard'

function ChartBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className="absolute inset-x-0 top-0 h-[280px] w-full opacity-[0.35]" preserveAspectRatio="none" viewBox="0 0 1440 280">
        <polyline
          points="0,180 120,150 240,200 360,120 480,160 600,90 720,140 840,70 960,130 1080,60 1200,110 1320,40 1440,90"
          fill="none" stroke="#2F6BD8" strokeWidth="2"
        />
        <polyline
          points="0,210 120,230 240,170 360,220 480,190 600,240 720,180 840,220 960,160 1080,210 1200,150 1320,200 1440,150"
          fill="none" stroke="#244B91" strokeWidth="1.5" opacity="0.6"
        />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-[260px] w-full opacity-[0.25]" preserveAspectRatio="none" viewBox="0 0 1440 260">
        <polyline
          points="0,120 120,150 240,90 360,140 480,80 600,130 720,70 840,120 960,60 1080,110 1200,50 1320,100 1440,40"
          fill="none" stroke="#B5453E" strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

export default function AuthPage({ mode, admin = false }) {
  const title = admin ? 'Admin Panel' : mode === 'register' ? 'Sign Up' : 'Log In'
  return (
    <div className="relative min-h-screen" style={{ background: '#171F2C' }}>
      <ChartBackdrop />
      <div className="relative z-10">
        <SiteNavbar />
        <main className="px-5 pt-6 md:pt-10">
          <h1 className="mb-8 text-center text-5xl font-extrabold text-white md:mb-10 md:text-6xl">
            {title}
          </h1>
          <Suspense fallback={<div className="h-[400px]" />}>
            <AuthCard mode={mode} admin={admin} />
          </Suspense>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
