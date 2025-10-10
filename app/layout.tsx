import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Browser Comments',
  description: 'Annotate and capture web pages',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
