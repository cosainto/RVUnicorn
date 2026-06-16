import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface CampKitchenData {
  contextLabel: string;
  recipes: { id: string; title: string; imageUrl: string | null; cookingMethod: string; authorRigName: string | null; likes: number }[];
  fromRigsFollowed: { id: string; title: string; imageUrl: string | null; authorRigName: string | null }[];
}

interface Props {
  data: CampKitchenData | null;
}

const METHOD_BADGES: Record<string, string> = {
  campfire: '🔥 Campfire',
  'dutch oven': '🏺 Dutch Oven',
  'dutch_oven': '🏺 Dutch Oven',
  stove: '🍳 Stove',
};

function getMethodBadge(method: string) {
  return METHOD_BADGES[method.toLowerCase()] || `🍽️ ${method}`;
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ minWidth: 160, height: 180, borderRadius: 12, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

export default function CampKitchenSection({ data }: Props) {
  if (data === null) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🔥 Camp Kitchen</div>
        <div style={{ color: CN.muted, fontSize: 13, marginBottom: 16 }}>Loading...</div>
        <SkeletonRow />
      </div>
    );
  }

  const contextLabel = data.contextLabel || 'Recipes for you';
  const recipes = data.recipes || [];
  const fromRigsFollowed = data.fromRigsFollowed || [];
  if (!recipes.length && !fromRigsFollowed.length) return null;

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🔥 Camp Kitchen</div>
      <div style={{ color: CN.muted, fontSize: 13, marginBottom: 16 }}>{contextLabel}</div>

      {recipes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {recipes.map((r) => (
              <Link key={r.id} to={`/recipes/${r.id}`} style={{ textDecoration: 'none', minWidth: 160, maxWidth: 160 }}>
                <div style={{ width: 160, borderRadius: 12, overflow: 'hidden', background: CN.card, border: `1px solid ${CN.border}` }}>
                  <div style={{ height: 96, background: CN.cardAlt }}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CN.muted, fontSize: 28 }}>🍽️</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ color: CN.cream, fontSize: 11, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{ background: CN.cardAlt, color: CN.muted, fontSize: 10, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{getMethodBadge(r.cookingMethod)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {fromRigsFollowed.length > 0 && (
        <div>
          <div style={{ color: CN.muted, fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>What rigs you follow are cooking</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {fromRigsFollowed.map((r) => (
              <Link key={r.id} to={`/recipes/${r.id}`} style={{ textDecoration: 'none', minWidth: 130, maxWidth: 130 }}>
                <div style={{ width: 130, borderRadius: 10, overflow: 'hidden', background: CN.card, border: `1px solid ${CN.border}` }}>
                  <div style={{ height: 72, background: CN.cardAlt }}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CN.muted, fontSize: 22 }}>🍽️</div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: CN.cream, fontSize: 10, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    {r.authorRigName && <div style={{ color: CN.muted, fontSize: 9, marginTop: 2 }}>{r.authorRigName}</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
