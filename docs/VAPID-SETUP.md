# Web Push (VAPID) — Setup

**Status:** Implementado e operacional (sem Firebase)

---

## O que e VAPID?

VAPID (Voluntary Application Server Identification) e o padrao W3C para Web Push Notifications.
Funciona diretamente no navegador/PWA **sem dependencia de Firebase/FCM**.

## Arquivos Implementados

```
public/sw.js                              Service Worker — recebe o push e exibe notificacao
hooks/use-push-notifications.ts           Hook — solicita permissao e gerencia subscription
app/api/v1/push/
  vapid-public-key/route.ts              GET  — retorna chave publica para o browser
  subscribe/route.ts                      POST/DELETE — salva/remove subscription no Supabase
  send/route.ts                           POST — envia push para 1 usuario
  broadcast/route.ts                      POST — envia push para grupo (admin only)
scripts/generate-vapid-keys.js            Gerador de chaves VAPID
scripts/010-push-subscriptions.sql        Tabela push_subscriptions no Supabase
```

## Variaveis de Ambiente Necessarias

```env
VAPID_PUBLIC_KEY=seu_vapid_public_key
VAPID_PRIVATE_KEY=seu_vapid_private_key
VAPID_EMAIL=noreply@uppi.app
```

## Como Gerar as Chaves VAPID

```bash
node scripts/generate-vapid-keys.js
```

Isso exibira as chaves `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` para adicionar no `.env.local`.

## Como Funciona

1. **Browser solicita permissao** via `usePushNotifications().subscribe()`
2. **Hook busca a chave publica** em `GET /api/v1/push/vapid-public-key`
3. **Browser cria subscription** via `pushManager.subscribe()`
4. **Subscription salva no Supabase** em `POST /api/v1/push/subscribe` (tabela `push_subscriptions`)
5. **Servidor envia push** via `POST /api/v1/push/send` usando `web-push`
6. **Service Worker (`sw.js`) recebe** o evento `push` e exibe a notificacao nativa

## Banco de Dados

Tabela `push_subscriptions`:
- `user_id` — FK para profiles
- `endpoint` — URL unica do browser
- `p256dh` — chave de criptografia
- `auth` — secret de autenticacao
- `is_active` — false quando subscription expira (HTTP 410)

## Suporte em Plataformas

| Plataforma | Suporte |
|------------|---------|
| Android (Chrome/WebView) | Sim |
| PWA instalada (Play Store TWA) | Sim |
| iOS Safari 16.4+ | Sim |
| Desktop Chrome/Firefox/Edge | Sim |
| iOS Safari < 16.4 | Nao |

## Diferenca em relacao ao Firebase FCM

| | Firebase FCM | Web Push VAPID (atual) |
|---|---|---|
| Dependencias | firebase (10+ MB) | web-push (leve) |
| Env vars necessarias | 8 variaveis | 3 variaveis |
| Suporte iOS | Nao | Sim (16.4+) |
| Funciona offline | Sim | Sim |
| Custo | Gratis (com limites) | Gratis (sem limites) |
