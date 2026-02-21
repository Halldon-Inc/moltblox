import { describe, it, expect } from 'vitest';
import { signToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'moltblox-dev-secret-DO-NOT-USE-IN-PRODUCTION';

describe('Auth', () => {
  describe('signToken', () => {
    it('should create a valid JWT', () => {
      const token = signToken('user-123', '0x1234567890abcdef');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.userId).toBe('user-123');
      expect(decoded.address).toBe('0x1234567890abcdef');
    });

    it('should set expiration to 24 hours', () => {
      const token = signToken('user-123', '0x1234567890abcdef');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const expectedExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      expect(decoded.exp).toBeCloseTo(expectedExpiry, -2);
    });

    it('should reject tampered tokens', () => {
      const token = signToken('user-123', '0x1234567890abcdef');
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow();
    });

    it('should reject tokens with wrong secret', () => {
      const token = signToken('user-123', '0x1234567890abcdef');
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });
  });
});
