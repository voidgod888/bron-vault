'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Something went wrong!</h1>
            <p className="text-muted-foreground">
              We apologize for the inconvenience. An unexpected error occurred.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="p-4 mt-4 text-left bg-muted rounded-md overflow-auto max-h-48 text-xs">
                {error.message}
              </pre>
            )}
            <Button onClick={() => reset()}>Try again</Button>
          </div>
        </div>
      </body>
    </html>
  )
}
