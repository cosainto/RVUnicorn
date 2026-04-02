export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <div className="flex items-center gap-3 mb-8">
          <img src="/images/Logo_RVUnicorn.webp" alt="RVUnicorn" className="h-10" />
          <h1 className="text-3xl font-bold text-gray-900">Terms & Conditions</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Effective Date: March 31, 2026</p>

        <p className="text-gray-700 mb-8">
          Welcome to RVUnicorn. By accessing or using our website, mobile application, or any related services (collectively, the "Platform"), you agree to be bound by these Terms & Conditions. Please read them carefully before using the Platform.
        </p>

        {[
          {
            title: "1. Acceptance of Terms",
            content: `By creating an account or using RVUnicorn in any way, you confirm that you are at least 13 years of age, have read and agree to these Terms & Conditions, and agree to our Privacy Policy, which is incorporated herein by reference.\n\nIf you do not agree to these terms, please do not use the Platform.`
          },
          {
            title: "2. Use of the Platform",
            content: `RVUnicorn is a social platform for RV enthusiasts. You agree to use the Platform only for lawful purposes and in a manner that does not infringe the rights of others.\n\nYou agree not to:\n- Post content that is unlawful, harmful, threatening, abusive, or defamatory\n- Impersonate any person or entity\n- Upload or transmit viruses or malicious code\n- Scrape, crawl, or use automated tools to access the Platform without permission\n- Use the Platform to send unsolicited messages or spam`
          },
          {
            title: "3. Accounts",
            content: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at support@rvunicorn.com if you believe your account has been compromised.\n\nWe reserve the right to suspend or terminate accounts that violate these Terms or that have been inactive for an extended period.`
          },
          {
            title: "4. User Content",
            content: `You retain ownership of content you post on RVUnicorn. By posting content, you grant RVUnicorn a non-exclusive, royalty-free, worldwide license to use, display, reproduce, and distribute that content in connection with operating and promoting the Platform.\n\nYou represent that you have all rights necessary to grant this license and that your content does not violate any third-party rights.`
          },
          {
            title: "5. SMS Messaging",
            content: `RVUnicorn offers optional SMS notifications for safety alerts, trip updates, and platform activity. By opting in to SMS notifications through the app's Settings page, you consent to receive text messages from RVUnicorn.\n\nMessage frequency varies based on your activity and conditions at your campground. Message and data rates may apply. Reply STOP to unsubscribe at any time. Reply HELP for assistance.\n\nSMS consent is not required to use the Platform and will never be shared or sold to third parties.`
          },
          {
            title: "6. Campground & Trip Information",
            content: `RVUnicorn provides campground information, trip planning tools, and community-generated content for informational purposes only. We do not guarantee the accuracy, completeness, or timeliness of campground listings, availability, pricing, or conditions.\n\nAlways verify campground details directly with the campground before making travel decisions. RVUnicorn is not responsible for any loss or inconvenience resulting from inaccurate or outdated information.`
          },
          {
            title: "7. Safety Features",
            content: `Features such as Guardian Mode, weather alerts, and emergency broadcasts are provided as supplemental safety tools only. They are not a substitute for your own judgment, official emergency services, or professional advice.\n\nIn any emergency, always contact local emergency services (911) first. RVUnicorn is not liable for any harm resulting from reliance on these features.`
          },
          {
            title: "8. Intellectual Property",
            content: `All content, branding, logos, and technology comprising the RVUnicorn Platform are the property of RVUnicorn or its licensors and are protected by applicable intellectual property laws.\n\nYou may not copy, modify, distribute, or create derivative works from any part of the Platform without our prior written consent.`
          },
          {
            title: "9. Disclaimers",
            content: `THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. RVUNICORN DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.\n\nYOUR USE OF THE PLATFORM IS AT YOUR OWN RISK.`
          },
          {
            title: "10. Limitation of Liability",
            content: `TO THE FULLEST EXTENT PERMITTED BY LAW, RVUNICORN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.\n\nOUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF THESE TERMS SHALL NOT EXCEED $100.`
          },
          {
            title: "11. Indemnification",
            content: `You agree to indemnify and hold harmless RVUnicorn, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising out of your use of the Platform, your content, or your violation of these Terms.`
          },
          {
            title: "12. Governing Law",
            content: `These Terms shall be governed by and construed in accordance with the laws of the State of Illinois, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Illinois.`
          },
          {
            title: "13. Changes to These Terms",
            content: `We may update these Terms from time to time. When we do, we will update the effective date at the top of this page. Your continued use of the Platform after any changes constitutes your acceptance of the updated Terms.`
          },
          {
            title: "14. Contact",
            content: `If you have questions about these Terms & Conditions, please contact:\n\nRVUnicorn\nEmail: support@rvunicorn.com\nWebsite: https://rvunicorn.com`
          }
        ].map(({ title, content }) => (
          <div key={title} className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">{title}</h2>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{content}</p>
          </div>
        ))}

        <div className="mt-12 pt-8 border-t border-gray-100 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} RVUnicorn. All rights reserved.
        </div>
      </div>
    </div>
  );
}
