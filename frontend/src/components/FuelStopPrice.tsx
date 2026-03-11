import { useState, useEffect } from 'react';

export default function FuelStopPrice({ lat, lng, fuelType }: { lat?: number | null; lng?: number | null; fuelType: string }) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://www.fueleconomy.gov/ws/rest/fuelprices', { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then((d: any) => {
        const p = fuelType === 'diesel' ? parseFloat(d.diesel) : parseFloat(d.regular);
        if (!isNaN(p)) setPrice(p);
      }).catch(() => {});
  }, [fuelType]);

  if (!price) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg mt-1">
      {fuelType === 'diesel' ? '🛢️' : '⛽'} ${price.toFixed(2)}/gal avg
    </span>
  );
}
