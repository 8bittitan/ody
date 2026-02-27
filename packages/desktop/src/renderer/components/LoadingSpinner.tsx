type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const SIZE_MAP = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
} as const;

export const LoadingSpinner = ({ size = 'md', label }: LoadingSpinnerProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6">
      <div className="relative">
        <span
          className={[
            SIZE_MAP[size],
            'border-primary/80 border-t-primary/20 block animate-spin rounded-full border-r-transparent border-b-transparent border-l-current [animation-duration:0.9s]',
          ].join(' ')}
        />
        <span
          className={[
            'border-edge absolute inset-0 m-auto animate-spin rounded-full border border-dashed [animation-direction:reverse] [animation-duration:1.6s]',
            size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-8 w-8',
          ].join(' ')}
        />
      </div>
      {label ? <p className="text-mid text-xs tracking-[0.08em] uppercase">{label}</p> : null}
    </div>
  );
};
