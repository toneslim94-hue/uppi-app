import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'noreply@uppi.app'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

type BroadcastTarget = 'all_passengers' | 'all_drivers' | 'everyone'

/**
 * POST /api/v1/push/broadcast
 * Envia Web Push para um grupo inteiro de usuarios.
 * Apenas admins podem chamar esta rota.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID nao configurado' }, { status: 500 })
    }

    const supabase = await createClient()

    // Verifica se e admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Apenas admins podem fazer broadcast' }, { status: 403 })
    }

    const { target, title, body, data } = await request.json() as {
      target: BroadcastTarget
      title: string
      body: string
      data?: Record<string, unknown>
    }

    if (!target || !title || !body) {
      return NextResponse.json({ error: 'target, title e body sao obrigatorios' }, { status: 400 })
    }

    // Busca user_ids do grupo alvo
    let userQuery = supabase.from('profiles').select('id')
    if (target === 'all_passengers') userQuery = userQuery.eq('user_type', 'passenger')
    if (target === 'all_drivers')    userQuery = userQuery.eq('user_type', 'driver')
    // 'everyone' nao filtra

    const { data: targetUsers } = await userQuery
    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    const userIds = targetUsers.map((u) => u.id)

    // Busca todas as subscriptions ativas do grupo
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    const payload = JSON.stringify({ title, body, data: data ?? {} })

    // Envia em lotes de 50 para nao sobrecarregar
    const BATCH = 50
    let sent = 0
    const expiredEndpoints: string[] = []

    for (let i = 0; i < subscriptions.length; i += BATCH) {
      const batch = subscriptions.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24 }
          )
        )
      )
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          sent++
        } else {
          const err = result.reason as { statusCode?: number }
          if (err?.statusCode === 410) expiredEndpoints.push(batch[idx].endpoint)
        }
      })
    }

    // Desativa expiradas
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('endpoint', expiredEndpoints)
    }

    return NextResponse.json({ success: true, sent, total: subscriptions.length })
  } catch (error) {
    console.error('[push/broadcast] error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
