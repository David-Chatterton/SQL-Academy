export type Cell = string | number | boolean | null;
export interface Column { name: string; type: string; numeric: boolean }
export interface QueryResult { columns: Column[]; rows: Cell[][]; elapsedMs: number }
export type VisualKind = 'table' | 'projection' | 'filter' | 'range' | 'logic' | 'sort' | 'distinct' | 'investigate' | 'aggregate';
export interface Lesson {
  id: string; title: string; module: number; prerequisites: string[]; concepts: string[];
  objectives: string[]; explanation: string[]; excel: string; syntax: { clause: string; meaning: string }[];
  visual: VisualKind; task: string; starter: string; solution: string; solutionWhy: string;
  hints: string[]; expected: { ordered: boolean; technique?: string[] };
  terminal: string; completionCriteria: string;
}
export interface Progress { version: 1; current: string; completed: Record<string, string> }
