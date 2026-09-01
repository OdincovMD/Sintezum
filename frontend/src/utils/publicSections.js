export const ORGANIZATION_PUBLIC_SECTIONS = [
  { key: "news", label: "Новости", description: "Публикации организации" },
  { key: "laboratories", label: "Лаборатории", description: "Подразделения организации" },
  { key: "equipment", label: "Оборудование", description: "Доступные приборы и установки" },
  { key: "employees", label: "Сотрудники", description: "Команда организации" },
  { key: "task_solutions", label: "Решённые задачи", description: "Выполненные проекты и кейсы" },
  { key: "queries", label: "Запросы", description: "Открытые запросы организации" },
  { key: "vacancies", label: "Вакансии", description: "Предложения о работе" },
];

export const LABORATORY_PUBLIC_SECTIONS = [
  { key: "photos", label: "Фотографии", description: "Фотогалерея лаборатории" },
  { key: "news", label: "Новости", description: "Публикации лаборатории" },
  { key: "employees", label: "Сотрудники", description: "Команда лаборатории" },
  { key: "equipment", label: "Оборудование", description: "Приборы и установки" },
  { key: "task_solutions", label: "Решённые задачи", description: "Выполненные проекты и кейсы" },
  { key: "queries", label: "Запросы", description: "Открытые запросы лаборатории" },
  { key: "vacancies", label: "Вакансии", description: "Предложения о работе" },
  { key: "documents", label: "Документы", description: "Прикреплённые файлы" },
];

export function isPublicSectionVisible(entity, sectionKey) {
  const hidden = Array.isArray(entity?.hidden_public_sections)
    ? entity.hidden_public_sections
    : [];
  return !hidden.includes(sectionKey);
}

export function setPublicSectionVisibility(hiddenSections, sectionKey, isVisible) {
  const next = new Set(Array.isArray(hiddenSections) ? hiddenSections : []);
  if (isVisible) next.delete(sectionKey);
  else next.add(sectionKey);
  return Array.from(next);
}
