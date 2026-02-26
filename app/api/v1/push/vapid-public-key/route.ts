import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/v1/push/vapid-public-key — retorna a chave publica VAPID para o frontend
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID_PUBLIC_KEY nao configurada no servidor' },
      { status: 500 }
    )
  }

  return NextResponse.json({ publicKey })
}
