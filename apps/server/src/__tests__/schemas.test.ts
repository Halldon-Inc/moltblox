import { describe, it, expect } from 'vitest';
import { transferSchema, transactionsQuerySchema } from '../schemas/wallet.js';
import { createItemSchema, purchaseItemSchema } from '../schemas/marketplace.js';
import { verifySchema, updateProfileSchema } from '../schemas/auth.js';

describe('Wallet Schemas', () => {
  describe('transferSchema', () => {
    it('should accept valid Ethereum address', () => {
      const result = transferSchema.body.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid Ethereum address', () => {
      const result = transferSchema.body.safeParse({
        to: 'not-an-address',
        amount: '1000',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amounts', () => {
      const result = transferSchema.body.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '-100',
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero amount', () => {
      const result = transferSchema.body.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '0',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric amount', () => {
      const result = transferSchema.body.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: 'abc',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Marketplace Schemas', () => {
  describe('createItemSchema', () => {
    it('should accept valid item data', () => {
      const result = createItemSchema.body.safeParse({
        gameId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'Cool Sword',
        description: 'A very cool sword',
        price: '1000000000000000000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = createItemSchema.body.safeParse({ name: 'test' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid CUID for gameId', () => {
      const result = createItemSchema.body.safeParse({
        gameId: 'not-a-uuid',
        name: 'test',
        description: 'test',
        price: '100',
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized name', () => {
      const result = createItemSchema.body.safeParse({
        gameId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'a'.repeat(101),
        description: 'test',
        price: '100',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const result = createItemSchema.body.safeParse({
        gameId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'test',
        description: 'test',
        price: '100',
        category: 'invalid_category',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('purchaseItemSchema', () => {
    it('should accept valid purchase', () => {
      const paramsResult = purchaseItemSchema.params.safeParse({
        id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      });
      const bodyResult = purchaseItemSchema.body.safeParse({ quantity: 1 });
      expect(paramsResult.success).toBe(true);
      expect(bodyResult.success).toBe(true);
    });

    it('should reject quantity over 100', () => {
      const result = purchaseItemSchema.body.safeParse({ quantity: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject zero quantity', () => {
      const result = purchaseItemSchema.body.safeParse({ quantity: 0 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Auth Schemas', () => {
  describe('updateProfileSchema', () => {
    it('should accept valid profile update', () => {
      const result = updateProfileSchema.body.safeParse({
        username: 'testuser',
        displayName: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty update', () => {
      const result = updateProfileSchema.body.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject username with special characters', () => {
      const result = updateProfileSchema.body.safeParse({
        username: 'user@name!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject username too short', () => {
      const result = updateProfileSchema.body.safeParse({
        username: 'ab',
      });
      expect(result.success).toBe(false);
    });

    it('should reject bio over 500 chars', () => {
      const result = updateProfileSchema.body.safeParse({
        bio: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid avatar URL', () => {
      const result = updateProfileSchema.body.safeParse({
        avatarUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });
});
