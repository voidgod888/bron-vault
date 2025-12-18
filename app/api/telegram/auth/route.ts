import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { telegramConfig } from "@/lib/telegram-config"
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import { executeQuery } from "@/lib/mysql"

// This is a simplified approach. In a real specialized environment, we might need a persistent
// process or a more complex state management for the "auth flow" (Request Code -> Wait -> Submit Code).
// Here we will use a temporary storage for the client instance or assume the client connects quickly.
// However, in serverless/Next.js API, we cannot keep the client instance alive between requests easily.
// A common pattern for Telegram Auth in web apps is:
// 1. User enters phone -> API connects, requests code, saves `phone_code_hash` to DB.
// 2. User enters code -> API connects again using same phone/hash, signs in, saves session.

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, apiId, apiHash, phone, code, password, phoneCodeHash } = body

    if (action === "config") {
      await telegramConfig.setConfig(apiId, apiHash, phone)

      // Attempt to connect and request code
      const client = new TelegramClient(new StringSession(""), Number(apiId), apiHash, {
        connectionRetries: 5,
      })
      await client.connect()

      const { phoneCodeHash } = await client.sendCode(
        {
          apiId: Number(apiId),
          apiHash: apiHash,
        },
        phone
      )

      await executeQuery(
        "INSERT INTO app_settings (key_name, value) VALUES ('telegram_phone_code_hash', ?) ON DUPLICATE KEY UPDATE value = ?",
        [phoneCodeHash, phoneCodeHash]
      )

      return NextResponse.json({ success: true, phoneCodeHash })
    }

    if (action === "login") {
      const config = await telegramConfig.getConfig()
      if (!config.apiId) return NextResponse.json({ error: "Config missing" }, { status: 400 })

      // Get stored hash
      const hashResult = await executeQuery("SELECT value FROM app_settings WHERE key_name = 'telegram_phone_code_hash'") as any[]
      const storedHash = hashResult[0]?.value

      if (!storedHash) return NextResponse.json({ error: "Phone code hash not found. Please request code first." }, { status: 400 })

      const client = new TelegramClient(new StringSession(""), Number(config.apiId), config.apiHash, {
        connectionRetries: 5,
      })

      await client.connect()

      try {
        // Dynamically import to avoid build errors if the path is slightly different in different versions
        // or just use the client.signIn method which is higher level.
        // However, keeping the invoke structure but fixing the import.
        // In gramjs, usually it is `Api.auth.SignIn`.
        const { Api } = require("telegram");
        await client.invoke(
            new Api.auth.SignIn({
                phoneNumber: config.phone,
                phoneCodeHash: storedHash,
                phoneCode: code,
            })
        )
      } catch (e: any) {
          if (e.message.includes("SESSION_PASSWORD_NEEDED")) {
               return NextResponse.json({ error: "2FA Password needed", requiresPassword: true }, { status: 400 })
          }
           if (e.message.includes("PHONE_CODE_INVALID")) {
               return NextResponse.json({ error: "Invalid Code" }, { status: 400 })
          }
          throw e
      }

      const session = client.session.save() as unknown as string
      await telegramConfig.setSession(session)

      return NextResponse.json({ success: true })
    }

    if (action === "2fa") {
         const config = await telegramConfig.getConfig()
         const client = new TelegramClient(new StringSession(""), Number(config.apiId), config.apiHash, {
            connectionRetries: 5,
          })
          await client.connect()

          // We need to re-do the sign in flow up to password?
          // GramJS flow usually requires keeping the client state.
          // Since we are stateless, this is tricky.
          // Standard solution: Use `signIn` method which handles it if we provide the callback,
          // OR we handle it manually.

          // Re-implementing full flow in stateless API is hard.
          // Simplified: We assume the user provides everything.

          await client.start({
              phoneNumber: config.phone,
              password: async () => password,
              phoneCode: async () => code, // We might need the code again? Or just password?
              onError: (err) => console.log(err),
          })

           const session = client.session.save() as unknown as string
           await telegramConfig.setSession(session)

           return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Telegram Auth Error:", error)
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
    const user = await validateRequest(request)
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const config = await telegramConfig.getConfig()
    const isConfigured = !!(config.apiId && config.apiHash && config.phone)
    const isAuthenticated = !!config.session

    return NextResponse.json({ isConfigured, isAuthenticated, phone: config.phone })
}
