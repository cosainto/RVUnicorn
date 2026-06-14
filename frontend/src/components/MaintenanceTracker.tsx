import { useState, useEffect } from 'react';
import { Wrench, Plus, Calendar, DollarSign, AlertCircle, CheckCircle, Clock, Bell, Trash2, Edit, Save, X, Building } from 'lucide-react';
import api from '../services/api';
import ServiceItemsEditor from './rig/ServiceItemsEditor';
import { useAuth } from '../contexts/AuthContext';

interface MaintenanceRecord {
  id: string;
  title: string;
  category: string;
  description?: string;
  cost?: number;
  mileage?: number;
  location?: string;
  serviceDate: string;
  status: string;
  notes?: string;
  receiptImage?: string;
  providerName?: string;
  providerAddress?: string;
  reminder?: MaintenanceReminder;
}

interface MaintenanceReminder {
  id: string;
  title: string;
  category: string;
  description?: string;
  frequency: string;
  customMiles?: number;
  customMonths?: number;
  nextDueDate?: string;
  nextDueMileage?: number;
  isActive: boolean;
}

interface Stats {
  totalRecords: number;
  totalSpent: number;
  recordsByCategory: { [key: string]: number };
  activeReminders: number;
  overdueReminders: number;
}

const CATEGORIES = [
  { value: 'ENGINE', label: 'Engine', icon: '🔧' },
  { value: 'TRANSMISSION', label: 'Transmission', icon: '⚙️' },
  { value: 'BRAKES', label: 'Brakes', icon: '🛑' },
  { value: 'TIRES', label: 'Tires', icon: '🛞' },
  { value: 'ELECTRICAL', label: 'Electrical', icon: '⚡' },
  { value: 'PLUMBING', label: 'Plumbing', icon: '🚰' },
  { value: 'APPLIANCES', label: 'Appliances', icon: '🔌' },
  { value: 'HVAC', label: 'HVAC', icon: '❄️' },
  { value: 'EXTERIOR', label: 'Exterior', icon: '🏠' },
  { value: 'INTERIOR', label: 'Interior', icon: '🛋️' },
  { value: 'SAFETY', label: 'Safety', icon: '🦺' },
  { value: 'GENERATOR', label: 'Generator', icon: '⚡' },
  { value: 'OTHER', label: 'Other', icon: '📋' },
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly (Every 2 Weeks)' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Every 3 Months' },
  { value: 'SEMI_ANNUALLY', label: 'Every 6 Months' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'CUSTOM_MONTHS', label: 'Custom Months' },
  { value: 'CUSTOM_MILES', label: 'Custom Miles' },
];

export default function MaintenanceTracker() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'reminders'>('records');
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ENGINE');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [mileage, setMileage] = useState('');
  const [location, setLocation] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [createReminder, setCreateReminder] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState('MONTHLY');
  const [customMiles, setCustomMiles] = useState('');
  const [customMonths, setCustomMonths] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerAddress, setProviderAddress] = useState('');
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  // New fields
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [laborCost, setLaborCost] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<'mechanical' | 'bodywork' | 'self' | 'inspection'>('mechanical');
  const [shopName, setShopName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [isBodyWork, setIsBodyWork] = useState(false);
  const [warrantyExpires, setWarrantyExpires] = useState('');

  const CATEGORY_DEFAULTS: Record<string, { frequency: string; miles?: string; months?: string }> = {
    TIRES: { frequency: 'SEMI_ANNUALLY', months: '6' },
    ENGINE: { frequency: 'CUSTOM_MILES', miles: '5000' },
    BRAKES: { frequency: 'ANNUALLY' },
    TRANSMISSION: { frequency: 'ANNUALLY' },
    GENERATOR: { frequency: 'SEMI_ANNUALLY' },
    ELECTRICAL: { frequency: 'ANNUALLY' },
    HVAC: { frequency: 'ANNUALLY' },
    PLUMBING: { frequency: 'ANNUALLY' },
    SAFETY: { frequency: 'ANNUALLY' },
    EXTERIOR: { frequency: 'SEMI_ANNUALLY' },
  };

  const CATEGORY_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
    TIRES: [
      { key: 'tireBrand', label: 'Tire Brand', placeholder: 'e.g., Michelin, Goodyear' },
      { key: 'tireSize', label: 'Tire Size', placeholder: 'e.g., 235/65R16' },
      { key: 'tireType', label: 'Tire Type', placeholder: 'e.g., All Season, Highway' },
      { key: 'tiresPressurePsi', label: 'Tire Pressure (PSI)', placeholder: 'e.g., 80' },
      { key: 'tiresReplaced', label: 'Tires Replaced', placeholder: 'e.g., All 4, Front 2' },
      { key: 'treadDepth', label: 'Tread Depth (32nds)', placeholder: 'e.g., 10/32' },
    ],
    ENGINE: [
      { key: 'oilBrand', label: 'Oil Brand', placeholder: 'e.g., Mobil 1, Castrol' },
      { key: 'oilType', label: 'Oil Type/Viscosity', placeholder: 'e.g., 5W-30, 15W-40' },
      { key: 'oilFilterBrand', label: 'Oil Filter Brand', placeholder: 'e.g., Fram, K&N' },
      { key: 'oilFilterPartNum', label: 'Filter Part #', placeholder: 'e.g., PH16' },
      { key: 'quartsUsed', label: 'Quarts Used', placeholder: 'e.g., 7' },
      { key: 'airFilterReplaced', label: 'Air Filter Replaced?', placeholder: 'Yes / No' },
    ],
    BRAKES: [
      { key: 'brakePadBrand', label: 'Brake Pad Brand', placeholder: 'e.g., Raybestos' },
      { key: 'rotorsReplaced', label: 'Rotors Replaced?', placeholder: 'Yes / No' },
      { key: 'brakeFluidFlushed', label: 'Brake Fluid Flushed?', placeholder: 'Yes / No' },
      { key: 'axlesDone', label: 'Axles Serviced', placeholder: 'e.g., Front, Rear, All' },
      { key: 'padThickness', label: 'Pad Thickness (mm)', placeholder: 'e.g., 8' },
    ],
    EXTERIOR: [
      { key: 'wiperDriverSize', label: 'Driver Wiper Size', placeholder: 'e.g., 22"' },
      { key: 'wiperPassSize', label: 'Passenger Wiper Size', placeholder: 'e.g., 20"' },
      { key: 'wiperBrand', label: 'Wiper Brand', placeholder: 'e.g., Bosch, Rain-X' },
      { key: 'sealantApplied', label: 'Sealant Applied?', placeholder: 'Yes / No' },
      { key: 'roofInspected', label: 'Roof Inspected?', placeholder: 'Yes / No' },
    ],
    GENERATOR: [
      { key: 'genMake', label: 'Generator Make', placeholder: 'e.g., Onan, Honda' },
      { key: 'genHours', label: 'Generator Hours', placeholder: 'e.g., 500' },
      { key: 'genOilChanged', label: 'Oil Changed?', placeholder: 'Yes / No' },
      { key: 'genFilterReplaced', label: 'Filter Replaced?', placeholder: 'Yes / No' },
      { key: 'genSparkPlugs', label: 'Spark Plugs Replaced?', placeholder: 'Yes / No' },
    ],
  };

  const [reminderForm, setReminderForm] = useState({
    title: '',
    category: 'ENGINE',
    description: '',
    frequency: 'MONTHLY',
    customMiles: '',
    customMonths: '',
    nextDueDate: '',
    nextDueMileage: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRecords(),
        loadReminders(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    try {
      const { data } = await api.get('/maintenance/records');
      setRecords(data);
    } catch (error) {
      console.error('Load records error:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const { data } = await api.get('/maintenance/reminders?active=true');
      setReminders(data);
    } catch (error) {
      console.error('Load reminders error:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/maintenance/stats');
      setStats(data);
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', title);
      formDataToSend.append('category', category);
      if (description) formDataToSend.append('description', description);
      if (cost) formDataToSend.append('cost', cost);
      if (mileage) formDataToSend.append('mileage', mileage);
      if (location) formDataToSend.append('location', location);
      formDataToSend.append('serviceDate', serviceDate);
      if (notes) formDataToSend.append('notes', notes);
      if (providerName) formDataToSend.append('providerName', providerName);
      if (providerAddress) formDataToSend.append('providerAddress', providerAddress);
      formDataToSend.append('createReminder', createReminder.toString());
      if (createReminder) {
        formDataToSend.append('reminderFrequency', reminderFrequency);
        if (customMiles) formDataToSend.append('customMiles', customMiles);
        if (customMonths) formDataToSend.append('customMonths', customMonths);
      }
      if (receiptImage) {
        formDataToSend.append('receiptImage', receiptImage);
      }
      if (Object.keys(metadata).length > 0) {
        formDataToSend.append('metadata', JSON.stringify(metadata));
      }
      // New fields
      if (serviceItems.length > 0) formDataToSend.append('serviceItems', JSON.stringify(serviceItems));
      if (laborCost != null) formDataToSend.append('laborCost', String(laborCost));
      if (shopName) formDataToSend.append('shopName', shopName);
      if (technicianName) formDataToSend.append('technicianName', technicianName);
      if (workOrderNumber) formDataToSend.append('workOrderNumber', workOrderNumber);
      formDataToSend.append('isBodyWork', String(isBodyWork));
      if (warrantyExpires) formDataToSend.append('warrantyExpires', warrantyExpires);

      await api.post('/maintenance/records', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowAddModal(false);
      resetForm();
      await loadData();
      alert('Maintenance record added! 🔧');
    } catch (error) {
      console.error('Submit record error:', error);
      alert('Failed to add maintenance record');
    }
  };

  const handleEditRecord = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setTitle(record.title);
    setCategory(record.category);
    setDescription(record.description || '');
    setCost(record.cost?.toString() || '');
    setMileage(record.mileage?.toString() || '');
    setLocation(record.location || '');
    setServiceDate(record.serviceDate.split('T')[0]);
    setNotes((record as any).notes || '');
    setProviderName(record.providerName || '');
    setProviderAddress(record.providerAddress || '');
    // New fields
    setServiceItems((record as any).serviceItems || []);
    setLaborCost((record as any).laborCost || null);
    setShopName((record as any).shopName || record.providerName || '');
    setTechnicianName((record as any).technicianName || '');
    setWorkOrderNumber((record as any).workOrderNumber || '');
    setIsBodyWork((record as any).isBodyWork || false);
    setWarrantyExpires((record as any).warrantyExpires ? new Date((record as any).warrantyExpires).toISOString().split('T')[0] : '');
    setServiceType((record as any).isBodyWork ? 'bodywork' : 'mechanical');
    setShowEditModal(true);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', title);
      formDataToSend.append('category', category);
      formDataToSend.append('description', description || '');
      formDataToSend.append('cost', cost || '');
      formDataToSend.append('mileage', mileage || '');
      formDataToSend.append('location', location || '');
      formDataToSend.append('serviceDate', serviceDate);
      formDataToSend.append('notes', notes || '');
      formDataToSend.append('providerName', providerName || '');
      formDataToSend.append('providerAddress', providerAddress || '');
      
      if (receiptImage) {
        formDataToSend.append('receiptImage', receiptImage);
      }

      await api.put(`/maintenance/records/${editingRecord.id}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowEditModal(false);
      setEditingRecord(null);
      resetForm();
      await loadData();
      alert('Maintenance record updated! ✅');
    } catch (error) {
      console.error('Update record error:', error);
      alert('Failed to update maintenance record');
    }
  };

  const handleSubmitReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post('/maintenance/reminders', reminderForm);
      setShowReminderModal(false);
      resetReminderForm();
      await loadReminders();
      alert('Reminder created! 🔔');
    } catch (error) {
      console.error('Submit reminder error:', error);
      alert('Failed to create reminder');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance record?')) return;

    try {
      await api.delete(`/maintenance/records/${id}`);
      await loadData();
      alert('Record deleted');
    } catch (error) {
      console.error('Delete record error:', error);
      alert('Failed to delete record');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      await api.delete(`/maintenance/reminders/${id}`);
      await loadReminders();
      alert('Reminder deleted');
    } catch (error) {
      console.error('Delete reminder error:', error);
      alert('Failed to delete reminder');
    }
  };

  const handleToggleReminder = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/maintenance/reminders/${id}`, { isActive: !isActive });
      await loadReminders();
    } catch (error) {
      console.error('Toggle reminder error:', error);
      alert('Failed to update reminder');
    }
  };

  const resetForm = () => {
    setMetadata({});
    setTitle('');
    setCategory('ENGINE');
    setDescription('');
    setCost('');
    setMileage('');
    setLocation('');
    setServiceDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setCreateReminder(false);
    setReminderFrequency('MONTHLY');
    setCustomMiles('');
    setCustomMonths('');
    setProviderName('');
    setProviderAddress('');
    setReceiptImage(null);
  };

  const resetReminderForm = () => {
    setReminderForm({
      title: '',
      category: 'ENGINE',
      description: '',
      frequency: 'MONTHLY',
      customMiles: '',
      customMonths: '',
      nextDueDate: '',
      nextDueMileage: '',
    });
  };

  const getCategoryIcon = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.icon || '📋';
  };

  const isOverdue = (date?: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading maintenance tracker...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Wrench className="w-8 h-8" />
          RV Maintenance Tracker
        </h1>
        <p className="text-gray-600 mt-2">Track service history and set maintenance reminders</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalSpent.toFixed(2)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Reminders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeReminders}</p>
              </div>
              <Bell className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueReminders}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium transition ${
                activeTab === 'records'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Service Records
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium transition ${
                activeTab === 'reminders'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bell className="w-5 h-5" />
              Reminders
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Service Records Tab */}
          {activeTab === 'records' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Service History</h2>
                <button
                  onClick={() => { resetForm(); setShowAddModal(true); }}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Record
                </button>
              </div>

              {records.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg mb-2">No maintenance records yet</p>
                  <p className="text-gray-500 text-sm mb-4">Start tracking your RV maintenance</p>
                  <button onClick={() => { resetForm(); setShowAddModal(true); }} className="btn btn-primary">
                    Add First Record
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{getCategoryIcon(record.category)}</span>
                            <h3 className="font-bold text-gray-900">{record.title}</h3>
                            <span className="text-sm text-gray-500">
                              {CATEGORIES.find(c => c.value === record.category)?.label}
                            </span>
                          </div>

                          {record.description && (
                            <p className="text-gray-700 text-sm mb-2">{record.description}</p>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(record.serviceDate).toLocaleDateString()}
                            </div>
                            {record.mileage && (
                              <div>📍 {record.mileage.toLocaleString()} miles</div>
                            )}
                            {record.cost && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {record.cost.toFixed(2)}
                              </div>
                            )}
                            {record.location && (
                              <div>📍 {record.location}</div>
                            )}
                          </div>

                          {/* Service Provider Info */}
                          {(record.providerName || record.providerAddress) && (
                            <div className="mt-2 p-2 bg-blue-50 rounded flex items-start gap-2 text-sm">
                              <Building className="w-4 h-4 text-blue-600 mt-0.5" />
                              <div>
                                {record.providerName && (
                                  <span className="text-blue-700 font-medium">{record.providerName}</span>
                                )}
                                {record.providerName && record.providerAddress && <span className="text-blue-400 mx-1">•</span>}
                                {record.providerAddress && (
                                  <span className="text-blue-600">{record.providerAddress}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {(record as any).metadata && Object.keys((record as any).metadata).length > 0 && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 grid grid-cols-2 gap-1">
                              {Object.entries((record as any).metadata).filter(([,v]) => v).map(([k, v]) => (
                                <span key={k}><span className="font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span> {v as string}</span>
                              ))}
                            </div>
                          )}
                          {record.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">{record.notes}</p>
                          )}

                          {record.reminder && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded flex items-center gap-2 text-sm">
                              <Bell className="w-4 h-4 text-yellow-600" />
                              <span className="text-yellow-700">
                                Reminder set for {record.reminder.nextDueDate 
                                  ? new Date(record.reminder.nextDueDate).toLocaleDateString()
                                  : `${record.reminder.nextDueMileage} miles`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Edit record"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Delete record"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reminders Tab */}
          {activeTab === 'reminders' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Active Reminders</h2>
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Reminder
                </button>
              </div>

              {reminders.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg mb-2">No reminders set</p>
                  <p className="text-gray-500 text-sm mb-4">Create reminders for upcoming maintenance</p>
                  <button onClick={() => setShowReminderModal(true)} className="btn btn-primary">
                    Create First Reminder
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {reminders.map((reminder) => (
                    <div 
                      key={reminder.id} 
                      className={`border rounded-lg p-4 ${
                        isOverdue(reminder.nextDueDate) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{getCategoryIcon(reminder.category)}</span>
                            <h3 className="font-bold text-gray-900">{reminder.title}</h3>
                            {isOverdue(reminder.nextDueDate) && (
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">OVERDUE</span>
                            )}
                          </div>

                          {reminder.description && (
                            <p className="text-gray-700 text-sm mb-2">{reminder.description}</p>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {FREQUENCIES.find(f => f.value === reminder.frequency)?.label}
                            </div>
                            {reminder.nextDueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Due: {new Date(reminder.nextDueDate).toLocaleDateString()}
                              </div>
                            )}
                            {reminder.nextDueMileage && (
                              <div>📍 Due at: {reminder.nextDueMileage.toLocaleString()} miles</div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleReminder(reminder.id, reminder.isActive)}
                            className={`px-3 py-1 rounded text-sm ${
                              reminder.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {reminder.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Add Maintenance Record</h2>
            </div>
            <form onSubmit={handleSubmitRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Oil Change" className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={category} onChange={(e) => {
                  const cat = e.target.value;
                  setCategory(cat);
                  setMetadata({});
                  const defaults = CATEGORY_DEFAULTS[cat];
                  if (defaults) {
                    setCreateReminder(true);
                    setReminderFrequency(defaults.frequency);
                    if (defaults.miles) setCustomMiles(defaults.miles);
                    if (defaults.months) setCustomMonths(defaults.months);
                  }
                }} className="input" required>
                  {CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="Additional details..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Date *</label>
                  <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                  <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Current mileage" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className="input" />
                </div>
              </div>

              {/* Shop / Provider Info */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" /> Shop / Provider Info
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Shop Name</label>
                    <input type="text" value={shopName || providerName} onChange={(e) => { setShopName(e.target.value); setProviderName(e.target.value); }} placeholder="Camping World — Amarillo TX" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Technician Name</label>
                    <input type="text" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} placeholder="Ask for name for warranty" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Work Order #</label>
                    <input type="text" value={workOrderNumber} onChange={(e) => setWorkOrderNumber(e.target.value)} placeholder="WO-12345" className="input" />
                  </div>
                </div>
              </div>

              {/* Service Items Editor */}
              <div className="border-t pt-4 mt-4">
                <ServiceItemsEditor
                  items={serviceItems}
                  onChange={setServiceItems}
                  laborCost={laborCost}
                  onLaborCostChange={setLaborCost}
                  serviceType={serviceType}
                  onServiceTypeChange={(t) => {
                    setServiceType(t);
                    setIsBodyWork(t === 'bodywork');
                    if (t === 'bodywork') setCategory('EXTERIOR');
                  }}
                  onTotalChange={(total) => setCost(total > 0 ? total.toFixed(2) : cost)}
                />
              </div>

              {/* Warranty */}
              {serviceItems.some(i => i.warranty) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Expires</label>
                  <input type="date" value={warrantyExpires} onChange={(e) => setWarrantyExpires(e.target.value)} className="input" />
                </div>
              )}

              {/* Receipt — now optional with skip option */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{'\u{1F4C4}'} Receipt (Optional)</label>
                <p className="text-xs text-gray-400 mb-2">Upload a receipt to auto-fill details, or skip and enter manually above</p>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptImage(e.target.files?.[0] || null)} className="input" />
              </div>

              {CATEGORY_FIELDS[category] && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">🔍 {CATEGORIES.find(c => c.value === category)?.label} Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {CATEGORY_FIELDS[category].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <input type="text" value={metadata[field.key] || ''} onChange={(e) => setMetadata(prev => ({ ...prev, [field.key]: e.target.value }))} placeholder={field.placeholder} className="input text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" placeholder="Additional notes..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Image</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptImage(e.target.files?.[0] || null)} className="input" />
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createReminder} onChange={(e) => setCreateReminder(e.target.checked)} className="text-primary-600 rounded" />
                  <span className="text-sm font-medium text-gray-700">Create reminder for next service</span>
                </label>

                {createReminder && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Frequency</label>
                      <select value={reminderFrequency} onChange={(e) => setReminderFrequency(e.target.value)} className="input">
                        {FREQUENCIES.map((freq) => (<option key={freq.value} value={freq.value}>{freq.label}</option>))}
                      </select>
                    </div>
                    {reminderFrequency === 'CUSTOM_MONTHS' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Months</label>
                        <input type="number" value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} placeholder="3" className="input" min="1" />
                      </div>
                    )}
                    {reminderFrequency === 'CUSTOM_MILES' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Miles Until Next Service</label>
                        <input type="number" value={customMiles} onChange={(e) => setCustomMiles(e.target.value)} placeholder="5000" className="input" min="1" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1"><Save className="w-4 h-4 mr-2" />Save Record</button>
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Edit Maintenance Record</h2>
            </div>
            <form onSubmit={handleUpdateRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Oil Change" className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" required>
                  {CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="Additional details..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Date *</label>
                  <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                  <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Current mileage" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className="input" />
                </div>
              </div>

              {/* Shop / Provider Info */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" /> Shop / Provider Info
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Shop Name</label>
                    <input type="text" value={shopName || providerName} onChange={(e) => { setShopName(e.target.value); setProviderName(e.target.value); }} placeholder="Camping World — Amarillo TX" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Technician Name</label>
                    <input type="text" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} placeholder="Ask for name for warranty" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Work Order #</label>
                    <input type="text" value={workOrderNumber} onChange={(e) => setWorkOrderNumber(e.target.value)} placeholder="WO-12345" className="input" />
                  </div>
                </div>
              </div>

              {/* Service Items Editor */}
              <div className="border-t pt-4 mt-4">
                <ServiceItemsEditor
                  items={serviceItems}
                  onChange={setServiceItems}
                  laborCost={laborCost}
                  onLaborCostChange={setLaborCost}
                  serviceType={serviceType}
                  onServiceTypeChange={(t) => {
                    setServiceType(t);
                    setIsBodyWork(t === 'bodywork');
                    if (t === 'bodywork') setCategory('EXTERIOR');
                  }}
                  onTotalChange={(total) => setCost(total > 0 ? total.toFixed(2) : cost)}
                />
              </div>

              {/* Warranty */}
              {serviceItems.some(i => i.warranty) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Expires</label>
                  <input type="date" value={warrantyExpires} onChange={(e) => setWarrantyExpires(e.target.value)} className="input" />
                </div>
              )}

              {/* Receipt — now optional with skip option */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{'\u{1F4C4}'} Receipt (Optional)</label>
                <p className="text-xs text-gray-400 mb-2">Upload a receipt to auto-fill details, or skip and enter manually above</p>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptImage(e.target.files?.[0] || null)} className="input" />
              </div>

              {CATEGORY_FIELDS[category] && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">🔍 {CATEGORIES.find(c => c.value === category)?.label} Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {CATEGORY_FIELDS[category].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <input type="text" value={metadata[field.key] || ''} onChange={(e) => setMetadata(prev => ({ ...prev, [field.key]: e.target.value }))} placeholder={field.placeholder} className="input text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" placeholder="Additional notes..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Image</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptImage(e.target.files?.[0] || null)} className="input" />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1"><Save className="w-4 h-4 mr-2" />Update Record</button>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingRecord(null); resetForm(); }} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Create Reminder</h2>
            </div>

            <form onSubmit={handleSubmitReminder} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} placeholder="e.g., Oil Change Due" className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={reminderForm.category} onChange={(e) => setReminderForm({ ...reminderForm, category: e.target.value })} className="input" required>
                  {CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={reminderForm.description} onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })} rows={2} className="input" placeholder="What needs to be done?" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                <select value={reminderForm.frequency} onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })} className="input" required>
                  {FREQUENCIES.map((freq) => (<option key={freq.value} value={freq.value}>{freq.label}</option>))}
                </select>
              </div>

              {reminderForm.frequency === 'CUSTOM_MONTHS' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Months *</label>
                  <input type="number" value={reminderForm.customMonths} onChange={(e) => setReminderForm({ ...reminderForm, customMonths: e.target.value })} placeholder="3" className="input" min="1" required />
                </div>
              )}

              {reminderForm.frequency === 'CUSTOM_MILES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Miles Between Service *</label>
                  <input type="number" value={reminderForm.customMiles} onChange={(e) => setReminderForm({ ...reminderForm, customMiles: e.target.value })} placeholder="5000" className="input" min="1" required />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                <input type="date" value={reminderForm.nextDueDate} onChange={(e) => setReminderForm({ ...reminderForm, nextDueDate: e.target.value })} className="input" />
              </div>

              {reminderForm.frequency === 'CUSTOM_MILES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Mileage</label>
                  <input type="number" value={reminderForm.nextDueMileage} onChange={(e) => setReminderForm({ ...reminderForm, nextDueMileage: e.target.value })} placeholder="Current mileage + interval" className="input" />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1"><Bell className="w-4 h-4 mr-2" />Create Reminder</button>
                <button type="button" onClick={() => { setShowReminderModal(false); resetReminderForm(); }} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
