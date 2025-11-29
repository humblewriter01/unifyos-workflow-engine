import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '../contexts/ThemeContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

// Location: apps/frontend/pages/_app.tsx
