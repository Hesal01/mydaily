export interface Congrats {
  id: string;
  from: string;
  to: string;
  date: string;
  emoji: string;
  seen: boolean;
  /** Number of times this sender has clapped this recipient today (spam pings). */
  count: number;
}
