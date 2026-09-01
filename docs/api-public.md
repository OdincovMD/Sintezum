# Публичный API — Синтезум

Документация публичных эндпоинтов платформы (без `/api/admin`). Swagger/ReDoc отключены, эндпоинты описаны вручную.

---

## Общие сведения

| Параметр | Значение |
|----------|----------|
| **Базовый префикс** | `/api` |
| **Аутентификация** | Bearer JWT в заголовке `Authorization` |
| **Формат** | JSON |
| **Кодировка** | UTF-8 |

К большинству эндпоинтов требуется авторизация. Исключения: health, auth, поиск, каталоги (списки и детали), главная, статистика.

---

## Оглавление

1. [Health](#1-health)
2. [Аутентификация](#2-аутентификация)
3. [Поиск](#3-поиск)
4. [Главная страница](#4-главная-страница)
5. [Организации (labs)](#5-организации-labs)
6. [Лаборатории](#6-лаборатории)
7. [Вакансии](#7-вакансии)
8. [Запросы](#8-запросы)
9. [Соискатели](#9-соискатели)
10. [Пользователь и роли](#10-пользователь-и-роли)
11. [Профиль](#11-профиль)
12. [Аналитика](#12-аналитика)
13. [Хранилище](#13-хранилище)
14. [Статистика](#14-статистика)

---

## 1. Health

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/health` | — | Проверка доступности сервиса |

**Ответ:** `{"status": "ok"}`

---

## 2. Аутентификация

**Префикс:** `/api/auth`

### Регистрация и вход

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/auth/register` | — | Регистрация по email |
| POST | `/auth/login` | — | Вход по email/паролю |
| POST | `/auth/verify-email` | — | Подтверждение email по токену |
| POST | `/auth/resend-verification` | ✓ | Повторная отправка письма верификации |
| POST | `/auth/forgot-password` | — | Запрос сброса пароля (отправка письма) |
| POST | `/auth/reset-password` | — | Установка нового пароля по токену из письма |
| POST | `/auth/me/set-password` | ✓ | Установить пароль (для пользователей через ORCID) |

**POST /auth/register** — Body:
```json
{
  "mail": "user@example.com",
  "password": "строка",
  "role_id": 1
}
```
Ответ: `UserRead` (201). Rate limit: 5/min.

**POST /auth/login** — Body:
```json
{
  "mail": "user@example.com",
  "password": "строка"
}
```
Ответ: `{"access_token": "JWT...", "user": UserRead}`. Rate limit: 10/min.

**POST /auth/verify-email** — Body: `{"token": "..."}`

**POST /auth/reset-password** — Body:
```json
{
  "token": "из письма",
  "password": "новый пароль",
  "password_confirm": "повтор"
}
```

### ORCID OAuth

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/auth/orcid` | — | Редирект на ORCID (вход/регистрация) |
| GET | `/auth/orcid/callback` | — | Callback от ORCID (редирект с JWT) |
| POST | `/auth/orcid/complete` | — | Дорегистрация после ORCID: email + роль |
| POST | `/auth/orcid/link` | ✓ | Получить URL для привязки ORCID |
| GET | `/auth/orcid/link-go` | — | Промежуточный редирект (cookie + ORCID) |
| DELETE | `/auth/orcid/unlink` | ✓ | Отвязать ORCID |

**POST /auth/orcid/complete** — Body:
```json
{
  "mail": "user@example.com",
  "orcid": "0000-0001-2345-6789",
  "role_id": 1,
  "full_name": "Имя Фамилия"
}
```
Ответ: `TokenResponse` (access_token, user).

---

## 3. Поиск

**Префикс:** `/api/search`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/search/suggest` | — | Глобальные подсказки (вакансии, организации, лаборатории, запросы) |

**Параметры:** `q` (строка), `limit` (1–20, по умолчанию 12)

**Ответ:** `{"items": [{"type": "vacancy"|"organization"|"laboratory"|"query", "public_id": "...", "title": "..."}, ...]}`

---

## 4. Главная страница

**Префикс:** `/api/home`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/home/featured` | — | Рекомендованные организации, лаборатории, вакансии |
| GET | `/home/empty-suggestions` | — | Fallback-предложения при пустом поиске |

**Параметры empty-suggestions:** `type` (vacancies | queries | laboratories | organizations), `limit` (1–20)

**Ответ featured:** `{"organizations": [...], "laboratories": [...], "vacancies": [...]}`

**Ответ empty-suggestions:** `{"items": [...]}`

---

## 5. Организации (labs)

**Префикс:** `/api/labs`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/labs/` | ✓ | Создание организации |
| GET | `/labs/` | — | Список опубликованных организаций |
| GET | `/labs/suggest` | — | Подсказки для поиска |
| GET | `/labs/{org_id}` | — | Организация по числовому ID |
| GET | `/labs/public/{public_id}/details` | — | Детали организации по public_id |

**POST /labs/** — Body: `OrganizationCreate` (name, avatar_url?, description?, address?, website?)

**GET /labs/** — Параметры: `q`, `page` (1+), `size` (1–100), `min_laboratories`, `min_employees`, `sort_by`

**Ответ списка:** `{"items": [...], "total": N, "page": P, "size": S}`

---

## 6. Лаборатории

**Префикс:** `/api/laboratories`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/laboratories/` | — | Список опубликованных лабораторий |
| GET | `/laboratories/suggest` | — | Подсказки для поиска |
| GET | `/laboratories/public/{public_id}/details` | — | Детали лаборатории по public_id |

**Параметры списка:** `q`, `page`, `size`, `organization_id`, `without_org`, `min_employees`, `sort_by`

**Ответ списка:** `{"items": [...], "total": N, "page": P, "size": S}`

---

## 7. Вакансии

**Префикс:** `/api/vacancies`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/vacancies/` | — | Список опубликованных вакансий |
| GET | `/vacancies/suggest` | — | Подсказки для поиска |
| GET | `/vacancies/public/{public_id}/details` | — | Детали вакансии |
| POST | `/vacancies/public/{public_id}/respond` | ✓ | Откликнуться (student/researcher) |
| GET | `/vacancies/public/{public_id}/my-response` | опц. | Свой отклик на вакансию |

**Параметры списка:** `q`, `page`, `size`, `employment_type`, `organization_id`, `laboratory_id`, `sort_by` (date_desc | date_asc)

**Ответ списка:** `{"items": [...], "total": N, "page": P, "size": S}`

**Ответ respond:** `{"id": response_id, "status": "new"}` (201)

**Ответ my-response:** `{"has_response": true|false[, "id", "status"]}`

---

## 8. Запросы

**Префикс:** `/api/queries`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/queries/` | — | Список опубликованных запросов |
| GET | `/queries/suggest` | — | Подсказки для поиска |
| GET | `/queries/public/{public_id}/details` | — | Детали запроса |

**Параметры списка:** `q`, `page`, `size`, `status`, `laboratory_id`, `budget_contains`, `sort_by` (date_desc | date_asc)

**Ответ списка:** массив объектов `OrganizationQueryRead` (без метаданных пагинации)

---

## 9. Соискатели

**Префикс:** `/api/applicants`

Доступ: `lab_admin`, `lab_representative`, `platform_admin`. Требуется активная подписка (кроме platform_admin).

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/applicants/` | ✓ | Список опубликованных соискателей |
| GET | `/applicants/suggest` | ✓ | Подсказки для поиска |
| GET | `/applicants/public/{public_id}/details` | ✓ | Детали соискателя |

**Параметры списка:** `q`, `page`, `size`, `role` (student | researcher), `status`, `sort_by`

**Ответ списка:** `{"items": [...], "total": N, "page": P, "size": S}`

---

## 10. Пользователь и роли

**Префикс:** `/api/users`, `/api/roles`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/users/me` | ✓ | Текущий пользователь |
| PUT | `/users/me` | ✓ | Обновить профиль (full_name, contacts) |
| PUT | `/users/me/avatar` | ✓ | Обновить аватар (photo_url) |
| PUT | `/users/me/role` | ✓ | Сменить роль (role_id) |
| GET | `/roles/` | ✓ | Список ролей |

**PUT /users/me** — Body: `{"full_name": "...", "contacts": {...}}`

**PUT /users/me/avatar** — Body: `{"photo_url": "https://..."}`

**PUT /users/me/role** — Body: `{"role_id": 1}`

---

## 11. Профиль

**Префикс:** `/api/profile`

### Подписка (представители)

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/subscription` | ✓ | Текущая подписка |
| POST | `/profile/subscription/request` | ✓ | Запросить подключение подписки |

**POST subscription/request** — Body: `{"tier": "basic"|"pro", "is_trial": false}`

### Организация

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/organization` | ✓ | Моя организация |
| PUT | `/profile/organization` | ✓ | Создать/обновить организацию |
| PUT | `/profile/organization/publish` | ✓ | Опубликовать/снять с публикации |

### Лаборатории, оборудование, сотрудники, задачи, запросы, вакансии

CRUD для организаций и лабораторий (представители). Префиксы: `/profile/organization/...`

| Группа | Endpoints |
|--------|-----------|
| Лаборатории | GET/POST `/organization/laboratories`, PUT/DELETE `/{id}`, PUT `/{id}/publish` |
| Оборудование | GET/POST `/organization/equipment`, PUT/DELETE `/{id}` |
| Сотрудники | GET/POST `/organization/employees`, GET/PUT/DELETE `/{id}` |
| Решённые задачи | GET/POST `/organization/tasks`, PUT/DELETE `/{id}` |
| Запросы | GET/POST `/organization/queries`, PUT/DELETE `/{id}`, PUT `/{id}/publish` |
| Вакансии | GET/POST `/organization/vacancies`, PUT/DELETE `/{id}`, PUT `/{id}/publish` |

### Заявки на присоединение

**Префикс:** `/profile/join-requests`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/profile/join-requests/lab` | ✓ | Заявка исследователя в лабораторию |
| DELETE | `/profile/join-requests/lab/{lab_id}` | ✓ | Покинуть лабораторию |
| POST | `/profile/join-requests/org` | ✓ | Заявка лаборатории в организацию |
| GET | `/profile/join-requests` | ✓ | Мои заявки (lab + org) |
| GET | `/profile/join-requests/organization/lab` | ✓ | Входящие заявки (lab_admin) |
| GET | `/profile/join-requests/laboratories/lab` | ✓ | Входящие заявки (lab_rep) |
| POST | `/profile/join-requests/lab/{id}/approve` | ✓ | Принять заявку |
| POST | `/profile/join-requests/lab/{id}/reject` | ✓ | Отклонить заявку |
| POST | `/profile/join-requests/org/{id}/approve` | ✓ | Принять заявку lab→org |
| POST | `/profile/join-requests/org/{id}/reject` | ✓ | Отклонить заявку |
| DELETE | `/profile/join-requests/org/{id}` | ✓ | Отменить заявку lab→org |

**POST lab** — Body: `{"lab_public_id": "..."}`  
**POST org** — Body: `{"org_public_id": "...", "lab_public_id": "..."}`

### Отклики на вакансии

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/vacancy-responses` | ✓ | Отклики на мои вакансии (работодатель) |
| PATCH | `/profile/vacancy-responses/{id}` | ✓ | Изменить статус отклика |
| GET | `/profile/my-vacancy-responses` | ✓ | Мои отклики (соискатель) |

**PATCH** — Body: `{"status": "new"|"viewed"|"contacted"|"rejected"}`

### Уведомления

**Префикс:** `/profile/notifications`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/notifications` | ✓ | Список уведомлений |
| GET | `/profile/notifications/unread-count` | ✓ | Количество непрочитанных |
| PATCH | `/profile/notifications/{id}/read` | ✓ | Отметить прочитанным и удалить |
| DELETE | `/profile/notifications/{id}` | ✓ | Удалить |

**Параметры GET:** `unread_only` (bool)

### OpenAlex (профиль пользователя)

**Префикс:** `/profile/openalex`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/profile/openalex/link` | ✓ | Привязать OpenAlex ID |
| DELETE | `/profile/openalex/unlink` | ✓ | Отвязать OpenAlex |
| POST | `/profile/openalex/import` | ✓ | Импорт данных в Researcher |

**POST link** — Body: `{"openalex_id": "A1234567890" или "https://openalex.org/..."}`

### OpenAlex (организация)

**Префикс:** `/profile/organization/openalex`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/profile/organization/openalex/link` | ✓ | Привязать OpenAlex к сотруднику |
| DELETE | `/profile/organization/openalex/unlink` | ✓ | Отвязать |
| POST | `/profile/organization/openalex/import` | ✓ | Импорт данных сотрудника |

### Профили ролей

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/student` | ✓ | Профиль студента |
| PUT | `/profile/student` | ✓ | Создать/обновить профиль студента |
| GET | `/profile/researcher` | ✓ | Профиль исследователя |
| PUT | `/profile/researcher` | ✓ | Создать/обновить профиль исследователя |

---

## 12. Аналитика

**Префикс:** `/api/analytics`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/analytics/events` | опц. | Отправить события (page_view, page_leave, button_click) |

**Body:**
```json
{
  "events": [
    {
      "event_type": "page_view" | "page_leave" | "button_click",
      "session_id": "строка",
      "entity_type": "vacancy" | "organization" | "laboratory" | "query" | "news" | "profile" | "home" | "list",
      "entity_id": "опционально",
      "payload": {}
    }
  ]
}
```

До 50 событий за запрос. Rate limit: 60/min.

**Ответ:** `{"accepted": N}`

### Аналитика профиля (представители)

**Префикс:** `/api/profile/analytics`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/profile/analytics/extended` | ✓ | Расширенная аналитика (только Pro) |
| GET | `/profile/analytics/vacancy-stats` | ✓ | Статистика по вакансиям |
| GET | `/profile/analytics/dashboard` | ✓ | Дашборд работодателя |

---

## 13. Хранилище

**Префикс:** `/api/storage`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | `/storage/upload` | ✓ | Загрузка файла (multipart/form-data) |

**Формат:** `category` (form), `file` (form).  
**category:** equipment, laboratory, employee, organization, researcher, student, user, feedback, news.

**Допустимые типы:** изображения, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV. Макс. 10 MB.

**Ответ:** `{"public_url": "https://...", "key": "..."}`

---

## 14. Статистика

**Префикс:** `/api/stats`

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/stats/` | — | Счётчики платформы (лаборатории, вакансии, организации и т.п.) |

---

## 15. Новости

| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | `/news` | — | Все опубликованные новости; фильтры `organization_id` или `laboratory_id` |
| GET | `/news/public/{public_id}` | — | Детальная публикация |
| GET | `/profile/news` | ✓ | Новости доступных пользователю организации и лабораторий |
| GET | `/profile/news/eligible-employees` | ✓ | Сотрудники, доступные для привязки к выбранному источнику |
| POST | `/profile/news` | ✓ | Создать черновик |
| PUT | `/profile/news/{id}` | ✓ | Изменить собственную новость |
| PUT | `/profile/news/{id}/publish` | ✓ | Опубликовать или вернуть в черновик |
| DELETE | `/profile/news/{id}` | ✓ | Удалить собственную новость |

`POST /profile/news` и `PUT /profile/news/{id}` принимают необязательный массив `employee_ids` (до 20 уникальных ID). Для новости организации разрешены только её сотрудники, для новости лаборатории — только сотрудники этой лаборатории. Публичные и управляющие ответы возвращают краткие данные выбранных сотрудников в поле `employees`.

Публичный список поддерживает `page`, `size` и сортируется по исходной дате публикации. Черновики, заблокированные новости и публикации скрытых владельцев не возвращаются.

---

## Коды ответов и ошибки

| Код | Описание |
|-----|----------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — неверные данные |
| 401 | Unauthorized — не авторизован или токен недействителен |
| 403 | Forbidden — нет прав |
| 404 | Not Found |
| 413 | Payload Too Large (загрузка файла) |
| 429 | Too Many Requests (rate limit) |

Формат ошибки: `{"detail": "строка"}` или `{"detail": {"error": "код", "message": "..."}}`
