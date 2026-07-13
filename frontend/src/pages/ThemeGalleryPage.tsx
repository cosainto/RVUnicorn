/**
 * /dev/theme — Component gallery showing every cartoon primitive
 * in both "full" and "subtle" intensities.
 */
import { useState } from 'react';
import {
  CButton, CCard, CInput, CTextarea, CBadge, CModal, CTabs,
  CToast, CSectionHeader, CSkeleton, CSelect, WaveDivider,
  SquiggleUnderline, SparkStar, CN,
} from '../components/ui/CartoonPrimitives';

export default function ThemeGalleryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIntensity, setModalIntensity] = useState<'full' | 'subtle'>('subtle');
  const [activeTab, setActiveTab] = useState('tab1');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (type: 'success' | 'error' | 'info') => {
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  return (
    <div style={{ background: CN.deep, minHeight: '100vh', color: CN.cream }}>
      <CToast message={`This is a ${toastType} toast!`} type={toastType} visible={toastVisible} />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold font-display mb-2" style={{ color: CN.gold }}>
          🎨 Cartoon Theme Gallery
        </h1>
        <p className="text-sm mb-12" style={{ color: CN.muted }}>
          Every shared primitive in both "full" (marketing) and "subtle" (functional) intensities.
        </p>

        {/* ── SECTION HEADERS ─────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Section Headers</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl" style={{ background: CN.navy }}>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>FULL INTENSITY</p>
              <CSectionHeader intensity="full" subtitle="Supporting text goes here">
                Your Adventure Awaits
              </CSectionHeader>
            </div>
            <div className="p-6 rounded-xl" style={{ background: CN.navy }}>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>SUBTLE INTENSITY</p>
              <CSectionHeader intensity="subtle" subtitle="Supporting text goes here">
                Your Adventure Awaits
              </CSectionHeader>
            </div>
          </div>
        </div>

        {/* ── BUTTONS ─────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Buttons</p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl" style={{ background: CN.navy }}>
              <p className="text-[10px] font-bold mb-4" style={{ color: CN.muted }}>FULL INTENSITY</p>
              <div className="flex flex-wrap gap-3">
                <CButton intensity="full" variant="primary">Primary</CButton>
                <CButton intensity="full" variant="secondary">Secondary</CButton>
                <CButton intensity="full" variant="outline">Outline</CButton>
                <CButton intensity="full" variant="danger">Danger</CButton>
                <CButton intensity="full" variant="ghost">Ghost</CButton>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <CButton intensity="full" size="sm">Small</CButton>
                <CButton intensity="full" size="md">Medium</CButton>
                <CButton intensity="full" size="lg">Large</CButton>
              </div>
            </div>

            <div className="p-6 rounded-xl" style={{ background: CN.navy }}>
              <p className="text-[10px] font-bold mb-4" style={{ color: CN.muted }}>SUBTLE INTENSITY</p>
              <div className="flex flex-wrap gap-3">
                <CButton intensity="subtle" variant="primary">Primary</CButton>
                <CButton intensity="subtle" variant="secondary">Secondary</CButton>
                <CButton intensity="subtle" variant="outline">Outline</CButton>
                <CButton intensity="subtle" variant="danger">Danger</CButton>
                <CButton intensity="subtle" variant="ghost">Ghost</CButton>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <CButton intensity="subtle" size="sm">Small</CButton>
                <CButton intensity="subtle" size="md">Medium</CButton>
                <CButton intensity="subtle" size="lg">Large</CButton>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARDS ───────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Cards</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>FULL — sticker style</p>
              <div className="flex gap-4">
                <CCard intensity="full" rotation={-2} className="flex-1">
                  <span className="text-3xl block mb-2">🏕️</span>
                  <h4 className="font-bold font-display" style={{ color: CN.cream }}>Campground</h4>
                  <p className="text-xs mt-1" style={{ color: CN.muted }}>A sticker card with rotation</p>
                </CCard>
                <CCard intensity="full" rotation={1.5} className="flex-1">
                  <span className="text-3xl block mb-2">🗺️</span>
                  <h4 className="font-bold font-display" style={{ color: CN.cream }}>Travel Map</h4>
                  <p className="text-xs mt-1" style={{ color: CN.muted }}>Opposite rotation</p>
                </CCard>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>SUBTLE — functional</p>
              <CCard intensity="subtle">
                <h4 className="font-bold text-sm" style={{ color: CN.cream }}>Trip Details</h4>
                <p className="text-xs mt-1" style={{ color: CN.muted }}>A functional card with thick outlines and cel shadow, no rotation. Works for data-heavy views.</p>
                <div className="flex gap-2 mt-3">
                  <CButton size="sm" variant="primary">Save</CButton>
                  <CButton size="sm" variant="secondary">Cancel</CButton>
                </div>
              </CCard>
            </div>
          </div>
        </div>

        {/* ── INPUTS ──────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Inputs & Selects</p>
          <div className="grid md:grid-cols-2 gap-8">
            <CCard intensity="subtle">
              <div className="space-y-4">
                <CInput label="Campground Name" placeholder="e.g., Yellowstone Grizzly RV Park" />
                <CInput label="Location" placeholder="City, State" />
                <CSelect label="Category" options={[
                  { value: 'CAMPGROUND', label: '🏕 Campground' },
                  { value: 'RESTAURANT', label: '🍽 Restaurant' },
                  { value: 'HIKING_TRAIL', label: '🥾 Hiking Trail' },
                  { value: 'ATTRACTION', label: '🎡 Attraction' },
                ]} />
                <CTextarea label="Notes" placeholder="What was memorable about this place?" rows={3} />
              </div>
            </CCard>
            <CCard intensity="subtle">
              <p className="text-xs font-bold mb-3" style={{ color: CN.muted }}>Disabled state</p>
              <CInput placeholder="Disabled input" disabled />
              <p className="text-xs font-bold mt-4 mb-3" style={{ color: CN.muted }}>With value</p>
              <CInput value="Alamogordo / White Sands KOA Journey" readOnly />
            </CCard>
          </div>
        </div>

        {/* ── BADGES ──────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Badges</p>
          <div className="flex flex-wrap gap-3">
            <CBadge color="gold">🏕 Campground</CBadge>
            <CBadge color="orange">🍽 Restaurant</CBadge>
            <CBadge color="green">🥾 Trail</CBadge>
            <CBadge color="muted">📍 Landmark</CBadge>
            <CBadge color="cream">⭐ Featured</CBadge>
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Tabs</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>FULL</p>
              <CTabs intensity="full" active={activeTab} onChange={setActiveTab}
                tabs={[
                  { id: 'tab1', label: 'Photos', icon: '📸' },
                  { id: 'tab2', label: 'Reviews', icon: '⭐' },
                  { id: 'tab3', label: 'Map', icon: '🗺️' },
                ]} />
            </div>
            <div>
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>SUBTLE</p>
              <CTabs intensity="subtle" active={activeTab} onChange={setActiveTab}
                tabs={[
                  { id: 'tab1', label: 'Photos', icon: '📸' },
                  { id: 'tab2', label: 'Reviews', icon: '⭐' },
                  { id: 'tab3', label: 'Map', icon: '🗺️' },
                ]} />
            </div>
          </div>
        </div>

        {/* ── TOASTS ──────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Toasts</p>
          <div className="flex gap-3">
            <CButton size="sm" variant="primary" onClick={() => showToast('success')}>Success Toast</CButton>
            <CButton size="sm" variant="danger" onClick={() => showToast('error')}>Error Toast</CButton>
            <CButton size="sm" variant="secondary" onClick={() => showToast('info')}>Info Toast</CButton>
          </div>
        </div>

        {/* ── MODALS ──────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Modals</p>
          <div className="flex gap-3">
            <CButton size="sm" onClick={() => { setModalIntensity('full'); setModalOpen(true); }}>Full Modal</CButton>
            <CButton size="sm" variant="secondary" onClick={() => { setModalIntensity('subtle'); setModalOpen(true); }}>Subtle Modal</CButton>
          </div>
          <CModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Pick a Location" intensity={modalIntensity}>
            <div className="space-y-4">
              <CInput placeholder="Search places..." />
              <div className="flex flex-wrap gap-2">
                <CBadge color="gold">🏕 Campground</CBadge>
                <CBadge color="orange">🍽 Restaurant</CBadge>
                <CBadge color="green">🥾 Trail</CBadge>
              </div>
              <CButton className="w-full">Select Place</CButton>
            </div>
          </CModal>
        </div>

        {/* ── SKELETONS ───────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>Loading Skeletons</p>
          <CCard intensity="subtle">
            <div className="space-y-3">
              <CSkeleton width="60%" height={16} />
              <CSkeleton height={12} />
              <CSkeleton height={12} />
              <CSkeleton width="40%" height={12} />
            </div>
          </CCard>
        </div>

        {/* ── SVG ACCENTS ─────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>SVG Accents</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>Squiggle Underline</p>
              <h3 className="text-xl font-bold font-display" style={{ color: CN.cream }}>A Title</h3>
              <SquiggleUnderline width={100} />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>Spark Stars</p>
              <div className="flex justify-center gap-4">
                <SparkStar size={12} className="animate-pulse" />
                <SparkStar size={20} />
                <SparkStar size={16} color={CN.orange} className="animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold mb-3" style={{ color: CN.muted }}>Wave Divider</p>
              <div className="rounded-lg overflow-hidden" style={{ background: CN.navyLight }}>
                <div className="h-8" />
                <WaveDivider color={CN.navy} />
                <div className="h-8" style={{ background: CN.navy }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── CSS UTILITY CLASSES ─────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.orange }}>CSS Utility Classes</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="cel-shadow cartoon-outline cartoon-rounded p-4 text-center" style={{ background: CN.navy }}>
              <p className="text-xs font-bold" style={{ color: CN.cream }}>.cel-shadow .cartoon-outline .cartoon-rounded</p>
            </div>
            <div className="cel-shadow-gold cartoon-outline-gold cartoon-rounded-lg p-4 text-center" style={{ background: CN.navy }}>
              <p className="text-xs font-bold" style={{ color: CN.cream }}>.cel-shadow-gold .cartoon-outline-gold</p>
            </div>
            <div className="sticker p-4 text-center" style={{ transform: 'rotate(-2deg)' }}>
              <p className="text-xs font-bold" style={{ color: CN.cream }}>.sticker (hover me)</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
