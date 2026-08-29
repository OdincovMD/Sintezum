import React, { useRef, useEffect, useState } from "react";
import { 
  User, 
  Users, 
  GraduationCap, 
  TrendingUp, 
  Mail, 
  Phone, 
  Plus, 
  Edit3, 
  Trash2, 
  Beaker, 
  ChevronDown, 
  ChevronUp, 
  Layout,
  ExternalLink,
  BookOpen,
  Send,
  Globe
} from "lucide-react";
import { formatPhoneRU, normalizeWebsiteInput } from "../../../utils/validation";
import { Card, EntityAvatar } from "../../../components/ui";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import NewEntityBadge from "../../../components/NewEntityBadge";
import { useEditOverlayScrollLock } from "../../../hooks";

function TagInput({ value = [], onChange, placeholder, id }) {
  const [inputValue, setInputValue] = useState("");
  const handleKeyDown = (e) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };
  const addTag = () => {
    const trimmed = inputValue.trim().replace(/,+$/, "").trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInputValue("");
  };
  const handleBlur = () => { if (inputValue.trim()) addTag(); };
  return (
    <div className="tag-input-container">
      <div className="tag-input-tags">
        {value.map((tag, index) => (
          <span key={`${tag}-${index}`} className="tag-input-tag">
            {tag}
            <button type="button" className="tag-input-tag-remove" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Удалить ${tag}`}>×</button>
          </span>
        ))}
        <input id={id} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} placeholder={value.length === 0 ? placeholder : ""} className="tag-input-field" />
      </div>
    </div>
  );
}

function capitalizeEachWord(str) {
  if (!str || typeof str !== "string") return str;
  return str.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * Общий модуль «Сотрудники»: форма нового сотрудника, редактирование, список.
 */
export default function StaffTab({
  employeeDraft,
  handleEmployeeDraftChange,
  setEmployeeDraft,
  uploadEmployeePhoto,
  employeeDraftPositionInput,
  setEmployeeDraftPositionInput,
  orgLabs,
  toggleEmployeeLab,
  addEducation,
  removeEducation,
  showDraftPublications,
  setShowDraftPublications,
  updatePublication,
  removePublication,
  addPublication,
  handleEmployeeContacts,
  createEmployee,
  employeeEditId,
  employeeEdit,
  handleEmployeeEditChange,
  employeeEditPositionInput,
  setEmployeeEditPositionInput,
  showEditPublications,
  setShowEditPublications,
  updateEmployee,
  cancelEditEmployee,
  startEditEmployee,
  deleteEmployee,
  orgEmployees,
  setEmployeePreview,
  setShowEmployeePublications,
  importEmployeeOpenAlex,
  importEmployeeOpenAlexPreview,
  employeeDraftImporting,
  uploading,
  saving,
  onFileInputRefsReady,
}) {
  const draftEducationInputRef = useRef(null);
  const editEducationInputRef = useRef(null);
  const draftPhotoInputRef = useRef(null);
  const editPhotoInputRef = useRef(null);
  const newEmployeeRef = useRef(null);
  const listRef = useRef(null);
  const editFormRef = useRef(null);

  useEditOverlayScrollLock(!!employeeEditId);

  useEffect(() => {
    onFileInputRefsReady?.([draftPhotoInputRef, editPhotoInputRef]);
  }, [onFileInputRefsReady]);

  useEffect(() => {
    if (employeeEditId && editFormRef.current) {
      requestAnimationFrame(() => {
        editFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [employeeEditId]);

  const [employeeImportInput, setEmployeeImportInput] = useState("");
  const [employeeImporting, setEmployeeImporting] = useState(false);
  const [employeeDraftImportInput, setEmployeeDraftImportInput] = useState("");
  const [expandedDraftEducation, setExpandedDraftEducation] = useState(false);
  const [expandedDraftPublications, setExpandedDraftPublications] = useState(false);
  const [expandedNewEmployee, setExpandedNewEmployee] = useState(false);
  const [expandedEditEducation, setExpandedEditEducation] = useState(false);
  const [expandedEditPublications, setExpandedEditPublications] = useState(false);

  const handleAddEmployeeClick = () => {
    setExpandedNewEmployee(true);
    requestAnimationFrame(() => {
      if (newEmployeeRef.current) {
        newEmployeeRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCreateEmployee = async () => {
    const ok = await createEmployee();
    if (ok) {
      setExpandedNewEmployee(false);
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  };

  const handleEmployeeImport = async () => {
    if (!employeeEditId || !employeeImportInput?.trim() || !importEmployeeOpenAlex) return;
    const v = employeeImportInput.trim();
    const isOrcid = v.includes("orcid.org") || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v);
    const orcid = isOrcid ? v : undefined;
    const openalexId = !isOrcid ? v : undefined;
    setEmployeeImporting(true);
    try {
      await importEmployeeOpenAlex(employeeEditId, orcid, openalexId);
      setEmployeeImportInput("");
    } finally {
      setEmployeeImporting(false);
    }
  };

  const handleDraftImport = async () => {
    if (!employeeDraftImportInput?.trim() || !importEmployeeOpenAlexPreview) return;
    const v = employeeDraftImportInput.trim();
    const isOrcid = v.includes("orcid.org") || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v);
    const orcid = isOrcid ? v : undefined;
    const openalexId = !isOrcid ? v : undefined;
    try {
      await importEmployeeOpenAlexPreview(orcid, openalexId);
      setEmployeeDraftImportInput("");
    } catch (_) {}
  };

  const interestsList = (emp) => {
    const arr = Array.isArray(emp?.research_interests) ? emp.research_interests : (typeof emp?.research_interests === "string" ? (emp.research_interests || "").split(",").map((s) => s.trim()).filter(Boolean) : []);
    return arr;
  };

  return (
    <Card variant="solid" padding="lg" className="profile-section-card">
      <div className="profile-section-header">
        <h2 className="profile-section-card__title">Сотрудники</h2>
        <Button variant="primary" onClick={handleAddEmployeeClick}>
          + Добавить сотрудника
        </Button>
      </div>
      <p className="profile-section-desc">
        Добавляйте сотрудников организации. Можно импортировать данные из OpenAlex.
      </p>
      <div className="profile-list" ref={listRef}>
        {orgEmployees.length === 0 && (
          <div className="profile-empty-state">Сотрудники пока не добавлены.</div>
        )}
        {orgEmployees.map((employee) => {
          const initials = employee.full_name
            ? employee.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
            : "?";
          
          const hasHIndex = employee.hindex_wos != null || employee.hindex_scopus != null || employee.hindex_rsci != null || employee.hindex_openalex != null;
          const interests = interestsList(employee);

          return (
            <Card key={employee.id} variant="elevated" padding="none" className="employee-dashboard-card">
              <div className="employee-dashboard-card__header">
                <div className="employee-dashboard-card__avatar-section">
                  <div className="employee-dashboard-card__avatar">
                    <EntityAvatar src={employee.photo_url} alt="" />
                  </div>
                  <div className="employee-dashboard-card__title-group">
                    <div className="entity-title-with-badge">
                      <h4 className="employee-dashboard-card__name">{employee.full_name}</h4>
                      <NewEntityBadge createdAt={employee.created_at} />
                    </div>
                    {employee.academic_degree && (
                      <span className="employee-dashboard-card__degree">{employee.academic_degree}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="employee-dashboard-card__body">
                {(employee.positions || []).length > 0 && (
                  <div className="employee-meta-item">
                    <Layout size={14} className="employee-meta-item__icon" />
                    <span className="employee-meta-item__value">{(employee.positions || []).join(", ")}</span>
                  </div>
                )}

                {(employee.laboratories || []).length > 0 && (
                  <div className="employee-meta-item">
                    <Beaker size={14} className="employee-meta-item__icon" />
                    <div className="chip-row">
                      {employee.laboratories.map((lab) => (
                        <span key={lab.id} className="chip chip--outline">{lab.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {hasHIndex && (
                  <div className="employee-stats-grid">
                    <div className="employee-stat-box">
                      <div className="employee-stat-box__header">
                        <TrendingUp size={12} />
                        <span>h-index</span>
                      </div>
                      <div className="employee-stat-box__values">
                        {employee.hindex_wos != null && <span>WoS: <b>{employee.hindex_wos}</b></span>}
                        {employee.hindex_scopus != null && <span>Scopus: <b>{employee.hindex_scopus}</b></span>}
                      </div>
                    </div>
                  </div>
                )}

                {interests.length > 0 && (
                  <div className="employee-meta-item employee-meta-item--column">
                    <div className="employee-meta-item__header">
                      <BookOpen size={14} />
                      <span>Интересы</span>
                    </div>
                    <div className="chip-row">
                      {interests.slice(0, 4).map((interest) => (
                        <span key={interest} className="chip">{interest}</span>
                      ))}
                      {interests.length > 4 && <span className="chip muted">+{interests.length - 4}</span>}
                    </div>
                  </div>
                )}

                {(employee.contacts?.email || employee.contacts?.phone) && (
                  <div className="employee-contacts-preview">
                    {employee.contacts.email && (
                      <div className="employee-contact-pill">
                        <Mail size={12} />
                        <span>{employee.contacts.email}</span>
                      </div>
                    )}
                    {employee.contacts.phone && (
                      <div className="employee-contact-pill">
                        <Phone size={12} />
                        <span>{employee.contacts.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="employee-dashboard-card__footer">
                <Button 
                  variant="ghost" 
                  size="small" 
                  onClick={() => startEditEmployee(employee)}
                  className="icon-btn"
                  title="Редактировать"
                >
                  <Edit3 size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="small" 
                  className="btn-icon-text"
                  onClick={() => { setEmployeePreview(employee); setShowEmployeePublications(false); }}
                >
                  <User size={14} /> Профиль
                </Button>
                <Button 
                  variant="ghost" 
                  size="small" 
                  className="employee-btn-delete" 
                  onClick={() => deleteEmployee(employee.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {employeeEditId && employeeEdit && (
        <div className="employee-edit-overlay">
          <div className="employee-edit-form">
            <div className="employee-edit-form__header">
              <h5>Редактирование: {employeeEdit.full_name}</h5>
            </div>
            <div className="employee-edit-form__scroll">
              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <ExternalLink size={16} /> Импорт из OpenAlex
                </div>
                <div className="lab-import-box">
                  <p className="profile-field-hint">Введите ORCID или OpenAlex ID для подтягивания данных</p>
                  <div className="lab-import-input-group">
                    <input
                      type="text"
                      value={employeeImportInput}
                      onChange={(e) => setEmployeeImportInput(e.target.value)}
                      placeholder="ORCID или OpenAlex ID"
                      className="ui-input"
                    />
                    <Button
                      variant="primary"
                      onClick={handleEmployeeImport}
                      disabled={saving || employeeImporting || !employeeImportInput?.trim()}
                    >
                      {employeeImporting ? "Импорт…" : "Импортировать"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <User size={16} /> Основная информация
                </div>
                <div className="employee-photo-edit">
                  <div className="employee-photo-edit__avatar">
                    <EntityAvatar src={employeeEdit.photo_url} alt="" />
                    <button 
                      type="button" 
                      className="employee-photo-edit__remove"
                      onClick={() => handleEmployeeEditChange("photo_url", "")}
                    >
                      ×
                    </button>
                  </div>
                  <div className="employee-photo-edit__actions">
                    <label className="file-upload-label">
                      <Plus size={14} /> Изменить фото
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => uploadEmployeePhoto(e.target.files?.[0], true)} 
                        disabled={uploading || saving} 
                      />
                    </label>
                  </div>
                </div>
                <Input
                  label="ФИО"
                  value={employeeEdit.full_name}
                  onChange={(e) => handleEmployeeEditChange("full_name", e.target.value)}
                  placeholder="Иванов Иван Иванович"
                />
                <Input
                  label="Учёная степень"
                  value={employeeEdit.academic_degree}
                  onChange={(e) => handleEmployeeEditChange("academic_degree", e.target.value)}
                  placeholder="Доктор наук"
                />
                <Input
                  label="Должность"
                  value={employeeEditPositionInput}
                  onChange={(e) => setEmployeeEditPositionInput(e.target.value)}
                  placeholder="Ведущий сотрудник"
                />
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <BookOpen size={16} /> Научные интересы
                </div>
                <TagInput
                  value={employeeEdit.research_interests || []}
                  onChange={(v) => handleEmployeeEditChange("research_interests", v)}
                  placeholder="Введите интерес и нажмите Enter"
                />
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Beaker size={16} /> Лаборатории
                </div>
                <div className="lab-checkbox-grid">
                  {orgLabs.map((lab) => (
                    <label key={lab.id} className="lab-selection-item">
                      <input
                        type="checkbox"
                        checked={(employeeEdit.laboratory_ids || []).includes(lab.id)}
                        onChange={() => toggleEmployeeLab(lab.id, true)}
                      />
                      <span>{lab.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <TrendingUp size={16} /> Индексы Хирша
                </div>
                <div className="employee-hindex-form-grid">
                  <label>WoS <input type="number" value={employeeEdit.hindex_wos ?? ""} onChange={(e) => handleEmployeeEditChange("hindex_wos", e.target.value ? Number(e.target.value) : null)} placeholder="—" /></label>
                  <label>Scopus <input type="number" value={employeeEdit.hindex_scopus ?? ""} onChange={(e) => handleEmployeeEditChange("hindex_scopus", e.target.value ? Number(e.target.value) : null)} placeholder="—" /></label>
                  <label>РИНЦ <input type="number" value={employeeEdit.hindex_rsci ?? ""} onChange={(e) => handleEmployeeEditChange("hindex_rsci", e.target.value ? Number(e.target.value) : null)} placeholder="—" /></label>
                </div>
              </div>

              <div className="profile-form-group">
                <div className="profile-form-group-title">
                  <Mail size={16} /> Контакты
                </div>
                <div className="employee-contacts-form-grid">
                  <Input 
                    label="Email" 
                    type="email" 
                    value={employeeEdit.contacts?.email || ""} 
                    onChange={(e) => handleEmployeeContacts("email", e.target.value, true)} 
                    placeholder="email@example.com" 
                  />
                  <Input 
                    label="Телефон" 
                    type="tel" 
                    value={employeeEdit.contacts?.phone ? formatPhoneRU(employeeEdit.contacts.phone) : ""} 
                    onChange={(e) => handleEmployeeContacts("phone", formatPhoneRU(e.target.value), true)} 
                    placeholder="+7 (999) 123-45-67" 
                  />
                  <Input 
                    label="Telegram" 
                    value={employeeEdit.contacts?.telegram || ""} 
                    onChange={(e) => handleEmployeeContacts("telegram", e.target.value, true)} 
                    placeholder="@username" 
                  />
                </div>
              </div>
            </div>
            <div className="employee-edit-form__footer">
              <Button variant="primary" onClick={updateEmployee} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить изменения"}
              </Button>
              <Button variant="ghost" onClick={cancelEditEmployee}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={newEmployeeRef}
        className={`lab-collapsible-form ${expandedNewEmployee ? "expanded" : ""}`}
      >
        <button 
          type="button" 
          className="lab-collapsible-form__header" 
          onClick={() => setExpandedNewEmployee((prev) => !prev)} 
          aria-expanded={expandedNewEmployee}
        >
          <div className="lab-collapsible-form__header-content">
            <Plus size={18} />
            <span>Новый сотрудник</span>
          </div>
          {expandedNewEmployee ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <div className="lab-collapsible-form__body">
          <div className="employee-edit-form__scroll">
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <ExternalLink size={16} /> Импорт из OpenAlex
              </div>
              <div className="lab-import-box">
                <p className="profile-field-hint">Введите ORCID или OpenAlex ID для подтягивания данных</p>
                <div className="lab-import-input-group">
                  <input 
                    type="text" 
                    value={employeeDraftImportInput} 
                    onChange={(e) => setEmployeeDraftImportInput(e.target.value)} 
                    placeholder="ORCID или OpenAlex ID" 
                    className="ui-input" 
                  />
                  <Button 
                    variant="primary" 
                    onClick={handleDraftImport} 
                    disabled={saving || employeeDraftImporting || !employeeDraftImportInput?.trim()}
                  >
                    {employeeDraftImporting ? "Импорт…" : "Импортировать"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <User size={16} /> Основная информация
              </div>
              <div className="employee-photo-edit">
                <div className="employee-photo-edit__avatar">
                  <EntityAvatar src={employeeDraft.photo_url} alt="" />
                </div>
                <div className="employee-photo-edit__actions">
                  <label className="file-upload-label">
                    <Plus size={14} /> {employeeDraft.photo_url ? "Изменить фото" : "Загрузить фото"}
                    <input 
                      ref={draftPhotoInputRef} 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => uploadEmployeePhoto(e.target.files?.[0], false)} 
                      disabled={uploading || saving} 
                    />
                  </label>
                  {employeeDraft.photo_url && (
                    <button 
                      type="button" 
                      className="text-btn-danger"
                      onClick={() => handleEmployeeDraftChange("photo_url", "")}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
              <Input
                label="ФИО"
                value={employeeDraft.full_name}
                onChange={(e) => handleEmployeeDraftChange("full_name", e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
              <Input 
                label="Учёная степень" 
                value={employeeDraft.academic_degree} 
                onChange={(e) => handleEmployeeDraftChange("academic_degree", e.target.value)} 
                placeholder="Кандидат наук" 
              />
              <Input 
                label="Должность" 
                value={employeeDraftPositionInput} 
                onChange={(e) => setEmployeeDraftPositionInput(e.target.value)} 
                placeholder="Научный сотрудник" 
              />
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <BookOpen size={16} /> Научные интересы
              </div>
              <TagInput 
                value={employeeDraft.research_interests || []} 
                onChange={(v) => handleEmployeeDraftChange("research_interests", v)} 
                placeholder="Введите интерес и нажмите Enter" 
              />
            </div>

            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Beaker size={16} /> Лаборатории
              </div>
              <div className="lab-checkbox-grid">
                {orgLabs.map((lab) => (
                  <label key={lab.id} className="lab-selection-item">
                    <input 
                      type="checkbox" 
                      checked={(employeeDraft.laboratory_ids || []).includes(lab.id)} 
                      onChange={() => toggleEmployeeLab(lab.id, false)} 
                    />
                    <span>{lab.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contacts for draft */}
            <div className="profile-form-group">
              <div className="profile-form-group-title">
                <Mail size={16} /> Контакты
              </div>
              <div className="employee-contacts-form-grid">
                <Input 
                  label="Email" 
                  type="email" 
                  value={employeeDraft.contacts?.email || ""} 
                  onChange={(e) => handleEmployeeContacts("email", e.target.value, false)} 
                  placeholder="email@example.com" 
                />
                <Input 
                  label="Телефон" 
                  type="tel" 
                  value={employeeDraft.contacts?.phone ? formatPhoneRU(employeeDraft.contacts.phone) : ""} 
                  onChange={(e) => handleEmployeeContacts("phone", formatPhoneRU(e.target.value), false)} 
                  placeholder="+7 (999) 123-45-67" 
                />
              </div>
            </div>
          </div>

          <div className="lab-form-actions lab-form-actions--create">
            <Button variant="primary" onClick={handleCreateEmployee} disabled={saving}>
              {saving ? "Сохранение…" : "Создать сотрудника"}
            </Button>
            <Button variant="ghost" onClick={() => setExpandedNewEmployee(false)}>Отмена</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
