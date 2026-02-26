'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Car,
  DollarSign,
  Radio,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Usuarios' },
  { href: '/admin/rides', icon: Car, label: 'Corridas' },
  { href: '/admin/financeiro', icon: DollarSign, label: 'Financeiro' },
  { href: '/admin/monitor', icon: Radio, label: 'Monitor Realtime' },
  { href: '/admin/notifications', icon: Bell, label: 'Notificações' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'h-screen flex flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold text-[hsl(var(--sidebar-foreground))] tracking-tight truncate">Uppi Admin</span>
              <span className="text-[11px] text-[hsl(var(--sidebar-foreground))]/50 font-medium">Painel de Controle</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        <div className={cn('mb-3 px-2', collapsed && 'px-0')}>
          {!collapsed && (
            <p className="text-[11px] font-semibold text-[hsl(var(--sidebar-foreground))]/40 uppercase tracking-wider mb-2">Menu</p>
          )}
        </div>
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-sm'
                  : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', active && 'text-[hsl(var(--sidebar-primary-foreground))]')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && (
                <Activity className="w-3 h-3 ml-auto animate-pulse text-emerald-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[hsl(var(--sidebar-foreground))]/50 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="w-5 h-5 shrink-0 mx-auto" /> : (
            <>
              <ChevronLeft className="w-5 h-5 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
        <Link
          href="/uppi/home"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[hsl(var(--sidebar-foreground))]/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sair do Admin</span>}
        </Link>
      </div>
    </aside>
  )
}
