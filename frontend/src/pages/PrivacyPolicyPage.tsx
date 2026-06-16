import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Menu } from 'lucide-react';

const SECTIONS = [
  { id: 'info-collect', title: '1. Information We Collect' },
  { id: 'how-use', title: '2. How We Use Your Information' },
  { id: 'sms', title: '3. SMS Communications' },
  { id: 'sharing', title: '4. How We Share Your Information' },
  { id: 'retention', title: '5. Data Retention' },
  { id: 'rights', title: '6. Your Rights and Choices' },
  { id: 'children', title: '7. Children\'s Privacy' },
  { id: 'security', title: '8. Data Security' },
  { id: 'third-party', title: '9. Third-Party Links' },
  { id: 'ai', title: '10. AI-Powered Features' },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'contact', title: '12. Contact' },
];

export default function PrivacyPolicyPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2 id={id} className="text-xl font-bold mt-12 mb-4 pt-4 scroll-mt-24" style={{ color: '#F5F0E8' }}>{children}</h2>
  );
  const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-lg font-semibold mt-6 mb-2" style={{ color: '#F5F0E8' }}>{children}</h3>
  );
  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed text-[15px]" style={{ color: 'rgba(245,240,232,0.75)' }}>{children}</p>
  );
  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="mb-1.5 text-[15px] leading-relaxed" style={{ color: 'rgba(245,240,232,0.7)' }}>{children}</li>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0F1C35', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:flex lg:gap-12">

        {/* Sidebar TOC — desktop sticky, mobile accordion */}
        <aside className="lg:w-56 flex-shrink-0 mb-8 lg:mb-0">
          {/* Mobile toggle */}
          <button onClick={() => setTocOpen(!tocOpen)} className="lg:hidden flex items-center gap-2 w-full p-3 rounded-lg mb-4" style={{ background: '#1a2d4a', color: '#E8A838' }}>
            <Menu size={16} /> Table of Contents {tocOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>
          <nav className={`lg:sticky lg:top-24 space-y-1 ${tocOpen ? 'block' : 'hidden lg:block'}`}>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setTocOpen(false)}
                className="block text-[13px] py-1.5 px-2 rounded transition-colors hover:bg-white/5"
                style={{ color: 'rgba(245,240,232,0.55)' }}
              >{s.title}</a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">&#x1F984;</span>
            <h1 className="text-3xl font-bold" style={{ color: '#F5F0E8' }}>RVUnicorn Privacy Policy</h1>
          </div>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,240,232,0.5)' }}>Effective Date: April 12, 2026 &middot; Last Updated: April 12, 2026</p>

          <P>RVUnicorn LLC ("RVUnicorn", "we", "our", or "us") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, share, and protect information when you use our website, mobile application, and all associated services including Hitch AI, Basecamp, Trip Planning, Creator Network, Campground tools, and SMS notifications.</P>
          <P>By using RVUnicorn, you agree to this Privacy Policy. If you do not agree, please do not use our services.</P>

          {/* Section 1 */}
          <H2 id="info-collect">1. Information We Collect</H2>

          <H3>1.1 Information You Provide Directly</H3>
          <P><strong style={{ color: '#F5F0E8' }}>Account Information:</strong> When you create an account, we collect your name, email address, username, password (encrypted), and optionally your mobile phone number, profile photo, and biography.</P>
          <P><strong style={{ color: '#F5F0E8' }}>RV Profile Information:</strong> We collect details about your recreational vehicle including make, model, year, type (Class A/B/C, fifth wheel, van, etc.), length, height, weight, fuel type, MPG, license plate, odometer, and any nickname you give your rig. This information is used to provide personalized trip intelligence, rig fit checks at campgrounds, fuel cost estimates, and route safety warnings.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Location and Travel Information:</strong> We collect your home city and state, travel preferences, states visited, campground check-ins, trip routes, road trip stops, and destination campgrounds. This powers your Travel Map, Trip Intelligence system, and community features.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Content You Create:</strong> We collect photos, videos, albums, scrapbook pins, trip stories, recipes, community posts, threads, comments, reactions, reviews, ratings, creator content, Trip Kits, activity logs, and any other content you post on RVUnicorn.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Communications:</strong> We collect messages you send via Road Chat, Campfire Chat, household messaging, activity instance group chats, and direct messages. We also collect your Hitch AI conversation history to provide context-aware responses.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Payment Information:</strong> If you purchase a campground owner subscription (Base Camp or Summit tier), we collect billing information through our payment processor. RVUnicorn does not store raw credit card numbers.</P>

          <H3>1.2 Information We Collect Automatically</H3>
          <P><strong style={{ color: '#F5F0E8' }}>Device and Usage Information:</strong> We automatically collect your IP address, browser type, operating system, device identifiers, pages visited, features used, time spent, and referring URLs.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Location Data:</strong> With your permission, we collect precise GPS location for features including auto check-in (geo-fence detection), proximity-based campground discovery, Passenger Mode driving safety, and "nearby campers" features. You can disable location access in your device settings at any time.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Push Notification Tokens:</strong> If you enable push notifications, we store a device token (VAPID-based web push subscription) to deliver notifications to your device.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Cookies and Local Storage:</strong> We use cookies and browser local storage for session management, preference storage, and keeping you logged in.</P>

          <H3>1.3 Information from Third Parties</H3>
          <P><strong style={{ color: '#F5F0E8' }}>Campground Data:</strong> We import and maintain campground data from Recreation.gov, state park systems, and other public sources to power our campground directory of 14,000+ locations.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Booking Partners:</strong> If you click through to book a campground via Campspot or other affiliate partners, we may receive confirmation of completed bookings for analytics purposes. We are an affiliate partner with AWIN (publisher ID: 2799516).</P>
          <P><strong style={{ color: '#F5F0E8' }}>Social Login:</strong> If you sign in via Facebook or other social providers, we receive your name, email, and profile photo from that provider per their terms and your privacy settings.</P>

          {/* Section 2 */}
          <H2 id="how-use">2. How We Use Your Information</H2>
          <P>We use your information to:</P>
          <H3>Platform Operations</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Provide, maintain, and improve all RVUnicorn features</Li>
            <Li>Authenticate your account and keep it secure</Li>
            <Li>Process campground owner subscriptions</Li>
            <Li>Deliver push notifications and email communications</Li>
            <Li>Send SMS notifications you have opted into</Li>
          </ul>
          <H3>Personalization</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Power Hitch AI with context about your rig, trips, and travel history to give you relevant advice</Li>
            <Li>Generate your Trip Confidence Score and pre-trip intelligence briefings</Li>
            <Li>Suggest campgrounds, creators, and activities matching your profile and upcoming trips</Li>
            <Li>Show you your Travel Map, badges, and journey history</Li>
          </ul>
          <H3>Community Features</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Display your profile, content, and activity to other RVUnicorn members per your privacy settings</Li>
            <Li>Enable Campfire Chat, Road Chat, and group activity coordination</Li>
            <Li>Surface relevant creator content based on your trip destinations</Li>
            <Li>Power the Weekly Campfire community threads</Li>
          </ul>
          <H3>Campground Owner Tools (Summit/Base Camp tier)</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Provide campground operators with check-in data, engagement analytics, and guest communication tools</Li>
            <Li>Enable broadcast messages from verified campground owners to their checked-in guests who have SMS/push notifications enabled</Li>
            <Li>Power the Organizer Dashboard and Mission Mode</Li>
          </ul>
          <H3>Safety</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Deliver Passenger Mode driving safety alerts</Li>
            <Li>Send high-wind, weather, and rig-fit warnings before your trips</Li>
            <Li>Detect and prevent fraudulent or abusive activity</Li>
          </ul>
          <H3>Analytics and Improvement</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Understand how features are used to improve the platform</Li>
            <Li>Generate aggregate, anonymized insights about campground activity for campground owner dashboards</Li>
            <Li>Track the performance of community content</Li>
          </ul>

          {/* Section 3 */}
          <H2 id="sms">3. SMS Communications</H2>
          <H3>3.1 Types of SMS We Send</H3>
          <P>RVUnicorn sends the following categories of SMS to opted-in users:</P>
          <P><strong style={{ color: '#F5F0E8' }}>Trip & Safety Alerts:</strong> Pre-departure briefings, high-wind warnings, rig fit alerts, fatigue risk warnings, and weather changes affecting your planned route.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Check-In & Community:</strong> Campground check-in prompts, campfire trivia notifications, activity invites from other campers, friend trip overlap alerts, and trip anniversary reminders.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Campground Owner Broadcasts:</strong> Verified campground owners (Base Camp and Summit tier) may send broadcast messages to guests who are currently checked in at their campground AND have SMS notifications enabled. These messages include welcome messages, schedule changes, amenity alerts, and weather notices. Campground owners do not have access to your phone number — messages are delivered through RVUnicorn's infrastructure.</P>

          <H3>3.2 SMS Consent</H3>
          <P>SMS notifications are disabled by default. You may opt in via account settings at rvunicorn.com/settings. Each notification category has its own toggle. You must actively enable SMS for each category you wish to receive.</P>

          <H3>3.3 SMS Opt-Out</H3>
          <P>Reply STOP to any RVUnicorn SMS to unsubscribe from all SMS messages immediately. You will receive one final confirmation message. You may also disable SMS at any time at rvunicorn.com/settings.</P>

          <H3>3.4 SMS Provider</H3>
          <P>RVUnicorn uses Twilio, Inc. as our SMS delivery provider. Messages are sent from +1 (413) 296-8875, a registered 10DLC number. Twilio's privacy policy is available at twilio.com/legal/privacy. Your phone number is never shared with campground owners or other users.</P>

          <H3>3.5 Message Frequency and Rates</H3>
          <P>Message frequency varies based on your activity and notification settings. Message and data rates may apply. RVUnicorn is not responsible for carrier charges.</P>

          {/* Section 4 */}
          <H2 id="sharing">4. How We Share Your Information</H2>
          <P>We do not sell your personal information. We do not share your information with advertisers.</P>
          <P>We may share information with:</P>
          <H3>Service Providers</H3>
          <ul className="list-disc pl-6 mb-4">
            <Li>Railway (cloud hosting)</Li>
            <Li>Cloudinary (photo and video storage)</Li>
            <Li>Resend (email delivery, domain: updates.rvunicorn.com)</Li>
            <Li>Twilio (SMS delivery)</Li>
            <Li>HERE Maps (routing and geocoding)</Li>
            <Li>Google Maps (mapping features)</Li>
            <Li>Anthropic (Hitch AI responses via Claude API)</Li>
          </ul>
          <P>These providers access only the data necessary to perform their services and are bound by confidentiality obligations.</P>
          <H3>Other Users</H3>
          <P>Content you post publicly (profile, trips marked public, creator content, community posts, scrapbooks you share, reviews) is visible to other RVUnicorn members and potentially the public depending on your privacy settings.</P>
          <H3>Campground Owners</H3>
          <P>Campground owners with a claimed listing can see anonymized aggregate activity data (check-in counts, engagement levels). Summit tier owners can see the names and RV types of guests who are currently checked in. Your phone number and email address are never shared with campground owners.</P>
          <H3>Legal Requirements</H3>
          <P>We may disclose information if required by law, court order, or to protect the safety of our users or the public.</P>
          <H3>Business Transfer</H3>
          <P>In the event of a merger, acquisition, or sale of assets, user information may be transferred as part of that transaction. We will notify users via email before any such transfer.</P>

          {/* Section 5 */}
          <H2 id="retention">5. Data Retention</H2>
          <P>We retain your account information for as long as your account is active. If you delete your account, we begin deletion of your personal data within 30 days, except where retention is required by law or for legitimate business purposes (such as fraud prevention).</P>
          <P>Content you have shared publicly (reviews, community posts) may remain visible in anonymized or aggregated form after account deletion.</P>
          <P>SMS logs are retained for 90 days for compliance and debugging purposes, then deleted.</P>

          {/* Section 6 */}
          <H2 id="rights">6. Your Rights and Choices</H2>
          <P>You have the right to:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li><strong style={{ color: '#F5F0E8' }}>Access:</strong> Request a copy of the personal data we hold about you by contacting hello@rvunicorn.com.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Correction:</strong> Update your account information at any time via rvunicorn.com/profile/edit.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Deletion:</strong> Request deletion of your account and personal data by contacting hello@rvunicorn.com or using the account deletion feature in settings.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Opt-Out of SMS:</strong> Reply STOP to any message or visit rvunicorn.com/settings.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Opt-Out of Email:</strong> Use the unsubscribe link in any RVUnicorn email or visit rvunicorn.com/settings.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Disable Location:</strong> Turn off location permissions for RVUnicorn in your device settings at any time.</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Push Notifications:</strong> Disable push notifications in your browser or device settings, or toggle them off at rvunicorn.com/settings.</Li>
          </ul>
          <H3>California Residents (CCPA)</H3>
          <P>California residents have the right to know what personal information we collect and how it is used, the right to delete personal information, and the right to opt out of sale (we do not sell personal information). To exercise these rights, contact hello@rvunicorn.com.</P>

          {/* Section 7 */}
          <H2 id="children">7. Children's Privacy</H2>
          <P>RVUnicorn is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact hello@rvunicorn.com and we will delete it.</P>

          {/* Section 8 */}
          <H2 id="security">8. Data Security</H2>
          <P>We implement industry-standard security measures including encrypted data transmission (HTTPS/TLS), hashed passwords (bcrypt), and access controls. No system is completely secure. If you discover a security vulnerability, please report it to hello@rvunicorn.com.</P>

          {/* Section 9 */}
          <H2 id="third-party">9. Third-Party Links</H2>
          <P>RVUnicorn contains links to third-party websites including campground booking partners, affiliate products, and creator-linked content. We are not responsible for the privacy practices of those sites.</P>

          {/* Section 10 */}
          <H2 id="ai">10. AI-Powered Features</H2>
          <P>RVUnicorn uses Claude (by Anthropic) to power Hitch AI responses, trip intelligence, content extraction, and creator insights. Conversation data sent to Hitch is processed by Anthropic's API. We do not use your Hitch conversations to train AI models. Anthropic's privacy policy is available at anthropic.com/privacy.</P>

          {/* Section 11 */}
          <H2 id="changes">11. Changes to This Policy</H2>
          <P>We may update this Privacy Policy from time to time. We will notify you of significant changes via email (to your registered address) and by posting the updated policy at rvunicorn.com/privacy with a new effective date. Your continued use of RVUnicorn after changes take effect constitutes your acceptance of the updated policy.</P>

          {/* Section 12 */}
          <H2 id="contact">12. Contact</H2>
          <P>RVUnicorn LLC<br />
          Email: <a href="mailto:hello@rvunicorn.com" style={{ color: '#E8A838' }}>hello@rvunicorn.com</a><br />
          Website: <a href="https://www.rvunicorn.com" style={{ color: '#E8A838' }}>rvunicorn.com</a><br />
          SMS Terms: <Link to="/sms-terms" style={{ color: '#E8A838' }}>rvunicorn.com/sms-terms</Link><br />
          Terms of Service: <Link to="/terms" style={{ color: '#E8A838' }}>rvunicorn.com/terms</Link></P>

          {/* Footer */}
          <div className="mt-16 pt-8 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(245,240,232,0.35)' }}>
            &copy; {new Date().getFullYear()} RVUnicorn LLC. All rights reserved.
          </div>
        </main>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button onClick={scrollToTop} className="fixed bottom-8 right-8 p-3 rounded-full shadow-lg transition-opacity z-50 hidden md:flex items-center justify-center" style={{ background: '#E8A838', color: '#0F1C35' }}>
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}
