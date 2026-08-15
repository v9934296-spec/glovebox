import { runPostDeletionTeardown } from '../deletion';

describe('runPostDeletionTeardown', () => {
  it('clears the session before local cleanup', async () => {
    const order: string[] = [];
    await runPostDeletionTeardown({
      clearSession: async () => {
        order.push('session');
      },
      cleanupLocal: async () => {
        order.push('local');
      },
    });
    expect(order).toEqual(['session', 'local']);
  });

  it('still completes when local cleanup throws after the session is cleared', async () => {
    let sessionCleared = false;
    await expect(
      runPostDeletionTeardown({
        clearSession: async () => {
          sessionCleared = true;
        },
        cleanupLocal: async () => {
          throw new Error('sqlite failed');
        },
      }),
    ).resolves.toBeUndefined();
    expect(sessionCleared).toBe(true);
  });

  it('does not run local cleanup if clearing the session fails', async () => {
    let cleaned = false;
    await expect(
      runPostDeletionTeardown({
        clearSession: async () => {
          throw new Error('signOut failed');
        },
        cleanupLocal: async () => {
          cleaned = true;
        },
      }),
    ).rejects.toThrow('signOut failed');
    expect(cleaned).toBe(false);
  });
});
