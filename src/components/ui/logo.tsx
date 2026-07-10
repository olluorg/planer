import { useTheme } from '@/lib/theme';

/** Тема-зависимый логотип: белый под для тёмной/glass, тёмный под для светлой. */
export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => {
  const { theme } = useTheme();
  // Тёмный орб (logo-light.png) — для светлых фонов: обычная светлая И стеклянная светлая.
  const src = theme === 'light' || theme === 'glass-light' ? '/logo-light.png' : '/logo-dark.png';
  return (
    <img
      src={src}
      alt="THEDAD"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
};
