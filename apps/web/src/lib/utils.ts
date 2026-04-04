import { format, subHours } from 'date-fns';

export function formatTime(isoString: string): string {
  return format(new Date(isoString), 'HH:mm');
}

export function formatDateTime(isoString: string): string {
  return format(new Date(isoString), 'MMM d, HH:mm');
}

export function getDefaultTimeRange(): { from: string; to: string } {
  const to = new Date();
  const from = subHours(to, 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
