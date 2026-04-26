class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  // Set an item in the cache with a Time-To-Live (TTL) in seconds
  set(key, value, ttlSeconds) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  // Get an item from the cache. Returns null if expired or missing.
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  // Delete an item
  delete(key) {
    this.cache.delete(key);
  }

  // Clear the whole cache
  clear() {
    this.cache.clear();
  }
}

// Export a singleton instance
module.exports = new MemoryCache();
