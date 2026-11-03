// @vitest-environment happy-dom
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORKOUT_TYPES } from '@/components/WorkoutMode';

describe('illustrated exercises', () => {
  it.each([
    ['yoga', 'Поза горы', '/workout/studio/mountain-pose.webp'],
    ['calisthenics', 'Стул у стены', '/workout/studio/wall-sit.webp'],
    ['charge', 'Высокие колени', '/workout/studio/high-knees.webp'],
    ['yoga', 'Поза кобры', '/workout/studio/cobra-pose.webp'],
    ['yoga', 'Поза воина II', '/workout/studio/warrior-two.webp'],
    ['yoga', 'Наклон вперёд стоя', '/workout/studio/standing-forward-fold.webp'],
    ['charge', 'Скручивания', '/workout/studio/crunch.webp'],
    ['charge', 'Велосипед', '/workout/studio/bicycle-crunch.webp'],
    ['calisthenics', 'Подъём ног лёжа', '/workout/studio/leg-raise.webp'],
    ['charge', 'Бег на месте', '/workout/studio/jog-in-place.webp'],
    ['charge', 'Захлёст голени', '/workout/studio/butt-kick.webp'],
    ['charge', 'Наклоны к ногам', '/workout/studio/standing-forward-fold.webp'],
    ['yoga', 'Мостик лёжа', '/workout/studio/bridge.webp'],
    ['yoga', 'Шавасана / дыхание', '/workout/studio/savasana.webp'],
    ['charge', 'Круги тазом', '/workout/studio/hip-circles.webp'],
    ['calisthenics', 'Ягодичный мостик на одной ноге', '/workout/studio/single-leg-bridge.webp'],
    ['yoga', 'Поза голубя', '/workout/studio/pigeon-pose.webp'],
    ['calisthenics', 'Отжимания узким хватом', '/workout/studio/close-grip-push-up.webp'],
    ['calisthenics', 'Болгарские выпады', '/workout/studio/bulgarian-split-squat.webp'],
    ['calisthenics', 'Отжимания «щучка»', '/workout/studio/pike-push-up.webp'],
    ['calisthenics', 'Супермен', '/workout/studio/superman.webp'],
    ['charge', 'Махи руками', '/workout/studio/arm-circles.webp'],
    ['calisthenics', 'Скалолаз', '/workout/studio/mountain-climber.webp'],
    ['yoga', 'Поза дерева (слева)', '/workout/studio/tree-pose.webp'],
    ['yoga', 'Поза дерева (справа)', '/workout/studio/tree-pose.webp'],
    ['yoga', 'Поза лодки', '/workout/studio/boat-pose.webp'],
  ])('%s includes a real image for %s', (type, name, path) => {
    const exercise = WORKOUT_TYPES.find(item => item.id === type)?.exercises.find(item => item.name === name);
    expect(exercise?.img).toBe(path);
    expect(existsSync(`public${path}`)).toBe(true);
  });
});
