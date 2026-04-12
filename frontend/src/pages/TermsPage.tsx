import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Menu } from 'lucide-react';

const SECTIONS = [
  { id: 'eligibility', title: '1. Eligibility' },
  { id: 'account', title: '2. Your Account' },
  { id: 'acceptable-use', title: '3. Acceptable Use' },
  { id: 'content', title: '4. Content You Post' },
  { id: 'creator', title: '5. Creator Program' },
  { id: 'campground-owner', title: '6. Campground Owner Tools' },
  { id: 'hitch-ai', title: '7. Hitch AI' },
  { id: 'third-party', title: '8. Third-Party Services' },
  { id: 'disclaimers', title: '9. Disclaimers' },
  { id: 'liability', title: '10. Limitation of Liability' },
  { id: 'termination', title: '11. Termination' },
  { id: 'governing-law', title: '12. Governing Law' },
  { id: 'changes', title: '13. Changes to Terms' },
  { id: 'contact', title: '14. Contact' },
];

export default function TermsPage() {
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
  const Caps = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed text-[14px] uppercase" style={{ color: 'rgba(245,240,232,0.6)' }}>{children}</p>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0F1C35', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:flex lg:gap-12">

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

        <main className="flex-1 max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">&#x1F984;</span>
            <h1 className="text-3xl font-bold" style={{ color: '#F5F0E8' }}>RVUnicorn Terms of Service</h1>
          </div>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,240,232,0.5)' }}>Effective Date: April 12, 2026</p>

          <P>Welcome to RVUnicorn. These Terms of Service ("Terms") are a legal agreement between you and RVUnicorn LLC ("RVUnicorn", "we", "our", "us") governing your use of our website, mobile application, Hitch AI, Basecamp, Creator Network, campground tools, and all associated services (collectively, the "Platform").</P>
          <P>By creating an account or using RVUnicorn, you agree to these Terms. If you do not agree, do not use the Platform.</P>

          <H2 id="eligibility">1. Eligibility</H2>
          <P>You must be at least 13 years old to use RVUnicorn. By using the Platform, you represent that you meet this requirement. Users between 13 and 18 must have parental or guardian consent.</P>

          <H2 id="account">2. Your Account</H2>
          <P>You are responsible for:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Maintaining the confidentiality of your password</Li>
            <Li>All activity that occurs under your account</Li>
            <Li>Providing accurate account information</Li>
            <Li>Notifying us immediately of unauthorized access at <a href="mailto:hello@rvunicorn.com" style={{ color: '#E8A838' }}>hello@rvunicorn.com</a></Li>
          </ul>
          <P>RVUnicorn accounts are personal and non-transferable. You may not create accounts on behalf of others without authorization.</P>

          <H2 id="acceptable-use">3. Acceptable Use</H2>
          <P>You agree not to:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Post false, misleading, or fraudulent content</Li>
            <Li>Harass, threaten, or abuse other users</Li>
            <Li>Post content that is illegal, defamatory, obscene, or violates others' privacy</Li>
            <Li>Impersonate another person or organization</Li>
            <Li>Use automated tools to scrape or extract data without written permission</Li>
            <Li>Attempt to access accounts or systems you are not authorized to access</Li>
            <Li>Post spam or unsolicited commercial messages</Li>
            <Li>Interfere with the operation of the Platform</Li>
            <Li>Use the Platform for any unlawful purpose</Li>
            <Li>Post reviews for campgrounds where you have a financial interest or conflict of interest</Li>
          </ul>
          <P>Campground owners using the Organizer Dashboard and broadcast tools agree not to:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Send misleading or false information to guests</Li>
            <Li>Use broadcast tools for commercial solicitation unrelated to their campground</Li>
            <Li>Misrepresent their campground's amenities, policies, or availability</Li>
          </ul>

          <H2 id="content">4. Content You Post</H2>
          <P>You retain ownership of content you post on RVUnicorn (photos, videos, reviews, posts, Trip Kits, etc.).</P>
          <P>By posting content, you grant RVUnicorn a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute that content on the Platform and in connection with RVUnicorn's services, including in promotional materials and the campground discovery feed.</P>
          <P>You represent that:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>You own or have the right to post the content</Li>
            <Li>The content does not violate any third party's rights including copyright, privacy, or publicity</Li>
            <Li>The content complies with these Terms</Li>
          </ul>
          <P>We reserve the right to remove content that violates these Terms or that we determine is harmful to the community.</P>

          <H2 id="creator">5. Creator Program</H2>
          <P>RVUnicorn's Creator Network allows eligible users to publish content, create Trip Kits, and build a following on the Platform.</P>
          <P>By participating as a creator you agree to:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Only post content you have the right to share</Li>
            <Li>Clearly disclose sponsored or affiliate content</Li>
            <Li>Not use the creator program to mislead users about campgrounds, products, or services</Li>
            <Li>Comply with FTC disclosure guidelines for any paid or affiliate-linked content</Li>
          </ul>
          <P>Trip Kits (both free and paid) must represent accurate route and campground information to the best of your knowledge.</P>

          <H2 id="campground-owner">6. Campground Owner Tools</H2>
          <P>Campground owners who claim a listing and subscribe to Base Camp or Summit tier agree to:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>Accurately represent their campground's amenities, pricing, policies, and availability</Li>
            <Li>Only broadcast messages to guests who have opted in to SMS/push notifications</Li>
            <Li>Not use guest contact data for purposes outside of RVUnicorn's platform</Li>
            <Li>Maintain accurate campground profiles</Li>
            <Li>Respond to reviews in good faith</Li>
          </ul>
          <P>RVUnicorn reserves the right to revoke campground owner access for violations of these terms, fraudulent activity, or guest complaints.</P>

          <H2 id="hitch-ai">7. Hitch AI</H2>
          <P>Hitch AI is an artificial intelligence assistant powered by Anthropic's Claude. Hitch provides general guidance, trip suggestions, and campground information based on available data.</P>
          <P>Hitch AI responses are:</P>
          <ul className="list-disc pl-6 mb-4">
            <Li>For informational purposes only</Li>
            <Li>Not a substitute for professional advice (legal, medical, financial, or safety)</Li>
            <Li>Based on available data which may be outdated or incomplete</Li>
            <Li>Not guaranteed to be accurate for specific campground conditions, road conditions, or rig compatibility</Li>
          </ul>
          <P>Always verify critical trip information (campground availability, road closures, weather conditions) through authoritative sources before departure. RVUnicorn is not liable for trip outcomes based on Hitch AI recommendations.</P>

          <H2 id="third-party">8. Third-Party Services</H2>
          <P>RVUnicorn integrates with third-party services including HERE Maps, Google Maps, Campspot, AWIN, Cloudinary, Resend, and Twilio. Use of these services through our Platform is subject to their respective terms of service. RVUnicorn is not responsible for third-party service availability, accuracy, or changes to their terms.</P>
          <P>RVUnicorn participates in affiliate programs including AWIN (publisher ID: 2799516) and Campspot (merchant ID: 22326). We may earn commissions on qualifying bookings made through links on our Platform at no additional cost to you.</P>

          <H2 id="disclaimers">9. Disclaimers</H2>
          <Caps>THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. RVUNICORN DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</Caps>
          <Caps>CAMPGROUND INFORMATION (HOURS, AMENITIES, AVAILABILITY, RIG RESTRICTIONS) IS SOURCED FROM PUBLIC DATABASES AND USER SUBMISSIONS AND MAY NOT BE CURRENT OR ACCURATE. ALWAYS VERIFY CAMPGROUND CONDITIONS DIRECTLY WITH THE CAMPGROUND BEFORE ARRIVAL.</Caps>
          <Caps>TRIP INTELLIGENCE AND HITCH AI RECOMMENDATIONS ARE INFORMATIONAL ONLY AND DO NOT CONSTITUTE SAFETY GUARANTEES. YOU ARE RESPONSIBLE FOR YOUR OWN DRIVING SAFETY AND TRIP DECISIONS.</Caps>

          <H2 id="liability">10. Limitation of Liability</H2>
          <Caps>TO THE MAXIMUM EXTENT PERMITTED BY LAW, RVUNICORN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO TRIP INCIDENTS, CAMPGROUND DISPUTES, DATA LOSS, OR RELIANCE ON HITCH AI RECOMMENDATIONS.</Caps>

          <H2 id="termination">11. Termination</H2>
          <P>We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or harm other users or the Platform. You may delete your account at any time in settings or by emailing <a href="mailto:hello@rvunicorn.com" style={{ color: '#E8A838' }}>hello@rvunicorn.com</a>.</P>

          <H2 id="governing-law">12. Governing Law</H2>
          <P>These Terms are governed by the laws of the State of Illinois, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of DuPage County, Illinois.</P>

          <H2 id="changes">13. Changes to Terms</H2>
          <P>We may update these Terms from time to time. We will notify you of material changes via email and by posting updated Terms at rvunicorn.com/terms with a new effective date. Continued use after changes take effect constitutes acceptance.</P>

          <H2 id="contact">14. Contact</H2>
          <P>RVUnicorn LLC<br />
          Email: <a href="mailto:hello@rvunicorn.com" style={{ color: '#E8A838' }}>hello@rvunicorn.com</a><br />
          Privacy Policy: <Link to="/privacy" style={{ color: '#E8A838' }}>rvunicorn.com/privacy</Link><br />
          SMS Terms: <Link to="/sms-terms" style={{ color: '#E8A838' }}>rvunicorn.com/sms-terms</Link></P>

          <div className="mt-16 pt-8 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(245,240,232,0.35)' }}>
            &copy; {new Date().getFullYear()} RVUnicorn LLC. All rights reserved.
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
