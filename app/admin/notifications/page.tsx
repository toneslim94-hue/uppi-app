'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminHeader } from '@/components/admin/admin-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Send, Users, Car, Bell, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Profile {
  id: string
  full_name: string
  phone: string
  avatar_url: string | null
  user_type: string
}

type Target = 'user' | 'all_passengers' | 'all_drivers' | 'everyone'

const TARGETS = [
  { key: 'user' as Target,           icon: Search,  label: 'Usuário específico',  desc: 'Escolha uma pessoa' },
  { key: 'all_passengers' as Target, icon: Users,   label: 'Todos passageiros',   desc: 'Envia para todos' },
  { key: 'all_drivers' as Target,    icon: Car,     label: 'Todos motoristas',    desc: 'Envia para todos' },
  { key: 'everyone' as Target,       icon: Bell,    label: 'Broadcast geral',     desc: 'Toda a plataforma' },
]

const TEMPLATES = [
  { label: 'Motorista chegou',     title: 'Motorista chegou!',          body: 'Seu motorista está esperando no local.' },
  { label: 'Corrida aceita',       title: 'Corrida aceita!',            body: 'Um motorista aceitou sua corrida e está a caminho.' },
  { label: 'Promoção',             title: 'Promoção especial!',         body: 'Use o cupom UPPI10 e ganhe R$ 10 de desconto na próxima corrida.' },
  { label: 'Manutenção',           title: 'Aviso de manutenção',        body: 'O sistema ficará em manutenção das 02h às 04h. Obrigado pela compreensão.' },
  { label: 'Boas-vindas',          title: 'Bem-vindo à Uppi!',         body: 'Sua conta foi criada com sucesso. Aproveite nossas corridas!' },
]

export default function AdminNotificationsPage() {
  const [target, setTarget]         = useState<Target>('user')
  const [search, setSearch]         = useState('')
  const [users, setUsers]           = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [history, setHistory]       = useState<{ title: string; target: string; at: string }[]>([])

  const fetchUsers = useCallback(async () => {
    if (search.length < 2) { setUsers([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, user_type')
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(10)
    setUsers(data || [])
  }, [search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title)
    setBody(t.body)
    setResult(null)
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    if (target === 'user' && !selectedUser) return

    setSending(true)
    setResult(null)

    try {
      if (target === 'user' && selectedUser) {
        // Envia para usuário específico
        const res = await fetch('/api/v1/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.id, title, body }),
        })
        const json = await res.json()
        setResult({ ok: res.ok, msg: res.ok ? `Enviado para ${selectedUser.full_name} (${json.sent ?? 0} dispositivo(s))` : json.error })
      } else {
        // Broadcast
        const res = await fetch('/api/v1/push/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, title, body }),
        })
        const json = await res.json()
        setResult({ ok: res.ok, msg: res.ok ? `Enviado para ${json.sent ?? 0} dispositivo(s)` : json.error })
      }

      if (result?.ok !== false) {
        const targetLabel = TARGETS.find(t => t.key === target)?.label ?? target
        setHistory(prev => [{ title, target: targetLabel, at: new Date().toLocaleTimeString('pt-BR') }, ...prev.slice(0, 9)])
        setTitle('')
        setBody('')
      }
    } catch {
      setResult({ ok: false, msg: 'Erro de conexão' })
    } finally {
      setSending(false)
    }
  }

  const canSend = title.trim() && body.trim() && (target !== 'user' || selectedUser) && !sending

  return (
    <>
      <AdminHeader title="Notificações Push" subtitle="Envie mensagens para usuários da plataforma" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Destino */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold">1. Quem vai receber?</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TARGETS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setTarget(t.key); setSelectedUser(null); setResult(null) }}
                  className={cn(
                    'flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all',
                    target === t.key
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-border/50 bg-card hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <t.icon className="w-5 h-5" />
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">{t.label}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </CardContent>

            {/* Busca de usuario especifico */}
            {target === 'user' && (
              <CardContent className="pt-0 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedUser(null) }}
                    className="pl-9 h-10 bg-secondary border-0 rounded-xl text-[14px]"
                  />
                </div>
                {users.length > 0 && !selectedUser && (
                  <div className="border border-border/50 rounded-xl overflow-hidden divide-y divide-border/50">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUser(u); setUsers([]); setSearch(u.full_name) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/70 transition-colors text-left"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-blue-500/15 text-blue-500 font-bold">
                            {u.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{u.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.user_type === 'driver' ? 'Motorista' : 'Passageiro'} · {u.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-blue-500 text-white font-bold">
                        {selectedUser.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{selectedUser.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedUser.user_type === 'driver' ? 'Motorista' : 'Passageiro'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setSearch('') }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Mensagem */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-bold">2. Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Templates rapidos */}
              <div>
                <p className="text-[12px] text-muted-foreground font-medium mb-2">Templates rápidos</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-border text-[12px] font-medium text-foreground transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium mb-1.5 block">Título</label>
                  <Input
                    placeholder="Ex: Motorista chegou!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    className="h-10 bg-secondary border-0 rounded-xl text-[14px]"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">{title.length}/80</p>
                </div>
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium mb-1.5 block">Corpo da mensagem</label>
                  <Textarea
                    placeholder="Ex: Seu motorista está esperando no local."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={200}
                    rows={3}
                    className="bg-secondary border-0 rounded-xl text-[14px] resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">{body.length}/200</p>
                </div>
              </div>

              {/* Preview */}
              {(title || body) && (
                <div className="bg-secondary/60 rounded-xl p-4 border border-border/50">
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">Preview da notificação</p>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-foreground leading-tight">{title || 'Título...'}</p>
                      <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{body || 'Mensagem...'}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-1">Uppi · agora</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado */}
              {result && (
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium',
                  result.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                )}>
                  {result.ok
                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {result.msg}
                </div>
              )}

              {/* Botao enviar */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'w-full h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 transition-all',
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-secondary text-muted-foreground cursor-not-allowed'
                )}
              >
                {sending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-5 h-5" /> Enviar Notificação</>
                )}
              </button>
            </CardContent>
          </Card>

          {/* Historico */}
          {history.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px] font-bold">Enviados nesta sessão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{h.title}</p>
                      <p className="text-[11px] text-muted-foreground">{h.target} · {h.at}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
