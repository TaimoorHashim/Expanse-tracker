/**
 * Reusable Fetch Wrapper for API requests
 * Automatically includes credentials, handles JSON serialization,
 * and redirects on 401 Unauthorized.
 */
async function apiFetch(url, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json'
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const fetchOptions = {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    const currentPath = window.location.pathname;
    if (!currentPath.endsWith('index.html') && !currentPath.endsWith('register.html') && currentPath !== '/') {
      window.location.href = '/index.html';
      return;
    }
  }

  // Handle blob/download responses if requested
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    return response.blob();
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) ? data.error : `Request failed (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

window.apiFetch = apiFetch;
