import { useState, useEffect } from 'react';
import { Phone, Plus, Trash2, Edit2, X, Check, Loader2, Shield, User } from 'lucide-react';
import api from '../services/api';

interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relation?: string;
  notifyOnCheckIn: boolean;
  notifyOnCheckOut: boolean;
}

const RELATION_OPTIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'];

export default function EmergencyContactsManager() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phoneNumber: '', relation: '', notifyOnCheckIn: true, notifyOnCheckOut: true });

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    try {
      const { data } = await api.get('/emergency-contacts');
      setContacts(data);
    } catch {} finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ name: '', phoneNumber: '', relation: '', notifyOnCheckIn: true, notifyOnCheckOut: true });
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phoneNumber.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/emergency-contacts/${editing}`, form);
      } else {
        await api.post('/emergency-contacts', form);
      }
      await loadContacts();
      resetForm();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save contact');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this emergency contact?')) return;
    try {
      await api.delete(`/emergency-contacts/${id}`);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const handleToggle = async (id: string, field: 'notifyOnCheckIn' | 'notifyOnCheckOut', value: boolean) => {
    try {
      await api.put(`/emergency-contacts/${id}`, { [field]: value });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    } catch {}
  };

  const startEdit = (contact: EmergencyContact) => {
    setForm({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      relation: contact.relation || '',
      notifyOnCheckIn: contact.notifyOnCheckIn,
      notifyOnCheckOut: contact.notifyOnCheckOut,
    });
    setEditing(contact.id);
    setShowForm(true);
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return phone;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Emergency Contacts</h2>
            <p className="text-xs text-gray-500">Get SMS alerts sent to loved ones when you check in or out</p>
          </div>
        </div>
        {contacts.length < 5 && !showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Contact list */}
            {contacts.length > 0 && (
              <div className="space-y-3 mb-4">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{contact.name}</p>
                        {contact.relation && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{contact.relation}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{formatPhone(contact.phoneNumber)}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={contact.notifyOnCheckIn} onChange={e => handleToggle(contact.id, 'notifyOnCheckIn', e.target.checked)} className="w-3.5 h-3.5 rounded text-red-500 focus:ring-red-400" />
                          <span className="text-[10px] text-gray-500">Check-in</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={contact.notifyOnCheckOut} onChange={e => handleToggle(contact.id, 'notifyOnCheckOut', e.target.checked)} className="w-3.5 h-3.5 rounded text-red-500 focus:ring-red-400" />
                          <span className="text-[10px] text-gray-500">Check-out</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(contact)} className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(contact.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {contacts.length === 0 && !showForm && (
              <div className="text-center py-6">
                <Phone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">No emergency contacts yet</p>
                <p className="text-xs text-gray-400 mt-1">Add contacts to notify when you check in or out of campgrounds</p>
                <button onClick={() => setShowForm(true)} className="mt-3 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition">
                  Add Emergency Contact
                </button>
              </div>
            )}

            {/* Add/Edit form */}
            {showForm && (
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">{editing ? 'Edit Contact' : 'New Contact'}</p>
                  <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Mom" className="w-full text-sm border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Phone Number *</label>
                      <input type="tel" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1 (555) 123-4567" className="w-full text-sm border rounded-lg px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Relationship</label>
                    <div className="flex flex-wrap gap-1.5">
                      {RELATION_OPTIONS.map(r => (
                        <button key={r} onClick={() => setForm({ ...form, relation: form.relation === r ? '' : r })}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${form.relation === r ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.notifyOnCheckIn} onChange={e => setForm({ ...form, notifyOnCheckIn: e.target.checked })} className="w-4 h-4 rounded text-red-500" />
                      <span className="text-xs text-gray-700">Notify on check-in</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.notifyOnCheckOut} onChange={e => setForm({ ...form, notifyOnCheckOut: e.target.checked })} className="w-4 h-4 rounded text-red-500" />
                      <span className="text-xs text-gray-700">Notify on check-out</span>
                    </label>
                  </div>
                  <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.phoneNumber.trim()}
                    className="w-full py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {editing ? 'Save Changes' : 'Add Contact'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
