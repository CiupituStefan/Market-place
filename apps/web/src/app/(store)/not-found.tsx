import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">This key isn’t mapped.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/shop">Browse the shop</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
