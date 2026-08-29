/**
 * Promise-chain mutex: only one exclusive task runs at a time.
 * The next caller is queued on the previous settlement (resolve or reject),
 * so there is no check-then-set gap around an await.
 */
export type AsyncMutex = {
  runExclusive<T>(task: () => Promise<T>): Promise<T>;
};

export function createAsyncMutex(): AsyncMutex {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    runExclusive<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

/**
 * Mutual exclusion plus dirty-bit coalescing: overlapping callers share one
 * in-flight run and trigger at most one extra pass afterward.
 */
export function coalesceExclusive(mutex: AsyncMutex, task: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let dirty = false;

  return () => {
    if (inFlight) {
      dirty = true;
      return inFlight;
    }
    inFlight = (async () => {
      try {
        do {
          dirty = false;
          await mutex.runExclusive(task);
        } while (dirty);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
