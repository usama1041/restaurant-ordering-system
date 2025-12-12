import './globals.css'

export const metadata = {
  title: 'Restaurant AI Phone Ordering',
  description: 'AI-powered restaurant ordering system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
