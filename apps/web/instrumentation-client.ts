import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  // Lazy load Replay to save ~40KB from the initial bundle
  Sentry.lazyLoadIntegration('replayIntegration').then((replay) => {
    Sentry.addIntegration(replay());
  });
}
