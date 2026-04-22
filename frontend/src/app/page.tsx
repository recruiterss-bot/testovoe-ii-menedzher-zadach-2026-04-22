"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./page.module.css";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  classificationKind: "category" | "tag" | null;
  classificationValue: string | null;
  parentTaskId: string | null;
  createdAt: string;
};

type TaskForm = {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
};

type TaskFilters = {
  q: string;
  status: "" | TaskStatus;
  priority: "" | TaskPriority;
  dueDateFrom: string;
  dueDateTo: string;
};

type CategorySuggestion = {
  kind: "category" | "tag";
  value: string;
  reason: string;
};

type PrioritySuggestion = {
  suggestedPriority: TaskPriority;
  raisePriority: boolean;
  reason: string;
};

type DecompositionSuggestion = {
  subtasks: Array<{ title: string; description: string | null }>;
  reason: string;
};

type EditableSubtask = {
  title: string;
  description: string;
};

type WorkloadSummary = {
  summary: string;
  overdueCount: number;
  upcomingCount: number;
  distribution: {
    status: {
      todo: number;
      in_progress: number;
      done: number;
    };
    priority: {
      low: number;
      medium: number;
      high: number;
    };
  };
  focus: string[];
};

type TaskLoadingMap = Record<string, boolean>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

const EMPTY_FORM: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  dueDate: "",
};

const EMPTY_FILTERS: TaskFilters = {
  q: "",
  status: "",
  priority: "",
  dueDateFrom: "",
  dueDateTo: "",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<TaskForm>(EMPTY_FORM);
  const [filtersDraft, setFiltersDraft] = useState<TaskFilters>(EMPTY_FILTERS);
  const [filtersApplied, setFiltersApplied] =
    useState<TaskFilters>(EMPTY_FILTERS);
  const [editingByTaskId, setEditingByTaskId] = useState<
    Record<string, TaskForm>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDays, setSummaryDays] = useState(3);
  const [workloadSummary, setWorkloadSummary] =
    useState<WorkloadSummary | null>(null);

  const [suggestionByTaskId, setSuggestionByTaskId] = useState<
    Record<string, CategorySuggestion>
  >({});
  const [prioritySuggestionByTaskId, setPrioritySuggestionByTaskId] = useState<
    Record<string, PrioritySuggestion>
  >({});
  const [decompositionByTaskId, setDecompositionByTaskId] = useState<
    Record<string, { reason: string; subtasks: EditableSubtask[] }>
  >({});
  const [savingByTaskId, setSavingByTaskId] = useState<TaskLoadingMap>({});
  const [deletingByTaskId, setDeletingByTaskId] = useState<TaskLoadingMap>({});
  const [categoryLoadingByTaskId, setCategoryLoadingByTaskId] =
    useState<TaskLoadingMap>({});
  const [priorityLoadingByTaskId, setPriorityLoadingByTaskId] =
    useState<TaskLoadingMap>({});
  const [decompositionLoadingByTaskId, setDecompositionLoadingByTaskId] =
    useState<TaskLoadingMap>({});
  const [applyCategoryLoadingByTaskId, setApplyCategoryLoadingByTaskId] =
    useState<TaskLoadingMap>({});
  const [applyPriorityLoadingByTaskId, setApplyPriorityLoadingByTaskId] =
    useState<TaskLoadingMap>({});
  const [
    applyDecompositionLoadingByTaskId,
    setApplyDecompositionLoadingByTaskId,
  ] = useState<TaskLoadingMap>({});

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) =>
        a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0,
      ),
    [tasks],
  );

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersApplied]);

  useEffect(() => {
    void loadWorkloadSummary(summaryDays);
  }, [summaryDays]);

  async function loadTasks() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtersApplied.q.trim()) params.set("q", filtersApplied.q.trim());
      if (filtersApplied.status) params.set("status", filtersApplied.status);
      if (filtersApplied.priority)
        params.set("priority", filtersApplied.priority);
      if (filtersApplied.dueDateFrom) {
        params.set(
          "dueDateFrom",
          new Date(filtersApplied.dueDateFrom).toISOString(),
        );
      }
      if (filtersApplied.dueDateTo) {
        params.set(
          "dueDateTo",
          new Date(filtersApplied.dueDateTo).toISOString(),
        );
      }

      const query = params.toString();
      const data = await apiFetch<{ items: Task[] }>(
        `/tasks${query ? `?${query}` : ""}`,
      );
      setTasks(data.items);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadWorkloadSummary(upcomingDays: number) {
    setSummaryLoading(true);
    setError(null);
    try {
      const summary = await apiFetch<WorkloadSummary>(
        `/ai/workload-summary?upcomingDays=${upcomingDays}`,
      );
      setWorkloadSummary(summary);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }

  function setTaskLoading(
    setMap: Dispatch<SetStateAction<TaskLoadingMap>>,
    taskId: string,
    value: boolean,
  ) {
    setMap((prev) => ({
      ...prev,
      [taskId]: value,
    }));
  }

  function isTaskLoading(map: TaskLoadingMap, taskId: string): boolean {
    return Boolean(map[taskId]);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersApplied(filtersDraft);
  }

  function resetFilters() {
    setFiltersDraft(EMPTY_FILTERS);
    setFiltersApplied(EMPTY_FILTERS);
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTask.title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await apiFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTask.title.trim(),
          description: normalizeOptionalString(newTask.description),
          priority: newTask.priority,
          status: newTask.status,
          dueDate: normalizeOptionalDate(newTask.dueDate),
        }),
      });
      setNewTask(EMPTY_FORM);
      await loadTasks();
      await loadWorkloadSummary(summaryDays);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function onStartEdit(task: Task) {
    setEditingByTaskId((prev) => ({
      ...prev,
      [task.id]: {
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        status: task.status,
        dueDate: toLocalDateTimeInput(task.dueDate),
      },
    }));
  }

  function onCancelEdit(taskId: string) {
    setEditingByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function onEditField(
    taskId: string,
    field: keyof TaskForm,
    value: string | TaskPriority | TaskStatus,
  ) {
    setEditingByTaskId((prev) => {
      const current = prev[taskId];
      if (!current) return prev;
      return {
        ...prev,
        [taskId]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function onSaveEdit(taskId: string) {
    const payload = editingByTaskId[taskId];
    if (!payload || !payload.title.trim()) {
      setError("У задачи должен быть непустой title");
      return;
    }
    if (isTaskLoading(savingByTaskId, taskId)) return;

    setTaskLoading(setSavingByTaskId, taskId, true);
    setError(null);
    try {
      await apiFetch<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": createIdempotencyKey(`edit-${taskId}`) },
        body: JSON.stringify({
          title: payload.title.trim(),
          description: normalizeOptionalString(payload.description),
          priority: payload.priority,
          status: payload.status,
          dueDate: normalizeOptionalDate(payload.dueDate),
        }),
      });
      onCancelEdit(taskId);
      await loadTasks();
      await loadWorkloadSummary(summaryDays);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setSavingByTaskId, taskId, false);
    }
  }

  async function onDeleteTask(taskId: string) {
    if (!window.confirm("Удалить задачу?")) return;
    if (isTaskLoading(deletingByTaskId, taskId)) return;

    setTaskLoading(setDeletingByTaskId, taskId, true);
    setError(null);
    try {
      await apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" });
      onCancelEdit(taskId);
      await loadTasks();
      await loadWorkloadSummary(summaryDays);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setDeletingByTaskId, taskId, false);
    }
  }

  async function onGenerateSuggestion(taskId: string) {
    if (isTaskLoading(categoryLoadingByTaskId, taskId)) return;

    setTaskLoading(setCategoryLoadingByTaskId, taskId, true);
    setError(null);
    try {
      const data = await apiFetch<{ suggestion: CategorySuggestion }>(
        `/tasks/${taskId}/ai/category-suggestion`,
        {
          method: "POST",
          body: JSON.stringify({ mode: "category_or_tag", language: "ru" }),
        },
      );
      setSuggestionByTaskId((prev) => ({ ...prev, [taskId]: data.suggestion }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setCategoryLoadingByTaskId, taskId, false);
    }
  }

  async function onApplySuggestion(taskId: string) {
    const suggestion = suggestionByTaskId[taskId];
    if (!suggestion) return;
    if (isTaskLoading(applyCategoryLoadingByTaskId, taskId)) return;

    setTaskLoading(setApplyCategoryLoadingByTaskId, taskId, true);
    setError(null);
    try {
      await apiFetch<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": createIdempotencyKey(`us3-${taskId}`) },
        body: JSON.stringify({
          classificationKind: suggestion.kind,
          classificationValue: suggestion.value,
        }),
      });
      setSuggestionByTaskId((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      await loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setApplyCategoryLoadingByTaskId, taskId, false);
    }
  }

  function onRejectSuggestion(taskId: string) {
    setSuggestionByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  async function onGeneratePrioritySuggestion(taskId: string) {
    if (isTaskLoading(priorityLoadingByTaskId, taskId)) return;

    setTaskLoading(setPriorityLoadingByTaskId, taskId, true);
    setError(null);
    try {
      const data = await apiFetch<{ suggestion: PrioritySuggestion }>(
        `/tasks/${taskId}/ai/priority-suggestion`,
        { method: "POST", body: JSON.stringify({ language: "ru" }) },
      );
      setPrioritySuggestionByTaskId((prev) => ({
        ...prev,
        [taskId]: data.suggestion,
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setPriorityLoadingByTaskId, taskId, false);
    }
  }

  async function onApplyPrioritySuggestion(taskId: string) {
    const suggestion = prioritySuggestionByTaskId[taskId];
    if (!suggestion) return;
    if (isTaskLoading(applyPriorityLoadingByTaskId, taskId)) return;

    setTaskLoading(setApplyPriorityLoadingByTaskId, taskId, true);
    setError(null);
    try {
      await apiFetch<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": createIdempotencyKey(`us5-${taskId}`) },
        body: JSON.stringify({
          priority: suggestion.suggestedPriority,
        }),
      });
      setPrioritySuggestionByTaskId((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      await loadTasks();
      await loadWorkloadSummary(summaryDays);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setApplyPriorityLoadingByTaskId, taskId, false);
    }
  }

  function onRejectPrioritySuggestion(taskId: string) {
    setPrioritySuggestionByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  async function onGenerateDecomposition(taskId: string) {
    if (isTaskLoading(decompositionLoadingByTaskId, taskId)) return;

    setTaskLoading(setDecompositionLoadingByTaskId, taskId, true);
    setError(null);
    try {
      const data = await apiFetch<{ suggestion: DecompositionSuggestion }>(
        `/tasks/${taskId}/ai/decompose`,
        {
          method: "POST",
          body: JSON.stringify({ maxSubtasks: 6, language: "ru" }),
        },
      );
      setDecompositionByTaskId((prev) => ({
        ...prev,
        [taskId]: {
          reason: data.suggestion.reason,
          subtasks: data.suggestion.subtasks.map((subtask) => ({
            title: subtask.title,
            description: subtask.description ?? "",
          })),
        },
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setDecompositionLoadingByTaskId, taskId, false);
    }
  }

  function onEditSubtask(
    taskId: string,
    index: number,
    field: "title" | "description",
    value: string,
  ) {
    setDecompositionByTaskId((prev) => {
      const current = prev[taskId];
      if (!current) return prev;
      return {
        ...prev,
        [taskId]: {
          ...current,
          subtasks: current.subtasks.map((item, i) =>
            i === index ? { ...item, [field]: value } : item,
          ),
        },
      };
    });
  }

  function onAddSubtask(taskId: string) {
    setDecompositionByTaskId((prev) => {
      const current = prev[taskId];
      if (!current || current.subtasks.length >= 10) return prev;
      return {
        ...prev,
        [taskId]: {
          ...current,
          subtasks: [...current.subtasks, { title: "", description: "" }],
        },
      };
    });
  }

  function onRemoveSubtask(taskId: string, index: number) {
    setDecompositionByTaskId((prev) => {
      const current = prev[taskId];
      if (!current || current.subtasks.length <= 1) return prev;
      return {
        ...prev,
        [taskId]: {
          ...current,
          subtasks: current.subtasks.filter((_, i) => i !== index),
        },
      };
    });
  }

  async function onApplyDecomposition(taskId: string) {
    const decomposition = decompositionByTaskId[taskId];
    if (!decomposition) return;
    if (isTaskLoading(applyDecompositionLoadingByTaskId, taskId)) return;

    const normalizedSubtasks = decomposition.subtasks.map((subtask) => ({
      title: subtask.title.trim(),
      description: subtask.description.trim() || null,
    }));
    if (normalizedSubtasks.some((subtask) => subtask.title.length === 0)) {
      setError("У каждой подзадачи должен быть непустой title");
      return;
    }

    setTaskLoading(setApplyDecompositionLoadingByTaskId, taskId, true);
    setError(null);
    try {
      await apiFetch<{ created: number; parentTaskId: string }>(
        `/tasks/${taskId}/subtasks/bulk`,
        {
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey(`us4-${taskId}`) },
          body: JSON.stringify({ subtasks: normalizedSubtasks }),
        },
      );
      setDecompositionByTaskId((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      await loadTasks();
      await loadWorkloadSummary(summaryDays);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTaskLoading(setApplyDecompositionLoadingByTaskId, taskId, false);
    }
  }

  function onRejectDecomposition(taskId: string) {
    setDecompositionByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.badge}>AI Task Manager / US-1..US-6</p>
        <div className={styles.header}>
          <h1>Интеллектуальный менеджер задач</h1>
          <p>
            CRUD + фильтрация/поиск + AI-ассистент. Для US-3/US-4/US-5 AI только
            предлагает, а изменения применяются исключительно вручную.
          </p>
        </div>

        <section className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <h2>Сводка нагрузки (US-6)</h2>
            <div className={styles.summaryControls}>
              <select
                className={styles.select}
                value={summaryDays}
                onChange={(event) => setSummaryDays(Number(event.target.value))}
              >
                <option value={3}>3 дня</option>
                <option value={7}>7 дней</option>
                <option value={14}>14 дней</option>
              </select>
              <button
                className={styles.secondaryButton}
                onClick={() => void loadWorkloadSummary(summaryDays)}
                type="button"
                disabled={summaryLoading}
              >
                {summaryLoading ? "Обновление..." : "Обновить"}
              </button>
            </div>
          </div>
          {workloadSummary ? (
            <>
              <p className={styles.summaryText}>{workloadSummary.summary}</p>
              <div className={styles.summaryStats}>
                <span>Просрочено: {workloadSummary.overdueCount}</span>
                <span>Ближайшие сроки: {workloadSummary.upcomingCount}</span>
                <span>
                  Статусы: todo {workloadSummary.distribution.status.todo} /
                  in_progress {workloadSummary.distribution.status.in_progress}{" "}
                  / done {workloadSummary.distribution.status.done}
                </span>
                <span>
                  Приоритеты: low {workloadSummary.distribution.priority.low} /
                  medium {workloadSummary.distribution.priority.medium} / high{" "}
                  {workloadSummary.distribution.priority.high}
                </span>
              </div>
              <ul className={styles.focusList}>
                {workloadSummary.focus.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.emptyState}>Сводка пока недоступна.</p>
          )}
        </section>

        <form className={styles.filtersForm} onSubmit={applyFilters}>
          <input
            value={filtersDraft.q}
            onChange={(event) =>
              setFiltersDraft((prev) => ({ ...prev, q: event.target.value }))
            }
            placeholder="Поиск по title/description"
            className={styles.input}
          />
          <select
            className={styles.select}
            value={filtersDraft.status}
            onChange={(event) =>
              setFiltersDraft((prev) => ({
                ...prev,
                status: event.target.value as TaskFilters["status"],
              }))
            }
          >
            <option value="">Все статусы</option>
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>
          <select
            className={styles.select}
            value={filtersDraft.priority}
            onChange={(event) =>
              setFiltersDraft((prev) => ({
                ...prev,
                priority: event.target.value as TaskFilters["priority"],
              }))
            }
          >
            <option value="">Все приоритеты</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
          <input
            className={styles.input}
            type="datetime-local"
            value={filtersDraft.dueDateFrom}
            onChange={(event) =>
              setFiltersDraft((prev) => ({
                ...prev,
                dueDateFrom: event.target.value,
              }))
            }
          />
          <input
            className={styles.input}
            type="datetime-local"
            value={filtersDraft.dueDateTo}
            onChange={(event) =>
              setFiltersDraft((prev) => ({
                ...prev,
                dueDateTo: event.target.value,
              }))
            }
          />
          <button className={styles.secondaryButton} type="submit">
            Применить
          </button>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={resetFilters}
          >
            Сброс
          </button>
        </form>

        <form className={styles.createForm} onSubmit={onCreateTask}>
          <input
            value={newTask.title}
            onChange={(event) =>
              setNewTask((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="title"
            className={styles.input}
          />
          <input
            value={newTask.description}
            onChange={(event) =>
              setNewTask((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder="description (опционально)"
            className={styles.input}
          />
          <select
            className={styles.select}
            value={newTask.priority}
            onChange={(event) =>
              setNewTask((prev) => ({
                ...prev,
                priority: event.target.value as TaskPriority,
              }))
            }
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
          <select
            className={styles.select}
            value={newTask.status}
            onChange={(event) =>
              setNewTask((prev) => ({
                ...prev,
                status: event.target.value as TaskStatus,
              }))
            }
          >
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>
          <input
            className={styles.input}
            type="datetime-local"
            value={newTask.dueDate}
            onChange={(event) =>
              setNewTask((prev) => ({ ...prev, dueDate: event.target.value }))
            }
          />
          <button className={styles.primaryButton} disabled={loading}>
            {loading ? "Создание..." : "Создать"}
          </button>
        </form>

        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <div className={styles.taskList}>
          {sortedTasks.length === 0 ? (
            <p className={styles.emptyState}>Список пуст.</p>
          ) : (
            sortedTasks.map((task) => {
              const isSubtask = task.parentTaskId !== null;
              const isEditing = Boolean(editingByTaskId[task.id]);
              const suggestion = suggestionByTaskId[task.id];
              const prioritySuggestion = prioritySuggestionByTaskId[task.id];
              const decomposition = decompositionByTaskId[task.id];
              const isSaving = isTaskLoading(savingByTaskId, task.id);
              const isDeleting = isTaskLoading(deletingByTaskId, task.id);
              const isCategoryLoading = isTaskLoading(
                categoryLoadingByTaskId,
                task.id,
              );
              const isPriorityLoading = isTaskLoading(
                priorityLoadingByTaskId,
                task.id,
              );
              const isDecompositionLoading = isTaskLoading(
                decompositionLoadingByTaskId,
                task.id,
              );
              const isApplyCategoryLoading = isTaskLoading(
                applyCategoryLoadingByTaskId,
                task.id,
              );
              const isApplyPriorityLoading = isTaskLoading(
                applyPriorityLoadingByTaskId,
                task.id,
              );
              const isApplyDecompositionLoading = isTaskLoading(
                applyDecompositionLoadingByTaskId,
                task.id,
              );
              const hasBlockingAction =
                isSaving ||
                isDeleting ||
                isCategoryLoading ||
                isPriorityLoading ||
                isDecompositionLoading ||
                isApplyCategoryLoading ||
                isApplyPriorityLoading ||
                isApplyDecompositionLoading;

              return (
                <article key={task.id} className={styles.taskCard}>
                  <div className={styles.taskMeta}>
                    {isEditing ? (
                      <div className={styles.editGrid}>
                        <input
                          className={styles.input}
                          value={editingByTaskId[task.id].title}
                          onChange={(event) =>
                            onEditField(task.id, "title", event.target.value)
                          }
                        />
                        <input
                          className={styles.input}
                          value={editingByTaskId[task.id].description}
                          onChange={(event) =>
                            onEditField(
                              task.id,
                              "description",
                              event.target.value,
                            )
                          }
                        />
                        <select
                          className={styles.select}
                          value={editingByTaskId[task.id].priority}
                          onChange={(event) =>
                            onEditField(
                              task.id,
                              "priority",
                              event.target.value as TaskPriority,
                            )
                          }
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                        <select
                          className={styles.select}
                          value={editingByTaskId[task.id].status}
                          onChange={(event) =>
                            onEditField(
                              task.id,
                              "status",
                              event.target.value as TaskStatus,
                            )
                          }
                        >
                          <option value="todo">todo</option>
                          <option value="in_progress">in_progress</option>
                          <option value="done">done</option>
                        </select>
                        <input
                          className={styles.input}
                          type="datetime-local"
                          value={editingByTaskId[task.id].dueDate}
                          onChange={(event) =>
                            onEditField(task.id, "dueDate", event.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <h2>{task.title}</h2>
                        <p>
                          Приоритет: <b>{task.priority}</b> · Статус:{" "}
                          <b>{task.status}</b>
                          {isSubtask ? " · Подзадача" : ""}
                        </p>
                        <p>
                          Срок:{" "}
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleString("ru-RU")
                            : "не задан"}
                        </p>
                        <p>Описание: {task.description ?? "—"}</p>
                        <p>
                          Классификация:{" "}
                          {task.classificationKind && task.classificationValue
                            ? `${task.classificationKind}: ${task.classificationValue}`
                            : "не задана"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className={styles.actionRow}>
                    {isEditing ? (
                      <>
                        <button
                          className={styles.primaryButton}
                          onClick={() => void onSaveEdit(task.id)}
                          type="button"
                          disabled={isSaving}
                        >
                          {isSaving ? "Сохранение..." : "Сохранить"}
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => onCancelEdit(task.id)}
                          type="button"
                          disabled={isSaving}
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => onStartEdit(task)}
                          type="button"
                          disabled={hasBlockingAction}
                        >
                          Редактировать
                        </button>
                        <button
                          className={styles.ghostButton}
                          onClick={() => void onDeleteTask(task.id)}
                          type="button"
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Удаление..." : "Удалить"}
                        </button>
                      </>
                    )}
                  </div>

                  {!isSubtask && !isEditing ? (
                    <>
                      <div className={styles.actionsGrid}>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => void onGenerateSuggestion(task.id)}
                          type="button"
                          disabled={isCategoryLoading || hasBlockingAction}
                        >
                          {isCategoryLoading
                            ? "category/tag..."
                            : "category/tag"}
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() =>
                            void onGeneratePrioritySuggestion(task.id)
                          }
                          type="button"
                          disabled={isPriorityLoading || hasBlockingAction}
                        >
                          {isPriorityLoading ? "priority..." : "priority"}
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => void onGenerateDecomposition(task.id)}
                          type="button"
                          disabled={isDecompositionLoading || hasBlockingAction}
                        >
                          {isDecompositionLoading
                            ? "decompose..."
                            : "decompose"}
                        </button>
                      </div>

                      {suggestion ? (
                        <section className={styles.suggestionCard}>
                          <p>
                            <b>{suggestion.kind}</b>: {suggestion.value}
                          </p>
                          <p>{suggestion.reason}</p>
                          <div className={styles.actionRow}>
                            <button
                              className={styles.primaryButton}
                              onClick={() => void onApplySuggestion(task.id)}
                              type="button"
                              disabled={isApplyCategoryLoading}
                            >
                              {isApplyCategoryLoading
                                ? "Применение..."
                                : "Применить"}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              onClick={() => onRejectSuggestion(task.id)}
                              type="button"
                              disabled={isApplyCategoryLoading}
                            >
                              Отклонить
                            </button>
                          </div>
                        </section>
                      ) : null}

                      {prioritySuggestion ? (
                        <section className={styles.suggestionCard}>
                          <p>
                            Предложенный приоритет:{" "}
                            <b>{prioritySuggestion.suggestedPriority}</b>
                          </p>
                          <p>{prioritySuggestion.reason}</p>
                          <div className={styles.actionRow}>
                            <button
                              className={styles.primaryButton}
                              onClick={() =>
                                void onApplyPrioritySuggestion(task.id)
                              }
                              type="button"
                              disabled={isApplyPriorityLoading}
                            >
                              {isApplyPriorityLoading
                                ? "Применение..."
                                : "Применить"}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              onClick={() =>
                                onRejectPrioritySuggestion(task.id)
                              }
                              type="button"
                              disabled={isApplyPriorityLoading}
                            >
                              Отклонить
                            </button>
                          </div>
                        </section>
                      ) : null}

                      {decomposition ? (
                        <section className={styles.suggestionCard}>
                          <p>{decomposition.reason}</p>
                          <div className={styles.subtaskEditorList}>
                            {decomposition.subtasks.map((subtask, index) => (
                              <div
                                key={`${task.id}-subtask-${index}`}
                                className={styles.subtaskEditorItem}
                              >
                                <input
                                  className={styles.input}
                                  value={subtask.title}
                                  onChange={(event) =>
                                    onEditSubtask(
                                      task.id,
                                      index,
                                      "title",
                                      event.target.value,
                                    )
                                  }
                                  placeholder={`Подзадача ${index + 1}`}
                                />
                                <input
                                  className={styles.input}
                                  value={subtask.description}
                                  onChange={(event) =>
                                    onEditSubtask(
                                      task.id,
                                      index,
                                      "description",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Описание (опционально)"
                                />
                                <button
                                  className={styles.ghostButton}
                                  onClick={() =>
                                    onRemoveSubtask(task.id, index)
                                  }
                                  type="button"
                                  disabled={
                                    decomposition.subtasks.length <= 1 ||
                                    isApplyDecompositionLoading
                                  }
                                >
                                  Удалить
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            className={styles.secondaryButton}
                            onClick={() => onAddSubtask(task.id)}
                            type="button"
                            disabled={
                              decomposition.subtasks.length >= 10 ||
                              isApplyDecompositionLoading
                            }
                          >
                            Добавить
                          </button>
                          <div className={styles.actionRow}>
                            <button
                              className={styles.primaryButton}
                              onClick={() => void onApplyDecomposition(task.id)}
                              type="button"
                              disabled={isApplyDecompositionLoading}
                            >
                              {isApplyDecompositionLoading
                                ? "Применение..."
                                : "Применить"}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              onClick={() => onRejectDecomposition(task.id)}
                              type="button"
                              disabled={isApplyDecompositionLoading}
                            >
                              Отклонить
                            </button>
                          </div>
                        </section>
                      ) : null}
                    </>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };

  if (!response.ok) {
    throw new ApiRequestError(
      body.error?.message ?? `HTTP ${response.status}`,
      response.status,
      body.error?.code ?? null,
    );
  }

  return body as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "AI_TIMEOUT":
        return "AI не ответил вовремя. Повторите запрос.";
      case "AI_UNAVAILABLE":
        return "AI-провайдер временно недоступен. Повторите позже.";
      case "AI_INVALID_SCHEMA":
        return "AI вернул ответ в неверном формате. Повторите запрос.";
      case "IDEMPOTENCY_CONFLICT":
        return "Повторный запрос конфликтует с уже выполненной операцией.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function createIdempotencyKey(prefix: string): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${randomPart}`;
}

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDate(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function toLocalDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}
