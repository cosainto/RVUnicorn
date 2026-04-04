interface CampgroundData {
  id: string;
  name: string;
  description: string | null;
  location: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  customSlug: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  businessPhone: string | null;
  phone: string | null;
  googleRating: number | null;
  photos: { imageUrl: string }[];
}

interface CampgroundStats {
  followers: number;
  checkIns: number;
  reviews: number;
  photos: number;
}

interface ReviewData {
  rating: number;
  review: string | null;
  title: string | null;
  createdAt: Date;
  user: { firstName: string; lastName: string; username: string };
}

interface EventData {
  title: string;
  startDate: Date;
  description: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateISO(date: Date): string {
  return new Date(date).toISOString().split('T')[0];
}

export function renderCampgroundPage(
  campground: CampgroundData,
  stats: CampgroundStats,
  reviews: ReviewData[],
  events: EventData[]
): string {
  const slug = campground.customSlug || campground.id;
  const canonicalUrl = `https://rvunicorn.com/campgrounds/${slug}`;
  const phone = campground.businessPhone || campground.phone || '';
  const rating = campground.googleRating || 0;
  const description = campground.description || '';
  const stateStr = campground.state || '';
  const locationStr = campground.location || '';

  const ogImage = campground.photos.length > 0
    ? campground.photos[0].imageUrl
    : (campground.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png');

  const metaDescription = `Camp at ${escapeHtml(campground.name)} in ${escapeHtml(locationStr)}, ${escapeHtml(stateStr)}. ${stats.checkIns} RVers have checked in. See reviews, amenities, and upcoming events on RVUnicorn.`;
  const ogDescription = truncate(description, 160);

  // JSON-LD structured data
  const amenityFeatures = campground.amenities.map(a => ({
    '@type': 'LocationFeatureSpecification',
    name: a,
    value: true,
  }));

  const reviewSchema = reviews.slice(0, 3).map(r => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.username },
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
    reviewBody: r.review || '',
    datePublished: formatDateISO(r.createdAt),
  }));

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Campground',
    name: campground.name,
    description: description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locationStr,
      addressRegion: stateStr,
      addressCountry: 'US',
    },
    url: campground.websiteUrl || canonicalUrl,
  };

  if (campground.latitude && campground.longitude) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: campground.latitude,
      longitude: campground.longitude,
    };
  }

  if (phone) jsonLd.telephone = phone;

  if (amenityFeatures.length > 0) {
    jsonLd.amenityFeature = amenityFeatures;
  }

  if (stats.reviews > 0 && rating > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount: stats.reviews,
    };
  }

  if (reviewSchema.length > 0) {
    jsonLd.review = reviewSchema;
  }

  // Build review HTML
  const reviewsHtml = reviews.length > 0 ? `
    <section>
      <h2>Recent Reviews</h2>
      ${reviews.map(r => `
        <article>
          <p>${r.rating}/5 — ${escapeHtml(`${r.user.firstName} ${r.user.lastName}`.trim() || r.user.username)}</p>
          ${r.review ? `<p>${escapeHtml(r.review)}</p>` : ''}
          <time datetime="${formatDateISO(r.createdAt)}">${formatDate(r.createdAt)}</time>
        </article>
      `).join('')}
    </section>` : '';

  // Build events HTML
  const eventsHtml = events.length > 0 ? `
    <section>
      <h2>Upcoming Events at ${escapeHtml(campground.name)}</h2>
      ${events.map(e => `
        <article>
          <h3>${escapeHtml(e.title)}</h3>
          <time datetime="${formatDateISO(e.startDate)}">${formatDate(e.startDate)}</time>
          ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ''}
        </article>
      `).join('')}
    </section>` : '';

  // Build amenities HTML
  const amenitiesHtml = campground.amenities.length > 0 ? `
    <section>
      <h2>Amenities</h2>
      <ul>${campground.amenities.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(campground.name)} - RV Campground in ${escapeHtml(stateStr)} | RVUnicorn</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">

  <meta property="og:title" content="${escapeHtml(campground.name)} | RVUnicorn">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(campground.name)} | RVUnicorn">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">

  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/png" href="/images/Logo_RVUnicorn.png">

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a2e4a; }
    h1 { margin-bottom: 4px; }
    h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    article { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6; }
    time { color: #6b7280; font-size: 0.875rem; }
    a { color: #2563eb; }
    ul { columns: 2; }
    #ssr-content { }
  </style>
</head>
<body>
  <div id="ssr-content">
    <header>
      <h1>${escapeHtml(campground.name)}</h1>
      <p>${escapeHtml(locationStr)}${stateStr ? ', ' + escapeHtml(stateStr) : ''}</p>
      <p>${rating > 0 ? rating + '/5' : ''} ${stats.checkIns} check-ins · ${stats.followers} followers</p>
    </header>

    <main>
      ${description ? `
      <section>
        <h2>About ${escapeHtml(campground.name)}</h2>
        <p>${escapeHtml(description)}</p>
      </section>` : ''}

      ${amenitiesHtml}
      ${reviewsHtml}
      ${eventsHtml}

      <section>
        <h2>About RVUnicorn</h2>
        <p>RVUnicorn is the social platform for RV enthusiasts. Discover campgrounds, connect with fellow campers, and plan your next adventure.</p>
        <a href="https://rvunicorn.com">Join RVUnicorn free</a>
      </section>
    </main>
  </div>

  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var root = document.getElementById('root');
      var observer = new MutationObserver(function() {
        if (root.children.length > 0) {
          var ssr = document.getElementById('ssr-content');
          if (ssr) ssr.remove();
          observer.disconnect();
        }
      });
      observer.observe(root, { childList: true });
    });
  </script>
</body>
</html>`;
}

export function renderCommunityBoardPage(
  board: { name: string; slug: string; postCount: number },
  threads: { title: string; content: string | null; author: { firstName: string; lastName: string; username: string }; createdAt: Date; _count: { posts: number } }[]
): string {
  const canonicalUrl = `https://rvunicorn.com/community/${board.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: board.name,
    url: canonicalUrl,
    about: {
      '@type': 'Thing',
      name: 'RV Community Discussion',
    },
  };

  const threadsHtml = threads.map(t => `
    <article>
      <h3>${escapeHtml(t.title)}</h3>
      <p>by ${escapeHtml(`${t.author.firstName} ${t.author.lastName}`.trim() || t.author.username)} · ${t._count.posts} replies</p>
      ${t.content ? `<p>${escapeHtml(truncate(t.content, 200))}</p>` : ''}
      <time datetime="${formatDateISO(t.createdAt)}">${formatDate(t.createdAt)}</time>
    </article>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(board.name)} - RV Community Discussion | RVUnicorn</title>
  <meta name="description" content="Join ${board.postCount} RVers discussing ${escapeHtml(board.name)} on RVUnicorn. Tips, advice, and real experiences from the road.">

  <meta property="og:title" content="${escapeHtml(board.name)} | RVUnicorn Community">
  <meta property="og:description" content="Join ${board.postCount} RVers discussing ${escapeHtml(board.name)} on RVUnicorn.">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">

  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/png" href="/images/Logo_RVUnicorn.png">

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a2e4a; }
    h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    article { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6; }
    time { color: #6b7280; font-size: 0.875rem; }
    a { color: #2563eb; }
    #ssr-content { }
  </style>
</head>
<body>
  <div id="ssr-content">
    <header>
      <h1>${escapeHtml(board.name)}</h1>
      <p>${board.postCount} discussions</p>
    </header>

    <main>
      <section>
        <h2>Recent Discussions</h2>
        ${threadsHtml}
      </section>

      <section>
        <h2>About RVUnicorn</h2>
        <p>RVUnicorn is the social platform for RV enthusiasts. Discover campgrounds, connect with fellow campers, and plan your next adventure.</p>
        <a href="https://rvunicorn.com">Join RVUnicorn free</a>
      </section>
    </main>
  </div>

  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var root = document.getElementById('root');
      var observer = new MutationObserver(function() {
        if (root.children.length > 0) {
          var ssr = document.getElementById('ssr-content');
          if (ssr) ssr.remove();
          observer.disconnect();
        }
      });
      observer.observe(root, { childList: true });
    });
  </script>
</body>
</html>`;
}
