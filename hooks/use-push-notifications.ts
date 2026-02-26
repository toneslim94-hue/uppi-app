'use client'

import { useState, useEffect, useCallback } from 'react'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

interface UsePushNotificationsReturn {
  permission: PermissionState
  isSubscribed: boolean
  isLoading: boolean
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

/**
 * Hook para solicitar permissao e gerenciar a subscription Web Push do usuario.
 * Funciona em PWA/TWA (Play Store) e no navegador.
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission]     = useState<PermissionState>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading]       = useState(false)

  // Verifica estado inicial ao montar
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission as PermissionState)

    // Verifica se ja existe uma subscription ativa
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub)
      })
    })
  }, [])

  /** Converte Uint8Array para base64url (necessario para VAPID) */
  const uint8ArrayToBase64 = (array: Uint8Array): string => {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Pede permissao ao usuario, cria a subscription no navegador
   * e salva no Supabase via /api/v1/push/subscribe
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

    setIsLoading(true)
    try {
      // 1. Pede permissao ao usuario
      const perm = await Notification.requestPermission()
      setPermission(perm as PermissionState)
      if (perm !== 'granted') return false

      // 2. Busca a VAPID public key do servidor
      const keyRes = await fetch('/api/v1/push/vapid-public-key')
      if (!keyRes.ok) throw new Error('Nao foi possivel obter a VAPID key')
      const { publicKey } = await keyRes.json()

      // 3. Cria a subscription no navegador
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: publicKey,
      })

      const rawKey  = subscription.getKey('p256dh')
      const rawAuth = subscription.getKey('auth')
      if (!rawKey || !rawAuth) throw new Error('Chaves de subscription invalidas')

      // 4. Salva no Supabase
      const res = await fetch('/api/v1/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: uint8ArrayToBase64(new Uint8Array(rawKey)),
            auth:   uint8ArrayToBase64(new Uint8Array(rawAuth)),
          },
        }),
      })

      if (!res.ok) throw new Error('Falha ao salvar subscription')

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('[usePushNotifications] subscribe error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Remove a subscription do navegador e desativa no Supabase
   */
  const unsubscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      await fetch('/api/v1/push/subscribe', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })

      await sub.unsubscribe()
      setIsSubscribed(false)
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe }
}
