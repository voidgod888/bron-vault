"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, RefreshCw, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState({ isConfigured: false, isAuthenticated: false, phone: "" })

  // Auth Form State
  const [apiId, setApiId] = useState("")
  const [apiHash, setApiHash] = useState("")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState(1) // 1: Config, 2: Code
  const [authLoading, setAuthLoading] = useState(false)

  // Add Source Form State
  const [newSourceName, setNewSourceName] = useState("")
  const [newSourceId, setNewSourceId] = useState("")

  useEffect(() => {
    fetchSources()
    fetchConfig()
  }, [])

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources")
      const data = await res.json()
      if (data.sources) setSources(data.sources)
    } catch (error) {
      toast.error("Failed to load sources")
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/telegram/auth")
      const data = await res.json()
      setConfig(data)
      if (data.isConfigured && !data.isAuthenticated) {
          setPhone(data.phone)
          setStep(1) // Still need to re-enter API ID/Hash for security or just re-request code
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleRequestCode = async () => {
    setAuthLoading(true)
    try {
      const res = await fetch("/api/telegram/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config", apiId, apiHash, phone }),
      })
      const data = await res.json()
      if (data.success) {
        setStep(2)
        toast.success("Code sent to your Telegram app")
      } else {
        toast.error(data.error || "Failed to send code")
      }
    } catch (error) {
      toast.error("Error requesting code")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    setAuthLoading(true)
    try {
      const res = await fetch("/api/telegram/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", code }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Connected successfully!")
        fetchConfig()
        setStep(1)
        setCode("")
      } else {
        toast.error(data.error || "Verification failed")
      }
    } catch (error) {
      toast.error("Error verifying code")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAddSource = async () => {
    if (!newSourceName || !newSourceId) return
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSourceName, identifier: newSourceId }),
      })
      if (res.ok) {
        toast.success("Source added")
        setNewSourceName("")
        setNewSourceId("")
        fetchSources()
      } else {
        toast.error("Failed to add source")
      }
    } catch (error) {
      toast.error("Error adding source")
    }
  }

  const handleDeleteSource = async (id: number) => {
    if (!confirm("Are you sure?")) return
    try {
      await fetch(`/api/sources/${id}`, { method: "DELETE" })
      toast.success("Source removed")
      fetchSources()
    } catch (error) {
      toast.error("Error removing source")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Data Sources</h1>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Telegram Connection
            {config.isAuthenticated ? (
              <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1"/> Connected</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Disconnected</Badge>
            )}
          </CardTitle>
          <CardDescription>Configure your Telegram account to scrape channels.</CardDescription>
        </CardHeader>
        <CardContent>
          {!config.isAuthenticated ? (
            <div className="space-y-4 max-w-md">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label>API ID</Label>
                    <Input value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="123456" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Hash</Label>
                    <Input value={apiHash} onChange={(e) => setApiHash(e.target.value)} type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" />
                  </div>
                  <Button onClick={handleRequestCode} disabled={authLoading}>
                    {authLoading ? "Sending..." : "Request Code"}
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" />
                  </div>
                  <Button onClick={handleVerifyCode} disabled={authLoading}>
                    {authLoading ? "Verifying..." : "Connect"}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                </>
              )}
            </div>
          ) : (
             <div className="flex items-center gap-4">
                 <p className="text-sm text-muted-foreground">Connected as {config.phone}</p>
                 <Button variant="outline" size="sm" onClick={() => setConfig({...config, isAuthenticated: false})}>Reconnect</Button>
             </div>
          )}
        </CardContent>
      </Card>

      {/* Sources Management */}
      <Card>
        <CardHeader>
          <CardTitle>Monitored Channels</CardTitle>
          <CardDescription>Manage Telegram channels to scrape.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6 items-end">
            <div className="space-y-2 flex-1">
              <Label>Channel Name</Label>
              <Input value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="e.g. Stealer Logs" />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Channel Username/ID</Label>
              <Input value={newSourceId} onChange={(e) => setNewSourceId(e.target.value)} placeholder="e.g. stealer_logs_channel" />
            </div>
            <Button onClick={handleAddSource}><Plus className="w-4 h-4 mr-2"/> Add Channel</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Scraped</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>{source.identifier}</TableCell>
                  <TableCell>
                    <Badge variant={source.enabled ? "default" : "secondary"}>
                      {source.enabled ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell>{source.last_scraped_at ? new Date(source.last_scraped_at).toLocaleString() : "Never"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSource(source.id)}
                      aria-label={`Delete source ${source.name}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No channels added yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
