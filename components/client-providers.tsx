'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { GoogleMapsProvider } from '@/lib/google-maps/provider'
import { usePushNotifications } from '@/hooks/use-push-notifications'

// Lazy-loaded providers that are not needed during SSR prerendering
function LazyProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR / prerendering, render children without any providers
  if (!mounted) {
    return <>{children}</>
  }

  // Once mounted on client, dynamically import heavy providers
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <GoogleMapsProvider>
        {children}
      </GoogleMapsProvider>
      <Toaster
        theme="dark"
        position="top-center"
        expand={false}
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          classNames: {
            toast: 'group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-[0_4px_24px_rgba(0,0,0,0.12)] group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3',
            title: 'group-[.toast]:text-[15px] group-[.toast]:font-bold',
          },
        }}
      />
      <ClientOnlyProviders />
      <PushNotificationsBootstrap />
    </ThemeProvider>
  )
}

// Solicita permissao de push assim que o usuario esta autenticado
function PushNotificationsBootstrap() {
  const { permission, isSubscribed, subscribe } = usePushNotifications()

  useEffect(() => {
    // So pede se ainda nao foi decidido e nao esta subscrito
    if (permission === 'default' && !isSubscribed) {
      // Aguarda 3s para nao bloquear a renderizacao inicial
      const timer = setTimeout(() => { subscribe() }, 3000)
      return () => clearTimeout(timer)
    }
  }, [permission, isSubscribed, subscribe])

  return null
}

// These providers return null and only run effects on the client
function ClientOnlyProviders() {
  useEffect(() => {
    // Auto theme
    const hour = new Date().getHours()
    const userPref = localStorage.getItem('uppi-theme-preference')
    if (userPref !== 'manual') {
      const shouldBeDark = hour >= 18 || hour < 6
      document.documentElement.classList.toggle('dark', shouldBeDark)
    }

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Block browser install prompt (TWA only)
    const handler = (e: Event) => e.preventDefault()
    window.addEventListener('beforeinstallprompt', handler)

    // Offline handling
    const handleOffline = () => {
      import('@/lib/utils/ios-toast').then(({ iosToast }) => {
        iosToast.error('Sem conexao com a internet')
      })
    }
    const handleOnline = () => {
      import('@/lib/utils/ios-toast').then(({ iosToast }) => {
        iosToast.success('Conexao restaurada')
      })
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return null
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return <LazyProviders>{children}</LazyProviders>
}
