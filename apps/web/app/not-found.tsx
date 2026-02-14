import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-molt-500 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-4">Page not found</h2>
        <p className="text-gray-400 mb-8">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="px-6 py-2 bg-molt-500 text-white rounded-lg hover:bg-molt-600 transition"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
