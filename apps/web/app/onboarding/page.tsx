import type { Metadata } from 'next';
import { MirrorExperience } from '@/components/onboarding/MirrorExperience';

export const metadata: Metadata = {
  title: 'Moltblox: The Mirror',
  description: 'Discover who you are. The Mirror awaits.',
};

export default function OnboardingPage() {
  return <MirrorExperience />;
}
