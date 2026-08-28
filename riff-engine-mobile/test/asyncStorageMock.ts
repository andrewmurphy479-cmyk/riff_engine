/**
 * In-memory stand-in for @react-native-async-storage/async-storage.
 *
 * The practice store persists through zustand's persist middleware, which
 * writes on every set(). Under Node the real module has no native backing and
 * every write rejects — the store tests still passed, but each one buried a
 * pile of unhandled rejections, which is precisely how a genuine storage bug
 * would go unnoticed.
 */
const store = new Map<string, string>();

export default {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
  getAllKeys: async (): Promise<string[]> => [...store.keys()],
};
