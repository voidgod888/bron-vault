import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authState } from './telegram-auth-state';
import redis from './redis';

// Mock redis
vi.mock('./redis', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    isOpen: true,
    connect: vi.fn(),
  }
}));

describe('telegram-auth-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set auth state in redis', async () => {
    const phone = '+1234567890';
    const data = {
      phoneCodeHash: 'hash123',
      sessionString: 'session123'
    };

    await authState.set(phone, data);

    expect(redis.set).toHaveBeenCalledWith(
      `telegram_auth:${phone}`,
      JSON.stringify(data),
      { EX: 300 }
    );
  });

  it('should get auth state from redis', async () => {
    const phone = '+1234567890';
    const data = {
      phoneCodeHash: 'hash123',
      sessionString: 'session123'
    };

    // Mock redis.get return value
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));

    const result = await authState.get(phone);

    expect(redis.get).toHaveBeenCalledWith(`telegram_auth:${phone}`);
    expect(result).toEqual(data);
  });

  it('should return null if auth state not found', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    const result = await authState.get('notfound');
    expect(result).toBeNull();
  });

  it('should delete auth state from redis', async () => {
    const phone = '+1234567890';
    await authState.delete(phone);
    expect(redis.del).toHaveBeenCalledWith(`telegram_auth:${phone}`);
  });
});
