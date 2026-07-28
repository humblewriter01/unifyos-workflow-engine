import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '../contexts/ThemeContext'
import { SessionProvider } from 'next-auth/react'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <Component {...pageProps} />
      </ThemeProvider>
    </SessionProvider>
  )
}

// Location: apps/frontend/pages/_app.tsx
