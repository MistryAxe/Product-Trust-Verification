// Network helpers that guarantee a slow or unreachable server can never leave
// the app waiting for minutes. React Native's fetch has no timeout of its own.

export const DEFAULT_TIMEOUT_MS = 9000;

/**
 * fetch() with a hard time limit. The limit covers the whole exchange: waiting
 * for the server AND reading the body via response.text() / response.json().
 * Pass `timeoutMs` inside the options object (it is not forwarded to fetch).
 * On timeout an Error with code "request-timeout" is thrown.
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options || {};
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { controller?.abort(); } catch (_) {}
  }, timeoutMs);

  const timeoutError = () => {
    const error = new Error('The request took too long and was stopped.');
    error.code = 'request-timeout';
    return error;
  };

  try {
    const response = await fetch(url, controller ? { ...fetchOptions, signal: controller.signal } : fetchOptions);
    // Keep the timer running until the body has been read, then clear it.
    ['text', 'json'].forEach((method) => {
      const original = typeof response[method] === 'function' ? response[method].bind(response) : null;
      if (!original) return;
      response[method] = async () => {
        try {
          return await original();
        } catch (error) {
          if (timedOut) throw timeoutError();
          throw error;
        } finally {
          clearTimeout(timer);
        }
      };
    });
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (timedOut || error?.name === 'AbortError') throw timeoutError();
    throw error;
  }
}

export function isTimeoutError(error) {
  return error?.code === 'request-timeout';
}

/**
 * Resolve with `promise`'s value, or call `onTimeout()` and resolve with its
 * result if `ms` elapses first. Never rejects because of the deadline itself.
 */
export function withDeadline(promise, ms, onTimeout) {
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(onTimeout ? onTimeout() : undefined), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
