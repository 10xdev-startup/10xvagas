import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/useAuth'

export const metadata: Metadata = {
  title: '10xVagas',
  description: 'Radar inteligente de oportunidades profissionais',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const theme=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',theme!=='light')}catch{document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
