import HitchAIAssistant from '../components/HitchAIAssistant';

export default function HitchAIPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/hitch.png" alt="Hitch" className="w-12 h-12 rounded-full object-cover shadow-lg" />
          <h1 className="text-2xl font-bold text-gray-900">Hitch AI</h1>
        </div>
        <p className="text-gray-500 text-sm">Your personal RV travel planning companion</p>
      </div>
      <div style={{ height: '70vh' }}>
        <HitchAIAssistant />
      </div>
    </div>
  );
}
