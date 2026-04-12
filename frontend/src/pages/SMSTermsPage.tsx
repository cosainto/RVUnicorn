import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Menu, Smartphone } from 'lucide-react';

const SECTIONS = [
  { id: 'description', title: '1. Program Description' },
  { id: 'opt-in', title: '2. How to Opt In' },
  { id: 'opt-out', title: '3. How to Opt Out' },
  { id: 'frequency', title: '4. Message Frequency' },
  { id: 'rates', title: '5. Message and Data Rates' },
  { id: 'sender', title: '6. Sender Information' },
  { id: 'carriers', title: '7. Supported Carriers' },
  { id: 'privacy', title: '8. Privacy and Data Use' },
  { id: 'help', title: '9. Help and Support' },
  { id: 'changes', title: '10. Terms Changes' },
  { id: 'related', title: '11. Related Policies' },
];

export default function SMSTermsPage() {
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
  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed text-[15px]" style={{ color: 'rgba(245,240,232,0.75)' }}>{children}</p>
  );
  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="mb-1.5 text-[15px] leading-relaxed" style={{ color: 'rgba(245,240,232,0.7)' }}>{children}</li>
  );
  const Example = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-lg p-4 my-4 text-sm italic" style={{ background: '#1a2d4a', color: 'rgba(245,240,232,0.65)', borderLeft: '3px solid #E8A838' }}>{children}</div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0F1C35', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:flex lg:gap-12">

        {/* Sidebar TOC */}
        <aside className="lg:w-56 flex-shrink-0 mb-8 lg:mb-0">
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
            <h1 className="text-3xl font-bold" style={{ color: '#F5F0E8' }}>RVUnicorn SMS Terms of Service</h1>
          </div>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,240,232,0.5)' }}>Effective Date: April 12, 2026</p>

          <P>These SMS Terms of Service govern your consent to receive text messages from RVUnicorn LLC via our SMS messaging program operated through Twilio, Inc. By opting in, you agree to these terms in addition to our full <Link to="/privacy" style={{ color: '#E8A838' }}>Privacy Policy</Link> and <Link to="/terms" style={{ color: '#E8A838' }}>Terms of Service</Link>.</P>

          <H2 id="description">1. Program Description</H2>
          <P>RVUnicorn operates an application-to-person (A2P) SMS messaging program registered under Twilio's 10DLC framework. We send the following categories of messages to opted-in users:</P>
          <P><strong style={{ color: '#F5F0E8' }}>Trip Safety Alerts:</strong> Pre-departure weather briefings, high-wind advisories on your planned route, rig size mismatch warnings, fatigue risk alerts for long drives, and real-time weather changes affecting your trip.</P>
          <Example>"&#x1F690; Hitch here! Heads up — winds hitting 34mph on your route to Arches tomorrow. Secure that awning before you roll. rvunicorn.com/basecamp"</Example>
          <P><strong style={{ color: '#F5F0E8' }}>Check-In & Reminders:</strong> Campground arrival day reminders, check-in prompts, and departure day notices.</P>
          <Example>"Hey Will! Looks like you're due at Riverside RV Park today. Don't forget to check in and unlock your campfire &#x1F525; rvunicorn.com/checkin"</Example>
          <P><strong style={{ color: '#F5F0E8' }}>Community & Activity:</strong> Activity invites from other campers, trip overlap alerts when friends are heading to the same campground, campfire trivia notifications, and badge achievement alerts.</P>
          <Example>"&#x1F3AF; Campfire Trivia starts in 10 min at Moab KOA! Get your answers ready. rvunicorn.com/basecamp"</Example>
          <P><strong style={{ color: '#F5F0E8' }}>Memories:</strong> Trip anniversary reminders linking to your scrapbook on the date anniversary of past trips.</P>
          <Example>"&#x1F4F8; One year ago today you were rolling into Yellowstone. Your scrapbook is waiting. rvunicorn.com/s/xk29mb"</Example>
          <P><strong style={{ color: '#F5F0E8' }}>Campground Owner Broadcasts:</strong> If you are checked in at a campground whose owner uses RVUnicorn's Base Camp or Summit dashboard, that owner may send broadcast messages to checked-in guests who have SMS enabled. You must have SMS notifications enabled AND be actively checked in at that campground to receive these messages.</P>
          <Example>"&#x1F4E2; Riverside RV Park: Happy hour at the pavilion — come say hi! &#x1F37B;"</Example>

          <H2 id="opt-in">2. How to Opt In</H2>
          <P>You may opt in to RVUnicorn SMS notifications through two methods:</P>
          <P><strong style={{ color: '#F5F0E8' }}>Method 1 — Account Registration:</strong> During sign-up at rvunicorn.com, you may provide your mobile phone number. A checkbox (unchecked by default) reads: "I agree to receive SMS notifications from RVUnicorn including trip alerts, check-in reminders, and community updates. Message & data rates may apply. Reply STOP to opt out at any time." You must actively check this box to enable SMS.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Method 2 — Notification Settings:</strong> At any time, visit rvunicorn.com/settings and enable SMS for any of the following individual categories (all off by default):</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Trip safety alerts and pre-departure briefings</Li>
            <Li>Check-in reminders</Li>
            <Li>Activity invites from other campers</Li>
            <Li>Community and trivia notifications</Li>
            <Li>Trip anniversary reminders</Li>
            <Li>Campground owner broadcasts (when checked in)</Li>
          </ul>
          <P>SMS is never enabled without your explicit action. Pre-checked consent boxes are not used.</P>

          <H2 id="opt-out">3. How to Opt Out</H2>
          <P><strong style={{ color: '#F5F0E8' }}>Reply STOP:</strong> Reply STOP to any RVUnicorn SMS message. You will receive one final confirmation: "You've been unsubscribed from RVUnicorn SMS. Reply START to resubscribe or manage preferences at rvunicorn.com/settings." No further messages will be sent.</P>
          <P><strong style={{ color: '#F5F0E8' }}>Notification Settings:</strong> Visit rvunicorn.com/settings and toggle off individual SMS categories or use the global toggle.</P>
          <P>Opt-out requests are processed immediately. Opting out of SMS does not affect your account, email notifications, or push notifications.</P>

          <H2 id="frequency">4. Message Frequency</H2>
          <P>Message frequency varies based on your trip activity, notification settings, and community engagement. Users with active trips during departure week may receive up to 3 messages per day. Users with no active trips typically receive 0-2 messages per week. You control frequency through individual category toggles at rvunicorn.com/settings.</P>

          <H2 id="rates">5. Message and Data Rates</H2>
          <P>Message and data rates may apply depending on your mobile carrier plan. RVUnicorn is not responsible for any charges applied by your carrier. Contact your carrier for rate information.</P>

          <H2 id="sender">6. Sender Information</H2>
          <ul className="list-none pl-0 mb-4">
            <Li><strong style={{ color: '#F5F0E8' }}>Phone number:</strong> +1 (413) 296-8875</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>Registered as:</strong> RVUnicorn LLC</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>10DLC Campaign:</strong> Registered and approved</Li>
            <Li><strong style={{ color: '#F5F0E8' }}>SMS Provider:</strong> Twilio, Inc. (twilio.com)</Li>
          </ul>
          <P>Replies of STOP, START, and HELP are processed automatically.</P>

          <H2 id="carriers">7. Supported Carriers</H2>
          <P>RVUnicorn SMS is supported by all major US carriers including AT&T, Verizon, T-Mobile, US Cellular, and regional carriers participating in the 10DLC program. Message delivery is not guaranteed and may be affected by carrier filtering, network conditions, or device settings.</P>

          <H2 id="privacy">8. Privacy and Data Use</H2>
          <P>Your mobile phone number is used solely to deliver SMS notifications you have opted into. We do not:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Sell your phone number to third parties</Li>
            <Li>Share your phone number with campground owners or other RVUnicorn users</Li>
            <Li>Use your phone number for marketing purposes beyond the notification categories you have enabled</Li>
            <Li>Share your number with any party other than Twilio (our SMS delivery provider)</Li>
          </ul>
          <P>Campground owner broadcast messages are delivered through RVUnicorn's infrastructure. The campground owner never sees or receives your phone number.</P>
          <P>Full details in our <Link to="/privacy" style={{ color: '#E8A838' }}>Privacy Policy</Link>.</P>

          <H2 id="help">9. Help and Support</H2>
          <P><strong style={{ color: '#F5F0E8' }}>Reply HELP</strong> to any RVUnicorn SMS message. You will receive: "RVUnicorn SMS help: manage notifications at rvunicorn.com/settings or email hello@rvunicorn.com. Reply STOP to unsubscribe."</P>
          <P>Email: <a href="mailto:hello@rvunicorn.com" style={{ color: '#E8A838' }}>hello@rvunicorn.com</a></P>

          <H2 id="changes">10. Terms Changes</H2>
          <P>RVUnicorn reserves the right to update these SMS Terms at any time. Material changes will be communicated via email to your registered address before taking effect. The updated terms will be posted at rvunicorn.com/sms-terms with a new effective date.</P>

          <H2 id="related">11. Related Policies</H2>
          <ul className="list-none pl-0 mb-4">
            <Li><Link to="/privacy" style={{ color: '#E8A838' }}>Privacy Policy</Link></Li>
            <Li><Link to="/terms" style={{ color: '#E8A838' }}>Terms of Service</Link></Li>
            <Li><a href="https://www.rvunicorn.com/settings" style={{ color: '#E8A838' }}>Notification Settings</a></Li>
          </ul>

          {/* Quick Reference Card */}
          <div className="rounded-xl p-6 mt-12" style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.3)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Smartphone size={18} style={{ color: '#E8A838' }} />
              <h3 className="font-bold" style={{ color: '#E8A838' }}>Quick Reference</h3>
            </div>
            <ul className="space-y-2">
              {['Reply STOP to unsubscribe from all SMS', 'Reply HELP for support', 'Message & data rates may apply', 'Sent from +1 (413) 296-8875', 'Manage at rvunicorn.com/settings'].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(245,240,232,0.75)' }}>
                  <span>&#x1F4F1;</span> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16 pt-8 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(245,240,232,0.35)' }}>
            RVUnicorn LLC &middot; <a href="mailto:hello@rvunicorn.com" style={{ color: 'rgba(232,168,56,0.5)' }}>hello@rvunicorn.com</a> &middot; <a href="https://www.rvunicorn.com" style={{ color: 'rgba(232,168,56,0.5)' }}>rvunicorn.com</a>
            <br />&copy; {new Date().getFullYear()} RVUnicorn LLC. All rights reserved.
          </div>
        </main>
      </div>

      {showBackToTop && (
        <button onClick={scrollToTop} className="fixed bottom-8 right-8 p-3 rounded-full shadow-lg z-50 hidden md:flex items-center justify-center" style={{ background: '#E8A838', color: '#0F1C35' }}>
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}
