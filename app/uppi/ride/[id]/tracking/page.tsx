'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { iosToast } from '@/lib/utils/ios-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Ride, Profile, DriverProfile } from '@/lib/types/database'
import { trackingService, type DriverLocation } from '@/lib/services/tracking-service'
import { notificationService } from '@/lib/services/notification-service'
import { GoogleMap, type GoogleMapHandle } from '@/components/google-map'
import { triggerHaptic } from '@/lib/utils/haptics'

export default function RideTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [ride, setRide] = useState<Ride | null>(null)
  const [driver, setDriver] = useState<Profile | null>(null)
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSafetyMenu, setShowSafetyMenu] = useState(false)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const mapRef = useRef<GoogleMapHandle>(null)
  const driverMarkerRef = useRef<any>(null)

  useEffect(() => {
    const loadData = async () => {
      // Load ride details
      const { data: rideData } = await supabase
        .from('rides')
        .select('*')
        .eq('id', params.id)
        .single()
      
      setRide(rideData)

      if (rideData?.driver_id) {
        // Load driver profile
        const { data: driverData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', rideData.driver_id)
          .single()
        
        setDriver(driverData)

        // Load driver vehicle info
        const { data: vehicleData } = await supabase
          .from('driver_profiles')
          .select('*')
          .eq('id', rideData.driver_id)
          .single()
        
        setDriverProfile(vehicleData)
      }

      setLoading(false)
    }

    loadData()

    // Subscribe to real-time tracking updates
    const unsubscribe = trackingService.subscribeToRideUpdates(
      params.id as string,
      (update) => {
        console.log('[v0] Tracking update:', update)
        
        if (update.status) {
          setRide(prev => prev ? { ...prev, status: update.status } : null)
          
          // Show notifications
          if (update.status === 'driver_arriving') {
            iosToast.success('Motorista a caminho!')
            triggerHaptic('medium')
          } else if (update.status === 'arrived') {
            iosToast.success('Motorista chegou!')
            triggerHaptic('heavy')
          } else if (update.status === 'in_progress') {
            iosToast.info('Corrida iniciada')
          } else if (update.status === 'completed') {
            iosToast.success('Corrida finalizada!')
            router.push(`/uppi/ride/${params.id}/review`)
          }
        }
        
        if (update.driver_location) {
          setDriverLocation(update.driver_location)
          updateDriverMarker(update.driver_location)
        }
        
        if (update.eta_minutes !== undefined) {
          setEta(update.eta_minutes)
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [params.id, router])

  const updateDriverMarker = (location: DriverLocation) => {
    const map = mapRef.current?.getMapInstance()
    if (!map || !window.google) return

    const position = { lat: location.lat, lng: location.lng }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        position,
        map,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          rotation: location.heading,
        },
        title: 'Motorista',
      })
    } else {
      driverMarkerRef.current.setPosition(position)
      const icon = driverMarkerRef.current.getIcon()
      if (icon && typeof icon === 'object') {
        icon.rotation = location.heading
        driverMarkerRef.current.setIcon(icon)
      }
    }

    map.panTo(position)
  }

  const handleStartRide = async () => {
    const result = await trackingService.updateRideStatus(params.id as string, 'in_progress')
    if (result.success) {
      iosToast.success('Corrida iniciada')
    }
  }

  const handleShareLocation = async () => {
    setSharingLocation(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      })
      const link = `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`
      if (navigator.share) {
        await navigator.share({
          title: 'Minha localizacao - Uppi',
          text: `Estou em uma corrida. Acompanhe: ${ride?.pickup_address} -> ${ride?.dropoff_address}`,
          url: link,
        })
      } else {
        await navigator.clipboard.writeText(link)
        iosToast.success('Link copiado')
      }
    } catch (error) {
      console.error('Error sharing location:', error)
    } finally {
      setSharingLocation(false)
    }
  }

  const handleCompleteRide = async () => {
    const result = await trackingService.updateRideStatus(params.id as string, 'completed')
    if (result.success) {
      iosToast.success('Corrida finalizada!')
      router.push(`/uppi/ride/${params.id}/review`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-blue-600 text-lg">Carregando...</div>
      </div>
    )
  }

  const getStatusText = () => {
    switch (ride?.status) {
      case 'accepted':
        return 'Motorista a caminho'
      case 'in_progress':
        return 'Em viagem'
      case 'completed':
        return 'Corrida finalizada'
      default:
        return 'Aguardando'
    }
  }

  const getStatusColor = () => {
    switch (ride?.status) {
      case 'accepted':
        return 'bg-yellow-500'
      case 'in_progress':
        return 'bg-green-500'
      case 'completed':
        return 'bg-blue-600'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-blue-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-blue-900 text-center">{getStatusText()}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Status Badge */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className={`${getStatusColor()} text-white px-6 py-2 rounded-full font-semibold flex items-center gap-2`}>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            {getStatusText()}
          </div>
          {eta !== null && (
            <div className="text-2xl font-bold text-blue-900">
              {eta} min
            </div>
          )}
        </div>

        {/* Real-time Map */}
        <Card className="mb-6 h-96 bg-blue-50 border-blue-200 overflow-hidden">
          <GoogleMap
            ref={mapRef}
            center={
              driverLocation
                ? { lat: driverLocation.lat, lng: driverLocation.lng }
                : ride?.pickup_lat && ride?.pickup_lng
                ? { lat: ride.pickup_lat, lng: ride.pickup_lng }
                : undefined
            }
            zoom={15}
          />
        </Card>

        {/* Driver Info */}
        {driver && (
          <Card className="p-6 bg-white border-blue-200 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-20 h-20 border-2 border-blue-200">
                <AvatarImage src={driver.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl font-bold">
                  {driver.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-900">{driver.full_name}</h3>
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                    <span className="font-semibold text-lg">{driver.rating.toFixed(1)}</span>
                  </div>
                  <span>•</span>
                  <span>{driver.total_rides} corridas</span>
                </div>
              </div>
              <Button size="icon" className="bg-green-500 hover:bg-green-600 rounded-full w-14 h-14">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </Button>
            </div>
            {driverProfile && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Veículo</p>
                    <p className="text-sm text-blue-900 font-semibold">
                      {driverProfile.vehicle_brand} {driverProfile.vehicle_model}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Cor</p>
                    <p className="text-sm text-blue-900 font-semibold">{driverProfile.vehicle_color}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Placa</p>
                    <p className="text-sm text-blue-900 font-semibold font-mono uppercase">{driverProfile.vehicle_plate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Tipo</p>
                    <p className="text-sm text-blue-900 font-semibold capitalize">{driverProfile.vehicle_type}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Trip Details */}
        <Card className="p-6 bg-white border-blue-200 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Detalhes da Viagem</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div className="w-0.5 h-12 bg-blue-300"></div>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">Origem</p>
                  <p className="text-blue-900 font-semibold">{ride?.pickup_address}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">Destino</p>
                  <p className="text-blue-900 font-semibold">{ride?.dropoff_address}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4 border-t border-blue-100">
              <div>
                <p className="text-sm text-blue-600">Distância</p>
                <p className="text-lg font-bold text-blue-900">{ride?.distance_km} km</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Valor</p>
                <p className="text-lg font-bold text-green-600">R$ {ride?.final_price?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Pagamento</p>
                <p className="text-lg font-bold text-blue-900 capitalize">
                  {ride?.payment_method === 'cash' ? 'Dinheiro' : 
                   ride?.payment_method === 'pix' ? 'PIX' : 
                   ride?.payment_method === 'credit_card' ? 'Crédito' : 
                   ride?.payment_method}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons (for demo purposes) */}
        {ride?.status === 'accepted' && (
          <Button 
            onClick={handleStartRide}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
          >
            Iniciar Corrida
          </Button>
        )}

        {ride?.status === 'in_progress' && (
          <Button 
            onClick={handleCompleteRide}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg"
          >
            Finalizar Corrida
          </Button>
        )}
      </main>

      {/* Floating Safety Button */}
      {(ride?.status === 'accepted' || ride?.status === 'in_progress') && (
        <>
          {/* Safety menu overlay */}
          {showSafetyMenu && (
            <div className="fixed inset-0 z-40">
              <button
                type="button"
                onClick={() => setShowSafetyMenu(false)}
                className="absolute inset-0 bg-black/40 ios-blur"
                aria-label="Fechar menu"
              />
              <div className="absolute bottom-28 right-5 flex flex-col gap-2.5 animate-ios-fade-up z-50">
                {/* Share location */}
                <button
                  type="button"
                  onClick={() => { setShowSafetyMenu(false); handleShareLocation() }}
                  disabled={sharingLocation}
                  className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-xl ios-press"
                >
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-bold text-foreground">Compartilhar local</p>
                    <p className="text-[12px] text-muted-foreground">Envie para amigos/familia</p>
                  </div>
                </button>
                {/* Emergency contacts */}
                <button
                  type="button"
                  onClick={() => { setShowSafetyMenu(false); router.push('/uppi/emergency') }}
                  className="flex items-center gap-3 bg-red-500 rounded-2xl px-4 py-3 shadow-xl ios-press"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-bold text-white">SOS Emergencia</p>
                    <p className="text-[12px] text-white/75">Alertar contatos e policia</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* FAB */}
          <button
            type="button"
            onClick={() => setShowSafetyMenu(!showSafetyMenu)}
            className={`fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg ios-press transition-all duration-200 ${
              showSafetyMenu
                ? 'bg-foreground text-background rotate-45'
                : 'bg-red-500 text-white'
            }`}
            aria-label="Menu de seguranca"
          >
            {showSafetyMenu ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  )
}
