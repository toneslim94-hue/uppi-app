import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiLimiter } from '@/lib/utils/rate-limit'

/**
 * PATCH /api/v1/driver/location
 * Atualiza a localizacao GPS do motorista em tempo real durante uma corrida.
 * Grava na tabela driver_locations — Supabase Realtime propaga ao passageiro.
 */
export async function PATCH(request: Request) {
  try {
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
    const { success } = await apiLimiter.check(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { latitude, longitude, heading, speed, accuracy, ride_id } = body

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'latitude e longitude sao obrigatorios' },
        { status: 400 }
      )
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordenadas invalidas' }, { status: 400 })
    }

    // Upsert na tabela driver_locations (UNIQUE driver_id)
    // O Supabase Realtime propaga o UPDATE ao passageiro automaticamente
    const { error } = await supabase
      .from('driver_locations')
      .upsert(
        {
          driver_id: user.id,
          ride_id: ride_id || null,
          lat: latitude,
          lng: longitude,
          heading: heading ?? 0,
          speed: speed ?? 0,
          accuracy: accuracy ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Atualizar also driver_profiles para manter compatibilidade
    await supabase
      .from('driver_profiles')
      .update({
        current_lat: latitude,
        current_lng: longitude,
      })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      updated_at: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/v1/driver/location
 * Retorna a localizacao atual do motorista.
 */
export async function GET(request: Request) {
  try {
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
    const { success } = await apiLimiter.check(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const driver_id = searchParams.get('driver_id') || user.id

    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driver_id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({
      driver_id: data.driver_id,
      location: { latitude: data.lat, longitude: data.lng },
      heading: data.heading,
      speed: data.speed,
      ride_id: data.ride_id,
      updated_at: data.updated_at,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
