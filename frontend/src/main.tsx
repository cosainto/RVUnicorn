import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Auto-reload on chunk load failure (happens after deploys when old chunks are gone)
window.addEventListener('error', (e) => {
  if (e.message?.includes('Loading chunk') || e.message?.includes('Failed to fetch dynamically imported module')) {
    const reloaded = sessionStorage.getItem('chunk_reload');
    if (!reloaded) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
    }
  }
});

// Clear reload flag on successful page load
sessionStorage.removeItem('chunk_reload');

// Global patch: ensure ALL file inputs support multi-select (iOS fix)
const patchFileInputs = () => {
  document.querySelectorAll('input[type="file"]').forEach((input: any) => {
    if (!input.hasAttribute('multiple')) {
      input.setAttribute('multiple', '');
    }
    if (input.accept && !input.accept.includes('heic')) {
      input.accept = input.accept + ',image/heic,image/heif';
    }
  });
};
const mo = new MutationObserver(() => patchFileInputs());
mo.observe(document.body || document.documentElement, { childList: true, subtree: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
// force rebuild Wed Mar 11 23:41:52 CDT 2026
// build marker Sun Mar 15 12:07:59 CDT 2026
