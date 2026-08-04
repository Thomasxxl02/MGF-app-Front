import { describe, it, expect } from 'vitest';
import { getProviderByModel } from '../services/geminiService';

describe('geminiService Provider Unit Tests', () => {
  it('correctly detects model provider from model name', () => {
    expect(getProviderByModel('gemini-3.5-flash')).toBe('gemini');
    expect(getProviderByModel('gemini-1.5-pro')).toBe('gemini');
    expect(getProviderByModel('claude-3-5-sonnet-20241022')).toBe('anthropic');
    expect(getProviderByModel('anthropic-claude-3-haiku')).toBe('anthropic');
    expect(getProviderByModel('mistral-large-latest')).toBe('mistral');
    expect(getProviderByModel('codestral-2501')).toBe('mistral');
  });
});
