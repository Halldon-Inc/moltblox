export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0a]">{children}</div>;
}
