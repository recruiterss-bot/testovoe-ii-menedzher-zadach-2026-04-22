export const TASK_STATUS_VALUES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITY_VALUES = ['low', 'medium', 'high'] as const;
export const SUGGESTION_KIND_VALUES = ['category', 'tag'] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];
export type SuggestionKind = (typeof SUGGESTION_KIND_VALUES)[number];
