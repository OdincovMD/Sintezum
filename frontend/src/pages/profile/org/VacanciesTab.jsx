import React, { useState, useRef } from "react";
import { 
  Briefcase, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Layout, 
  FileText, 
  User, 
  Mail, 
  Phone, 
  Beaker, 
  HelpCircle, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Clock, 
  ClipboardList 
} from "lucide-react";
import { formatPhoneRU, normalizePhoneRU } from "../../../utils/validation";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";

/**
 * Вкладка «Вакансии»: список вакансий, форма новой и редактирование.
 * Стиль как у запросов/лабораторий: lab-tab-header, profile-list, lab-card-actions, lab-form-grouped.
 * Связанный запрос и лаборатория — карточка выбранного + очистка или select.
 * Контакт: либо сотрудник (карточка + очистка/select), либо при отсутствии — обязательные email и телефон.
 */
const ERR_REMOVE_CONTACT =
  "Снимите вакансию с публикации, затем удалите контактное лицо.";
const ERR_REMOVE_LAB = "Снимите вакансию с публикации, затем удалите лабораторию.";

export default function VacanciesTab({
  vacancyDraft,
  setVacancyDraft,
  orgLabs,
  orgEmployees,
  orgQueries,
  createVacancy,
  orgVacancies,
  editingVacancyId,
  vacancyEdit,
  setVacancyEdit,
  updateVacancy,
  cancelEditVacancy,
  startEditVacancy,
  deleteVacancy,
  toggleVacancyPublish,
  saving,
  onError,
}) {
  const [expandedNewVacancy, setExpandedNewVacancy] = useState(false);
  const newVacancyRef = useRef(null);
  const listRef = useRef(null);

  useEditOverlayScrollLock(!!editingVacancyId);

  const handleAddVacancyClick = () => {
    setExpandedNewVacancy(true);
    requestAnimationFrame(() => {
      if (newVacancyRef.current) {
        newVacancyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateVacancy = async () => {
    const ok = await createVacancy();
    if (ok) {
      setExpandedNewVacancy(false);
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  };

  const renderContactMeta = (vacancy) => {
    if (vacancy.contact_employee || vacancy.contact_employee_id) {
      const name = vacancy.contact_employee?.full_name || orgEmployees.find((e) => e.id === vacancy.contact_employee_id)?.full_name || "—";
      return (
        <div className="vacancy-meta-item">
          <User size={14} className="vacancy-meta-item__icon" />
          <div className="vacancy-meta-item__content">
            <span className="vacancy-meta-item__label">Контакт</span>
            <span className="vacancy-meta-item__value">{name}</span>
          </div>
        </div>
      );
    }
    if (vacancy.contact_email || vacancy.contact_phone) {
      const phone = vacancy.contact_phone ? formatPhoneRU(vacancy.contact_phone) : "";
      return (
        <div className="vacancy-meta-item">
          <Mail size={14} className="vacancy-meta-item__icon" />
          <div className="vacancy-meta-item__content">
            <span className="vacancy-meta-item__label">Контакт</span>
            <span className="vacancy-meta-item__value">
              {[vacancy.contact_email, phone].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLinkedQuery = (queryId, setState) => {
    const selected = orgQueries.find((q) => q.id === queryId);
    return (
      <div className="query-linked-task-block">
        {selected ? (
          <div className="query-linked-task-selected">
            <span className="query-linked-task-title">{selected.title}</span>
            <button type="button" className="query-linked-task-clear" onClick={() => setState((prev) => ({ ...prev, query_id: null }))} aria-label="Очистить">×</button>
          </div>
        ) : (
          <select
            className="query-linked-task-select"
            value={queryId || ""}
            onChange={(e) => setState((prev) => ({ ...prev, query_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Не привязывать к запросу</option>
            {orgQueries.map((q) => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </select>
        )}
      </div>
    );
  };

  const renderLinkedLab = (laboratoryId, setState, isPublished = false) => {
    const selected = orgLabs.find((l) => l.id === laboratoryId);
    const handleClear = () => {
      if (isPublished && onError) {
        onError(ERR_REMOVE_LAB);
        return;
      }
      setState((prev) => ({ ...prev, laboratory_id: null }));
    };
    return (
      <div className="query-linked-task-block">
        {selected ? (
          <div className="query-linked-task-selected">
            <span className="query-linked-task-title">{selected.name}</span>
            <button type="button" className="query-linked-task-clear" onClick={handleClear} aria-label="Очистить">×</button>
          </div>
        ) : (
          <select
            className="query-linked-task-select"
            value={laboratoryId || ""}
            onChange={(e) => setState((prev) => ({ ...prev, laboratory_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Не выбрана</option>
            {orgLabs.map((lab) => (
              <option key={lab.id} value={lab.id}>{lab.name}</option>
            ))}
          </select>
        )}
      </div>
    );
  };

  const renderContactBlock = (state, setState, isPublished = false, idPrefix = "vacancy-contact") => {
    const selectedEmp = state.contact_employee_id ? orgEmployees.find((e) => e.id === state.contact_employee_id) : null;
    const showEmailPhone = !state.contact_employee_id;
    const contactHasNoEmail =
      selectedEmp && !(selectedEmp.contacts?.email || selectedEmp.contacts?.mail);
    const handleClearContact = () => {
      if (isPublished && onError) {
        const hasFallback = ((state.contact_email || "").trim() && (state.contact_phone || "").trim());
        if (!hasFallback) {
          onError(ERR_REMOVE_CONTACT);
          return;
        }
      }
      setState((prev) => ({ ...prev, contact_employee_id: null, contact_email: prev.contact_email || "", contact_phone: prev.contact_phone || "" }));
    };
    return (
      <>
        <div className="query-linked-task-block">
          {selectedEmp ? (
            <>
              <div className="query-linked-task-selected">
                <span className="query-linked-task-title">{selectedEmp.full_name}</span>
                <button type="button" className="query-linked-task-clear" onClick={handleClearContact} aria-label="Очистить">×</button>
              </div>
              {contactHasNoEmail && (
                <p className="profile-field-hint profile-field-warning" role="alert">
                  У контактного лица не указан email. Для получения откликов будет использоваться email вашего личного аккаунта.
                </p>
              )}
            </>
          ) : (
            <select
              className="query-linked-task-select"
              value={state.contact_employee_id || ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setState((prev) => ({ ...prev, contact_employee_id: id, ...(id ? { contact_email: "", contact_phone: "" } : {}) }));
              }}
            >
              <option value="">Указать email и телефон ниже</option>
              {orgEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          )}
        </div>
        {showEmailPhone && (
          <div className="vacancy-contact-fields">
            <p className="profile-field-hint">Если контактное лицо не выбрано, укажите email и телефон для связи (обязательно).</p>
            <Input
              id={`${idPrefix}-email`}
              label="Email для связи"
              type="email"
              value={state.contact_email || ""}
              onChange={(e) => setState((prev) => ({ ...prev, contact_email: e.target.value }))}
              placeholder="contact@example.com"
              autoComplete="email"
            />
            <Input
              id={`${idPrefix}-phone`}
              label="Телефон для связи"
              type="tel"
              value={state.contact_phone ? formatPhoneRU(state.contact_phone) : ""}
              onChange={(e) => {
                const digits = normalizePhoneRU(e.target.value);
                setState((prev) => ({ ...prev, contact_phone: digits ? `7${digits}` : "" }));
              }}
              placeholder="+7 (999) 123-45-67"
              autoComplete="tel"
              maxLength={18}
              hint="Формат: +7 (999) 123-45-67"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <Card variant="solid" padding="lg" className="profile-section-card">
      <div className="profile-section-header">
        <h2 className="profile-section-card__title">Вакансии</h2>
        <Button variant="primary" onClick={handleAddVacancyClick} className="add-btn-mobile">
          <Plus size={18} /> <span>Добавить вакансию</span>
        </Button>
      </div>
      <p className="profile-section-desc">
        Добавляйте вакансии, привязывайте к запросам и лабораториям. Укажите контактное лицо (сотрудника) или email и телефон для связи.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgVacancies.length === 0 && (
          <div className="profile-empty-state">
            Вакансии пока не добавлены.
          </div>
        )}
        {orgVacancies.map((vacancy) => (
          <Card key={vacancy.id} variant="elevated" padding="none" className="vacancy-dashboard-card">
            <div className="vacancy-dashboard-card__header">
              <div className="vacancy-dashboard-card__title-group">
                <div className="vacancy-dashboard-card__icon">
                  <Briefcase size={20} />
                </div>
                <div className="entity-dashboard-title-block">
                  <div className="entity-title-with-badge">
                    <h4 className="vacancy-dashboard-card__name">{vacancy.name}</h4>
                    <NewEntityBadge createdAt={vacancy.created_at} />
                  </div>
                  <Badge variant={vacancy.is_published ? "published" : "draft"}>
                    {vacancy.is_published ? "Опубликовано" : "Черновик"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="vacancy-dashboard-card__body">
              <div className="vacancy-meta-grid">
                {vacancy.employment_type && (
                  <div className="vacancy-meta-item">
                    <Clock size={14} className="vacancy-meta-item__icon" />
                    <div className="vacancy-meta-item__content">
                      <span className="vacancy-meta-item__label">Занятость</span>
                      <span className="vacancy-meta-item__value">{vacancy.employment_type}</span>
                    </div>
                  </div>
                )}
                {(vacancy.laboratory || vacancy.laboratory_id) && (
                  <div className="vacancy-meta-item">
                    <Beaker size={14} className="vacancy-meta-item__icon" />
                    <div className="vacancy-meta-item__content">
                      <span className="vacancy-meta-item__label">Лаборатория</span>
                      <span className="vacancy-meta-item__value">
                        {vacancy.laboratory?.name || orgLabs.find((l) => l.id === vacancy.laboratory_id)?.name || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {(vacancy.query || vacancy.query_id) && (
                  <div className="vacancy-meta-item">
                    <HelpCircle size={14} className="vacancy-meta-item__icon" />
                    <div className="vacancy-meta-item__content">
                      <span className="vacancy-meta-item__label">Запрос</span>
                      <span className="vacancy-meta-item__value">
                        {vacancy.query?.title || orgQueries.find((q) => q.id === vacancy.query_id)?.title || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {renderContactMeta(vacancy)}
              </div>

              {vacancy.requirements && (
                <div className="vacancy-section">
                  <div className="vacancy-section__header">
                    <FileText size={14} />
                    <span>Требования</span>
                  </div>
                  <p className="vacancy-section__text">{vacancy.requirements}</p>
                </div>
              )}

              {vacancy.description && (
                <div className="vacancy-section">
                  <div className="vacancy-section__header">
                    <ClipboardList size={14} />
                    <span>Описание</span>
                  </div>
                  <p className="vacancy-section__text">{vacancy.description}</p>
                </div>
              )}
            </div>
            
            <div className="vacancy-dashboard-card__footer">
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => startEditVacancy(vacancy)}
                className="icon-btn"
                title="Редактировать"
              >
                <Edit3 size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => toggleVacancyPublish(vacancy.id, !vacancy.is_published)}
                className="status-toggle-btn"
              >
                {vacancy.is_published ? <><EyeOff size={14} /> Скрыть</> : <><Eye size={14} /> Опубликовать</>}
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                className="lab-btn-delete" 
                onClick={() => deleteVacancy(vacancy.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editingVacancyId && vacancyEdit && (
        <div className="vacancy-edit-overlay">
          <div className="vacancy-edit-form">
            <div className="vacancy-edit-form__header">
              <h5>Редактирование: {vacancyEdit.name || "вакансии"}</h5>
            </div>
            <div className="vacancy-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Layout size={16} /> Основная информация
                </div>
                <Input
                  id="vacancy-edit-name"
                  label="Название"
                  value={vacancyEdit.name}
                  onChange={(e) => setVacancyEdit((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Например: Исследователь, Постдок"
                />
                <div className="ui-input-group">
                  <label htmlFor="vacancy-edit-requirements">Требования</label>
                  <textarea
                    id="vacancy-edit-requirements"
                    rows={2}
                    className="ui-input"
                    value={vacancyEdit.requirements}
                    onChange={(e) => setVacancyEdit((prev) => ({ ...prev, requirements: e.target.value }))}
                    placeholder="Образование, опыт, навыки"
                  />
                </div>
                <div className="ui-input-group">
                  <label htmlFor="vacancy-edit-description">Описание</label>
                  <textarea
                    id="vacancy-edit-description"
                    rows={2}
                    className="ui-input"
                    value={vacancyEdit.description}
                    onChange={(e) => setVacancyEdit((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Обязанности, условия работы"
                  />
                </div>
                <Input
                  id="vacancy-edit-employment"
                  label="Тип занятости"
                  value={vacancyEdit.employment_type || ""}
                  onChange={(e) => setVacancyEdit((prev) => ({ ...prev, employment_type: e.target.value }))}
                  placeholder="Полная занятость, стажировка"
                />
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <HelpCircle size={16} /> Связанный запрос
                </div>
                <p className="profile-field-hint">Опционально: привязка к запросу на R&D.</p>
                {renderLinkedQuery(vacancyEdit.query_id, setVacancyEdit)}
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Beaker size={16} /> Лаборатория
                </div>
                <p className="profile-field-hint">Лаборатория, в которой открыта вакансия.</p>
                {renderLinkedLab(vacancyEdit.laboratory_id, setVacancyEdit, true)}
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <User size={16} /> Контакт для связи
                </div>
                {renderContactBlock(vacancyEdit, setVacancyEdit, true, "vacancy-edit-contact")}
              </div>
            </div>
            <div className="vacancy-edit-form__footer">
              <Button variant="primary" onClick={updateVacancy} loading={saving}>Сохранить</Button>
              <Button variant="ghost" onClick={cancelEditVacancy}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newVacancyRef}
        className={`lab-collapsible-form ${expandedNewVacancy ? "expanded" : ""}`}
      >
        <button type="button" className="lab-collapsible-form__header" onClick={() => setExpandedNewVacancy((prev) => !prev)} aria-expanded={expandedNewVacancy}>
          <div className="lab-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новая вакансия</span>
          </div>
          {expandedNewVacancy ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="lab-collapsible-form__body">
          <div className="vacancy-edit-form__scroll">
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Layout size={16} /> Основная информация
              </div>
              <Input
                id="vacancy-draft-name"
                label="Название"
                value={vacancyDraft.name}
                onChange={(e) => setVacancyDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Например: Исследователь, Постдок"
              />
              <div className="ui-input-group">
                <label htmlFor="vacancy-draft-requirements">Требования</label>
                <textarea
                  id="vacancy-draft-requirements"
                  rows={2}
                  className="ui-input"
                  value={vacancyDraft.requirements}
                  onChange={(e) => setVacancyDraft((prev) => ({ ...prev, requirements: e.target.value }))}
                  placeholder="Образование, опыт, навыки"
                />
              </div>
              <div className="ui-input-group">
                <label htmlFor="vacancy-draft-description">Описание</label>
                <textarea
                  id="vacancy-draft-description"
                  rows={2}
                  className="ui-input"
                  value={vacancyDraft.description}
                  onChange={(e) => setVacancyDraft((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Обязанности, условия работы"
                />
              </div>
              <Input
                id="vacancy-draft-employment"
                label="Тип занятости"
                value={vacancyDraft.employment_type || ""}
                onChange={(e) => setVacancyDraft((prev) => ({ ...prev, employment_type: e.target.value }))}
                placeholder="Полная занятость, стажировка"
              />
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <HelpCircle size={16} /> Связанный запрос
              </div>
              <p className="profile-field-hint">Опционально: привязка к запросу на R&D.</p>
              {renderLinkedQuery(vacancyDraft.query_id, setVacancyDraft)}
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Beaker size={16} /> Лаборатория
              </div>
              <p className="profile-field-hint">Лаборатория, в которой открыта вакансия.</p>
              {renderLinkedLab(vacancyDraft.laboratory_id, setVacancyDraft)}
            </div>
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <User size={16} /> Контакт для связи
              </div>
              {renderContactBlock(vacancyDraft, setVacancyDraft, false, "vacancy-draft-contact")}
            </div>
          </div>
          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateVacancy} loading={saving}>
              Создать вакансию
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewVacancy(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
