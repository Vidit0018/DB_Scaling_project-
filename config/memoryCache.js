/**
 * In-process memory cache with:
 *  - TTL-based expiry
 *  - Thundering-herd protection via pending-promise deduplication
 *
 * When many concurrent requests miss the cache at the same instant,
 * only ONE async fetcher is invoked; every other waiter receives the
 * same Promise and they all resolve together once the data arrives.
 */
class MemoryCache {
  constructor() {
    this.cache   = new Map(); // key → { value, expiresAt }
    this.pending = new Map(); // key → Promise  (in-flight fetchers)
  }

  // ── Basic get/set/delete ──────────────────────────────────────────────────

  set(key, value, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
    this.pending.delete(key); // clear any in-flight waiter once data is stored
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  clear() {
    this.cache.clear();
    this.pending.clear();
  }

  // ── Thundering-herd deduplication ─────────────────────────────────────────
  //
  // Usage:
  //   const data = await cache.getOrFetch(key, ttlSeconds, async () => {
  //     return await pool.query(sql);
  //   });
  //
  // If the key is already cached → returns instantly from RAM.
  // If a fetch is already in-flight for this key → waits for that same Promise.
  // Otherwise → calls fetcher(), stores result, resolves all waiters.

  async getOrFetch(key, ttlSeconds, fetcher) {
    // 1. Cache hit — serve from RAM immediately
    const cached = this.get(key);
    if (cached !== null) return cached;

    // 2. In-flight deduplication — another request is already fetching
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // 3. Cache miss — we are the one to fetch
    const promise = (async () => {
      try {
        const value = await fetcher();
        this.set(key, value, ttlSeconds);
        return value;
      } catch (err) {
        // Remove the pending entry so the next request can retry
        this.pending.delete(key);
        throw err;
      }
    })();

    this.pending.set(key, promise);
    return promise;
  }
}

// Export a singleton — shared by all requires within the same worker process
module.exports = new MemoryCache();
