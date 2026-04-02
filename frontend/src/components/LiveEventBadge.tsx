import { useEventLifecycle, type EventLifecycle } from '../hooks/useEventLifecycle';

interface Props {
  startDate: string | Date;
  endDate: string | Date;
  eventStatus?: string | null;
  size?: 'sm' | 'md';
}

export default function LiveEventBadge({ startDate, endDate, eventStatus, size = 'sm' }: Props) {
  const lifecycle = useEventLifecycle(startDate, endDate, eventStatus);
  const isSm = size === 'sm';
  const base = isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  if (lifecycle === 'LIVE') {
    return (
      <span className={`inline-flex items-center gap-1 font-bold rounded-full ${base} bg-red-500 text-white`}>
        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        LIVE
      </span>
    );
  }

  if (lifecycle === 'ENDED') {
    return <span className={`inline-flex items-center font-semibold rounded-full ${base} bg-gray-200 text-gray-500`}>Ended</span>;
  }

  if (lifecycle === 'CANCELLED') {
    return <span className={`inline-flex items-center font-semibold rounded-full ${base} bg-red-100 text-red-600`}>Cancelled</span>;
  }

  // UPCOMING — countdown
  const diff = new Date(startDate).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const countdown = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h` : 'Soon';

  return <span className={`inline-flex items-center font-semibold rounded-full ${base} bg-blue-100 text-blue-700`}>Starts in {countdown}</span>;
}
