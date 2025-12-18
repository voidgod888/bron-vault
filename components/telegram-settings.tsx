"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

export function TelegramSettings() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [step, setStep] = useState<"initial" | "code_sent">("initial")

  const [apiId, setApiId] = useState("")
  const [apiHash, setApiHash] = useState("")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [phoneCodeHash, setPhoneCodeHash] = useState("")

  const [channels, setChannels] = useState("")
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/telegram/auth/status")
      const data = await response.json()

      if (data.success) {
        setIsConnected(data.isConnected)
        setApiId(data.settings.apiId || "")
        setApiHash(data.settings.apiHash || "")
        setPhone(data.settings.phone || "")
        setChannels(data.settings.channels || "")
        setIsEnabled(data.settings.isEnabled || false)
      }
    } catch (error) {
      console.error("Failed to fetch telegram status", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!apiId || !apiHash || !phone) {
      toast.error("Please fill in all fields")
      return
    }

    setConnecting(true)
    try {
      const response = await fetch("/api/telegram/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId, apiHash, phone }),
      })

      const data = await response.json()

      if (data.success) {
        setPhoneCodeHash(data.phoneCodeHash)
        setStep("code_sent")
        toast.success("Verification code sent to your Telegram")
      } else {
        toast.error(data.error || "Failed to send code")
      }
    } catch (error) {
      toast.error("Connection error")
    } finally {
      setConnecting(false)
    }
  }

  const handleVerify = async () => {
    if (!code) {
      toast.error("Please enter the verification code")
      return
    }

    setConnecting(true)
    try {
      const response = await fetch("/api/telegram/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, phoneCodeHash }),
      })

      const data = await response.json()

      if (data.success) {
        setIsConnected(true)
        setStep("initial")
        toast.success("Successfully connected to Telegram")
      } else {
        toast.error(data.error || "Verification failed")
      }
    } catch (error) {
      toast.error("Verification error")
    } finally {
      setConnecting(false)
    }
  }

  const handleSaveSettings = async () => {
    setConnecting(true)
    try {
      const response = await fetch("/api/telegram/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, isEnabled }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Settings saved")
      } else {
        toast.error(data.error || "Failed to save settings")
      }
    } catch (error) {
      toast.error("Save error")
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Telegram Scraper</span>
          {isConnected ? (
            <span className="flex items-center text-green-500 text-sm font-normal">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Connected
            </span>
          ) : (
            <span className="flex items-center text-yellow-500 text-sm font-normal">
              <AlertCircle className="mr-2 h-4 w-4" /> Not Connected
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Automatically scrape stealer logs from Telegram channels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected && step === "initial" && (
          <div className="space-y-4 border p-4 rounded-md bg-muted/20">
            <h3 className="font-medium">Connection Setup</h3>
            <div className="grid gap-2">
              <Label htmlFor="apiId">API ID</Label>
              <Input
                id="apiId"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                placeholder="123456"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apiHash">API Hash</Label>
              <PasswordInput
                id="apiHash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />
              <p className="text-xs text-muted-foreground">Format: +1234567890</p>
            </div>
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        )}

        {!isConnected && step === "code_sent" && (
          <div className="space-y-4 border p-4 rounded-md bg-muted/20">
            <h3 className="font-medium">Verify Phone Number</h3>
            <p className="text-sm text-muted-foreground">We sent a code to your Telegram account.</p>
            <div className="grid gap-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("initial")} disabled={connecting}>
                Cancel
              </Button>
              <Button onClick={handleVerify} disabled={connecting} className="flex-1">
                {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
             <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
              <Label htmlFor="enabled">Enable Automatic Scraping</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="channels">Target Channels</Label>
              <Textarea
                id="channels"
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
                placeholder="channel_username_1, channel_username_2"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Enter channel usernames separated by commas.
              </p>
            </div>

            <Button onClick={handleSaveSettings} disabled={connecting}>
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
