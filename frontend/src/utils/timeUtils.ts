import { calculateExpectedEffort, calculatePertVariance } from './pert';
import { calculateHoursFromTimeRange } from './productivity';

export const calculateExpectedTime = (best: number, likely: number, worst: number) => {
  return calculateExpectedEffort({ best, likely, worst });
};

export const calculateVariance = (best: number, worst: number) => {
  return calculatePertVariance({ best, worst });
};

export const calculateHoursFromRange = (from: string, to: string): number => {
  return calculateHoursFromTimeRange(from, to);
};

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getRelativeTime = (dateString?: string) => {
  if (!dateString) return 'INITIALIZING...';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'just now';
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
};
