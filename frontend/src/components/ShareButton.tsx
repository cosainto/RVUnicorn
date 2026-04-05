import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X, Copy, Check } from 'lucide-react';

const SITE = 'https://www.rvunicorn.com';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  className?: string;
  variant?: 'icon' | 'button';
}

export default function ShareButton({ title, text, url, className = '', variant = 'button' }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const fullUrl = url.startsWith('http') ? url : SITE + url;
  const eu = encodeURIComponent(fullUrl);
  const et = encodeURIComponent(text);
  const en = encodeURIComponent(title);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowModal(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const socials = [
    { name: 'Facebook', bg: '#1877F2', icon: String.fromCodePoint(0x1F4D8), href: 'https://www.facebook.com/sharer/sharer.php?u=' + eu + '&quote=' + et },
    { name: 'X / Twitter', bg: '#000000', icon: 'X', href: 'https://twitter.com/intent/tweet?text=' + et + '&url=' + eu },
    { name: 'Reddit', bg: '#FF4500', icon: String.fromCodePoint(0x1F916), href: 'https://www.reddit.com/submit?url=' + eu + '&title=' + en },
    { name: 'WhatsApp', bg: '#25D366', icon: String.fromCodePoint(0x1F4AC), href: 'https://wa.me/?text=' + et + '%20' + eu },
    { name: 'Threads', bg: '#000000', icon: String.fromCodePoint(0x1F9F5), href: 'https://www.threads.net/intent/post?text=' + et + '%20' + eu },
    { name: 'Email', bg: '#666666', icon: String.fromCodePoint(0x2709, 0xFE0F), href: 'mailto:?subject=' + en + '&body=' + et + '%0A%0A' + eu },
  ];

  return (
    <>
      {variant === 'icon' ? (
        <button onClick={handleShare} className={'p-2 rounded-full hover:bg-gray-100 transition ' + className} title="Share">
          <Share2 className="w-5 h-5 text-gray-500" />
        </button>
      ) : (
        <button onClick={handleShare} className={'flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg text-sm font-medium transition ' + className}>
          <Share2 className="w-4 h-4" />
          Share
        </button>
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Share</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{text}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {socials.map(s => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => setShowModal(false)} style={{ backgroundColor: s.bg }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 transition hover:opacity-90">
                  <span className="text-lg">{s.icon}</span>
                  <span style={{ fontSize: '10px' }} className="font-medium">{s.name}</span>
                </a>
              ))}
            </div>
            <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm text-gray-700">
              {copied ? <><Check className="w-4 h-4 text-green-500" />Copied!</> : <><Copy className="w-4 h-4" />Copy Link</>}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
