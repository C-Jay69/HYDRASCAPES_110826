import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function PropertyFourPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-void overflow-hidden"
      style={{
        backgroundImage: 'url(/PAGE_4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="text-center px-6 py-12">
        <h1 className="text-4xl font-bold text-void mb-4">
          Mountain Retreat
        </h1>
        <p className="text-lg text-foreground-muted mb-8">
          Cozy chalet nestled in the mountains with fireplace and hot tub.
        </p>
        <div className="inline-flex gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-6 py-3 text-base font-semibold text-void transition-opacity hover:opacity-90"
          >
            Learn More <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-teal-500 px-6 py-3 text-base font-semibold text-teal-300 transition-colors hover:bg-teal-500/10"
          >
            Log in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}