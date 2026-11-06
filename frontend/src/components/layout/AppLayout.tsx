import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  Menu,
  Moon,
  Sun,
  Activity,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import { SidebarNav } from './SidebarNav'
import { useGateway } from '@/hooks/useGateway'

export function AppLayout() {
  const location = useLocation()
  const { hardware, configuredCount } = useGateway()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('model_gateway_theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
    localStorage.setItem('model_gateway_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Overview Dashboard'
      case '/playground':
        return 'Interactive AI Playground'
      case '/providers':
        return 'Provider Management'
      case '/comparison':
        return 'Model Capability Matrix'
      case '/estimator':
        return 'Local Model Hardware Estimator'
      case '/research':
        return 'Research & Technology Audit'
      case '/settings':
        return 'Gateway & Node Settings'
      default:
        return 'Model Gateway'
    }
  }

  const isOllamaOnline = hardware?.runtimes?.ollama?.online ?? true

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col fixed inset-y-0 left-0 border-r border-border bg-sidebar z-30">
        <SidebarNav
          ollamaOnline={isOllamaOnline}
          cloudConfiguredCount={configuredCount}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Nav Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r border-border">
                <SidebarNav
                  onItemClick={() => setMobileOpen(false)}
                  ollamaOnline={isOllamaOnline}
                  cloudConfiguredCount={configuredCount}
                />
              </SheetContent>
            </Sheet>

            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">

            {/* Local Host RAM Indicator */}
            {hardware?.ram && (
              <Badge
                variant="outline"
                className="hidden lg:flex text-[11px] font-mono border-border bg-card/60 gap-1.5"
              >
                <Terminal className="h-3 w-3 text-primary" />
                <span>{hardware.ram.available_gb} GB RAM Free</span>
              </Badge>
            )}

            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Notifications */}
      <Toaster />
    </div>
  )
}

