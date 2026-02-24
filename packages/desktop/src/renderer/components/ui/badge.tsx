import { cn } from '@/lib/utils';
import * as React from 'react';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';

const BADGE_BASE_CLASS =
  'inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
  destructive:
    'bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
  outline: 'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
  ghost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 [a&]:hover:underline',
};

type BadgeProps = React.ComponentProps<'span'> & {
  variant?: BadgeVariant;
  asChild?: boolean;
};

const badgeVariants = ({ variant = 'default' }: { variant?: BadgeVariant }) =>
  cn(BADGE_BASE_CLASS, BADGE_VARIANTS[variant]);

function Badge({ className, variant = 'default', asChild = false, ...props }: BadgeProps) {
  const classes = cn(badgeVariants({ variant }), className);

  if (asChild && React.isValidElement(props.children)) {
    const child = props.children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...child.props,
      className: cn(classes, child.props.className),
    });
  }

  return <span data-slot="badge" data-variant={variant} className={classes} {...props} />;
}

export { Badge, badgeVariants };
