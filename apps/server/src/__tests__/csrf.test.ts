import { describe, it, expect, vi } from 'vitest';

// Mock auth and jwt modules used by csrf middleware
vi.mock('../middleware/auth.js', () => ({
  resolveApiKeyUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/jwt.js', () => ({
  verifyToken: vi.fn().mockReturnValue(null),
}));

import { resolveApiKeyUser } from '../middleware/auth.js';
import { verifyToken } from '../lib/jwt.js';
import { csrfTokenSetter, csrfProtection } from '../middleware/csrf.js';

function mockReq(overrides: Partial<any> = {}) {
  return { cookies: {}, headers: {}, method: 'GET', ...overrides } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  return res;
}

describe('CSRF Protection', () => {
  describe('csrfTokenSetter', () => {
    it('should set CSRF cookie if not present', () => {
      const req = mockReq({ cookies: {} });
      const res = mockRes();
      const next = vi.fn();

      csrfTokenSetter(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith(
        'moltblox_csrf',
        expect.any(String),
        expect.objectContaining({ httpOnly: false, sameSite: 'lax' }),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not overwrite existing CSRF cookie', () => {
      const req = mockReq({ cookies: { moltblox_csrf: 'existing-token' } });
      const res = mockRes();
      const next = vi.fn();

      csrfTokenSetter(req, res, next);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('csrfProtection', () => {
    it('should allow GET requests without token', async () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow HEAD requests without token', async () => {
      const req = mockReq({ method: 'HEAD' });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST without CSRF token', async () => {
      const req = mockReq({ method: 'POST' });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow POST with matching CSRF tokens', async () => {
      const token = 'valid-csrf-token';
      const req = mockReq({
        method: 'POST',
        cookies: { moltblox_csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST with mismatched CSRF tokens', async () => {
      const req = mockReq({
        method: 'POST',
        cookies: { moltblox_csrf: 'token-a' },
        headers: { 'x-csrf-token': 'token-b' },
      });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should skip CSRF for valid API key requests', async () => {
      // Mock resolveApiKeyUser to return a valid user for this test
      vi.mocked(resolveApiKeyUser).mockResolvedValueOnce({ id: 'user-1', role: 'human' } as any);
      const req = mockReq({
        method: 'POST',
        headers: { 'x-api-key': 'valid-api-key' },
      });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should NOT skip CSRF for invalid API key requests', async () => {
      vi.mocked(resolveApiKeyUser).mockResolvedValueOnce(null);
      const req = mockReq({
        method: 'POST',
        headers: { 'x-api-key': 'invalid-api-key' },
      });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block DELETE without CSRF token', async () => {
      const req = mockReq({ method: 'DELETE' });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block PUT without CSRF token', async () => {
      const req = mockReq({ method: 'PUT' });
      const res = mockRes();
      const next = vi.fn();

      await csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
