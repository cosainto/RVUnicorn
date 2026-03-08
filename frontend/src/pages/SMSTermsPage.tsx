export default function SMSTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <div className="flex items-center gap-3 mb-8">
          <img src="/images/logo.png" alt="RVUnicorn" className="h-10" />
          <h1 className="text-3xl font-bold text-gray-900">SMS Terms of Service</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Effective Date: March 7, 2026</p>

        <p className="text-gray-700 mb-8">These SMS Terms of Service ("SMS Terms") govern your consent to receive text messages from RVUnicorn. By opting in to SMS communications, you agree to these terms.</p>

        {[
          {
            title: "Program Description",
            content: `RVUnicorn operates an SMS messaging program to send users notifications and updates related to the RVUnicorn platform, including:

- Campground booking confirmations and reminders
- Reservation and availability alerts
- Community activity notifications
- Friend requests and mentions
- Trip planning updates
- Platform announcements
- Invitations from other RVUnicorn members`
          },
          {
            title: "How to Opt In",
            content: `You may opt in to receive SMS messages from RVUnicorn by:

- Providing your mobile phone number during account registration
- Enabling SMS notifications in your account settings
- Accepting an SMS invite from another RVUnicorn member

By opting in, you expressly consent to receive text messages from RVUnicorn at the phone number provided.`
          },
          {
            title: "Message Frequency",
            content: "Message frequency varies based on your activity on the platform and your notification preferences. You may receive up to several messages per day depending on your settings and community activity."
          },
          {
            title: "Message and Data Rates",
            content: "Message and data rates may apply. RVUnicorn is not responsible for any charges applied by your mobile carrier for receiving SMS messages."
          },
          {
            title: "How to Opt Out",
            content: `You may opt out of SMS messages at any time by:

- Replying STOP to any SMS message from RVUnicorn
- Disabling SMS notifications in your RVUnicorn account settings at rvunicorn.com/privacy-settings

After replying STOP, you will receive one final confirmation message and no further SMS messages will be sent unless you opt back in.`
          },
          {
            title: "How to Get Help",
            content: `For help, reply HELP to any SMS message from RVUnicorn, or contact us at:

Email: support@rvunicorn.com
Website: https://rvunicorn.com`
          },
          {
            title: "Supported Carriers",
            content: "RVUnicorn SMS messages are supported by most major US carriers including AT&T, Verizon, T-Mobile, Sprint, and others. Carrier support may vary."
          },
          {
            title: "Privacy",
            content: "Mobile phone numbers and SMS consent will not be shared, sold, or rented to third parties for marketing purposes. For full details on how we handle your data, please review our Privacy Policy at https://rvunicorn.com/privacy."
          },
          {
            title: "Messaging Provider",
            content: "RVUnicorn uses Twilio as its third-party SMS messaging provider. Messages are sent from a registered 10DLC phone number on behalf of RVUnicorn."
          },
          {
            title: "Changes to These Terms",
            content: "RVUnicorn reserves the right to update these SMS Terms at any time. Updates will be posted at https://rvunicorn.com/sms-terms with a revised effective date."
          },
          {
            title: "Contact",
            content: `RVUnicorn\nEmail: support@rvunicorn.com\nWebsite: https://rvunicorn.com\nPrivacy Policy: https://rvunicorn.com/privacy`
          }
        ].map(({ title, content }) => (
          <div key={title} className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">{title}</h2>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{content}</p>
          </div>
        ))}

        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-800">
          <strong>Quick Reference:</strong> Reply STOP to unsubscribe · Reply HELP for help · Message & data rates may apply · Frequency varies
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} RVUnicorn. All rights reserved.
        </div>
      </div>
    </div>
  );
}
