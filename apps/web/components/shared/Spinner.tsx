interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const sizes = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export default function Spinner({ size = 'md', color = 'border-molt-500' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin ${sizes[size]} border-2 ${color} border-t-transparent rounded-full`}
    />
  );
}
