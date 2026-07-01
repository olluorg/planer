import * as React from 'react';
import { motion, MotionConfig, type HTMLMotionProps, type Transition } from 'motion/react';

/**
 * Motion-пресеты дизайн-системы. Значения синхронизированы
 * с motion-токенами в index.css / tailwind.config.js.
 */
export const springs = {
  /** Основной spring для модалок и появления карточек */
  emphasized: { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 } as Transition,
  /** Мягкий spring для hover/press */
  gentle: { type: 'spring', stiffness: 300, damping: 24 } as Transition,
  /** Быстрый отклик (иконки, чекбоксы) */
  snappy: { type: 'spring', stiffness: 500, damping: 32 } as Transition,
};

/** Обёртка приложения: глобально уважает prefers-reduced-motion */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Плавное появление блока (fade + подъём) */
export function FadeIn({
  delay = 0,
  y = 8,
  ...p
}: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.emphasized, delay }}
      {...p}
    />
  );
}

/** Список с каскадным появлением детей (stagger) */
export function StaggerList({
  stagger = 0.05,
  ...p
}: HTMLMotionProps<'div'> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: stagger } } }}
      {...p}
    />
  );
}

export function StaggerItem(p: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: springs.emphasized },
      }}
      {...p}
    />
  );
}

/** Hover-подъём с физикой + лёгкое сжатие при нажатии */
export function HoverLift(p: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={springs.gentle}
      {...p}
    />
  );
}
