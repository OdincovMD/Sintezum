import React, { useRef, useState } from "react";
import { 
  ClipboardCheck, 
  Calendar, 
  Coins, 
  DollarSign, 
  Link as LinkIcon, 
  Beaker, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Layout, 
  ClipboardList, 
  CheckCircle, 
  ExternalLink, 
  Trash2, 
  Edit3 
} from "lucide-react";
import { normalizeWebsiteInput } from "../../../utils/validation";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";

/**
 * Модуль «Решённые задачи»: список, форма новой задачи, редактирование.
 * Стиль как у карточек лабораторий и оборудования.
 */
export default function TasksTab({
  taskDraft,
  setTaskDraft,
  orgLabs,
  toggleTaskLab,
  createTask,
  orgTasks,
  editingTaskId,
  taskEdit,
  handleTaskEditChange,
  updateTask,
  cancelEditTask,
  startEditTask,
  deleteTask,
  saving,
}) {
  const [expandedNewTask, setExpandedNewTask] = useState(false);
  const draftLinkInputRef = useRef(null);
  const editLinkInputRef = useRef(null);
  const newTaskRef = useRef(null);
  const listRef = useRef(null);

  useEditOverlayScrollLock(!!editingTaskId);

  const addArticleLink = (isEdit) => {
    if (isEdit && taskEdit) {
      const links = taskEdit.article_links || [];
      handleTaskEditChange("article_links", [...links, ""]);
    } else {
      setTaskDraft((prev) => ({ ...prev, article_links: [...(prev.article_links || []), ""] }));
    }
  };

  const removeArticleLink = (index, isEdit) => {
    if (isEdit && taskEdit) {
      const links = (taskEdit.article_links || []).filter((_, i) => i !== index);
      handleTaskEditChange("article_links", links);
    } else {
      setTaskDraft((prev) => ({
        ...prev,
        article_links: (prev.article_links || []).filter((_, i) => i !== index),
      }));
    }
  };

  const updateArticleLink = (index, value, isEdit) => {
    if (isEdit && taskEdit) {
      const links = [...(taskEdit.article_links || [])];
      links[index] = value;
      handleTaskEditChange("article_links", links);
    } else {
      setTaskDraft((prev) => {
        const links = [...(prev.article_links || [])];
        links[index] = value;
        return { ...prev, article_links: links };
      });
    }
  };

  const normalizeLinkAt = (index, isEdit) => {
    if (isEdit && taskEdit) {
      const links = taskEdit.article_links || [];
      const v = (links[index] || "").trim();
      if (!v) return;
      const normalized = normalizeWebsiteInput(v);
      if (normalized !== v) {
        const next = [...links];
        next[index] = normalized;
        handleTaskEditChange("article_links", next);
      }
    } else {
      setTaskDraft((prev) => {
        const links = [...(prev.article_links || [])];
        const v = (links[index] || "").trim();
        if (!v) return prev;
        const normalized = normalizeWebsiteInput(v);
        if (normalized === v) return prev;
        links[index] = normalized;
        return { ...prev, article_links: links };
      });
    }
  };

  const linksList = (task) => (task?.article_links || []).filter(Boolean);

  const handleAddTaskClick = () => {
    setExpandedNewTask(true);
    requestAnimationFrame(() => {
      if (newTaskRef.current) {
        newTaskRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateTask = async () => {
    const ok = await createTask();
    if (ok) {
      setExpandedNewTask(false);
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
        <h2 className="profile-section-card__title">Решённые задачи</h2>
        <Button variant="primary" onClick={handleAddTaskClick} className="add-btn-mobile">
          <Plus size={18} /> <span>Добавить задачу</span>
        </Button>
      </div>
      <p className="profile-section-desc">
        Добавляйте решённые задачи, указывайте сроки и грант, привязывайте к лабораториям.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgTasks.length === 0 && (
          <div className="profile-empty-state">Задачи пока не добавлены.</div>
        )}
        {orgTasks.map((task) => (
          <Card key={task.id} variant="elevated" padding="none" className="task-dashboard-card">
            <div className="task-dashboard-card__header">
              <div className="task-dashboard-card__title-group">
                <div className="task-dashboard-card__icon">
                  <ClipboardCheck size={20} />
                </div>
                <div className="entity-dashboard-title-block">
                  <div className="entity-title-with-badge">
                    <h4 className="task-dashboard-card__name">{task.title}</h4>
                    <NewEntityBadge createdAt={task.created_at} />
                  </div>
                </div>
              </div>
            </div>

            <div className="task-dashboard-card__body">
              {(task.solution_deadline || task.grant_info || task.cost) && (
                <div className="task-meta-grid">
                  {task.solution_deadline && (
                    <div className="task-meta-item">
                      <Calendar size={14} className="task-meta-item__icon" />
                      <div className="task-meta-item__content">
                        <span className="task-meta-item__label">Сроки</span>
                        <span className="task-meta-item__value">{task.solution_deadline}</span>
                      </div>
                    </div>
                  )}
                  {task.grant_info && (
                    <div className="task-meta-item">
                      <Coins size={14} className="task-meta-item__icon" />
                      <div className="task-meta-item__content">
                        <span className="task-meta-item__label">Грант</span>
                        <span className="task-meta-item__value">{task.grant_info}</span>
                      </div>
                    </div>
                  )}
                  {task.cost && (
                    <div className="task-meta-item">
                      <DollarSign size={14} className="task-meta-item__icon" />
                      <div className="task-meta-item__content">
                        <span className="task-meta-item__label">Стоимость</span>
                        <span className="task-meta-item__value">{task.cost}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {task.task_description && (
                <div className="task-section">
                  <div className="task-section__header">
                    <ClipboardList size={14} />
                    <span>Описание задачи</span>
                  </div>
                  <p className="task-section__text">{task.task_description}</p>
                </div>
              )}

              {task.solution_description && (
                <div className="task-section">
                  <div className="task-section__header">
                    <CheckCircle size={14} />
                    <span>Решение и результат</span>
                  </div>
                  <p className="task-section__text">{task.solution_description}</p>
                </div>
              )}

              {task.external_solutions && (
                <div className="task-section">
                  <div className="task-section__header">
                    <ExternalLink size={14} />
                    <span>Альтернативы</span>
                  </div>
                  <p className="task-section__text">{task.external_solutions}</p>
                </div>
              )}

              {linksList(task).length > 0 && (
                <div className="task-section">
                  <div className="task-section__header">
                    <LinkIcon size={14} />
                    <span>Ссылки на статьи</span>
                  </div>
                  <div className="task-article-links">
                    {linksList(task).map((url, index) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="task-article-link">
                        <ExternalLink size={12} />
                        {url.length > 60 ? url.slice(0, 57) + "…" : url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(task.laboratories || []).length > 0 && (
                <div className="task-section">
                  <div className="task-section__header">
                    <Beaker size={14} />
                    <span>Лаборатории</span>
                  </div>
                  <div className="chip-row">
                    {task.laboratories.map((lab) => (
                      <span key={lab.id} className="chip chip--lab">{lab.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="task-dashboard-card__footer">
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => startEditTask(task)}
                className="icon-btn"
                title="Редактировать"
              >
                <Edit3 size={14} />
              </Button>
              <Button variant="ghost" size="small" className="lab-btn-delete" onClick={() => deleteTask(task.id)}>
                <Trash2 size={14} /> 
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editingTaskId && taskEdit && (
        <div className="task-edit-overlay">
          <div className="task-edit-form">
            <div className="task-edit-form__header">
              <h5>Редактирование: {taskEdit.title || "задачи"}</h5>
            </div>
            <div className="task-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Layout size={16} /> Основная информация
                </div>
                <Input 
                  id="task-edit-title" 
                  label="Название" 
                  value={taskEdit.title} 
                  onChange={(e) => handleTaskEditChange("title", e.target.value)} 
                  placeholder="Например: Разработка биосенсора" 
                />
                <div className="ui-input-group">
                  <label htmlFor="task-edit-desc">Описание задачи</label>
                  <textarea 
                    id="task-edit-desc" 
                    rows={2} 
                    className="ui-input" 
                    value={taskEdit.task_description} 
                    onChange={(e) => handleTaskEditChange("task_description", e.target.value)} 
                    placeholder="Какая проблема решалась и для кого" 
                  />
                </div>
                <div className="ui-input-group">
                  <label htmlFor="task-edit-solution">Решение и результат</label>
                  <textarea 
                    id="task-edit-solution" 
                    rows={2} 
                    className="ui-input" 
                    value={taskEdit.solution_description} 
                    onChange={(e) => handleTaskEditChange("solution_description", e.target.value)} 
                    placeholder="Описание решения и эффекта" 
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <LinkIcon size={16} /> Ссылки на статьи
                </div>
                <span className="profile-field-hint">Добавьте ссылку и нажмите Enter или кнопку «Добавить»</span>
                {(taskEdit.article_links || []).map((url, index) => (
                  <div key={`link-${index}`} className="education-item">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateArticleLink(index, e.target.value, true)}
                      onBlur={() => normalizeLinkAt(index, true)}
                      placeholder="https://doi.org/... или URL статьи"
                      className="ui-input article-link-input"
                    />
                    <button type="button" className="file-remove" onClick={() => removeArticleLink(index, true)} aria-label="Удалить">×</button>
                  </div>
                ))}
                <div className="inline-form">
                  <input 
                    ref={editLinkInputRef} 
                    type="url" 
                    className="ui-input" 
                    placeholder="Вставьте ссылку" 
                    onKeyDown={(e) => { 
                      if (e.key === "Enter") { 
                        e.preventDefault(); 
                        addArticleLink(true); 
                        e.currentTarget.value = ""; 
                      } 
                    }} 
                    style={{ flex: 1, minWidth: 0 }} 
                  />
                  <button type="button" className="ghost-btn" onClick={() => { addArticleLink(true); editLinkInputRef.current?.focus(); }}>Добавить</button>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Calendar size={16} /> Сроки и грант
                </div>
                <div className="profile-form__row">
                  <Input id="task-edit-deadline" label="Сроки решения" value={taskEdit.solution_deadline || ""} onChange={(e) => handleTaskEditChange("solution_deadline", e.target.value)} placeholder="2023–2024" />
                  <Input id="task-edit-grant" label="Грант" value={taskEdit.grant_info || ""} onChange={(e) => handleTaskEditChange("grant_info", e.target.value)} placeholder="Название или номер" />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <DollarSign size={16} /> Дополнительно
                </div>
                <Input id="task-edit-cost" label="Стоимость" value={taskEdit.cost || ""} onChange={(e) => handleTaskEditChange("cost", e.target.value)} placeholder="Модель стоимости" />
                <div className="ui-input-group">
                  <label htmlFor="task-edit-external">Альтернативы вне организации</label>
                  <textarea id="task-edit-external" rows={2} className="ui-input" value={taskEdit.external_solutions || ""} onChange={(e) => handleTaskEditChange("external_solutions", e.target.value)} placeholder="Внешние решения и отличия" />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Beaker size={16} /> Лаборатории
                </div>
                {orgLabs.length === 0 && <p className="muted">Лабораторий пока нет.</p>}
                <div className="lab-checkbox-grid">
                  {orgLabs.map((lab) => (
                    <label key={lab.id} className="lab-selection-item">
                      <input type="checkbox" checked={(taskEdit.laboratory_ids || []).includes(lab.id)} onChange={() => toggleTaskLab(lab.id, true)} />
                      <span>{lab.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="task-edit-form__footer">
              <Button variant="primary" onClick={updateTask} loading={saving}>Сохранить</Button>
              <Button variant="ghost" onClick={cancelEditTask}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newTaskRef}
        className={`lab-collapsible-form ${expandedNewTask ? "expanded" : ""}`}
      >
        <button type="button" className="lab-collapsible-form__header" onClick={() => setExpandedNewTask((prev) => !prev)} aria-expanded={expandedNewTask}>
          <div className="lab-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новая решённая задача</span>
          </div>
          {expandedNewTask ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="lab-collapsible-form__body">
          <div className="task-edit-form__scroll">
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Layout size={16} /> Основная информация
              </div>
              <Input id="task-draft-title" label="Название" value={taskDraft.title} onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Например: Разработка биосенсора" />
              <div className="ui-input-group">
                <label htmlFor="task-draft-desc">Описание задачи</label>
                <textarea id="task-draft-desc" rows={2} className="ui-input" value={taskDraft.task_description} onChange={(e) => setTaskDraft((prev) => ({ ...prev, task_description: e.target.value }))} placeholder="Какая проблема решалась и для кого" />
              </div>
              <div className="ui-input-group">
                <label htmlFor="task-draft-solution">Решение и результат</label>
                <textarea id="task-draft-solution" rows={2} className="ui-input" value={taskDraft.solution_description} onChange={(e) => setTaskDraft((prev) => ({ ...prev, solution_description: e.target.value }))} placeholder="Описание решения и эффекта" />
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <LinkIcon size={16} /> Ссылки на статьи
              </div>
              <span className="profile-field-hint">Добавьте ссылку и нажмите Enter</span>
              {(taskDraft.article_links || []).map((url, index) => (
                <div key={`draft-link-${index}`} className="education-item">
                  <input type="url" value={url} onChange={(e) => updateArticleLink(index, e.target.value, false)} onBlur={() => normalizeLinkAt(index, false)} placeholder="https://..." className="ui-input article-link-input" />
                  <button type="button" className="file-remove" onClick={() => removeArticleLink(index, false)}>×</button>
                </div>
              ))}
              <div className="inline-form">
                <input ref={draftLinkInputRef} type="url" className="ui-input" placeholder="Вставьте ссылку" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArticleLink(false); e.currentTarget.value = ""; } }} style={{ flex: 1 }} />
                <button type="button" className="ghost-btn" onClick={() => { addArticleLink(false); draftLinkInputRef.current?.focus(); }}>Добавить</button>
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Calendar size={16} /> Сроки и грант
              </div>
              <div className="profile-form__row">
                <Input id="task-draft-deadline" label="Сроки" value={taskDraft.solution_deadline} onChange={(e) => setTaskDraft((prev) => ({ ...prev, solution_deadline: e.target.value }))} placeholder="2023–2024" />
                <Input id="task-draft-grant" label="Грант" value={taskDraft.grant_info} onChange={(e) => setTaskDraft((prev) => ({ ...prev, grant_info: e.target.value }))} placeholder="Номер или название" />
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <DollarSign size={16} /> Дополнительно
              </div>
              <Input id="task-draft-cost" label="Стоимость" value={taskDraft.cost} onChange={(e) => setTaskDraft((prev) => ({ ...prev, cost: e.target.value }))} placeholder="Диапазон или модель" />
              <div className="ui-input-group">
                <label htmlFor="task-draft-external">Альтернативы</label>
                <textarea id="task-draft-external" rows={2} className="ui-input" value={taskDraft.external_solutions} onChange={(e) => setTaskDraft((prev) => ({ ...prev, external_solutions: e.target.value }))} placeholder="Внешние решения" />
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Beaker size={16} /> Лаборатории
              </div>
              <div className="lab-checkbox-grid">
                {orgLabs.map((lab) => (
                  <label key={lab.id} className="lab-selection-item">
                    <input type="checkbox" checked={(taskDraft.laboratory_ids || []).includes(lab.id)} onChange={() => toggleTaskLab(lab.id, false)} />
                    <span>{lab.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateTask} loading={saving}>
              Создать задачу
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewTask(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
