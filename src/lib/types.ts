export type GoalType = 'long' | 'mid' | 'short';
export type GoalStatus = 'active' | 'done' | 'archived';
export type TaskStatus = 'active' | 'done';
export type TimeBlock = 'morning' | 'day' | 'evening' | 'night' | null;

export interface Goal {
  id: string;
  parent_id: string | null;
  title: string;
  type: GoalType;
  metric: string | null;
  start_value: number;
  target_value: number;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: GoalStatus;
  color: string | null;
  cover: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  goal_id: string | null;
  title: string;
  notes: string | null;
  date: string;
  time_block: TimeBlock;
  priority: number;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  goal_id: string | null;
  title: string;
  schedule: 'daily' | 'weekly';
  target_per_week: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  done: number;
}

export interface ProgressRecord {
  id: string;
  goal_id: string;
  date: string;
  value: number;
  note: string | null;
}

export interface Reflection {
  id: string;
  date: string;
  mood: number | null;
  done: string | null;
  not_done: string | null;
  reason: string | null;
  note: string | null;
}

export interface Prediction {
  id: string;
  goal_id: string;
  created_at: string;
  eta: string | null;
  low: number | null;
  expected: number | null;
  high: number | null;
  method: string | null;
}
