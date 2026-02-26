import { createClient } from '@/lib/supabase/client'

export type NotificationType = 
  | 'new_offer' 
  | 'offer_accepted' 
  | 'ride_started' 
  | 'ride_completed'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'payment_received'
  | 'new_message'

export interface NotificationData {
  type: NotificationType
  title: string
  body: string
  data?: Record<string, any>
  ride_id?: string
  user_id: string
  priority?: 'high' | 'normal'
}

class NotificationService {
  private supabase = createClient()
  
  /**
   * Send notification to user
   */
  async sendNotification(notification: NotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      // Store notification in database
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: notification.data || {},
          ride_id: notification.ride_id,
          read: false,
        })

      if (error) throw error

      // Disparar Web Push para o usuario (app fechado / tela bloqueada)
      await this.sendWebPush(notification)

      console.log('[v0] Notification sent:', notification.type)
      return { success: true }
    } catch (error) {
      console.error('[v0] Error sending notification:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { success: true, notifications: data }
    } catch (error) {
      console.error('[v0] Error fetching notifications:', error)
      return { success: false, error: 'Failed to load notifications' }
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('[v0] Error marking notification as read:', error)
      return { success: false }
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('[v0] Error marking all as read:', error)
      return { success: false }
    }
  }

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: any) => void
  ): () => void {
    const channel = this.supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[v0] New notification received:', payload.new)
          callback(payload.new)
        }
      )
      .subscribe()

    return () => {
      this.supabase.removeChannel(channel)
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error
      return { success: true, count: count || 0 }
    } catch (error) {
      console.error('[v0] Error getting unread count:', error)
      return { success: false, count: 0 }
    }
  }

  /**
   * Helper: Send ride status notification
   */
  async notifyRideStatus(
    userId: string, 
    rideId: string, 
    status: string,
    driverName?: string
  ) {
    const notifications: Record<string, { title: string; body: string; type: NotificationType }> = {
      'driver_arriving': {
        title: 'Motorista a caminho',
        body: `${driverName || 'Seu motorista'} está indo até você`,
        type: 'driver_arriving',
      },
      'arrived': {
        title: 'Motorista chegou!',
        body: `${driverName || 'Seu motorista'} está te esperando`,
        type: 'driver_arrived',
      },
      'in_progress': {
        title: 'Corrida iniciada',
        body: 'Sua corrida começou. Boa viagem!',
        type: 'ride_started',
      },
      'completed': {
        title: 'Corrida finalizada',
        body: 'Avalie sua experiência',
        type: 'ride_completed',
      },
    }

    const notification = notifications[status]
    if (!notification) return

    return this.sendNotification({
      ...notification,
      user_id: userId,
      ride_id: rideId,
      priority: 'high',
    })
  }
}

  /**
   * Dispara Web Push para todos os dispositivos ativos do usuario via /api/v1/push/send
   * Chamado internamente por sendNotification — funciona com app fechado/tela bloqueada
   */
  private async sendWebPush(notification: NotificationData) {
    try {
      await fetch('/api/v1/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: notification.user_id,
          title:   notification.title,
          body:    notification.body,
          data: {
            type:    notification.type,
            ride_id: notification.ride_id,
            ...notification.data,
          },
        }),
      })
    } catch (err) {
      // Web Push e best-effort — nao quebra o fluxo principal
      console.error('[v0] sendWebPush error:', err)
    }
  }
}

export const notificationService = new NotificationService()
