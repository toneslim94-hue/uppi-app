import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Configura o web-push com as chaves VAPID uma unica vez
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'noreply@uppi.app'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

/**
 * POST /api/v1/push/send
 * Envia Web Push para todos os dispositivos ativos de um usuario.
 * Chamado internamente pelo notification-service — nao exposto publicamente.
 */
export async function POST(request: NextRequest) {
  try {
    // Valida que as chaves VAPID estao configuradas
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error('[push/send] VAPID keys nao configuradas')
      return NextResponse.json({ error: 'VAPID nao configurado' }, { status: 500 })
    }

    const { user_id, title, body, data } = await request.json()

    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id e title sao obrigatorios' }, { status: 400 })
    }

    // Usa service role para buscar subscriptions (rota interna)
    const supabase = await createClient()

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)
      .eq('is_active', true)

    if (error) throw error
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    const payload = JSON.stringify({ title, body: body ?? '', data: data ?? {} })

    // Envia para todos os dispositivos do usuario em paralelo
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 } // expira em 24h se o dispositivo estiver offline
        )
      )
    )

    // Desativa subscriptions que retornaram 410 (expiradas/revogadas)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number }
        if (err?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint)
        }
      }
    })

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user_id)
        .in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, sent })
  } catch (error) {
    console.error('[push/send] error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
