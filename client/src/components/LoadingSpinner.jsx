import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <Loader2 className={`${sizeClasses[size]} text-orange-500 animate-spin`} />
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  );
}
