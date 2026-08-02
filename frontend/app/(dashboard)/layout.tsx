import AppSidebar from '@/components/AppSidebar'
import { DashboardHeader } from '@/components/DashboardHeader'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex flex-1 flex-col bg-background p-4 pt-5 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
