import { describe, expect, it } from 'vitest';
import { validate } from './env.validation.js';

describe('Environment Validation', () => {
  it('should successfully validate valid environment config', () => {
    const validConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
      SESSION_SECRET: 'super-secret-key-that-is-long-enough',
    };

    const result = validate(validConfig);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/test');
  });

  it('should throw validation error when required DATABASE_URL is missing', () => {
    const invalidConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
    };

    expect(() => validate(invalidConfig)).toThrow('Environment validation error');
  });

  it('should throw validation error when NODE_ENV is invalid', () => {
    const invalidConfig = {
      NODE_ENV: 'not-an-env',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
    };

    expect(() => validate(invalidConfig)).toThrow('Environment validation error');
  });
});
