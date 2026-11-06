import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  Server,
  GitCompare,
  Cpu,
  FileSearch,
  Settings,
  Layers,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface SidebarNavProps {
  onItemClick?: () => void
  ollamaOnline?: boolean
  cloudConfiguredCount?: number
}

export function SidebarNav({
  onItemClick,
  ollamaOnline = true,
  cloudConfiguredCount = 2,
}: SidebarNavProps) {
  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/playground',
      label: 'Playground',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      to: '/providers',
      label: 'Providers',
      icon: Server,
      badge: `${cloudConfiguredCount} Ready`,
    },
    {
      to: '/comparison',
      label: 'Model Comparison',
      icon: GitCompare,
      badge: 'New',
    },
    {
      to: '/estimator',
      label: 'Resource Estimator',
      icon: Cpu,
      badge: 'Hardware',
    },
    {
      to: '/research',
      label: 'Research & Audit',
      icon: FileSearch,
      badge: '6 Tech',
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ]

  return (
    <div className="flex h-full flex-col justify-between">
      <ScrollArea className="flex-1">
        <div className="space-y-4 py-4">
          <div className="px-3 py-2">
            <div className="flex items-center gap-3 px-3 py-1 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                  Model Gateway
                  <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Unified AI Abstraction
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Core Platform
              </div>
              {navItems.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onItemClick}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors select-none',
                        isActive
                          ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 border-muted-foreground/30 font-normal bg-background/50"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>
      </ScrollArea>

      <Separator className="bg-border/60" />

      {/* Runtime Quick Status Footer */}
      <div className="p-3 m-2 rounded-lg bg-muted/30">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Runtime Nodes
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Google Gemini</span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Ollama Daemon</span>
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                ollamaOnline ? 'text-emerald-400' : 'text-zinc-500'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  ollamaOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                )}
              />
              {ollamaOnline ? ':11434 Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

