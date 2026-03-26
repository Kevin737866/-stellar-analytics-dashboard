import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export function NotFound() {
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-primary/10 p-4 rounded-full mb-6">
        <AlertCircle size={48} className="text-primary" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        The ledger you're looking for doesn't exist or the transaction hasn't been confirmed yet.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
      >
        <Home size={18} />
        Return to Dashboard
      </Link>
    </div>
  );
}
