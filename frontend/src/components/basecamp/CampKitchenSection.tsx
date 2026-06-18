import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface CampKitchenData {
  contextLabel: string;
  recipes: { id: string; title: string; imageUrl: string | null; cookingMethod: string; authorRigName: string | null; likes: number }[];
  fromRigsFollowed: { id: string; title: string; imageUrl: string | null; authorRigName: string | null }[];
}

interface Props {
  data: CampKitchenData | null;
}

type RecipeTab = 'favorites' | 'browse' | 'suggestions';

const METHOD_BADGES: Record<string, string> = {
  campfire: '\u{1F525} Campfire',
  'dutch oven': '\u{1F3FA} Dutch Oven',
  'dutch_oven': '\u{1F3FA} Dutch Oven',
  stove: '\u{1F373} Stove',
};

function getMethodBadge(method: string) {
  return METHOD_BADGES[method?.toLowerCase()] || `\u{1F37D}\uFE0F ${method || 'Recipe'}`;
}

function RecipeCard({ id, title, imageUrl, badge }: { id: string; title: string; imageUrl: string | null; badge?: string }) {
  return (
    <Link to={`/recipes/${id}`} style={{ textDecoration: 'none', minWidth: 140, maxWidth: 140, flexShrink: 0 }}>
      <div style={{ width: 140, borderRadius: 10, overflow: 'hidden', background: CN.card, border: `1px solid ${CN.border}` }}>
        <div style={{ height: 84, background: CN.cardAlt }}>
          {imageUrl ? (
            <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CN.muted, fontSize: 24 }}>{'\u{1F37D}\uFE0F'}</div>
          )}
        </div>
        <div style={{ padding: '6px 8px' }}>
          <div style={{ color: CN.cream, fontSize: 11, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
          {badge && <div style={{ marginTop: 4 }}><span style={{ background: CN.cardAlt, color: CN.muted, fontSize: 9, padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>{badge}</span></div>}
        </div>
      </div>
    </Link>
  );
}

export default function CampKitchenSection({ data }: Props) {
  const [activeTab, setActiveTab] = useState<RecipeTab>('favorites');
  const [savedRecipes, setSavedRecipes] = useState<any[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Fetch saved recipes when favorites tab is active
  useEffect(() => {
    if (activeTab === 'favorites' && savedRecipes === null && !loadingSaved) {
      setLoadingSaved(true);
      api.get('/recipes/saved')
        .then(r => setSavedRecipes(r.data?.recipes || r.data || []))
        .catch(() => setSavedRecipes([]))
        .finally(() => setLoadingSaved(false));
    }
  }, [activeTab]);

  if (data === null) {
    return (
      <div style={{ background: CN.card, borderRadius: 16, padding: 16 }}>
        <div style={{ color: CN.cream, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{'\u{1F373}'} Recipe Box</div>
        <div style={{ height: 100, borderRadius: 8, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  const recipes = data.recipes || [];
  const fromRigs = data.fromRigsFollowed || [];
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: active ? CN.gold : 'transparent',
    color: active ? CN.bg : CN.muted,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 16 }}>
      {/* Header + tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: CN.cream, fontSize: 16, fontWeight: 700 }}>{'\u{1F373}'} Recipe Box</div>
        <Link to="/recipes" style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>Browse all &rarr;</Link>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: CN.cardAlt, borderRadius: 99, padding: 3 }}>
        <button onClick={() => setActiveTab('favorites')} style={tabStyle(activeTab === 'favorites')}>My Favorites</button>
        <button onClick={() => setActiveTab('browse')} style={tabStyle(activeTab === 'browse')}>Browse</button>
        <button onClick={() => setActiveTab('suggestions')} style={tabStyle(activeTab === 'suggestions')}>For You</button>
      </div>

      {/* Favorites tab */}
      {activeTab === 'favorites' && (
        <>
          {loadingSaved && <div style={{ height: 80, borderRadius: 8, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />}
          {!loadingSaved && savedRecipes && savedRecipes.length > 0 && (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {savedRecipes.slice(0, 8).map((sr: any) => {
                const r = sr.recipe || sr;
                return <RecipeCard key={r.id} id={r.id} title={r.title} imageUrl={r.imageUrl} />;
              })}
            </div>
          )}
          {!loadingSaved && (!savedRecipes || savedRecipes.length === 0) && (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{'\u2764\uFE0F'}</div>
              <p style={{ fontSize: 12, color: CN.cream, fontWeight: 600, marginBottom: 4 }}>Save recipes you love</p>
              <p style={{ fontSize: 11, color: CN.muted, marginBottom: 10 }}>Heart any recipe and it'll live here for easy access.</p>
              <Link to="/recipes" style={{ fontSize: 12, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>Browse Recipes &rarr;</Link>
            </div>
          )}
        </>
      )}

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <>
          {recipes.length > 0 ? (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {recipes.map(r => <RecipeCard key={r.id} id={r.id} title={r.title} imageUrl={r.imageUrl} badge={getMethodBadge(r.cookingMethod)} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <p style={{ fontSize: 12, color: CN.muted }}>No community recipes yet. Be the first to share!</p>
            </div>
          )}
        </>
      )}

      {/* Suggestions tab */}
      {activeTab === 'suggestions' && (
        <>
          <div style={{ fontSize: 11, color: CN.muted, marginBottom: 8 }}>{data.contextLabel || 'Recipes for you'}</div>
          {recipes.length > 0 && (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: fromRigs.length > 0 ? 12 : 0 }}>
              {recipes.slice(0, 4).map(r => <RecipeCard key={r.id} id={r.id} title={r.title} imageUrl={r.imageUrl} badge={getMethodBadge(r.cookingMethod)} />)}
            </div>
          )}
          {fromRigs.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: CN.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>From rigs you follow</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {fromRigs.map(r => <RecipeCard key={r.id} id={r.id} title={r.title} imageUrl={r.imageUrl} />)}
              </div>
            </>
          )}
          {!recipes.length && !fromRigs.length && (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <p style={{ fontSize: 12, color: CN.muted }}>We're cooking up suggestions for you!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
