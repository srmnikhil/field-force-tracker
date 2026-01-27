export function parseUtcToLocal(utcString) {
  if (!utcString) return null;

  // Convert "YYYY-MM-DD HH:MM:SS" → ISO UTC
  const iso = utcString.replace(' ', 'T') + 'Z';
  return new Date(iso);
}


export function formatLocalDate(date) {
  if (!date) return '-';
  return date.toLocaleDateString();
}

export function formatLocalTime(date) {
  if (!date) return '-';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDuration(startDate, endDate) {
  if (!startDate || !endDate) return 'Active';

  const diffMs = endDate - startDate;
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

export function getTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ))
    .toISOString()
    .split('T')[0]; // YYYY-MM-DD
};