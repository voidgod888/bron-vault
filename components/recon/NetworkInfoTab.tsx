"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Server, Shield, Globe, Clock, AlertTriangle, CheckCircle, Activity, Lock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface NetworkInfoTabProps {
  domain: string
}

interface ScanData {
  ip_address: string | null
  ports: number[]
  http_status: number | null
  http_title: string | null
  http_server: string | null
  ssl_issuer: string | null
  ssl_expiry: string | null
  scan_status: 'pending' | 'processing' | 'completed' | 'failed'
  scan_date: string
  error_message: string | null
}

export function NetworkInfoTab({ domain }: NetworkInfoTabProps) {
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/domain-recon/network-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain })
        })
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (error) {
        console.error("Failed to fetch network info", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [domain])

  if (loading) {
    return <NetworkInfoSkeleton />
  }

  if (!data) {
    return (
      <Card className="glass-card border-white/10">
        <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Activity className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Scan Data Available</h3>
          <p className="text-sm text-center max-w-sm mb-4">
            This domain hasn&apos;t been scanned yet or is queued for processing.
          </p>
          <Badge variant="outline" className="bg-white/5">Status: Pending</Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
      {/* Overview Card */}
      <Card className="glass-card border-white/10 md:col-span-2">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Network Overview
              </CardTitle>
              <CardDescription className="mt-1">
                Scan performed on {new Date(data.scan_date).toLocaleString()}
              </CardDescription>
            </div>
            <StatusBadge status={data.scan_status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">IP Address</span>
            <div className="flex items-center gap-2 font-mono text-sm">
              {data.ip_address || "N/A"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Web Server</span>
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-muted-foreground" />
              {data.http_server || "Unknown"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">HTTP Status</span>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={data.http_status === 200 ? "default" : "secondary"}>
                {data.http_status || "N/A"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Web Details Card */}
      <Card className="glass-card border-white/10 h-full">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Web Application
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-xs text-muted-foreground">Page Title</span>
            <p className="text-sm font-medium mt-1 p-2 bg-white/5 rounded border border-white/5 truncate">
              {data.http_title || "No title detected"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Open Ports</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {data.ports && data.ports.length > 0 ? (
                data.ports.map((port) => (
                  <Badge key={port} variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {port}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No open ports detected</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SSL Details Card */}
      <Card className="glass-card border-white/10 h-full">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-green-400" />
            SSL / TLS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Issuer</span>
            <p className="text-sm font-medium break-all">{data.ssl_issuer || "N/A"}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Expiry Date</span>
            <div className="flex items-center gap-2">
               <Clock className="h-3 w-3 text-muted-foreground" />
               <p className="text-sm">{data.ssl_expiry ? new Date(data.ssl_expiry).toLocaleDateString() : "N/A"}</p>
            </div>
          </div>
          {data.ssl_expiry && (
             <div className="pt-2">
               <SSLStatus expiry={data.ssl_expiry} />
             </div>
          )}
        </CardContent>
      </Card>

      {data.error_message && (
        <Card className="glass-card border-red-500/20 bg-red-500/5 md:col-span-2">
            <CardContent className="p-4 flex items-center gap-3 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">{data.error_message}</p>
            </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    processing: "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  }

  const icons = {
    completed: <CheckCircle className="h-3 w-3 mr-1" />,
    processing: <Activity className="h-3 w-3 mr-1" />,
    failed: <AlertTriangle className="h-3 w-3 mr-1" />,
    pending: <Clock className="h-3 w-3 mr-1" />,
  }

  return (
    <Badge variant="outline" className={styles[status as keyof typeof styles] || styles.pending}>
      {icons[status as keyof typeof icons]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function SSLStatus({ expiry }: { expiry: string }) {
    const daysLeft = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return <Badge variant="destructive">Expired</Badge>
    }
    if (daysLeft < 30) {
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">Expires soon ({daysLeft} days)</Badge>
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-500">Valid ({daysLeft} days left)</Badge>
}

function NetworkInfoSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <Skeleton className="h-40 w-full md:col-span-2" />
       <Skeleton className="h-48 w-full" />
       <Skeleton className="h-48 w-full" />
    </div>
  )
}
