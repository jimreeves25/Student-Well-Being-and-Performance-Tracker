import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook for managing real-time data synchronization with auto-refetch
 * 
 * USAGE:
 * const { data, loading, error, refetch } = useDataSync(
 *   async () => await getDashboardSummary(),
 *   { autoRefetchInterval: 30000 }
 * );
 * 
 * FEATURES:
 * - Automatic refetch on interval
 * - Manual refetch on demand
 * - Loading state management
 * - Error handling
 * - Cache invalidation support
 */
export const useDataSync = (fetchFn, options = {}) => {
  const {
    autoRefetchInterval = 30000, // 30 seconds default
    initialData = null,
    onError = null,
    onSuccess = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  // Manual refetch function
  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      onError?.(err);
      console.error("Data sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, onError, onSuccess]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, []);

  // Auto refetch interval
  useEffect(() => {
    if (autoRefetchInterval > 0) {
      const interval = setInterval(refetch, autoRefetchInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefetchInterval, refetch]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

/**
 * Mutation hook for POST/PUT/DELETE operations with auto-refetch of related data
 * 
 * USAGE:
 * const { mutate, loading, error } = useDataMutation(
 *   async (data) => await saveDailyLog(data),
 *   async () => await getDailyLogs() // auto-refetch after save
 * );
 * 
 * FEATURES:
 * - Automatic refetch of dependent data after mutation
 * - Optimistic update support (optional)
 * - Loading & error states
 * - Callback hooks (onSuccess, onError)
 */
export const useDataMutation = (mutateFn, refetchFn, options = {}) => {
  const {
    onSuccess = null,
    onError = null,
    shouldRefetchAfter = true,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (variables) => {
      try {
        setLoading(true);
        setError(null);
        
        // Perform mutation
        const result = await mutateFn(variables);
        
        // Auto-refetch related data if provided
        if (shouldRefetchAfter && refetchFn) {
          await refetchFn();
        }
        
        onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        onError?.(err);
        console.error("Mutation error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutateFn, refetchFn, shouldRefetchAfter, onSuccess, onError]
  );

  return {
    mutate,
    loading,
    error,
  };
};

/**
 * Cache invalidation event system for triggering refetches across components
 * 
 * USAGE:
 * // In component that mutates data:
 * invalidateCache("dashboard-summary");
 * 
 * // In component that needs to refetch:
 * useCacheInvalidation("dashboard-summary", () => refetch());
 */
const cacheInvalidationListeners = {};

export const invalidateCache = (cacheKey) => {
  console.log(`[Cache] Invalidating: ${cacheKey}`);
  (cacheInvalidationListeners[cacheKey] || []).forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.error(`Cache invalidation error for ${cacheKey}:`, err);
    }
  });
};

export const useCacheInvalidation = (cacheKey, callback) => {
  useEffect(() => {
    if (!cacheInvalidationListeners[cacheKey]) {
      cacheInvalidationListeners[cacheKey] = [];
    }
    cacheInvalidationListeners[cacheKey].push(callback);

    return () => {
      cacheInvalidationListeners[cacheKey] = cacheInvalidationListeners[cacheKey].filter(
        (listener) => listener !== callback
      );
    };
  }, [cacheKey, callback]);
};

/**
 * Batch cache invalidation for multiple related caches
 */
export const invalidateMultipleCache = (cacheKeys) => {
  cacheKeys.forEach((key) => invalidateCache(key));
};
