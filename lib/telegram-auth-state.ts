import redis from "./redis";

// Temporary storage for clients during auth flow
// The key is the phone number
// The value is an object containing the phone code hash and the session string
interface AuthState {
  phoneCodeHash: string;
  sessionString: string;
}

const REDIS_PREFIX = "telegram_auth:";
const AUTH_TTL = 300; // 5 minutes

export const authState = {
  set: async (phone: string, data: AuthState) => {
    await redis.set(`${REDIS_PREFIX}${phone}`, JSON.stringify(data), {
      EX: AUTH_TTL,
    });
  },

  get: async (phone: string): Promise<AuthState | null> => {
    const data = await redis.get(`${REDIS_PREFIX}${phone}`);
    if (!data) return null;
    return JSON.parse(data);
  },

  delete: async (phone: string) => {
    await redis.del(`${REDIS_PREFIX}${phone}`);
  },
};
