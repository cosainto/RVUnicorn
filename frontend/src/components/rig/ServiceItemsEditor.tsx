import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

export interface ServiceItem {
  description: string;
  cost: number | null;
  partNumber: string | null;
  warranty: boolean;
}

export type ServiceType = 'mechanical' | 'bodywork' | 'self' | 'inspection';

interface Props {
  items: ServiceItem[];
  onChange: (items: ServiceItem[]) => void;
  laborCost: number | null;
  onLaborCostChange: (cost: number | null) => void;
  serviceType: ServiceType;
  onServiceTypeChange: (type: ServiceType) => void;
  onTotalChange?: (total: number) => void;
}

const TYPE_CONFIG: Record<ServiceType, { emoji: string; label: string; placeholders: string[] }> = {
  mechanical: { emoji: '\u{1F527}', label: 'Mechanical', placeholders: ['Oil change', 'Brake pads replacement', 'A/C recharge', 'Transmission flush'] },
  bodywork: { emoji: '\u{1F3A8}', label: 'Body Work', placeholders: ['Paint correction', 'Dent repair', 'Clearcoat touch-up', 'Decal replacement'] },
  self: { emoji: '\u{1F6E0}\uFE0F', label: 'Self-Performed', placeholders: ['Changed oil', 'Replaced water pump', 'Resealed windows', 'Replaced batteries'] },
  inspection: { emoji: '\u{1F50D}', label: 'Inspection', placeholders: ['Annual inspection', 'Emissions test', 'Safety check', 'Pre-trip inspection'] },
};

export default function ServiceItemsEditor({ items, onChange, laborCost, onLaborCostChange, serviceType, onServiceTypeChange, onTotalChange }: Props) {
  const config = TYPE_CONFIG[serviceType];

  const addItem = () => {
    onChange([...items, { description: '', cost: null, partNumber: null, warranty: false }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ServiceItem, value: any) => {
    const updated = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    onChange(updated);
  };

  // Auto-calculate totals
  const partsTotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);
  const labor = serviceType === 'self' ? 0 : (laborCost || 0);
  const grandTotal = partsTotal + labor;

  useEffect(() => {
    onTotalChange?.(grandTotal);
  }, [grandTotal]);

  return (
    <div>
      {/* Service Type Toggle */}
      <div className="flex gap-1.5 mb-4 bg-gray-100 p-1 rounded-xl">
        {(Object.keys(TYPE_CONFIG) as ServiceType[]).map(type => (
          <button key={type} onClick={() => onServiceTypeChange(type)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition ${
              serviceType === type ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{TYPE_CONFIG[type].emoji}</span>
            <span className="hidden sm:inline">{TYPE_CONFIG[type].label}</span>
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-900">{config.emoji} Services & Parts Performed</h4>
      </div>

      {/* Column headers */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-1.5 px-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <span className="flex-1">Description</span>
          <span className="w-24 text-center">Part #</span>
          <span className="w-20 text-center">Cost</span>
          <span className="w-10 text-center">Wty</span>
          <span className="w-6" />
        </div>
      )}

      {/* Line items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              value={item.description}
              onChange={e => updateItem(index, 'description', e.target.value)}
              placeholder={config.placeholders[index % config.placeholders.length]}
              className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <input
              value={item.partNumber || ''}
              onChange={e => updateItem(index, 'partNumber', e.target.value || null)}
              placeholder="Part #"
              className="w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <div className="relative w-20">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={item.cost ?? ''}
                onChange={e => updateItem(index, 'cost', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.00"
                className="w-full pl-5 pr-1 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                step="0.01"
              />
            </div>
            <label className="w-10 flex items-center justify-center cursor-pointer" title="Under warranty">
              <input
                type="checkbox"
                checked={item.warranty}
                onChange={e => updateItem(index, 'warranty', e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
              />
            </label>
            <button onClick={() => removeItem(index)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add item button */}
      <button onClick={addItem}
        className="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition">
        <Plus className="w-3.5 h-3.5" /> Add Item
      </button>

      {/* Totals section */}
      {(items.length > 0 || laborCost) && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
          {items.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Parts subtotal</span>
              <span className="font-medium text-gray-700">${partsTotal.toFixed(2)}</span>
            </div>
          )}
          {serviceType !== 'self' && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Labor</span>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={laborCost ?? ''}
                  onChange={e => onLaborCostChange(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  className="w-full pl-5 pr-1 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  step="0.01"
                />
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-gray-900">${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
