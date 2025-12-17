import { executeQuery } from "./mysql"

export interface TelegramConfig {
  apiId: string
  apiHash: string
  session: string
  phone: string
}

export const telegramConfig = {
  async getConfig(): Promise<TelegramConfig> {
    const settings = await executeQuery(
      "SELECT key_name, value FROM app_settings WHERE key_name IN ('telegram_api_id', 'telegram_api_hash', 'telegram_session', 'telegram_phone')"
    ) as Array<{ key_name: string, value: string }>

    const config: TelegramConfig = {
      apiId: "",
      apiHash: "",
      session: "",
      phone: "",
    }

    settings.forEach(setting => {
      if (setting.key_name === 'telegram_api_id') config.apiId = setting.value
      if (setting.key_name === 'telegram_api_hash') config.apiHash = setting.value
      if (setting.key_name === 'telegram_session') config.session = setting.value
      if (setting.key_name === 'telegram_phone') config.phone = setting.value
    })

    return config
  },

  async setConfig(apiId: string, apiHash: string, phone: string) {
    await executeQuery(
      "INSERT INTO app_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ['telegram_api_id', apiId, apiId]
    )
    await executeQuery(
      "INSERT INTO app_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ['telegram_api_hash', apiHash, apiHash]
    )
    await executeQuery(
      "INSERT INTO app_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ['telegram_phone', phone, phone]
    )
  },

  async setSession(session: string) {
    await executeQuery(
      "INSERT INTO app_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ['telegram_session', session, session]
    )
  }
}
