import React, { useRef, useEffect, useState } from "react";
import { 
  Wrench, 
  Beaker, 
  Settings, 
  Plus, 
  Image as ImageIcon, 
  FileText, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Layout,
  ClipboardList
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";

/**
 * Общий модуль «Оборудование»: создание/редактирование оборудования, привязка к лабораториям.
 * Используется и представителем организации, и представителем лаборатории.
 */
export default function EquipmentTab({
  equipmentDraft,
  handleEquipmentDraft,
  orgLabs,
  toggleEquipmentLab,
  handleEquipmentFiles,
  removeDraftImage,
  splitMedia,
  fileNameFromUrl,
  createEquipment,
  orgEquipment,
  editingEquipmentId,
  equipmentEdit,
  handleEquipmentEditChange,
  handleEquipmentEditFiles,
  removeEditImage,
  updateEquipment,
  cancelEditEquipment,
  startEditEquipment,
  deleteEquipment,
  openGallery,
  uploading,
  saving,
  onFileInputRefsReady,
}) {
  const draftFilesInputRef = useRef(null);
  const editFilesInputRef = useRef(null);
  const newEquipmentRef = useRef(null);
  const listRef = useRef(null);

  useEditOverlayScrollLock(!!editingEquipmentId);

  useEffect(() => {
    onFileInputRefsReady?.([draftFilesInputRef, editFilesInputRef]);
  }, [onFileInputRefsReady]);

  const [expandedNewEquipment, setExpandedNewEquipment] = useState(false);

  const toggleEditLab = (labId, isEdit) => {
    if (!isEdit || !equipmentEdit) return;
    const included = (equipmentEdit.laboratory_ids || []).includes(labId);
    handleEquipmentEditChange(
      "laboratory_ids",
      included
        ? (equipmentEdit.laboratory_ids || []).filter((id) => id !== labId)
        : [...(equipmentEdit.laboratory_ids || []), labId]
    );
  };

  const handleAddEquipmentClick = () => {
    setExpandedNewEquipment(true);
    requestAnimationFrame(() => {
      if (newEquipmentRef.current) {
        newEquipmentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateEquipment = async () => {
    const ok = await createEquipment();
    if (ok) {
      setExpandedNewEquipment(false);
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
        <h2 className="profile-section-card__title">Оборудование</h2>
        <Button variant="primary" onClick={handleAddEquipmentClick} className="add-btn-mobile">
          <Plus size={18} /> <span>Добавить оборудование</span>
        </Button>
      </div>
      <p className="profile-section-desc">
        Добавляйте единицы оборудования, указывайте характеристики и привязывайте к лабораториям.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgEquipment.length === 0 && (
          <div className="profile-empty-state">
            Оборудование пока не добавлено.
          </div>
        )}
        {orgEquipment.map((item) => (
          <Card key={item.id} variant="elevated" padding="none" className="equipment-dashboard-card">
            <div className="equipment-dashboard-card__header">
              <div className="equipment-dashboard-card__title-group">
                <div className="equipment-dashboard-card__icon">
                  <Wrench size={20} />
                </div>
                <div className="entity-dashboard-title-block">
                  <div className="entity-title-with-badge">
                    <h4 className="equipment-dashboard-card__name">{item.name}</h4>
                    <NewEntityBadge createdAt={item.created_at} />
                  </div>
                  {(item.laboratories || []).length > 0 && (
                    <Badge variant="accent">
                      <Beaker size={12} style={{ marginRight: '4px' }} />
                      {item.laboratories.length} лаб.
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="equipment-dashboard-card__body">
              {item.characteristics && (
                <div className="equipment-meta-item">
                  <Settings size={14} className="equipment-meta-item__icon" />
                  <span className="equipment-meta-item__label">Характеристики:</span>
                  <span className="equipment-meta-item__value">{item.characteristics}</span>
                </div>
              )}

              {item.description && (
                <div className="equipment-meta-item equipment-meta-item--column">
                  <div className="equipment-meta-item__header">
                    <ClipboardList size={14} />
                    <span>Описание</span>
                  </div>
                  <p className="equipment-meta-item__text">
                    {item.description}
                  </p>
                </div>
              )}

              {(item.laboratories || []).length > 0 && (
                <div className="equipment-labs-preview">
                  <span className="equipment-labs-preview__label">Установлено в:</span>
                  <div className="chip-row">
                    {item.laboratories.map((lab) => (
                      <span key={lab.id} className="chip chip--lab">
                        {lab.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(splitMedia(item.image_urls).images.length > 0 || splitMedia(item.image_urls).docs.length > 0) && (
                <div className="equipment-media-preview">
                  {splitMedia(item.image_urls).images.length > 0 && (
                    <button
                      type="button"
                      className="equipment-gallery-btn"
                      onClick={() => openGallery(splitMedia(item.image_urls).images, 0)}
                    >
                      <ImageIcon size={14} />
                      Галерея ({splitMedia(item.image_urls).images.length})
                    </button>
                  )}
                  {splitMedia(item.image_urls).docs.length > 0 && (
                    <div className="equipment-docs-preview">
                      <FileText size={14} />
                      Документы ({splitMedia(item.image_urls).docs.length})
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="equipment-dashboard-card__footer">
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => startEditEquipment(item)}
                className="icon-btn"
                title="Редактировать"
              >
                <Edit3 size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="small" 
                className="equipment-btn-delete" 
                onClick={() => deleteEquipment(item.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editingEquipmentId && equipmentEdit && (
        <div className="equipment-edit-overlay">
          <div className="equipment-edit-form">
            <div className="equipment-edit-form__header">
              <h5>Редактирование: {equipmentEdit.name || "оборудования"}</h5>
            </div>
            <div className="equipment-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Layout size={16} /> Основная информация
                </div>
                <Input
                  id="equipment-edit-name"
                  label="Название"
                  value={equipmentEdit.name}
                  onChange={(e) => handleEquipmentEditChange("name", e.target.value)}
                  placeholder="Название оборудования"
                />
                <div className="ui-input-group">
                  <label htmlFor="equipment-edit-characteristics">Характеристики</label>
                  <textarea
                    id="equipment-edit-characteristics"
                    rows={2}
                    className="ui-input"
                    value={equipmentEdit.characteristics}
                    onChange={(e) => handleEquipmentEditChange("characteristics", e.target.value)}
                    placeholder="Параметры, точность"
                  />
                </div>
                <div className="ui-input-group">
                  <label htmlFor="equipment-edit-description">Описание</label>
                  <textarea
                    id="equipment-edit-description"
                    rows={2}
                    className="ui-input"
                    value={equipmentEdit.description}
                    onChange={(e) => handleEquipmentEditChange("description", e.target.value)}
                    placeholder="Краткое описание"
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Beaker size={16} /> Размещение
                </div>
                <div className="equipment-checkbox-list">
                  <label className="equipment-checkbox-list__label">Где установлено (лаборатории)</label>
                  <div className="equipment-checkbox-grid">
                    {orgLabs.map((lab) => (
                      <label key={lab.id} className="equipment-selection-item">
                        <input
                          type="checkbox"
                          checked={(equipmentEdit.laboratory_ids || []).includes(lab.id)}
                          onChange={() => toggleEditLab(lab.id, true)}
                        />
                        <span>{lab.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <ImageIcon size={16} /> Медиа
                </div>
                <input
                  type="file"
                  className="ui-input"
                  multiple
                  onChange={(e) => handleEquipmentEditFiles(e.target.files)}
                  disabled={uploading || saving}
                />
                {equipmentEdit.image_urls?.length > 0 && (
                  <div className="image-preview-grid">
                    {splitMedia(equipmentEdit.image_urls).images.map((url, index) => (
                      <div key={index} className="image-preview">
                        <img src={url} alt="" />
                        <button type="button" onClick={() => removeEditImage("equipment", index)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="equipment-edit-form__footer">
              <Button variant="primary" onClick={updateEquipment} loading={saving}>Сохранить</Button>
              <Button variant="ghost" onClick={cancelEditEquipment}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newEquipmentRef}
        className={`equipment-collapsible-form ${expandedNewEquipment ? "expanded" : ""}`}
      >
        <button
          type="button"
          className="equipment-collapsible-form__header"
          onClick={() => setExpandedNewEquipment((prev) => !prev)}
          aria-expanded={expandedNewEquipment}
        >
          <div className="equipment-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новое оборудование</span>
          </div>
          {expandedNewEquipment ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <div className="equipment-collapsible-form__body">
          <div className="equipment-edit-form__scroll">
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Layout size={16} /> Основная информация
              </div>
              <Input
                id="equipment-draft-name"
                label="Название оборудования"
                value={equipmentDraft.name}
                onChange={(e) => handleEquipmentDraft("name", e.target.value)}
                placeholder="Микроскоп, хроматограф..."
              />
              <div className="ui-input-group">
                <label htmlFor="equipment-draft-characteristics">Характеристики</label>
                <textarea
                  id="equipment-draft-characteristics"
                  rows={2}
                  className="ui-input"
                  value={equipmentDraft.characteristics}
                  onChange={(e) => handleEquipmentDraft("characteristics", e.target.value)}
                  placeholder="Параметры, точность"
                />
              </div>
              <div className="ui-input-group">
                <label htmlFor="equipment-draft-description">Описание</label>
                <textarea
                  id="equipment-draft-description"
                  rows={2}
                  className="ui-input"
                  value={equipmentDraft.description}
                  onChange={(e) => handleEquipmentDraft("description", e.target.value)}
                  placeholder="Краткое описание"
                />
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Beaker size={16} /> Размещение
              </div>
              <div className="equipment-checkbox-list">
                <label className="equipment-checkbox-list__label">Где установлено (лаборатории)</label>
                <div className="equipment-checkbox-grid">
                  {orgLabs.map((lab) => (
                    <label key={lab.id} className="equipment-selection-item">
                      <input
                        type="checkbox"
                        checked={(equipmentDraft.laboratory_ids || []).includes(lab.id)}
                        onChange={() => toggleEquipmentLab(lab.id, false)}
                      />
                      <span>{lab.name}</span>
                    </label>
                  ))}
                </div>
              </div>
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
                onChange={(e) => handleEquipmentFiles(e.target.files)}
                disabled={uploading || saving}
              />
              {equipmentDraft.image_urls?.length > 0 && (
                <div className="image-preview-grid">
                  {splitMedia(equipmentDraft.image_urls).images.map((url, index) => (
                    <div key={index} className="image-preview">
                      <img src={url} alt="" />
                      <button type="button" onClick={() => removeDraftImage("equipment", index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateEquipment} loading={saving}>
              Создать оборудование
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewEquipment(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
