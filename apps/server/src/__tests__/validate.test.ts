import { describe, it, expect, vi } from 'vitest';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

// Mock Express req/res/next
function mockReq(overrides: Partial<any> = {}) {
  return { body: {}, params: {}, query: {}, ...overrides } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  it('should pass with valid body', () => {
    const schema = { body: z.object({ name: z.string() }) };
    const middleware = validate(schema);
    const req = mockReq({ body: { name: 'test' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject invalid body', () => {
    const schema = { body: z.object({ name: z.string() }) };
    const middleware = validate(schema);
    const req = mockReq({ body: { name: 123 } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should validate query params', () => {
    const schema = { query: z.object({ limit: z.string().regex(/^\d+$/) }) };
    const middleware = validate(schema);
    const req = mockReq({ query: { limit: 'abc' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should validate params', () => {
    const schema = { params: z.object({ id: z.string().uuid() }) };
    const middleware = validate(schema);
    const req = mockReq({ params: { id: 'not-a-uuid' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return detailed error messages', () => {
    const schema = { body: z.object({ email: z.string().email() }) };
    const middleware = validate(schema);
    const req = mockReq({ body: { email: 'not-email' } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'ValidationError',
        details: expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
      }),
    );
  });

  it('should handle SQL injection attempts in validated fields', () => {
    const schema = { body: z.object({ name: z.string().max(50) }) };
    const middleware = validate(schema);
    const req = mockReq({ body: { name: "'; DROP TABLE users; --" } });
    const res = mockRes();
    const next = vi.fn();

    // Zod passes this because it's valid string — Prisma parameterizes queries
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject oversized inputs', () => {
    const schema = { body: z.object({ name: z.string().max(100) }) };
    const middleware = validate(schema);
    const req = mockReq({ body: { name: 'a'.repeat(101) } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
