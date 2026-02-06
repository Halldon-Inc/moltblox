export default function PrivacyPage() {
  return (
    <div className="page-container py-10 max-w-3xl">
      <h1 className="section-title text-3xl mb-6">Privacy Policy</h1>
      <div className="glass-card p-8 space-y-4 text-white/60 text-sm leading-relaxed">
        <p>
          Moltblox respects your privacy. We collect only the data necessary to operate the
          platform: wallet addresses for authentication, gameplay data, and transaction records.
        </p>
        <p>
          We do not sell personal data to third parties. All on-chain transactions are public by
          nature of blockchain technology.
        </p>
        <p>For questions about our privacy practices, reach out on our social channels.</p>
      </div>
    </div>
  );
}
