import React, { useState, useRef } from "react";
import { 
  HelpCircle, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Layout, 
  Activity, 
  Coins, 
  Wallet, 
  Calendar, 
  Target, 
  Lightbulb, 
  Link as LinkIcon, 
  Beaker, 
  Users, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff 
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";

const STATUS_OPTIONS = [
  { value: "active", label: "Активный", hint: "Запрос открыт для откликов" },
  { value: "paused", label: "На паузе", hint: "Временно приостановлен" },
  { value: "closed", label: "Закрыт", hint: "Запрос завершён" },
];

/**
 * Модуль «Запросы»: список запросов, форма нового запроса, редактирование.
 * Стиль как у карточек лабораторий, оборудования и задач.
 */
export default function QueriesTab({
  queryDraft,
  setQueryDraft,
  orgLabs,
  orgEmployees,
  orgTasks,
  toggleQueryLab,
  toggleQueryEmployee,
  createQuery,
  orgQueries,
  editingQueryId,
  queryEdit,
  setQueryEdit,
  updateQuery,
  cancelEditQuery,
  startEditQuery,
  deleteQuery,
  toggleQueryPublish,
  saving,
}) {
  const [expandedNewQuery, setExpandedNewQuery] = useState(false);
  const newQueryRef = useRef(null);
  const listRef = useRef(null);

  useEditOverlayScrollLock(!!editingQueryId);

  const handleAddQueryClick = () => {
    setExpandedNewQuery(true);
    requestAnimationFrame(() => {
      if (newQueryRef.current) {
        newQueryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateQuery = async () => {
    const ok = await createQuery();
    if (ok) {
      setExpandedNewQuery(false);
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  };

  return (
    <Card variant="solid" padding="lg" className="profile-section-card">
      <div className="profile-section-header">
        <h2 className="profile-section-card__title">Запросы</h2>
        <Button variant="primary" onClick={handleAddQueryClick} className="add-btn-mobile">
          <Plus size={18} /> <span>Добавить запрос</span>
        </Button>
      </div>
      <p className="profile-section-desc">
        Создавайте запросы на решение задач, указывайте бюджет, сроки и грант. Привязывайте к лабораториям и сотрудникам.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgQueries.length === 0 && (
          <div className="profile-empty-state">
            Запросы пока не добавлены.
          </div>
        )}
        {orgQueries.map((query) => (
          <Card key={query.id} variant="elevated" padding="none" className="query-dashboard-card">
            <div className="query-dashboard-card__header">
              <div className="query-dashboard-card__title-group">
                <div className="query-dashboard-card__icon">
                  <HelpCircle size={20} />
                </div>
                <div className="entity-dashboard-title-block">
                  <div className="entity-title-with-badge">
                    <h4 className="query-dashboard-card__name">{query.title}</h4>
                    <NewEntityBadge createdAt={query.created_at} />
                  </div>
                  <Badge variant={query.is_published ? "published" : "draft"}>
                    {query.is_published ? "Опубликован" : "Черновик"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="query-dashboard-card__body">
              <div className="query-meta-grid">
                <div className="query-meta-item">
                  <Activity size={14} className="query-meta-item__icon" />
                  <div className="query-meta-item__content">
                    <span className="query-meta-item__label">Статус</span>
                    <span className="query-meta-item__value">
                      {STATUS_OPTIONS.find((o) => o.value === query.status)?.label || query.status}
                    </span>
                  </div>
                </div>
                {query.grant_info && (
                  <div className="query-meta-item">
                    <Coins size={14} className="query-meta-item__icon" />
                    <div className="query-meta-item__content">
                      <span className="query-meta-item__label">Грант</span>
                      <span className="query-meta-item__value">{query.grant_info}</span>
                    </div>
                  </div>
                )}
                {query.budget && (
                  <div className="query-meta-item">
                    <Wallet size={14} className="query-meta-item__icon" />
                    <div className="query-meta-item__content">
                      <span className="query-meta-item__label">Бюджет</span>
                      <span className="query-meta-item__value">{query.budget}</span>
                    </div>
                  </div>
                )}
                {query.deadline && (
                  <div className="query-meta-item">
                    <Calendar size={14} className="query-meta-item__icon" />
                    <div className="query-meta-item__content">
                      <span className="query-meta-item__label">Дедлайн</span>
                      <span className="query-meta-item__value">{query.deadline}</span>
                    </div>
                  </div>
                )}
              </div>

              {query.task_description && (
                <div className="query-section">
                  <div className="query-section__header">
                    <Target size={14} />
                    <span>Описание задачи</span>
                  </div>
                  <p className="query-section__text">{query.task_description}</p>
                </div>
              )}

              {query.completed_examples && (
                <div className="query-section">
                  <div className="query-section__header">
                    <Lightbulb size={14} />
                    <span>Примеры и кейсы</span>
                  </div>
                  <p className="query-section__text">{query.completed_examples}</p>
                </div>
              )}

              {query.linked_task_solution && (
                <div className="query-section">
                  <div className="query-section__header">
                    <LinkIcon size={14} />
                    <span>Связанная задача</span>
                  </div>
                  <div className="query-linked-task">
                    {query.linked_task_solution.title}
                  </div>
                </div>
              )}

              {((query.laboratories || []).length > 0 || (query.employees || []).length > 0) && (
                <div className="query-section">
                  <div className="query-section__header">
                    <Users size={14} />
                    <span>Размещено</span>
                  </div>
                  <div className="chip-row">
                    {query.laboratories?.map((lab) => (
                      <span key={lab.id} className="chip chip--lab">
                        <Beaker size={12} style={{ marginRight: '4px' }} />
                        {lab.name}
                      </span>
                    ))}
                    {query.employees?.map((emp) => (
                      <span key={emp.id} className="chip chip--outline">
                        {emp.full_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="query-dashboard-card__footer">
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => startEditQuery(query)}
                className="icon-btn"
                title="Редактировать"
              >
                <Edit3 size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => toggleQueryPublish(query.id, !query.is_published)}
                className="status-toggle-btn"
              >
                {query.is_published ? <><EyeOff size={14} /> Скрыть</> : <><Eye size={14} /> Опубликовать</>}
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                className="lab-btn-delete" 
                onClick={() => deleteQuery(query.id)}
              >
                <Trash2 size={14} /> 
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editingQueryId && queryEdit && (
        <div className="query-edit-overlay">
          <div className="query-edit-form">
            <div className="query-edit-form__header">
              <h5>Редактирование: {queryEdit.title || "запроса"}</h5>
            </div>
            <div className="query-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Layout size={16} /> Основная информация
                </div>
                <Input
                  id="query-edit-title"
                  label="Название"
                  value={queryEdit.title}
                  onChange={(e) => setQueryEdit((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Например: Разработка аналитического метода"
                />
                <div className="ui-input-group">
                  <label htmlFor="query-edit-task">Описание задачи</label>
                  <textarea
                    id="query-edit-task"
                    rows={3}
                    className="ui-input"
                    value={queryEdit.task_description}
                    onChange={(e) => setQueryEdit((prev) => ({ ...prev, task_description: e.target.value }))}
                    placeholder="Опишите задачу, проблему и ожидаемый результат"
                  />
                </div>
                <div className="ui-input-group">
                  <label htmlFor="query-edit-examples">Примеры и кейсы</label>
                  <textarea
                    id="query-edit-examples"
                    rows={2}
                    className="ui-input"
                    value={queryEdit.completed_examples}
                    onChange={(e) => setQueryEdit((prev) => ({ ...prev, completed_examples: e.target.value }))}
                    placeholder="Пилотные проекты, внедрения, похожие решения"
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Coins size={16} /> Бюджет, сроки и грант
                </div>
                <div className="profile-form__row">
                  <Input
                    id="query-edit-grant"
                    label="Грант"
                    value={queryEdit.grant_info || ""}
                    onChange={(e) => setQueryEdit((prev) => ({ ...prev, grant_info: e.target.value }))}
                    placeholder="Номер гранта"
                  />
                  <Input
                    id="query-edit-budget"
                    label="Бюджет"
                    value={queryEdit.budget}
                    onChange={(e) => setQueryEdit((prev) => ({ ...prev, budget: e.target.value }))}
                    placeholder="Сумма, руб."
                  />
                </div>
                <Input
                  id="query-edit-deadline"
                  label="Дедлайн"
                  value={queryEdit.deadline}
                  onChange={(e) => setQueryEdit((prev) => ({ ...prev, deadline: e.target.value }))}
                  placeholder="ДД.ММ.ГГГГ или квартал"
                />
                <div className="query-field query-field-status" style={{ marginTop: '0.5rem' }}>
                  <span className="query-field-label">Статус запроса</span>
                  <div className="query-status-selector">
                    {STATUS_OPTIONS.map((opt) => (
                      <label key={opt.value} className="query-status-option">
                        <input type="radio" name="query-edit-status" value={opt.value} checked={(queryEdit.status || "active") === opt.value} onChange={() => setQueryEdit((prev) => ({ ...prev, status: opt.value }))} />
                        <span className="query-status-option-label" title={opt.hint}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <LinkIcon size={16} /> Связанная задача
                </div>
                <p className="profile-field-hint">Привяжите запрос к решённой задаче, если это развитие проекта.</p>
                <div className="query-linked-task-block">
                  {(queryEdit.linked_task_solution_id && orgTasks.find((t) => t.id === queryEdit.linked_task_solution_id)) ? (
                    <div className="query-linked-task-selected">
                      <span className="query-linked-task-title">{orgTasks.find((t) => t.id === queryEdit.linked_task_solution_id)?.title}</span>
                      <button type="button" className="query-linked-task-clear" onClick={() => setQueryEdit((prev) => ({ ...prev, linked_task_solution_id: null }))}>×</button>
                    </div>
                  ) : (
                    <select className="ui-input" value={queryEdit.linked_task_solution_id || ""} onChange={(e) => setQueryEdit((prev) => ({ ...prev, linked_task_solution_id: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">Не привязывать к задаче</option>
                      {orgTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Beaker size={16} /> Лаборатории
                </div>
                <div className="lab-checkbox-grid">
                  {orgLabs.map((lab) => (
                    <label key={lab.id} className="lab-selection-item">
                      <input type="checkbox" checked={(queryEdit.laboratory_ids || []).includes(lab.id)} onChange={() => toggleQueryLab(lab.id, true)} />
                      <span>{lab.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Users size={16} /> Ответственные сотрудники
                </div>
                <div className="lab-checkbox-grid">
                  {orgEmployees.map((employee) => (
                    <label key={employee.id} className="lab-selection-item">
                      <input type="checkbox" checked={(queryEdit.employee_ids || []).includes(employee.id)} onChange={() => toggleQueryEmployee(employee.id, true)} />
                      <span>{employee.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="query-edit-form__footer">
              <Button variant="primary" onClick={updateQuery} loading={saving}>Сохранить</Button>
              <Button variant="ghost" onClick={cancelEditQuery}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newQueryRef}
        className={`lab-collapsible-form ${expandedNewQuery ? "expanded" : ""}`}
      >
        <button type="button" className="lab-collapsible-form__header" onClick={() => setExpandedNewQuery((prev) => !prev)} aria-expanded={expandedNewQuery}>
          <div className="lab-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новый запрос</span>
          </div>
          {expandedNewQuery ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="lab-collapsible-form__body">
          <div className="query-edit-form__scroll">
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Layout size={16} /> Основная информация
              </div>
              <Input
                id="query-draft-title"
                label="Название"
                value={queryDraft.title}
                onChange={(e) => setQueryDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Например: Разработка аналитического метода"
              />
              <div className="ui-input-group">
                <label htmlFor="query-draft-task">Описание задачи</label>
                <textarea
                  id="query-draft-task"
                  rows={3}
                  className="ui-input"
                  value={queryDraft.task_description}
                  onChange={(e) => setQueryDraft((prev) => ({ ...prev, task_description: e.target.value }))}
                  placeholder="Опишите задачу, проблему и ожидаемый результат"
                />
              </div>
              <div className="ui-input-group">
                <label htmlFor="query-draft-examples">Примеры и кейсы</label>
                <textarea
                  id="query-draft-examples"
                  rows={2}
                  className="ui-input"
                  value={queryDraft.completed_examples}
                  onChange={(e) => setQueryDraft((prev) => ({ ...prev, completed_examples: e.target.value }))}
                  placeholder="Пилотные проекты, внедрения, похожие решения"
                />
              </div>
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Coins size={16} /> Бюджет, сроки и грант
              </div>
              <div className="profile-form__row">
                <Input
                  id="query-draft-grant"
                  label="Грант"
                  value={queryDraft.grant_info}
                  onChange={(e) => setQueryDraft((prev) => ({ ...prev, grant_info: e.target.value }))}
                  placeholder="Номер гранта"
                />
                <Input
                  id="query-draft-budget"
                  label="Бюджет"
                  value={queryDraft.budget}
                  onChange={(e) => setQueryDraft((prev) => ({ ...prev, budget: e.target.value }))}
                  placeholder="Сумма, руб."
                />
              </div>
              <Input
                id="query-draft-deadline"
                label="Дедлайн"
                value={queryDraft.deadline}
                onChange={(e) => setQueryDraft((prev) => ({ ...prev, deadline: e.target.value }))}
                placeholder="ДД.ММ.ГГГГ или квартал"
              />
              <div className="query-field query-field-status" style={{ marginTop: '0.5rem' }}>
                <span className="query-field-label">Статус запроса</span>
                <div className="query-status-selector">
                  {STATUS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="query-status-option">
                      <input type="radio" name="query-draft-status" value={opt.value} checked={(queryDraft.status || "active") === opt.value} onChange={() => setQueryDraft((prev) => ({ ...prev, status: opt.value }))} />
                      <span className="query-status-option-label" title={opt.hint}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <LinkIcon size={16} /> Связанная задача
              </div>
              <p className="profile-field-hint">Привяжите запрос к решённой задаче.</p>
              <div className="query-linked-task-block">
                {(queryDraft.linked_task_solution_id && orgTasks.find((t) => t.id === queryDraft.linked_task_solution_id)) ? (
                  <div className="query-linked-task-selected">
                    <span className="query-linked-task-title">{orgTasks.find((t) => t.id === queryDraft.linked_task_solution_id)?.title}</span>
                    <button type="button" className="query-linked-task-clear" onClick={() => setQueryDraft((prev) => ({ ...prev, linked_task_solution_id: null }))}>×</button>
                  </div>
                ) : (
                  <select className="ui-input" value={queryDraft.linked_task_solution_id || ""} onChange={(e) => setQueryDraft((prev) => ({ ...prev, linked_task_solution_id: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">Не привязывать к задаче</option>
                    {orgTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Beaker size={16} /> Лаборатории
              </div>
              <div className="lab-checkbox-grid">
                {orgLabs.map((lab) => (
                  <label key={lab.id} className="lab-selection-item">
                    <input type="checkbox" checked={(queryDraft.laboratory_ids || []).includes(lab.id)} onChange={() => toggleQueryLab(lab.id, false)} />
                    <span>{lab.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Users size={16} /> Ответственные сотрудники
              </div>
              <div className="lab-checkbox-grid">
                {orgEmployees.map((employee) => (
                  <label key={employee.id} className="lab-selection-item">
                    <input type="checkbox" checked={(queryDraft.employee_ids || []).includes(employee.id)} onChange={() => toggleQueryEmployee(employee.id, false)} />
                    <span>{employee.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateQuery} loading={saving}>
              Создать запрос
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewQuery(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
