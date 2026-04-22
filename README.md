# Тестовое ИИ менеджер задач

## 1. Краткое описание проекта и реализованных функций
Проект — веб-приложение для управления задачами с AI-функциями (US-1..US-6).

Реализовано:
- US-1: CRUD задач (создание, просмотр, обновление, удаление).
- US-2: фильтрация и поиск задач по статусу/приоритету/срокам/тексту.
- US-3: AI-предложение category/tag (только suggestion + ручной apply/reject).
- US-4: AI-декомпозиция задачи в подзадачи (редактирование перед apply).
- US-5: AI-предложение приоритета (только suggestion + ручной apply/reject).
- US-6: AI-сводка нагрузки по задачам.
- AI runtime: Prompt Layer + LangGraph orchestration + JSON schema validation + error mapping.

## 2. Пошаговые инструкции настройки среды (зависимости, установка, переменные окружения)
Требования:
- Node.js >= 24
- Docker (для PostgreSQL)

Шаги:
1. Установить зависимости:
```bash
npm install
```
2. Поднять БД:
```bash
docker compose up -d
```
3. Создать `.env`:
```bash
cp .env.example .env
```
4. Применить миграции:
```bash
npm run db:migrate:deploy --workspace backend
```

Переменные окружения:
- `DATABASE_URL` — строка подключения к PostgreSQL.
- `AI_PROVIDER_DEFAULT=openai|mock`.
- `OPENAI_API_KEY` — для live OpenAI runtime (если пусто, используется mock fallback).
- `AI_MODEL_PRIMARY` и `AI_MAX_OUTPUT_TOKENS_US*` — настройка моделей и лимитов.

## 3. Инструкции запуска приложения (фронтенд и бэкенд)
Запуск backend:
```bash
npm run dev:backend
```

Запуск frontend:
```bash
npm run dev:frontend
```

Адреса:
- Backend API: `http://localhost:3001/api/v1`
- Frontend: `http://localhost:3000`

## 4. Описание принятых архитектурных решений
- Монорепо с workspaces: `backend` (NestJS) + `frontend` (Next.js).
- Хранение данных: PostgreSQL + Prisma ORM.
- AI-слой отделен от task-логики:
  - `prompts/*` для сценарных prompt-профилей,
  - `TaskAIStateGraph` (LangGraph) для оркестрации шагов,
  - provider adapter (`openai`/`mock`) через DI + env,
  - AJV schema validation как safety guardrail.
- Human-in-the-loop: US-3/US-4/US-5 не меняют данные автоматически; изменения только отдельным apply-запросом.
- Единый формат ошибок API и idempotency для apply-операций.

## 5. Известные проблемы, ограничения или компромиссы
- Demo single-user режим, без auth/roles.
- Idempotency-хранилище in-memory (не персистентно между рестартами backend).
- Eval-режим детерминированный (simulation), не полноценный live benchmark.
- Для frontend сборки используется webpack fallback (`next build --webpack`) из-за бага Turbopack на путях с unicode/спецсимволами.

## 6. Список функций, которые кандидат добавил бы при наличии дополнительного времени
- Полноценная авторизация и multi-user изоляция данных.
- Персистентное idempotency-хранилище (Redis/PostgreSQL).
- Live-eval pipeline с реальными LLM-вызовами и отчетами качества/стоимости.
- Наблюдаемость production-уровня: trace/log correlation, dashboards, алерты.
- Расширенный UI: канбан/календарь, bulk actions, история изменений.
