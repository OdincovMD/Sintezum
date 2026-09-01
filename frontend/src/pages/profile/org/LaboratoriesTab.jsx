import React, { useRef, useEffect, useState } from "react";
import { 
  Beaker, 
  User, 
  Users, 
  Wrench, 
  ClipboardList, 
  Plus, 
  Image as ImageIcon, 
  FileText, 
  MoreVertical,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Layout
} from "lucide-react";
import { Card, EntityAvatar } from "../../../components/ui";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";
import PublicSectionVisibility from "../../../components/PublicSectionVisibility";
import { LABORATORY_PUBLIC_SECTIONS } from "../../../utils/publicSections";

/**
 * Общий модуль «Лаборатории»: создание/редактирование лабораторий, привязка оборудования, задач, сотрудников.
 * Используется и представителем организации, и представителем лаборатории.
 */
export default function LaboratoriesTab({
  labDraft,
  handleLabDraft,
  orgEquipment,
  toggleLabEquipment,
  orgTasks,
  toggleLabTaskSolution,
  orgEmployees,
  toggleLabEmployee,
  setLabHead = () => {},
  handleLabFiles,
  removeDraftImage,
  splitMedia,
  fileNameFromUrl,
  createLab,
  orgLabs,
  editingLabId,
  labEdit,
  handleLabEditChange,
  handleLabEditFiles,
  removeEditImage,
  updateLab,
  cancelEditLab,
  startEditLab,
  deleteLab,
  openGallery,
  toggleLabPublish,
  uploading,
  saving,
  onFileInputRefsReady,
}) {
  const draftFilesInputRef = useRef(null);
  const editFilesInputRef = useRef(null);
  const newLabRef = useRef(null);
  const listRef = useRef(null);
  const [expandedNewLab, setExpandedNewLab] = useState(false);

  useEditOverlayScrollLock(!!editingLabId);

  useEffect(() => {
    onFileInputRefsReady?.([draftFilesInputRef, editFilesInputRef]);
  }, [onFileInputRefsReady]);

  const handleAddLabClick = () => {
    setExpandedNewLab(true);
    requestAnimationFrame(() => {
      if (newLabRef.current) {
        newLabRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateLab = async () => {
    const ok = await createLab();
    if (ok) {
      setExpandedNewLab(false);
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
        <h2 className="profile-section-card__title">Лаборатории</h2>
        <Button variant="primary" onClick={handleAddLabClick} className="add-btn-mobile">
          <Plus size={18} /> <span>Добавить лабораторию</span>
        </Button>
      </div>
      <p className="profile-section-desc">
        Создавайте лаборатории, назначайте руководителей и участников, привязывайте оборудование и задачи.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgLabs.length === 0 && (
          <div className="profile-empty-state">
            Лаборатории пока не добавлены.
          </div>
        )}
        {orgLabs.map((lab) => (
          <Card key={lab.id} variant="elevated" padding="none" className="lab-dashboard-card">
            <div className="lab-dashboard-card__header">
              <div className="lab-dashboard-card__title-group">
                <div className="lab-dashboard-card__icon">
                  <Beaker size={20} />
                </div>
                <div className="entity-dashboard-title-block">
                  <div className="entity-title-with-badge">
                    <h4 className="lab-dashboard-card__name">{lab.name}</h4>
                    <NewEntityBadge createdAt={lab.created_at} />
                  </div>
                  <Badge variant={lab.is_published ? "published" : "draft"}>
                    {lab.is_published ? "Опубликовано" : "Черновик"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="lab-dashboard-card__body">
              {lab.head_employee && (
                <div className="lab-head-info">
                  <div className="lab-head-info__avatar">
                    <EntityAvatar src={lab.head_employee.photo_url} alt="" />
                  </div>
                  <div className="lab-head-info__body">
                    <span className="lab-head-info__label">Руководитель</span>
                    <span className="lab-head-info__name">{lab.head_employee.full_name}</span>
                  </div>
                </div>
              )}

              {(lab.activities || lab.description) && (
                <div className="lab-meta-item lab-meta-item--column">
                  <div className="lab-meta-item__header">
                    <Layout size={14} />
                    <span>Описание</span>
                  </div>
                  <p className="lab-meta-item__text">
                    {lab.activities || lab.description}
                  </p>
                </div>
              )}

              <div className="lab-stats-grid">
                <div className="lab-stat-box">
                  <div className="lab-stat-box__header">
                    <Users size={14} />
                    <span>Команда</span>
                  </div>
                  <div className="lab-stat-box__content">
                    {((lab.employees || []).length + (lab.researchers || []).length) || 0} чел.
                  </div>
                </div>
                <div className="lab-stat-box">
                  <div className="lab-stat-box__header">
                    <Wrench size={14} />
                    <span>Оборудование</span>
                  </div>
                  <div className="lab-stat-box__content">
                    {(lab.equipment || []).length || 0} ед.
                  </div>
                </div>
                <div className="lab-stat-box">
                  <div className="lab-stat-box__header">
                    <ClipboardList size={14} />
                    <span>Задачи</span>
                  </div>
                  <div className="lab-stat-box__content">
                    {(lab.task_solutions || []).length || 0} реш.
                  </div>
                </div>
              </div>

              {(splitMedia(lab.image_urls).images.length > 0 || splitMedia(lab.image_urls).docs.length > 0) && (
                <div className="lab-media-preview">
                  {splitMedia(lab.image_urls).images.length > 0 && (
                    <button
                      type="button"
                      className="lab-gallery-btn"
                      onClick={() => openGallery(splitMedia(lab.image_urls).images, 0)}
                    >
                      <ImageIcon size={14} />
                      Галерея ({splitMedia(lab.image_urls).images.length})
                    </button>
                  )}
                  {splitMedia(lab.image_urls).docs.length > 0 && (
                    <div className="lab-docs-preview">
                      <FileText size={14} />
                      Документы ({splitMedia(lab.image_urls).docs.length})
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lab-dashboard-card__footer">
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => startEditLab(lab)}
                className="icon-btn"
                title="Редактировать"
              >
                <Edit3 size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => toggleLabPublish(lab.id, !lab.is_published)}
                className="status-toggle-btn"
              >
                {lab.is_published ? <><EyeOff size={14} /> Скрыть</> : <><Eye size={14} /> Опубликовать</>}
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                className="lab-btn-delete" 
                onClick={() => deleteLab(lab.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editingLabId && labEdit && (
        <div className="lab-edit-overlay">
          <div className="lab-edit-form">
            <div className="lab-edit-form__header">
              <h5>Редактирование: {labEdit.name || "лаборатории"}</h5>
            </div>
            <div className="lab-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Layout size={16} /> Основная информация
                </div>
                <Input
                  id="lab-name-edit"
                  label="Название"
                  value={labEdit.name}
                  onChange={(e) => handleLabEditChange("name", e.target.value)}
                  placeholder="Название лаборатории"
                />
                <div className="ui-input-group">
                  <label htmlFor="lab-activities-edit">Чем занимается</label>
                  <textarea
                    id="lab-activities-edit"
                    rows={2}
                    className="ui-input"
                    value={labEdit.activities}
                    onChange={(e) => handleLabEditChange("activities", e.target.value)}
                    placeholder="Направления работы"
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Users size={16} /> Команда
                </div>
                <div className="lab-select-group">
                  <label>Руководитель</label>
                  <select
                    className="ui-input"
                    value={labEdit.head_employee_id ?? ""}
                    onChange={(e) => setLabHead(e.target.value ? Number(e.target.value) : null, true)}
                  >
                    <option value="">Не назначен</option>
                    {orgEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="lab-checkbox-list">
                  <label className="lab-checkbox-list__label">Участники</label>
                  <div className="lab-checkbox-grid">
                    {orgEmployees.map((employee) => (
                      <label key={employee.id} className="lab-selection-item">
                        <input
                          type="checkbox"
                          checked={(labEdit.employee_ids || []).includes(employee.id)}
                          onChange={() => toggleLabEmployee(employee.id, true)}
                        />
                        <span>{employee.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Wrench size={16} /> Оборудование и Задачи
                </div>
                <div className="lab-checkbox-list">
                  <label className="lab-checkbox-list__label">Оборудование</label>
                  <div className="lab-checkbox-grid">
                    {orgEquipment.map((item) => (
                      <label key={item.id} className="lab-selection-item">
                        <input
                          type="checkbox"
                          checked={(labEdit.equipment_ids || []).includes(item.id)}
                          onChange={() => toggleLabEquipment(item.id, true)}
                        />
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="lab-checkbox-list" style={{ marginTop: '1rem' }}>
                  <label className="lab-checkbox-list__label">Решённые задачи</label>
                  <div className="lab-checkbox-grid">
                    {orgTasks.map((task) => (
                      <label key={task.id} className="lab-selection-item">
                        <input
                          type="checkbox"
                          checked={(labEdit.task_solution_ids || []).includes(task.id)}
                          onChange={() => toggleLabTaskSolution(task.id, true)}
                        />
                        <span>{task.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Eye size={16} /> Разделы публичной страницы
                </div>
                <PublicSectionVisibility
                  sections={LABORATORY_PUBLIC_SECTIONS}
                  hiddenSections={labEdit.hidden_public_sections}
                  onChange={(value) => handleLabEditChange("hidden_public_sections", value)}
                />
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <ImageIcon size={16} /> Медиа
                </div>
                <input
                  type="file"
                  className="ui-input"
                  multiple
                  onChange={(e) => handleLabEditFiles(e.target.files)}
                  disabled={uploading || saving}
                />
                {labEdit.image_urls?.length > 0 && (
                  <div className="image-preview-grid">
                    {splitMedia(labEdit.image_urls).images.map((url, index) => (
                      <div key={index} className="image-preview">
                        <img src={url} alt="" />
                        <button type="button" onClick={() => removeEditImage("lab", index)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="lab-edit-form__footer">
              <Button variant="primary" onClick={updateLab} loading={saving}>Сохранить</Button>
              <Button variant="ghost" onClick={cancelEditLab}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newLabRef}
        className={`lab-collapsible-form ${expandedNewLab ? "expanded" : ""}`}
      >
        <button
          type="button"
          className="lab-collapsible-form__header"
          onClick={() => setExpandedNewLab((prev) => !prev)}
          aria-expanded={expandedNewLab}
        >
          <div className="lab-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новая лаборатория</span>
          </div>
          {expandedNewLab ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        <div className="lab-collapsible-form__body">
          <div className="lab-edit-form__scroll">
            {/* Same structure as edit form */}
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Layout size={16} /> Основная информация
              </div>
              <Input
                id="lab-draft-name"
                label="Название"
                value={labDraft.name}
                onChange={(e) => handleLabDraft("name", e.target.value)}
                placeholder="Лаборатория материаловедения"
              />
              <div className="ui-input-group">
                <label htmlFor="lab-draft-activities">Чем занимается</label>
                <textarea
                  id="lab-draft-activities"
                  rows={2}
                  className="ui-input"
                  value={labDraft.activities}
                  onChange={(e) => handleLabDraft("activities", e.target.value)}
                  placeholder="Наноматериалы, биосенсоры, моделирование"
                />
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Users size={16} /> Команда
              </div>
              <div className="lab-select-group">
                <label>Руководитель</label>
                <select
                  className="ui-input"
                  value={labDraft.head_employee_id ?? ""}
                  onChange={(e) => setLabHead(e.target.value ? Number(e.target.value) : null, false)}
                >
                  <option value="">Не назначен</option>
                  {orgEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="lab-checkbox-list">
                <label className="lab-checkbox-list__label">Участники</label>
                <div className="lab-checkbox-grid">
                  {orgEmployees.map((employee) => (
                    <label key={employee.id} className="lab-selection-item">
                      <input
                        type="checkbox"
                        checked={(labDraft.employee_ids || []).includes(employee.id)}
                        onChange={() => toggleLabEmployee(employee.id, false)}
                      />
                      <span>{employee.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Equipment & Tasks */}
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Wrench size={16} /> Оборудование и Задачи
              </div>
              <div className="lab-checkbox-list">
                <label className="lab-checkbox-list__label">Оборудование</label>
                <div className="lab-checkbox-grid">
                  {orgEquipment.map((item) => (
                    <label key={item.id} className="lab-selection-item">
                      <input
                        type="checkbox"
                        checked={(labDraft.equipment_ids || []).includes(item.id)}
                        onChange={() => toggleLabEquipment(item.id, false)}
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="lab-checkbox-list" style={{ marginTop: '1rem' }}>
                <label className="lab-checkbox-list__label">Решённые задачи</label>
                <div className="lab-checkbox-grid">
                  {orgTasks.map((task) => (
                    <label key={task.id} className="lab-selection-item">
                      <input
                        type="checkbox"
                        checked={(labDraft.task_solution_ids || []).includes(task.id)}
                        onChange={() => toggleLabTaskSolution(task.id, false)}
                      />
                      <span>{task.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Eye size={16} /> Разделы публичной страницы
              </div>
              <PublicSectionVisibility
                sections={LABORATORY_PUBLIC_SECTIONS}
                hiddenSections={labDraft.hidden_public_sections}
                onChange={(value) => handleLabDraft("hidden_public_sections", value)}
              />
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <ImageIcon size={16} /> Медиа
              </div>
              <input
                ref={draftFilesInputRef}
                type="file"
                className="ui-input"
                multiple
                onChange={(e) => handleLabFiles(e.target.files)}
                disabled={uploading || saving}
              />
              {labDraft.image_urls?.length > 0 && (
                <div className="image-preview-grid">
                  {splitMedia(labDraft.image_urls).images.map((url, index) => (
                    <div key={index} className="image-preview">
                      <img src={url} alt="" />
                      <button type="button" onClick={() => removeDraftImage("lab", index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateLab} loading={saving}>
              Создать лабораторию
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewLab(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
