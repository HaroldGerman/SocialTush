/**
 * Date formatting utility for local user timezone and relative timestamps.
 * Uses native Intl APIs without heavy external dependencies.
 */
export function formatLocalTimestamp(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Reciente';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Reciente';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Future or less than 1 min
  if (diffSec < 60) {
    return 'Ahora';
  }

  // Under 60 minutes
  if (diffMin < 60) {
    return `Hace ${diffMin} min`;
  }

  // Under 24 hours
  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Ayer';
  }

  // Current year formatting
  const isSameYear = date.getFullYear() === now.getFullYear();
  
  if (isSameYear) {
    // e.g. "18 ago"
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  }

  // Different year e.g. "18 ago 2026"
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

/**
 * Detailed timestamp with time e.g. "18 ago, 8:35 p. m."
 */
export function formatFullLocalTimestamp(dateInput?: string | Date | null): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}
