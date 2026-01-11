import React, { useState, useEffect, useCallback } from 'react';
import { Package, Check, X } from 'lucide-react';
import api from '../services/api';

interface Assignment {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isPacked: boolean;
  assignmentStatus: string;
  eventTitle: string;
}

interface Props {
  onUpdate?: () => void;
}

export default function PackingAssignments({ onUpdate }: Props) {
  const [pending, setPending] = useState<Assignment[]>([]);
  const [accepted, setAccepted] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      const { data } = await api.get('/trip-packing/my-assignments');
      setPending(data.pending || []);
      setAccepted(data.accepted || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const respondToAssignment = async (itemId: string, accept: boolean) => {
    setResponding(itemId);
    try {
      await api.put(`/trip-packing/${itemId}/respond`, { accept, reason: accept ? undefined : 'Unable to bring this item' });
      await loadAssignments();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setResponding(null);
    }
  };

  const togglePacked = async (itemId: string) => {
    try {
      await api.put(`/trip-packing/${itemId}/toggle`);
      await loadAssignments();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (pending.length === 0 && accepted.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-green-600" />
        Packing Assignments
      </h3>

      {pending.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-yellow-700 mb-2">⏳ Pending ({pending.length})</h4>
          <div className="space-y-2">
            {pending.map(item => (
              <div key={item.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.name}
                      {item.quantity > 1 && <span className="ml-1 text-sm text-gray-500">×{item.quantity}</span>}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">For: {item.eventTitle}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondToAssignment(item.id, true)}
                      disabled={responding === item.id}
                      className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                      title="Accept"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => respondToAssignment(item.id, false)}
                      disabled={responding === item.id}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                      title="Decline"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-green-700 mb-2">✓ Your Items ({accepted.filter(a => !a.isPacked).length} to pack)</h4>
          <div className="space-y-2">
            {accepted.map(item => (
              <div key={item.id} className={`p-3 rounded-lg border flex items-center gap-3 ${item.isPacked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  onClick={() => togglePacked(item.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.isPacked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}
                >
                  {item.isPacked && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1">
                  <p className={`font-medium ${item.isPacked ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {item.name}
                    {item.quantity > 1 && <span className="ml-1 text-sm text-gray-500">×{item.quantity}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{item.eventTitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
