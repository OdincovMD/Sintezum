import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { Bold, Download, FileText, Heading2, Heading3, Images, ImagePlus, Italic, Link2, Paperclip, Redo2, Trash2, Undo2, Users, X } from "lucide-react";
import { apiRequest } from "../../api/client";
import { Button, EntityAvatar, Input } from "../ui";

const EMPTY_CONTENT = { type: "doc", content: [{ type: "paragraph", content: [] }] };

const MAX_GALLERY_IMAGES = 20;
const MAX_ATTACHMENTS = 10;

async function uploadNewsFile(file, { imageOnly = false } = {}) {
  if (!file) throw new Error("Выберите файл");
  if (imageOnly && !file.type?.startsWith("image/")) throw new Error("Выберите изображение");
  const body = new FormData();
  body.append("category", "news");
  body.append("file", file);
  return apiRequest("/storage/upload", { method: "POST", body });
}

function ToolButton({ active = false, title, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      className={`news-editor__tool${active ? " news-editor__tool--active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function NewsEditorForm({ item, targets, employeeEndpoint, onSave, onCancel, saving = false }) {
  const [title, setTitle] = useState(item?.title || "");
  const [coverUrl, setCoverUrl] = useState(item?.cover_url || "");
  const [galleryUrls, setGalleryUrls] = useState(item?.gallery_urls || []);
  const [attachments, setAttachments] = useState(item?.attachments || []);
  const [targetKey, setTargetKey] = useState("");
  const [employeeIds, setEmployeeIds] = useState(() => (item?.employees || []).map((employee) => employee.id));
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [error, setError] = useState("");
  const coverInput = useRef(null);
  const bodyImageInput = useRef(null);
  const galleryInput = useRef(null);
  const attachmentsInput = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      LinkExtension.configure({ openOnClick: false, protocols: ["http", "https", "mailto"] }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
    ],
    content: item?.content || EMPTY_CONTENT,
    editorProps: { attributes: { class: "news-editor__content", "aria-label": "Текст новости" } },
  });

  useEffect(() => {
    setTitle(item?.title || "");
    setCoverUrl(item?.cover_url || "");
    setGalleryUrls(item?.gallery_urls || []);
    setAttachments(item?.attachments || []);
    const current = item
      ? `${item.scope}:${item.organization_id || item.laboratory_id || "platform"}`
      : targets.length === 1
        ? targets[0].key
        : "";
    setTargetKey(current);
    setEmployeeIds((item?.employees || []).map((employee) => employee.id));
    editor?.commands.setContent(item?.content || EMPTY_CONTENT);
  }, [item?.id, targets, editor]);

  useEffect(() => {
    const source = targets.find((entry) => entry.key === targetKey) || item;
    if (!source || source.scope === "platform") {
      setEligibleEmployees([]);
      setEmployeeError("");
      setEmployeesLoading(false);
      return undefined;
    }
    const params = new URLSearchParams({ scope: source.scope });
    const organizationId = source.organization_id ?? (source.scope === "organization" ? source.id : null);
    const laboratoryId = source.laboratory_id ?? (source.scope === "laboratory" ? source.id : null);
    if (source.scope === "organization") params.set("organization_id", String(organizationId));
    if (source.scope === "laboratory") params.set("laboratory_id", String(laboratoryId));
    let active = true;
    setEmployeeError("");
    setEmployeesLoading(true);
    apiRequest(`${employeeEndpoint}/eligible-employees?${params}`)
      .then((result) => {
        if (!active) return;
        const originalKey = item
          ? `${item.scope}:${item.organization_id || item.laboratory_id || "platform"}`
          : "";
        const existingEmployees = originalKey === targetKey ? (item?.employees || []) : [];
        const byId = new Map([...(result || []), ...existingEmployees].map((employee) => [employee.id, employee]));
        setEligibleEmployees(Array.from(byId.values()));
      })
      .catch((err) => {
        if (active) setEmployeeError(err.message || "Не удалось загрузить сотрудников");
      })
      .finally(() => active && setEmployeesLoading(false));
    return () => { active = false; };
  }, [employeeEndpoint, item, targetKey, targets]);

  const toggleEmployee = (employeeId) => {
    setEmployeeIds((current) => current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : [...current, employeeId]);
  };

  const changeTarget = (value) => {
    setTargetKey(value);
    setEmployeeIds([]);
    setEmployeeError("");
  };

  const handleLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "https://";
    const href = window.prompt("Адрес ссылки", previous);
    if (href === null) return;
    if (!href.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const handleUpload = async (file, mode) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = await uploadNewsFile(file, { imageOnly: true });
      if (mode === "cover") setCoverUrl(uploaded.public_url);
      else editor?.chain().focus().setImage({ src: uploaded.public_url, alt: file.name }).run();
    } catch (err) {
      setError(err.message || "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (galleryUrls.length + selected.length > MAX_GALLERY_IMAGES) {
      setError(`В фотоальбом можно добавить не более ${MAX_GALLERY_IMAGES} изображений`);
      return;
    }
    setError("");
    setUploading(true);
    setUploadNotice(`Загружаем фотографии: 0 из ${selected.length}`);
    try {
      const uploadedUrls = [];
      for (let index = 0; index < selected.length; index += 1) {
        const uploaded = await uploadNewsFile(selected[index], { imageOnly: true });
        uploadedUrls.push(uploaded.public_url);
        setUploadNotice(`Загружаем фотографии: ${index + 1} из ${selected.length}`);
      }
      setGalleryUrls((current) => [...current, ...uploadedUrls]);
    } catch (err) {
      setError(err.message || "Не удалось загрузить фотографии");
    } finally {
      setUploading(false);
      setUploadNotice("");
    }
  };

  const handleAttachmentsUpload = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (attachments.length + selected.length > MAX_ATTACHMENTS) {
      setError(`К новости можно прикрепить не более ${MAX_ATTACHMENTS} файлов`);
      return;
    }
    setError("");
    setUploading(true);
    setUploadNotice(`Загружаем файлы: 0 из ${selected.length}`);
    try {
      const uploadedFiles = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const uploaded = await uploadNewsFile(file);
        uploadedFiles.push({
          url: uploaded.public_url,
          name: file.name,
          size: file.size,
          content_type: file.type || "application/octet-stream",
        });
        setUploadNotice(`Загружаем файлы: ${index + 1} из ${selected.length}`);
      }
      setAttachments((current) => [...current, ...uploadedFiles]);
    } catch (err) {
      setError(err.message || "Не удалось загрузить файлы");
    } finally {
      setUploading(false);
      setUploadNotice("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const target = targets.find((entry) => entry.key === targetKey);
    if (!item && !target) return setError("Выберите источник новости");
    if (!title.trim()) return setError("Введите заголовок");
    const source = target || item;
    try {
      await onSave({
        scope: source.scope,
        organization_id: source.scope === "organization" ? Number(source.organization_id ?? source.id) : null,
        laboratory_id: source.scope === "laboratory" ? Number(source.laboratory_id ?? source.id) : null,
        title: title.trim(),
        content: editor?.getJSON() || EMPTY_CONTENT,
        cover_url: coverUrl || null,
        gallery_urls: galleryUrls,
        attachments,
        employee_ids: employeeIds,
      });
    } catch (err) {
      setError(err.message || "Не удалось сохранить новость");
    }
  };

  const activeSource = targets.find((entry) => entry.key === targetKey) || item;

  return (
    <form className="news-editor" onSubmit={submit}>
      <div className="news-editor__heading">
        <div>
          <h3>{item ? "Редактировать новость" : "Новая публикация"}</h3>
        </div>
        <button type="button" className="news-editor__close" onClick={onCancel} aria-label="Закрыть редактор"><X /></button>
      </div>

      {(!item || targets.some((target) => target.key === targetKey)) && (
        <label className="news-editor__field">
          <span>Источник публикации</span>
          <select value={targetKey} onChange={(e) => changeTarget(e.target.value)} required>
            <option value="">Выберите источник</option>
            {targets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
          </select>
        </label>
      )}
      {item && !targets.some((target) => target.key === targetKey) && <div className="news-editor__source">Источник: <strong>{item.owner?.name}</strong></div>}

      <div className="news-editor__field">
        <label htmlFor="news-editor-title">Заголовок</label>
        <Input id="news-editor-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="О чём эта новость?" />
      </div>

      {activeSource && activeSource.scope !== "platform" && (
        <section className="news-editor__employees" aria-labelledby="news-editor-employees-title">
          <div className="news-editor__employees-heading">
            <div>
              <strong id="news-editor-employees-title"><Users size={17} /> Участники новости</strong>
              <span>Отметьте сотрудников, о которых идёт речь. Можно выбрать до 20 человек.</span>
            </div>
            {employeeIds.length > 0 && <span className="news-editor__employees-count">Выбрано: {employeeIds.length}</span>}
          </div>
          {employeesLoading ? (
            <div className="news-editor__employees-state">Загружаем сотрудников…</div>
          ) : employeeError ? (
            <div className="news-editor__employees-state news-editor__employees-state--error">{employeeError}</div>
          ) : eligibleEmployees.length === 0 ? (
            <div className="news-editor__employees-state">У выбранного источника пока нет сотрудников.</div>
          ) : (
            <div className="news-editor__employees-list">
              {eligibleEmployees.map((employee) => {
                const checked = employeeIds.includes(employee.id);
                const meta = [employee.academic_degree, ...(employee.positions || [])].filter(Boolean).join(" · ");
                return (
                  <label className={`news-editor__employee${checked ? " news-editor__employee--selected" : ""}`} key={employee.id}>
                    <input type="checkbox" checked={checked} disabled={!checked && employeeIds.length >= 20} onChange={() => toggleEmployee(employee.id)} />
                    <EntityAvatar src={employee.photo_url} alt={employee.full_name} className="news-editor__employee-avatar" />
                    <span><strong>{employee.full_name}</strong>{meta && <small>{meta}</small>}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="news-editor__cover">
        <div className="news-editor__cover-copy">
          <strong>Обложка</strong>
          <span>Необязательно. Без неё используем первое фото из альбома или текста.</span>
          <div className="news-editor__cover-actions">
            <Button type="button" variant="secondary" size="small" onClick={() => coverInput.current?.click()} disabled={uploading}>Загрузить</Button>
            {coverUrl && <Button type="button" variant="ghost" size="small" onClick={() => setCoverUrl("")}>Убрать</Button>}
          </div>
        </div>
        {coverUrl && <img src={coverUrl} alt="Предпросмотр обложки" />}
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0], "cover")} />
      </div>

      <div className="news-editor__body-field">
        <span className="news-editor__body-label">Текст новости</span>
        <div className="news-editor__toolbar" role="toolbar" aria-label="Форматирование текста">
          <ToolButton title="Полужирный" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={18} /></ToolButton>
          <ToolButton title="Курсив" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={18} /></ToolButton>
          <ToolButton title="Заголовок второго уровня" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={18} /></ToolButton>
          <ToolButton title="Заголовок третьего уровня" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={18} /></ToolButton>
          <span className="news-editor__toolbar-separator" />
          <ToolButton title="Добавить ссылку" active={editor?.isActive("link")} onClick={handleLink}><Link2 size={18} /></ToolButton>
          <ToolButton title="Вставить изображение" onClick={() => bodyImageInput.current?.click()} disabled={uploading}><ImagePlus size={18} /></ToolButton>
          <span className="news-editor__toolbar-spacer" />
          <ToolButton title="Отменить" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><Undo2 size={18} /></ToolButton>
          <ToolButton title="Повторить" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><Redo2 size={18} /></ToolButton>
          <input ref={bodyImageInput} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0], "body")} />
        </div>
        <EditorContent editor={editor} />
      </div>

      <section className="news-editor__media-section">
        <div className="news-editor__section-heading">
          <div><strong><Images size={18} /> Фотоальбом</strong><span>Отдельная галерея под текстом новости, до {MAX_GALLERY_IMAGES} фотографий.</span></div>
          <Button type="button" variant="secondary" size="small" onClick={() => galleryInput.current?.click()} disabled={uploading || galleryUrls.length >= MAX_GALLERY_IMAGES}>Добавить фото</Button>
        </div>
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => { handleGalleryUpload(e.target.files); e.target.value = ""; }} />
        {galleryUrls.length > 0 && (
          <div className="news-editor__gallery-list">
            {galleryUrls.map((url, index) => (
              <div className="news-editor__gallery-item" key={url}>
                <img src={url} alt={`Фотография ${index + 1}`} />
                <button type="button" onClick={() => setGalleryUrls((current) => current.filter((entry) => entry !== url))} aria-label={`Удалить фотографию ${index + 1}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="news-editor__media-section">
        <div className="news-editor__section-heading">
          <div><strong><Paperclip size={18} /> Файлы</strong><span>Документы и таблицы до 10 МБ, не более {MAX_ATTACHMENTS} файлов.</span></div>
          <Button type="button" variant="secondary" size="small" onClick={() => attachmentsInput.current?.click()} disabled={uploading || attachments.length >= MAX_ATTACHMENTS}>Прикрепить</Button>
        </div>
        <input ref={attachmentsInput} type="file" multiple hidden onChange={(e) => { handleAttachmentsUpload(e.target.files); e.target.value = ""; }} />
        {attachments.length > 0 && (
          <div className="news-editor__attachment-list">
            {attachments.map((attachment) => (
              <div className="news-editor__attachment" key={attachment.url}>
                <FileText size={18} />
                <a href={attachment.url} target="_blank" rel="noopener noreferrer"><span>{attachment.name}</span><small>{Math.max(1, Math.round((attachment.size || 0) / 1024))} КБ</small></a>
                <Download size={15} aria-hidden />
                <button type="button" onClick={() => setAttachments((current) => current.filter((entry) => entry.url !== attachment.url))} aria-label={`Удалить файл ${attachment.name}`}><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {uploading && <p className="news-editor__notice">{uploadNotice || "Загружаем изображение…"}</p>}
      {error && <p className="news-editor__error" role="alert">{error}</p>}
      <div className="news-editor__actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Отмена</Button>
        <Button type="submit" variant="primary" loading={saving} disabled={saving || uploading}>Сохранить черновик</Button>
      </div>
    </form>
  );
}
