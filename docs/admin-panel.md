# Панель администратора

Документация по административной панели платформы Синтезум. Доступ только для пользователей с ролью `platform_admin`.

---

## Доступ

| Условие | Описание |
|---------|----------|
| **Роль** | `platform_admin` |
| **Аутентификация** | Bearer JWT (тот же механизм, что и для обычных пользователей) |
| **Базовый URL** | `/api/admin` |
| **Frontend** | Маршрут `/admin` — `src/pages/admin/Admin.jsx` |

При отсутствии роли администратора API возвращает `403 Forbidden` с сообщением «Platform admin access required».

---

## Структура API

### Дашборд

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/dashboard/stats` | Сводная статистика |

**Ответ:**
```json
{
  "organizations": 12,
  "laboratories": 45,
  "vacancies": 23,
  "queries": 8,
  "users_count": 156,
  "pending_subscription_requests": 3,
  "pending_lab_join_requests": 2,
  "pending_org_join_requests": 1
}
```

---

### Организации

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/organizations` | Список организаций (пагинация) |
| GET | `/api/admin/organizations/{org_id}` | Детали организации |
| PUT | `/api/admin/organizations/{org_id}` | Обновление |
| DELETE | `/api/admin/organizations/{org_id}` | Удаление |
| GET | `/api/admin/organizations/{org_id}/laboratories` | Лаборатории организации |
| GET | `/api/admin/organizations/{org_id}/queries` | Запросы организации |
| GET | `/api/admin/organizations/{org_id}/employees` | Сотрудники организации |
| GET | `/api/admin/organizations/{org_id}/equipment` | Оборудование организации |
| GET | `/api/admin/organizations/{org_id}/tasks` | Решённые задачи организации |

**Параметры списка:** `page`, `size`

---

### Лаборатории

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/laboratories` | Список лабораторий |
| GET | `/api/admin/laboratories/{lab_id}` | Детали лаборатории |
| PUT | `/api/admin/laboratories/{lab_id}` | Обновление |
| DELETE | `/api/admin/laboratories/{lab_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Вакансии

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/vacancies` | Список вакансий |
| GET | `/api/admin/vacancies/{vacancy_id}` | Детали вакансии |
| PUT | `/api/admin/vacancies/{vacancy_id}` | Обновление |
| DELETE | `/api/admin/vacancies/{vacancy_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Запросы (organization_queries)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/queries` | Список запросов |
| GET | `/api/admin/queries/{query_id}` | Детали запроса |
| PUT | `/api/admin/queries/{query_id}` | Обновление |
| DELETE | `/api/admin/queries/{query_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Оборудование

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/equipment` | Список оборудования |
| GET | `/api/admin/equipment/{equipment_id}` | Детали |
| PUT | `/api/admin/equipment/{equipment_id}` | Обновление |
| DELETE | `/api/admin/equipment/{equipment_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Решённые задачи (task_solutions)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/tasks` | Список решённых задач |
| GET | `/api/admin/tasks/{task_id}` | Детали |
| PUT | `/api/admin/tasks/{task_id}` | Обновление |
| DELETE | `/api/admin/tasks/{task_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Сотрудники

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/employees` | Список сотрудников |
| GET | `/api/admin/employees/{employee_id}` | Детали |
| PUT | `/api/admin/employees/{employee_id}` | Обновление |
| DELETE | `/api/admin/employees/{employee_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Студенты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/students` | Список студентов |
| GET | `/api/admin/students/{user_id}` | Детали (по user_id) |
| PUT | `/api/admin/students/{user_id}` | Обновление |
| DELETE | `/api/admin/students/{user_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Исследователи

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/researchers` | Список исследователей |
| GET | `/api/admin/researchers/{user_id}` | Детали (по user_id) |
| PUT | `/api/admin/researchers/{user_id}` | Обновление |
| DELETE | `/api/admin/researchers/{user_id}` | Удаление |

**Параметры списка:** `page`, `size`

---

### Данные creators (lab_rep без организации)

Для представителей лабораторий без организации (`creator_user_id` вместо `organization_id`):

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/creators/{user_id}/laboratories` | Лаборатории creator |
| GET | `/api/admin/creators/{user_id}/queries` | Запросы |
| GET | `/api/admin/creators/{user_id}/employees` | Сотрудники |
| GET | `/api/admin/creators/{user_id}/equipment` | Оборудование |
| GET | `/api/admin/creators/{user_id}/tasks` | Решённые задачи |

---

### Пользователи

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/users` | Список пользователей |
| POST | `/api/admin/users/{user_id}/block` | Блокировка/разблокировка |
| POST | `/api/admin/users/{user_id}/reset-password` | Отправка письма сброса пароля |

**Параметры списка:** `page`, `size`, `role`, `q` (поиск по email/full_name)

**Body для block:** `{"blocked": true|false}`

---

### Подписки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/users/search` | Поиск пользователей (q, limit) для назначения подписки |
| POST | `/api/admin/subscriptions` | Создание/активация подписки |
| POST | `/api/admin/subscriptions/{id}/extend` | Продление подписки |
| POST | `/api/admin/subscriptions/{id}/cancel` | Отмена подписки |
| GET | `/api/admin/subscriptions/user/{user_id}` | Подписки пользователя |
| GET | `/api/admin/subscription-requests` | Заявки на подписку |
| POST | `/api/admin/subscription-requests/{id}/approve` | Одобрить заявку |
| POST | `/api/admin/subscription-requests/{id}/reject` | Отклонить заявку |
| GET | `/api/admin/subscriptions/{id}/events` | События подписки (аудит) |

**Body для создания подписки:**
```json
{
  "user_id": 123,
  "audience": "representative",
  "tier": "pro",
  "expires_at": "2025-12-31T23:59:59Z",
  "trial_ends_at": null
}
```

**Параметры subscription-requests:** `status` (pending | all)

---

### Заявки на присоединение

#### Исследователь → лаборатория

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/join-requests/lab` | Список заявок |
| POST | `/api/admin/join-requests/lab/{request_id}/approve` | Одобрить |
| POST | `/api/admin/join-requests/lab/{request_id}/reject` | Отклонить |

**Параметры:** `status` (pending | all)

#### Лаборатория → организация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/join-requests/org` | Список заявок |
| POST | `/api/admin/join-requests/org/{request_id}/approve` | Одобрить |
| POST | `/api/admin/join-requests/org/{request_id}/reject` | Отклонить |

**Параметры:** `status` (pending | all)

---

### Отклики на вакансии

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/vacancy-responses` | Список откликов |

**Параметры:** `page`, `size`, `vacancy_id`, `status` (new | accepted | rejected)

---

### Новости

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/news` | Все новости с фильтрами `news_status` и `scope` |
| GET | `/api/admin/news/eligible-employees` | Сотрудники источника для редактирования привязок |
| POST | `/api/admin/news` | Создать платформенный черновик |
| PUT | `/api/admin/news/{id}` | Изменить любую публикацию |
| PUT | `/api/admin/news/{id}/publish` | Опубликовать, восстановить или снять публикацию |
| DELETE | `/api/admin/news/{id}` | Удалить платформенную новость |

Снятие чужой новости переводит её в `blocked`. Автор может исправить материал, но только администратор может вернуть его в публичную ленту. При редактировании новости организации или лаборатории администратор может менять список связанных сотрудников в пределах выбранного источника. Редактор поддерживает обложку, изображения в тексте, отдельный фотоальбом и файловые вложения.

---

## Структура UI (Frontend)

Админ-панель организована по вкладкам:

| Вкладка | ID | Endpoint |
|---------|-----|----------|
| Дашборд | dashboard | `GET /dashboard/stats` |
| Организации | organizations | `GET /organizations` |
| Лаборатории | laboratories | `GET /laboratories` |
| Вакансии | vacancies | `GET /vacancies` |
| Запросы | queries | `GET /queries` |
| Новости | news | `GET /news` |
| Оборудование | equipment | `GET /equipment` |
| Решённые задачи | tasks | `GET /tasks` |
| Сотрудники | employees | `GET /employees` |
| Студенты | students | `GET /students` |
| Исследователи | researchers | `GET /researchers` |
| Пользователи | users | `GET /users` |
| Подписки | subscriptions | — (отдельный flow) |
| Заявки | join-requests | `GET /join-requests/lab`, `GET /join-requests/org` |
| Отклики | vacancy-responses | `GET /vacancy-responses` |

---

## Пагинация

Все списковые эндпоинты поддерживают:

- `page` (по умолчанию 1)
- `size` (по умолчанию 20, макс. 100)

Ответ содержит: `items`, `total`, `page`, `size`.
