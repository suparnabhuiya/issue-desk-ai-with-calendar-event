const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'The request could not be completed.');
  }

  return response.status === 204 ? null : response.json();
}

export const issuesApi = {
  list: () => request('/api/v1/issues/'),
  create: (issue) => request('/api/v1/issues', { method: 'POST', body: JSON.stringify(issue) }),
  update: (id, issue) => request(`/api/v1/issues/${id}`, { method: 'PUT', body: JSON.stringify(issue) }),
  remove: (id) => request(`/api/v1/issues/${id}`, { method: 'DELETE' }),
  askAgent: (message) => request('/agent/', { method: 'POST', body: JSON.stringify({ message }) }),
};
