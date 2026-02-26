'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNavigation } from '@/components/bottom-navigation'
import DriverSkeleton from '@/components/driver-skeleton'
import type { Ride } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { trackingService } from '@/lib/services/tracking-service'

interface RideWithPassenger extends Ride {
  passenger?: {
    full_name: string
    avatar_url?: string
    rating: number
  }
}

interface DailyStats {
  totalEarnings: number
  completedRides: number
  acceptanceRate: number
}

export default function DriverPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rides, setRides] = useState<RideWithPassenger[]>([])
  const [loading, setLoading] = useState(true)
  const [offerPrice, setOfferPrice] = useState<{ [key: string]: string }>({})
  const [isOnline, setIsOnline] = useState(true)
  const [dailyStats, setDailyStats] = useState<DailyStats>({ totalEarnings: 0, completedRides: 0, acceptanceRate: 100 })
  const [expandedRide, setExpandedRide] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [driverVehicleType, setDriverVehicleType] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    initDriver()
  }, [])

  // Subscribe to realtime ride updates when online
  useEffect(() => {
    if (!isOnline || !driverVehicleType) return

    const channel = supabase
      .channel('driver-rides-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
        },
        async (payload) => {
          const newRide = payload.new as RideWithPassenger
          // Only show rides matching driver's vehicle type (RLS handles this too)
          if (newRide.vehicle_type === driverVehicleType && (newRide.status === 'pending' || newRide.status === 'negotiating')) {
            // Fetch passenger info
            const { data: passenger } = await supabase
              .from('profiles')
              .select('full_name, avatar_url, rating')
              .eq('id', newRide.passenger_id)
              .single()

            const rideWithPassenger = { ...newRide, passenger: passenger || undefined }
            setRides(prev => [rideWithPassenger, ...prev])

            // Play notification sound and show visual feedback
            try {
              const audio = new Audio('/notification.mp3')
              audio.volume = 0.5
              audio.play().catch(() => {})
            } catch {
              // Audio not available
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
        },
        (payload) => {
          const updatedRide = payload.new as RideWithPassenger
          if (updatedRide.status === 'accepted' || updatedRide.status === 'cancelled') {
            // Remove from list when ride is taken or cancelled
            setRides(prev => prev.filter(r => r.id !== updatedRide.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, driverVehicleType])

  const initDriver = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/onboarding/splash')
        return
      }

      // Get driver profile to know vehicle type
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('vehicle_type')
        .eq('id', user.id)
        .single()

      // Get driver name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (profile) setDriverName(profile.full_name || '')

      const vType = driverProfile?.vehicle_type || null
      if (vType) setDriverVehicleType(vType)

      await loadAvailableRides(vType)
      await loadDailyStats(user.id)
    } catch (error) {
      console.error('[v0] Error initializing driver:', error)
      setLoading(false)
    }
  }

  const loadAvailableRides = async (vehicleTypeOverride?: string | null) => {
    setRefreshing(true)
    try {
      // Build query - filter by vehicle_type to only show matching rides
      let query = supabase
        .from('rides')
        .select(`
          *,
          passenger:profiles!passenger_id(full_name, avatar_url, rating)
        `)
        .in('status', ['pending', 'negotiating'])
        .order('created_at', { ascending: false })
        .limit(20)

      // Explicitly filter by driver's vehicle type so moto drivers only see moto rides and car drivers only see car rides
      const vt = vehicleTypeOverride ?? driverVehicleType
      if (vt) {
        query = query.eq('vehicle_type', vt)
      }

      const { data, error } = await query

      if (error) throw error
      setRides(data || [])
    } catch (error) {
      console.error('[v0] Error loading rides:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadDailyStats = async (userId?: string) => {
    try {
      let uid = userId
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser()
        uid = user?.id
      }
      if (!uid) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('rides')
        .select('final_price, status')
        .eq('driver_id', uid)
        .gte('completed_at', today.toISOString())
        .eq('status', 'completed')

      if (error) throw error

      const earnings = data?.reduce((sum, ride) => sum + (ride.final_price || 0), 0) || 0
      setDailyStats({
        totalEarnings: earnings,
        completedRides: data?.length || 0,
        acceptanceRate: 95
      })
    } catch (error) {
      console.log('[v0] Error loading stats:', error)
    }
  }

  // Accept ride directly at passenger's offered price
  const handleAcceptRide = async (ride: RideWithPassenger) => {
    setAccepting(ride.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create a price offer at passenger's price
      const { error: offerError } = await supabase
        .from('price_offers')
        .insert({
          ride_id: ride.id,
          driver_id: user.id,
          offered_price: ride.passenger_price_offer,
          message: 'Aceito pelo preço oferecido',
          status: 'accepted',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })

      if (offerError) throw offerError

      // Update ride with driver assignment
      const { error: rideError } = await supabase
        .from('rides')
        .update({
          driver_id: user.id,
          final_price: ride.passenger_price_offer,
          status: 'accepted',
        })
        .eq('id', ride.id)

      if (rideError) throw rideError

      // Iniciar tracking GPS em tempo real para o passageiro acompanhar
      trackingService.startDriverTracking(ride.id, user.id)

      // Remove from list
      setRides(prev => prev.filter(r => r.id !== ride.id))
      loadDailyStats(user.id)

      // Navegar para a tela de tracking do motorista
      router.push(`/uppi/ride/${ride.id}/tracking`)
    } catch (error) {
      console.error('[v0] Error accepting ride:', error)
    } finally {
      setAccepting(null)
    }
  }

  // Make counter-offer
  const handleMakeOffer = async (rideId: string) => {
    try {
      const price = offerPrice[rideId]
      if (!price) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('price_offers')
        .insert({
          ride_id: rideId,
          driver_id: user.id,
          offered_price: parseFloat(price),
          message: 'Contra-oferta do motorista',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })

      if (error) throw error

      // Update ride status to negotiating
      await supabase
        .from('rides')
        .update({ status: 'negotiating' })
        .eq('id', rideId)

      setOfferPrice({ ...offerPrice, [rideId]: '' })
      setExpandedRide(null)
    } catch (error) {
      console.error('[v0] Error making offer:', error)
    }
  }

  // Get vehicle type label
  const getVehicleLabel = (type: string) => {
    switch (type) {
      case 'moto': return 'Moto'
      case 'economy': return 'Carro'
      case 'electric': return 'Eletrico'
      case 'premium': return 'Premium'
      case 'suv': return 'SUV'
      default: return 'Carro'
    }
  }

  // Get vehicle type icon
  const getVehicleIcon = (type: string) => {
    if (type === 'moto') {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="5" cy="17" r="3" />
          <circle cx="19" cy="17" r="3" />
          <path d="M5 14l4-7h6l4 7" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zM16 17a2 2 0 104 0 2 2 0 00-4 0zM4 11l2-5h12l2 5M4 11h16M4 11v6h16v-6" />
      </svg>
    )
  }

  if (loading) {
    return <DriverSkeleton />
  }

  return (
    <div className="h-dvh overflow-y-auto bg-gradient-to-br from-neutral-50 via-emerald-50/20 to-neutral-50 pb-24 ios-scroll">
      {/* Refreshing indicator */}
      {refreshing && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-ios-bounce-in">
          <div className="bg-white/95 ios-blur-heavy px-5 py-3 rounded-[20px] shadow-lg flex items-center gap-2.5">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[14px] font-semibold text-neutral-700">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header - iOS 17 style */}
      <header className="bg-white/80 ios-blur border-b border-neutral-200/40 sticky top-0 z-30 animate-ios-fade-up">
        <div className="px-5 pt-safe-offset-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100/80 hover:bg-neutral-200/80 ios-press transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-[22px] font-bold text-neutral-900 tracking-tight leading-none">
                  {driverName ? `Ola, ${driverName.split(' ')[0]}` : 'Motorista'}
                </h1>
                <p className="text-[13px] text-neutral-500 mt-0.5">
                  {driverVehicleType ? getVehicleLabel(driverVehicleType) : 'Corridas disponiveis'}
                </p>
              </div>
            </div>
            
            {/* Online/Offline Toggle */}
            <button
              type="button"
              onClick={() => setIsOnline(!isOnline)}
              className={cn(
                "relative w-14 h-8 rounded-full transition-all ios-press",
                isOnline ? "bg-gradient-to-r from-emerald-500 to-green-500" : "bg-neutral-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all",
                isOnline ? "right-1" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-5 py-5 max-w-2xl mx-auto">
        {/* Status Banner */}
        <div className={cn(
          "mb-5 rounded-[20px] p-4 flex items-center justify-between animate-ios-fade-up border transition-all",
          isOnline 
            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/50" 
            : "bg-neutral-100 border-neutral-200/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
            )} />
            <div>
              <p className="text-[16px] font-bold text-neutral-900">
                {isOnline ? "Online - Recebendo corridas" : "Offline"}
              </p>
              <p className="text-[13px] text-neutral-600">
                {isOnline ? "Você está visível para passageiros" : "Ative para receber corridas"}
              </p>
            </div>
          </div>
          <svg 
            className={cn("w-6 h-6", isOnline ? "text-emerald-600" : "text-neutral-400")} 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>

        {/* Earnings Dashboard Link */}
        <button
          type="button"
          onClick={() => router.push('/uppi/driver/earnings')}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-[20px] p-4 mb-5 flex items-center gap-4 ios-press shadow-lg shadow-emerald-500/20 animate-ios-fade-up"
        >
          <div className="w-12 h-12 bg-white/20 rounded-[16px] flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-[16px] font-bold text-white">Dashboard de Ganhos</p>
            <p className="text-[13px] text-white/75">Graficos, demanda e zonas quentes</p>
          </div>
          <svg className="w-5 h-5 text-white/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Daily Stats - iOS glassmorphism cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-5 stagger-children">
          <div className="bg-gradient-to-br from-white/90 to-white/70 ios-blur rounded-[20px] p-4 text-center shadow-sm border border-white/50">
            <div className="text-[24px] font-bold bg-gradient-to-br from-emerald-500 to-green-600 bg-clip-text text-transparent tracking-tight leading-none mb-1.5">
              R$ {dailyStats.totalEarnings.toFixed(0)}
            </div>
            <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Ganhos Hoje</div>
          </div>
          
          <div className="bg-gradient-to-br from-white/90 to-white/70 ios-blur rounded-[20px] p-4 text-center shadow-sm border border-white/50">
            <div className="text-[24px] font-bold bg-gradient-to-br from-blue-500 to-blue-600 bg-clip-text text-transparent tracking-tight leading-none mb-1.5">
              {dailyStats.completedRides}
            </div>
            <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Viagens</div>
          </div>
          
          <div className="bg-gradient-to-br from-white/90 to-white/70 ios-blur rounded-[20px] p-4 text-center shadow-sm border border-white/50">
            <div className="text-[24px] font-bold bg-gradient-to-br from-amber-500 to-orange-600 bg-clip-text text-transparent tracking-tight leading-none mb-1.5">
              {dailyStats.acceptanceRate}%
            </div>
            <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Taxa</div>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">
            Solicitações ({rides.length})
          </p>
          <button
            type="button"
            onClick={loadAvailableRides}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 ios-press transition-colors disabled:opacity-50"
          >
            <svg 
              className={cn("w-4 h-4 text-emerald-600", refreshing && "animate-spin")} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Rides List */}
        <div className="space-y-3">
          {!isOnline ? (
            <div className="bg-gradient-to-br from-white/80 to-white/60 ios-blur rounded-[24px] p-16 text-center shadow-sm border border-white/50">
              <div className="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-10 h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12A9 9 0 015.636 5.636m12.728 12L5.636 5.636" />
                </svg>
              </div>
              <p className="text-[18px] font-bold text-neutral-900 mb-1.5">Você está offline</p>
              <p className="text-[15px] text-neutral-500 leading-relaxed">Ative o modo online para receber corridas</p>
            </div>
          ) : rides.length === 0 ? (
            <div className="bg-gradient-to-br from-white/80 to-white/60 ios-blur rounded-[24px] p-16 text-center shadow-sm border border-white/50">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-green-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-[18px] font-bold text-neutral-900 mb-1.5">Nenhuma corrida disponível</p>
              <p className="text-[15px] text-neutral-500 leading-relaxed">Aguardando novas solicitações...</p>
            </div>
          ) : (
            rides.map((ride, index) => {
              const isExpanded = expandedRide === ride.id
              return (
                <div
                  key={ride.id}
                  className="bg-gradient-to-br from-white/90 to-white/70 ios-blur rounded-[24px] p-5 shadow-sm border border-white/50 overflow-hidden relative animate-ios-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* New ride accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-[100px]" />
                  
                  {/* Passenger Info */}
                  <div className="flex items-center justify-between mb-4 relative">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-[18px] font-bold text-emerald-700">
                          {ride.passenger?.full_name?.[0] || 'P'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-neutral-900">{ride.passenger?.full_name || 'Passageiro'}</p>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-amber-500 fill-current" viewBox="0 0 20 20">
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                          <span className="text-[13px] font-semibold text-neutral-600">{ride.passenger?.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Vehicle type badge */}
                    <div className={cn(
                      "px-2.5 py-1.5 rounded-full flex items-center gap-1.5",
                      ride.vehicle_type === 'moto' ? "bg-orange-50" : "bg-blue-50"
                    )}>
                      <span className={cn("text-[11px] font-bold uppercase tracking-wide", ride.vehicle_type === 'moto' ? "text-orange-700" : "text-blue-700")}>
                        {getVehicleLabel(ride.vehicle_type || 'economy')}
                      </span>
                      {getVehicleIcon(ride.vehicle_type || 'economy')}
                    </div>
                  </div>

                  {/* Route Info */}
                  <div className="space-y-2.5 mb-4">
                    <div className="flex gap-3 items-start">
                      <div className="w-2 h-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Origem</p>
                        <p className="text-[15px] text-neutral-900 font-medium leading-relaxed">{ride.pickup_address}</p>
                      </div>
                    </div>
                    <div className="w-px h-3 bg-gradient-to-b from-neutral-200 to-transparent ml-[3px]" />
                    <div className="flex gap-3 items-start">
                      <div className="w-2 h-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Destino</p>
                        <p className="text-[15px] text-neutral-900 font-medium leading-relaxed">{ride.dropoff_address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Distance and Passenger Offer */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-neutral-50/80 rounded-[16px] p-3">
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Distância</p>
                      <p className="text-[18px] font-bold text-neutral-900">{ride.distance_km} km</p>
                    </div>
                    <div className="bg-emerald-50/80 rounded-[16px] p-3">
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Oferta</p>
                      <p className="text-[18px] font-bold bg-gradient-to-br from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        R$ {ride.passenger_price_offer?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Expand/Collapse for counter offer */}
                  {!isExpanded ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedRide(ride.id)}
                        className="h-12 rounded-[16px] bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[14px] font-bold ios-press shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Contra-oferta
                      </button>
                      <button
                        type="button"
                        disabled={accepting === ride.id}
                        onClick={() => handleAcceptRide(ride)}
                        className="h-12 rounded-[16px] bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[14px] font-bold ios-press shadow-sm hover:shadow-md transition-all disabled:opacity-70 flex items-center justify-center"
                      >
                        {accepting === ride.id ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Aceitar'
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-ios-fade-up">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-neutral-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Digite sua oferta"
                            value={offerPrice[ride.id] || ''}
                            onChange={(e) => setOfferPrice({ ...offerPrice, [ride.id]: e.target.value })}
                            className="w-full h-12 pl-10 pr-4 bg-white border-2 border-neutral-200 rounded-[16px] text-[16px] font-semibold text-neutral-900 focus:border-emerald-500 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedRide(null)
                            setOfferPrice({ ...offerPrice, [ride.id]: '' })
                          }}
                          className="h-11 rounded-[14px] bg-neutral-100 text-neutral-700 text-[14px] font-bold ios-press transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleMakeOffer(ride.id)
                            setExpandedRide(null)
                          }}
                          className="h-11 rounded-[14px] bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[14px] font-bold ios-press shadow-sm hover:shadow-md transition-all"
                        >
                          Enviar Oferta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>

      <BottomNavigation />
    </div>
  )
}
