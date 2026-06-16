import { create } from 'zustand';

export type InboxKind =
  | 'achievement'
  | 'level_up'
  | 'streak_milestone'
  | 'combo'
  | 'weekly_win'
  | 'daily_quest_full'
  | 'heartbeat'
  | 'reminder'
  | 'system';

export interface InboxItem {
  id: string;
  ts: number;       // Date.now()
  kind: InboxKind;
  title: string;
  body?: string;
  icon?: string;    // emoji
  link?: string;    // route to open
  read: boolean;
}

const KEY = 'inbox.items.v1';
const MAX = 50;

function load(): InboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function save(items: InboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

interface InboxState {
  items: InboxItem[];
  add: (i: Omit<InboxItem, 'id' | 'ts' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
  unread: () => number;
}

export const useInbox = create<InboxState>((set, get) => ({
  items: load(),
  add: (i) => {
    const item: InboxItem = {
      ...i,
      id: Math.random().toString(36).slice(2, 12),
      ts: Date.now(),
      read: false,
    };
    const items = [item, ...get().items].slice(0, MAX);
    save(items);
    set({ items });
  },
  markRead: (id) => {
    const items = get().items.map((x) => x.id === id ? { ...x, read: true } : x);
    save(items);
    set({ items });
  },
  markAllRead: () => {
    const items = get().items.map((x) => ({ ...x, read: true }));
    save(items);
    set({ items });
  },
  remove: (id) => {
    const items = get().items.filter((x) => x.id !== id);
    save(items);
    set({ items });
  },
  clear: () => {
    save([]);
    set({ items: [] });
  },
  unread: () => get().items.filter((x) => !x.read).length,
}));
