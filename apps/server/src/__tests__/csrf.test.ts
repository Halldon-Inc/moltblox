import { describe, it, expect, vi } from 'vitest';
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
    it('should allow GET requests without token', () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow HEAD requests without token', () => {
      const req = mockReq({ method: 'HEAD' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST without CSRF token', () => {
      const req = mockReq({ method: 'POST' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow POST with matching CSRF tokens', () => {
      const token = 'valid-csrf-token';
      const req = mockReq({
        method: 'POST',
        cookies: { moltblox_csrf: token },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST with mismatched CSRF tokens', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { moltblox_csrf: 'token-a' },
        headers: { 'x-csrf-token': 'token-b' },
      });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should skip CSRF for API key requests', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'x-api-key': 'some-api-key' },
      });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block DELETE without CSRF token', () => {
      const req = mockReq({ method: 'DELETE' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block PUT without CSRF token', () => {
      const req = mockReq({ method: 'PUT' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
