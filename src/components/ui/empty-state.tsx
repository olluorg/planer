import { Button } from './button';

interface Props {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<Props> = ({ icon, emoji, title, description, action, className }) => (
  <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className ?? ''}`}>
    {(icon || emoji) && (
      <div className="h-14 w-14 rounded-2xl bg-bg-soft flex items-center justify-center mb-4 text-2xl text-text-muted">
        {emoji ?? icon}
      </div>
    )}
    <div className="text-base font-semibold text-text">{title}</div>
    {description && <div className="text-sm text-text-muted mt-1.5 max-w-xs leading-relaxed">{description}</div>}
    {action && (
      <Button onClick={action.onClick} className="mt-4">{action.label}</Button>
    )}
  </div>
);
