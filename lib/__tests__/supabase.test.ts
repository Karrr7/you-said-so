import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// We just test that the module exports functions — real DB calls tested in E2E
describe('supabase client exports', () => {
  it('exports createServiceClient', async () => {
    // Set required env vars for test
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service')

    const { createServiceClient, createBrowserSupabaseClient } = await import('../supabase')
    expect(typeof createServiceClient).toBe('function')
    expect(typeof createBrowserSupabaseClient).toBe('function')
  })
})
