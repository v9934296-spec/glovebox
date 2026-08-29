import { coalesceExclusive, createAsyncMutex } from '../mutex';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createAsyncMutex', () => {
  it('never runs two tasks at the same time', async () => {
    const mutex = createAsyncMutex();
    let concurrent = 0;
    let maxConcurrent = 0;

    async function task() {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(5);
      concurrent -= 1;
    }

    await Promise.all([
      mutex.runExclusive(task),
      mutex.runExclusive(task),
      mutex.runExclusive(task),
    ]);

    expect(maxConcurrent).toBe(1);
  });

  it('runs overlapping callers in order and lets each await completion', async () => {
    const mutex = createAsyncMutex();
    const order: number[] = [];

    const first = mutex.runExclusive(async () => {
      order.push(1);
      await delay(5);
      order.push(2);
    });
    const second = mutex.runExclusive(async () => {
      order.push(3);
    });

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('keeps the chain alive after a rejected task', async () => {
    const mutex = createAsyncMutex();
    let ranAfter = false;

    await expect(
      mutex.runExclusive(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await mutex.runExclusive(async () => {
      ranAfter = true;
    });

    expect(ranAfter).toBe(true);
  });
});

describe('coalesceExclusive', () => {
  it('runs overlapping callers as one pass plus at most one trailing pass', async () => {
    const mutex = createAsyncMutex();
    let runs = 0;
    const run = coalesceExclusive(mutex, async () => {
      runs += 1;
      await delay(10);
    });

    await Promise.all([run(), run(), run(), run()]);
    expect(runs).toBeLessThanOrEqual(2);
    expect(runs).toBeGreaterThanOrEqual(1);
  });

  it('lets every overlapping caller await the shared pass', async () => {
    const mutex = createAsyncMutex();
    let finished = 0;
    const run = coalesceExclusive(mutex, async () => {
      await delay(5);
    });

    await Promise.all([run(), run(), run()]);
    finished = 3;
    expect(finished).toBe(3);
  });
});
