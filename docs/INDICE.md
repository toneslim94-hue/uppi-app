# UPPI - Indice Completo do Projeto

**Ultima atualizacao:** 24/02/2026  
**Versao:** 11.0  
**Arquitetura:** Frontend + Backend + Banco de Dados + API + Autenticacao + Servidor + Integracoes + Admin

---

## 1. Documentacao (docs/) — 15 documentos

```
docs/
  INDICE.md                                  <-- Voce esta aqui (mapa completo do projeto)
  AUDITORIA-PROJETO.md                       Auditoria completa: paginas, APIs, componentes, hooks
  CONFIGURACAO-COMPLETA.md                   Env vars, integrações, proximos passos
  VAPID-SETUP.md                             Setup Web Push (VAPID) para push notifications

  01-frontend/
    IMPLEMENTACAO.md                         Funcionalidades, componentes React, UX

  02-backend-api/
    API-ENDPOINTS.md                         56 route.ts, 92 handlers em /api/v1/ documentados,
                                             rate limiting, autenticacao, padrao de erros
    VERSIONAMENTO.md                         Padrão /api/v1/, middleware, headers de versão

  03-banco-de-dados/
    AUDITORIA-COMPLETA.md                    DOCUMENTO PRINCIPAL - 73 tabelas, 98+ RLS policies,
                                             45 RPC functions, 24 triggers, 60 indexes,
                                             scripts SQL, enums, variaveis de ambiente
    SCHEMA.md                                Schema real do Supabase (24/02/2026), tabelas,
                                             enums, campos, RPC functions, Realtime

  04-infraestrutura/
    GOOGLE-MAPS.md                           Setup, hooks, componentes, troubleshooting
    GOOGLE-MAPS-EXEMPLOS.md                  10 exemplos praticos: mapa, rota, autocomplete,
                                             motoristas proximos, heatmap, calculo de preco
    TESTE-REALTIME.md                        Guia de teste Supabase Realtime (passo a passo)

  05-status/
    STATUS-FUNCIONALIDADES.md                Checklist completo: pronto vs faltante por categoria

  06-deploy/
    PLAY-STORE.md                            Guia de publicacao (TWA/Capacitor/FCM)

  07-design/
    DESIGN-SYSTEM-IOS.md                     Design system iOS completo, tokens, animacoes
    BUTTONS-COMPONENTS.md                    Guia de botoes e componentes visuais
```

---

## 2. Codigo-Fonte - Estrutura Completa

### 2.1 Frontend - Paginas (app/)

```
app/
  page.tsx                                   Redirect para /auth/welcome
  layout.tsx                                 Layout raiz (PWA, meta, Inter font, Sentry)
  globals.css                                Design system iOS completo
  offline/page.tsx                           Pagina offline (PWA)

  auth/                                      Fluxo de autenticacao (9 paginas)
    welcome/page.tsx                         Tela inicial
    login/page.tsx                           Login passageiro
    sign-up/page.tsx                         Cadastro passageiro
    user-type/page.tsx                       Escolher: passageiro ou motorista
    callback/page.tsx                        OAuth callback Supabase
    driver/
      welcome/page.tsx                       Boas-vindas motorista
      login/page.tsx                         Login motorista
      sign-up/page.tsx                       Cadastro motorista

  uppi/                                      App principal (50+ paginas)
    layout.tsx                               Layout com BottomNavigation + SidebarMenu
    home/page.tsx                            Home com mapa, sugestoes IA, zonas quentes
    profile/page.tsx                         Perfil do usuario
    history/page.tsx                         Historico de corridas
    wallet/page.tsx                          Carteira digital
    payments/page.tsx                        Metodos de pagamento
    notifications/page.tsx                   Notificacoes
    settings/page.tsx                        Configuracoes
    settings/sms/page.tsx                    Config SMS
    settings/recording/page.tsx             Gravacao de audio
    favorites/page.tsx                       Enderecos favoritos
    favorites/add/page.tsx                   Adicionar favorito
    achievements/page.tsx                    Conquistas/badges
    analytics/page.tsx                       Estatisticas do usuario
    leaderboard/page.tsx                     Ranking
    social/page.tsx                          Feed social
    referral/page.tsx                        Indicacao de amigos
    promotions/page.tsx                      Promocoes e cupons
    club/page.tsx                            Clube de assinatura
    help/page.tsx                            Ajuda
    suporte/page.tsx                         Suporte
    suporte/chat/page.tsx                    Chat de suporte
    seguranca/page.tsx                       Seguranca
    emergency/page.tsx                       Emergencia
    emergency-contacts/page.tsx              Contatos de emergencia
    tracking/page.tsx                        Rastreamento GPS
    entregas/page.tsx                        Entregas
    cidade-a-cidade/page.tsx                 Viagens intermunicipais
    legal/terms/page.tsx                     Termos de uso
    legal/privacy/page.tsx                   Politica de privacidade

    ride/                                    Fluxo de corrida
      route-input/page.tsx                   Entrada de rota (multi-paradas)
      select/page.tsx                        Selecionar tipo de veiculo
      route-alternatives/page.tsx            Rotas alternativas
      searching/page.tsx                     Buscando motoristas
      schedule/page.tsx                      Agendar corrida
      group/page.tsx                         Corrida em grupo
      [id]/tracking/page.tsx                 Rastreamento da corrida
      [id]/chat/page.tsx                     Chat com motorista
      [id]/offers/page.tsx                   Leilao de preco (realtime)
      [id]/details/page.tsx                  Detalhes da corrida
      [id]/review/page.tsx                   Avaliacao
      [id]/review-enhanced/page.tsx          Avaliacao avancada

    request-ride/page.tsx                    Solicitar corrida
    driver-mode/page.tsx                     Modo motorista ativo

    driver/                                  Area do motorista
      page.tsx                               Painel do motorista
      register/page.tsx                      Cadastro de motorista
      documents/page.tsx                     Upload de documentos
      verify/page.tsx                        Verificacao facial
      earnings/page.tsx                      Ganhos e analytics

  admin/                                     Painel administrativo (7 paginas)
    layout.tsx                               Layout admin (sidebar + header, auth via is_admin)
    page.tsx                                 Dashboard com KPIs em tempo real
    users/page.tsx                           Gerenciar usuarios
    rides/page.tsx                           Gerenciar corridas
    financeiro/page.tsx                      Financeiro
    analytics/page.tsx                       Analytics avancado (5 RPCs)
    monitor/page.tsx                         Monitor realtime (mapa)
    webhooks/page.tsx                        Webhooks
```

### 2.2 Backend - API Routes (app/api/v1/)

```
app/api/v1/
  health/route.ts                            Health check
  rides/route.ts                             CRUD de corridas
  rides/[id]/status/route.ts                 Atualizar status
  rides/[id]/cancel/route.ts                 Cancelar corrida
  offers/route.ts                            Ofertas de preco
  offers/[id]/accept/route.ts                Aceitar oferta
  profile/route.ts                           Perfil do usuario
  ratings/route.ts                           Avaliacoes simples
  reviews/route.ts                           Reviews detalhadas
  reviews/enhanced/route.ts                  Avaliacao com categorias e tags
  reviews/driver/route.ts                    Review bidirecional motorista->passageiro
  notifications/route.ts                     Notificacoes
  messages/route.ts                          Mensagens/chat
  wallet/route.ts                            Carteira
  favorites/route.ts                         Favoritos
  coupons/route.ts                           Cupons
  referrals/route.ts                         Indicacoes
  achievements/route.ts                      Conquistas
  leaderboard/route.ts                       Ranking
  subscriptions/route.ts                     Assinaturas
  stats/route.ts                             Estatisticas
  emergency/route.ts                         Emergencia/SOS
  social/posts/route.ts                      Posts sociais
  social/posts/[id]/like/route.ts            Curtidas
  social/posts/[id]/comments/route.ts        Comentarios
  group-rides/route.ts                       Corridas em grupo
  group-rides/join/route.ts                  Entrar em grupo
  drivers/nearby/route.ts                    Motoristas proximos (PostGIS)
  drivers/hot-zones/route.ts                 Zonas quentes (PostGIS)
  driver/location/route.ts                   Localicao GPS motorista
  driver/documents/route.ts                  Documentos do motorista
  driver/verify/route.ts                     Verificacao do motorista
  distance/route.ts                          Calculo de distancia
  geocode/route.ts                           Geocodificacao
  places/autocomplete/route.ts               Autocomplete de enderecos
  places/details/route.ts                    Detalhes de local
  routes/alternatives/route.ts               Rotas alternativas
  sms/send/route.ts                          Envio de SMS
  sms/status/route.ts                        Webhook Twilio
  recordings/upload/route.ts                 Upload de gravacoes
  webhooks/route.ts                          Gerenciar webhooks
  webhooks/process/route.ts                  Processar entregas
  admin/setup/route.ts                       Setup inicial admin
  admin/create-first/route.ts                Criar primeiro admin
```

### 2.3 Componentes (components/)

```
components/
  Componentes de Negocio (custom, 48):
    bottom-navigation.tsx
    sidebar-menu.tsx
    google-map.tsx
    modern-map.tsx
    route-map.tsx
    map-fallback.tsx
    route-preview-3d.tsx
    places-search.tsx
    search-address.tsx
    nearby-drivers.tsx
    hot-zones-card.tsx
    location-tag.tsx
    referral-card.tsx
    referral-client.tsx
    facial-verification.tsx
    ride-audio-recorder.tsx
    voice-assistant-button.tsx
    ios-page-transition.tsx
    pull-to-refresh.tsx
    swipeable-list-item.tsx
    service-worker.tsx
    auto-theme.tsx
    theme-provider.tsx
    theme-toggle.tsx

  Componentes Admin:
    admin/admin-header.tsx
    admin/admin-sidebar.tsx

  Componentes UI (54 shadcn + 31 iOS = 85 em /components/ui/):
    ui/accordion.tsx ... ui/tooltip.tsx
    ui/confetti.tsx
    ui/expandable-tabs.tsx
    ui/ios-skeleton.tsx
    ui/location-tag.tsx
    ui/morphing-spinner.tsx
```

### 2.4 Hooks Customizados (hooks/)

```
hooks/
  use-auth.ts                                Sessao Supabase e perfil do usuario
  use-fcm.ts                                 Firebase Cloud Messaging (push notifications)
  use-geolocation.ts                         Geolocalizacao do dispositivo
  use-google-maps.ts                         Localizacao + Google Maps loader
  use-haptic.ts                              Feedback haptico (vibrate API, 7 padroes)
  use-mobile.tsx                             Detectar dispositivo mobile (breakpoint 768px)
  use-places-autocomplete.ts                 Autocomplete Google Places
  use-pull-to-refresh.ts                     Pull to refresh nativo
  use-swipe.ts                               Gestos de swipe
  use-swipe-actions.ts                       Acoes de swipe em lista
  use-toast.ts                               Sistema de toast (shadcn)
  use-voice-assistant.ts                     Assistente de voz (Speech Recognition, pt-BR)
```

### 2.5 Bibliotecas e Utilidades (lib/)

```
lib/
  utils.ts                                   cn() - merge de classes Tailwind
  admin-auth.ts                              Autenticacao admin (requireAdmin)

  supabase/
    client.ts                                Cliente browser (createBrowserClient)
    server.ts                                Cliente server (createServerClient)
    proxy.ts                                 Middleware de sessao (updateSession)

  google-maps/
    provider.tsx                             GoogleMapsProvider (APIProvider)
    utils.ts                                 Haversine, formatDistance, getCurrentLocation

  types/
    database.ts                              Todos os tipos TypeScript do dominio

  utils/
    ios-toast.ts                             iosToast - toasts com haptic feedback
    rate-limit.ts                            Rate limiter in-memory (3 niveis)
    ai-suggestions.ts                        Sugestoes IA de destinos, precos, insights
    ride-calculator.ts                       Calculos de preco e distancia (Haversine)
    fetch-retry.ts                           Retry com exponential backoff

  services/
    realtime-service.ts                      Wrapper Supabase Realtime
    ride-service.ts                          Logica de corridas
    tracking-service.ts                      Rastreamento GPS
    auth-service.ts                          Autenticacao e perfil
    chat-service.ts                          Mensagens
    payment-service.ts                       Pagamentos
    review-service.ts                        Avaliacoes
    notification-service.ts                  Notificacoes in-app
    storage-service.ts                       Upload de arquivos

  api/
    config.ts                                Config de versionamento
    version-middleware.ts                    Middleware de versao

  helpers/
    notifications.ts                         sendNotification, notifyNewOffer, etc.
```

### 2.6 Middleware e Configuracao

```
middleware.ts                                Supabase session + route protection
components.json                              Config shadcn/ui
next.config.mjs                              Next.js 16 config (Sentry, env vars)
package.json                                 Dependencias completas
```

---

## 3. Mapeamento: Camada -> Codigo + Docs

| Camada              | Codigo                              | Documentacao                                |
|---------------------|-------------------------------------|---------------------------------------------|
| Frontend / Paginas  | app/uppi/** + app/auth/**           | docs/01-frontend/IMPLEMENTACAO.md           |
| Backend / API       | app/api/v1/**                       | docs/02-backend-api/API-ENDPOINTS.md        |
| Banco de Dados      | Supabase (externo)                  | docs/03-banco-de-dados/AUDITORIA-COMPLETA.md|
| Schema do Banco     | Supabase (externo)                  | docs/03-banco-de-dados/SCHEMA.md            |
| Componentes         | components/**                       | docs/01-frontend/IMPLEMENTACAO.md           |
| Hooks               | hooks/**                            | docs/AUDITORIA-PROJETO.md                   |
| Lib / Utilidades    | lib/**                              | docs/AUDITORIA-PROJETO.md                   |
| Autenticacao        | middleware.ts + lib/supabase/       | docs/AUDITORIA-PROJETO.md                   |
| Google Maps         | lib/google-maps/** + hooks/         | docs/04-infraestrutura/GOOGLE-MAPS.md       |
| Realtime            | lib/services/realtime-service.ts    | docs/04-infraestrutura/TESTE-REALTIME.md    |
| Status              | -                                   | docs/05-status/STATUS-FUNCIONALIDADES.md    |
| Deploy              | -                                   | docs/06-deploy/PLAY-STORE.md                |

---

## 4. Tech Stack Completa

| Tecnologia           | Uso                                        | Versao    |
|----------------------|--------------------------------------------|-----------|
| Next.js              | Framework fullstack (App Router)           | 16.0.7    |
| React                | UI library                                 | 19        |
| TypeScript           | Tipagem estatica                           | 5.7.3     |
| Tailwind CSS         | Estilos utilitarios                        | 3.4.17    |
| shadcn/ui            | 76 componentes UI (52 base + 22 ios + extras)  | latest    |
| Supabase             | Auth + PostgreSQL + Realtime + Storage     | 2.47.x    |
| Google Maps          | Mapas, rotas, geocoding, places            | latest    |
| Web Push (VAPID)     | Push notifications (sem Firebase)          | web-push 3.x |
| Framer Motion        | Animacoes                                  | 11.x      |
| Recharts             | Graficos                                   | 2.15.0    |
| Sonner               | Notificacoes toast                         | 1.7.1     |
| Lucide React         | Icones                                     | latest    |
| Zod                  | Validacao de dados                         | 3.24      |
| React Hook Form      | Formularios                                | 7.54      |
| date-fns             | Formatacao de datas                        | latest    |
| Sentry               | Monitoramento de erros                     | 9.x       |
| Vercel Analytics     | Analytics de uso                           | 1.3.1     |
| canvas-confetti      | Animacao de confete                        | 1.9       |

---

## 5. Banco de Dados - Resumo (SQL 24/02/2026)

| Categoria           | Quantidade |
|---------------------|-----------|
| Tabelas             | 73        |
| RLS Policies        | 98+       |
| RPC Functions       | 45+       |
| Triggers            | 24+       |
| Indexes             | 60+       |
| Enums               | 6         |
| Realtime (tabelas)  | 4         |

**Realtime ativo em:** rides, price_offers, messages, notifications

**PostGIS ativo em:** driver_profiles (localizacao GPS), rides (pickup/dropoff)

---

**Ultima atualizacao:** 24/02/2026
