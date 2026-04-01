export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <div className="flex items-center gap-3 mb-8">
          <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="h-10" />
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Effective Date: March 7, 2026</p>

        <p className="text-gray-700 mb-8">RVUnicorn ("RVUnicorn", "we", "our", or "us") respects your privacy and is committed to protecting your personal information. This Privacy Policy describes how we collect, use, and protect information when you use our website, mobile services, and messaging programs.</p>

        {[
          {
            title: "Information We Collect",
            content: `We may collect the following information when you use RVUnicorn:
- Name, email address, and phone number
- Account profile information
- Location information related to camping trips
- Campground preferences and bookings
- Device and browser information
- Usage data related to the RVUnicorn platform

This information may be collected when you create an account, book or save campsites, participate in community features, subscribe to SMS notifications, or contact support.`
          },
          {
            title: "SMS Messaging and Notifications",
            content: `Users may opt in to receive SMS notifications related to RVUnicorn services, including:
- Campground booking confirmations
- Reservation reminders
- Campground availability alerts
- Community updates and platform notifications

By providing your phone number and opting in, you consent to receive SMS messages from RVUnicorn. Message frequency may vary. Message and data rates may apply. Reply STOP to unsubscribe at any time. Reply HELP for assistance.

RVUnicorn uses third-party messaging providers, including Twilio, to send SMS communications. Mobile phone numbers collected for SMS consent will not be shared or sold to third parties for marketing purposes.`
          },
          {
            title: "How We Use Your Information",
            content: `We use your information to:
- Operate and improve the RVUnicorn platform
- Provide campground discovery and booking features
- Deliver account notifications and SMS alerts
- Provide customer support
- Prevent fraud and maintain security
- Improve community features`
          },
          {
            title: "Sharing of Information",
            content: `We do not sell personal information. We may share information with trusted service providers who help us operate our platform, including:
- Cloud hosting providers
- Analytics providers
- Messaging providers (such as Twilio)
- Payment processors
- Booking partners

These providers are only given access to information necessary to perform their services.`
          },
          {
            title: "Data Security",
            content: "We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, disclosure, or misuse."
          },
          {
            title: "Your Choices",
            content: `You may:
- Opt out of SMS messages by replying STOP
- Update account information through your profile
- Request account deletion by contacting us at support@rvunicorn.com`
          },
          {
            title: "Children's Privacy",
            content: "RVUnicorn is not intended for children under the age of 13, and we do not knowingly collect personal information from children."
          },
          {
            title: "Changes to This Policy",
            content: "We may update this Privacy Policy periodically. Updates will be posted on this page with a revised effective date."
          },
          {
            title: "Contact",
            content: `If you have questions about this Privacy Policy, please contact:\n\nRVUnicorn\nEmail: support@rvunicorn.com\nWebsite: https://rvunicorn.com`
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
