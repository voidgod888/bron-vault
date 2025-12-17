import { TelegramClient } from "telegram";

// Temporary storage for clients during auth flow
export const authClients = new Map<string, TelegramClient>();
