import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Truck, Users, FileText, Sparkles, AlertTriangle, QrCode, Download } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ToastProvider';
import html2canvas from 'html2canvas';
import api from '../../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', orange: '#D4621A' };

export default function RigEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { addLocalToast } = useToast();
  const navigate = useNavigate();
  const [rig, setRig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');
  const [form, setForm] = useState<any>({});
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [privacyDuration, setPrivacyDuration] = useState('until_off');

  useEffect(() => {
    if (!slug) return;
    api.get(`/rigs/${slug}`)
      .then(r => { setRig(r.data); setForm(r.data); setLoading(false); })
      .catch(() => { setLoading(false); navigate('/basecamp'); });
  }, [slug]);

  useEffect(() => {
    if (activeTab !== 'qr-sticker' || !slug) return;
    setQrLoading(true);
    api.get(`/rigs/${slug}/qr-code`)
      .then(r => {
        setQrData(r.data);
        if (r.data?.privacyEnabled) setPrivacyEnabled(r.data.privacyEnabled);
        if (r.data?.privacyDuration) setPrivacyDuration(r.data.privacyDuration);
      })
      .catch(() => {})
      .finally(() => setQrLoading(false));
  }, [activeTab, slug]);

  const saveField = async (fields: Record<string, any>) => {
    if (!rig?.id) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/rigs/${rig.id}`, fields);
      setRig(data);
      setForm((f: any) => ({ ...f, ...fields }));
      addLocalToast('Saved!', 'success');
    } catch {
      addLocalToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  if (loading) {
    return <div style={{ background: CN.body, minHeight: '100vh' }} className="flex items-center justify-center">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: CN.gold, borderTopColor: 'transparent' }} />
    </div>;
  }

  const TABS = [
    { id: 'identity', label: 'Identity', icon: Truck },
    { id: 'specs', label: 'Specs', icon: Truck },
    { id: 'pilots', label: 'Pilots', icon: Users },
    { id: 'creator', label: 'Creator', icon: Sparkles },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'qr-sticker', label: 'QR Sticker', icon: QrCode },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  const Field = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: CN.muted }}>{label}</label>
      <input
        type={type}
        value={form[field] || ''}
        onChange={e => updateForm(field, type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
        style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }}
      />
    </div>
  );

  return (
    <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/rig/${slug}`} className="p-2 rounded-lg transition hover:bg-white/5" style={{ color: CN.muted }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Edit {rig?.rigName || 'Your Rig'}</h1>
            <p className="text-xs" style={{ color: CN.muted }}>/rig/{slug}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto mb-6 pb-px" style={{ borderBottom: `1px solid ${CN.border}` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition"
              style={{ color: activeTab === t.id ? CN.gold : CN.muted, borderBottom: activeTab === t.id ? `2px solid ${CN.gold}` : '2px solid transparent' }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ═══ IDENTITY TAB ═══ */}
        {activeTab === 'identity' && (
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <h3 className="text-sm font-bold mb-4">Rig Identity</h3>
              <div className="space-y-3">
                <Field label="Rig Name" field="rigName" placeholder='e.g. "The Pursuit"' />
                <Field label="Tagline" field="tagline" placeholder='e.g. "Class A life, Midwest bound"' />
                <Field label="Hero Photo URL" field="heroPhoto" placeholder="Cloudinary URL" />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isPublic ?? true} onChange={e => updateForm('isPublic', e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-xs" style={{ color: CN.cream }}>Public rig page</span>
                  </label>
                </div>
              </div>
              <button onClick={() => saveField({ rigName: form.rigName, tagline: form.tagline, heroPhoto: form.heroPhoto, isPublic: form.isPublic })}
                disabled={saving} className="mt-4 px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50 flex items-center gap-1"
                style={{ background: CN.gold, color: CN.bg }}>
                <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save Identity'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ SPECS TAB ═══ */}
        {activeTab === 'specs' && (
          <div className="space-y-4">
            {[
              { title: 'Dimensions & Type', fields: [
                { label: 'Class', field: 'rigClass', placeholder: 'CLASS_A' },
                { label: 'Length (ft)', field: 'lengthFeet', type: 'number' },
                { label: 'Slideouts', field: 'slideoutCount', type: 'number' },
                { label: 'Gross Weight (lbs)', field: 'grossWeight', type: 'number' },
                { label: 'Towing Capacity (lbs)', field: 'towingCapacity', type: 'number' },
              ]},
              { title: 'Engine & Fuel', fields: [
                { label: 'Fuel Type', field: 'fuelType', placeholder: 'diesel / gas' },
                { label: 'Engine Size', field: 'engineSize' },
                { label: 'Chassis', field: 'chassisMake', placeholder: 'e.g. Ford F-53' },
              ]},
              { title: 'Water Systems', fields: [
                { label: 'Fresh Water (gal)', field: 'freshWaterGal', type: 'number' },
                { label: 'Gray Water (gal)', field: 'grayWaterGal', type: 'number' },
                { label: 'Black Water (gal)', field: 'blackWaterGal', type: 'number' },
              ]},
              { title: 'Tires & Roof', fields: [
                { label: 'Front Tire Size', field: 'tireSizeFront' },
                { label: 'Rear Tire Size', field: 'tireSizeRear' },
                { label: 'Roof Type', field: 'roofType', placeholder: 'rubber / fiberglass' },
              ]},
              { title: 'Purchase Info', fields: [
                { label: 'Purchase Odometer', field: 'purchaseOdometer', type: 'number' },
                { label: 'Current Odometer', field: 'currentOdometer', type: 'number' },
              ]},
            ].map(section => (
              <div key={section.title} className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                <h3 className="text-sm font-bold mb-3">{section.title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.fields.map(f => <Field key={f.field} {...f} />)}
                </div>
                <button onClick={() => {
                  const updates: any = {};
                  section.fields.forEach(f => { updates[f.field] = form[f.field]; });
                  saveField(updates);
                }} disabled={saving} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: CN.gold, color: CN.bg }}>
                  {saving ? 'Saving...' : `Save ${section.title}`}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ PILOTS TAB ═══ */}
        {activeTab === 'pilots' && (
          <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <h3 className="text-sm font-bold mb-4">Pilots & Crew</h3>
            <div className="space-y-3">
              {rig?.pilots?.map((p: any) => (
                <div key={p.userId} className="flex items-center justify-between p-3 rounded-lg" style={{ background: CN.cardAlt }}>
                  <div className="flex items-center gap-3">
                    {p.user?.profilePicture ? <img src={p.user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full" style={{ background: CN.gold }} />}
                    <div>
                      <p className="text-sm font-semibold">{p.user?.firstName} {p.user?.lastName}</p>
                      <p className="text-[11px]" style={{ color: CN.muted }}>{p.role} {p.canEdit ? '· Can edit' : ''}</p>
                    </div>
                  </div>
                  <button onClick={async () => {
                    try { await api.delete(`/rigs/${rig.id}/pilots/${p.userId}`); addLocalToast('Pilot removed', 'success'); window.location.reload(); } catch { addLocalToast('Failed', 'error'); }
                  }} className="text-xs" style={{ color: CN.muted }}>Remove</button>
                </div>
              ))}
              {(!rig?.pilots || rig.pilots.length === 0) && <p className="text-xs" style={{ color: CN.muted }}>No pilots added yet.</p>}
            </div>
            <p className="text-xs mt-4" style={{ color: CN.muted }}>Pilot invite system coming soon.</p>
          </div>
        )}

        {/* ═══ CREATOR TAB ═══ */}
        {activeTab === 'creator' && (
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <h3 className="text-sm font-bold mb-3">Creator Profile</h3>
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" checked={form.isCreatorEnabled ?? false} onChange={e => { updateForm('isCreatorEnabled', e.target.checked); saveField({ isCreatorEnabled: e.target.checked }); }} className="w-4 h-4 rounded" />
                <span className="text-sm">Enable Creator Profile</span>
              </label>
              <div className="space-y-3">
                <Field label="YouTube URL" field="youtubeUrl" placeholder="https://youtube.com/@channel" />
                <Field label="Instagram URL" field="instagramUrl" placeholder="https://instagram.com/handle" />
                <Field label="TikTok URL" field="tiktokUrl" placeholder="https://tiktok.com/@handle" />
                <Field label="Website URL" field="websiteUrl" placeholder="https://yourblog.com" />
              </div>
              <button onClick={() => saveField({ youtubeUrl: form.youtubeUrl, instagramUrl: form.instagramUrl, tiktokUrl: form.tiktokUrl, websiteUrl: form.websiteUrl })}
                disabled={saving} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50"
                style={{ background: CN.gold, color: CN.bg }}>{saving ? 'Saving...' : 'Save Creator Links'}</button>
            </div>
          </div>
        )}

        {/* ═══ DOCUMENTS TAB ═══ */}
        {activeTab === 'documents' && (
          <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <h3 className="text-sm font-bold mb-3">Document Vault</h3>
            <p className="text-xs" style={{ color: CN.muted }}>Upload and manage your rig documents — insurance, registration, title, manuals.</p>
            <p className="text-xs mt-4" style={{ color: CN.muted }}>Document management coming soon.</p>
          </div>
        )}

        {/* ═══ QR STICKER TAB ═══ */}
        {activeTab === 'qr-sticker' && (
          <QRStickerTab slug={slug!} qrData={qrData} setQrData={setQrData} qrLoading={qrLoading} setQrLoading={setQrLoading}
            privacyEnabled={privacyEnabled} setPrivacyEnabled={setPrivacyEnabled} privacyDuration={privacyDuration} setPrivacyDuration={setPrivacyDuration}
            addLocalToast={addLocalToast} rig={rig} />
        )}

        {/* ═══ DANGER ZONE ═══ */}
        {activeTab === 'danger' && (
          <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid rgba(239,68,68,0.2)` }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#ef4444' }}>Danger Zone</h3>
            <div className="space-y-3">
              <button onClick={() => saveField({ isPublic: false })} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                Make Rig Private
              </button>
              <p className="text-[11px]" style={{ color: CN.muted }}>Private rigs are only visible to you and your pilots.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QR Sticker Tab (client-side rendered sticker card) ───

function QRStickerTab({ slug, qrData, setQrData, qrLoading, setQrLoading, privacyEnabled, setPrivacyEnabled, privacyDuration, setPrivacyDuration, addLocalToast, rig }: any) {
  const stickerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const rigDisplayName = (qrData?.rigEmoji || rig?.rigEmoji || '') + ' ' + (qrData?.rigName || rig?.rigName || 'My Rig');

  const downloadSticker = async () => {
    if (!stickerRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(stickerRef.current, { scale: 2, backgroundColor: null, useCORS: true });
      const link = document.createElement('a');
      link.download = `${slug}-rig-sticker.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      addLocalToast('Failed to download sticker', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <h3 className="text-sm font-bold mb-4">Your Rig Sticker</h3>
        {qrLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: CN.gold, borderTopColor: 'transparent' }} />
          </div>
        ) : qrData?.qrCodeUrl ? (
          <div className="space-y-4">
            {/* Client-rendered sticker card */}
            <div className="flex justify-center">
              <div ref={stickerRef} style={{
                width: 300, height: 400, background: '#1B2B4B', borderRadius: 16, border: '3px solid #C9A84C',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 16px', boxSizing: 'border-box',
              }}>
                <p style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, textAlign: 'center', margin: 0, lineHeight: 1.2 }}>
                  {rigDisplayName.trim()}
                </p>
                <div style={{ background: 'white', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={qrData.qrCodeUrl} alt="QR Code" style={{ width: 180, height: 180 }} crossOrigin="anonymous" />
                </div>
                <p style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, textAlign: 'center', margin: 0 }}>
                  Scan to follow our adventure
                </p>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#C9A84C', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 700, margin: 0 }}>RVUnicorn</p>
                  <p style={{ color: '#8B9BB4', fontSize: 8, margin: 0 }}>www.rvunicorn.com</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={downloadSticker} disabled={downloading}
                className="px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: CN.gold, color: CN.bg }}>
                <Download className="w-3.5 h-3.5" /> {downloading ? 'Capturing...' : 'Download Sticker'}
              </button>
              <button onClick={() => window.open(qrData.qrCodeUrl, '_blank')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
                style={{ background: 'transparent', color: CN.gold, border: `1px solid ${CN.gold}` }}>
                Download QR Only
              </button>
            </div>
            {qrData.scanCount !== undefined && (
              <p className="text-xs text-center" style={{ color: CN.muted }}>
                Your QR has been scanned {qrData.scanCount || 0} times
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <QrCode className="w-12 h-12 mx-auto mb-3" style={{ color: CN.muted }} />
            <p className="text-xs mb-4" style={{ color: CN.muted }}>Generate a QR sticker for your rig. People can scan it to discover your rig page.</p>
            <button onClick={async () => {
              setQrLoading(true);
              try {
                const { data } = await api.post(`/rigs/${slug}/qr-code`);
                setQrData(data);
                addLocalToast('QR code generated!', 'success');
              } catch { addLocalToast('Failed to generate QR code', 'error'); }
              finally { setQrLoading(false); }
            }} className="px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110"
              style={{ background: CN.gold, color: CN.bg }}>
              Generate Sticker
            </button>
          </div>
        )}
      </div>

      {qrData?.qrCodeUrl && (
        <div className="rounded-xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          <h3 className="text-sm font-bold mb-3">Privacy Mode</h3>
          <p className="text-xs mb-3" style={{ color: CN.muted }}>When enabled, QR scanners see a friendly message instead of your rig page.</p>
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" checked={privacyEnabled} onChange={async (e) => {
              const enabled = e.target.checked;
              setPrivacyEnabled(enabled);
              const hours = privacyDuration === '2hr' ? 2 : privacyDuration === '4hr' ? 4 : privacyDuration === '8hr' ? 8 : null;
              try {
                await api.post(`/rigs/${slug}/qr-code/privacy`, { enabled, expiresInHours: hours });
                addLocalToast(enabled ? 'Privacy mode enabled' : 'Privacy mode disabled', 'success');
              } catch { setPrivacyEnabled(!enabled); addLocalToast('Failed to update privacy', 'error'); }
            }} className="w-4 h-4 rounded" />
            <span className="text-xs" style={{ color: CN.cream }}>Enable Privacy Mode</span>
          </label>
          {privacyEnabled && (
            <select value={privacyDuration} onChange={async (e) => {
              const dur = e.target.value;
              setPrivacyDuration(dur);
              const hours = dur === '2hr' ? 2 : dur === '4hr' ? 4 : dur === '8hr' ? 8 : null;
              try { await api.post(`/rigs/${slug}/qr-code/privacy`, { enabled: true, expiresInHours: hours }); addLocalToast('Duration updated', 'success'); }
              catch { addLocalToast('Failed to update', 'error'); }
            }} className="px-3 py-2 rounded-lg text-xs focus:outline-none"
              style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }}>
              <option value="2hr">2 hours</option>
              <option value="4hr">4 hours</option>
              <option value="8hr">8 hours</option>
              <option value="until_off">Until I turn off</option>
            </select>
          )}
        </div>
      )}
    </div>
  );
}
