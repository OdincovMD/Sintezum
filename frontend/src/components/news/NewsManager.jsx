import React, { useCallback, useEffect, useState } from "react";
import { Edit3, Eye, FilePlus2, LockKeyhole, Newspaper, Trash2, UnlockKeyhole, Users } from "lucide-react";
import { apiRequest } from "../../api/client";
import { useEditOverlayScrollLock } from "../../hooks";
import { Badge, Button } from "../ui";
import NewsEditorForm from "./NewsEditorForm";
import { formatNewsDate } from "./NewsCard";

const STATUS = {
  draft: { label: "Черновик", variant: "draft" },
  published: { label: "Опубликовано", variant: "published" },
  blocked: { label: "Снято администратором", variant: "rejected" },
};

export default function NewsManager({ endpoint, targets, admin = false }) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorItem, setEditorItem] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  useEditOverlayScrollLock(editorOpen);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !saving) setEditorOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editorOpen, saving]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (admin && statusFilter) params.set("news_status", statusFilter);
      if (admin && scopeFilter) params.set("scope", scopeFilter);
      const result = await apiRequest(`${endpoint}?${params}`);
      setData(result || { items: [], total: 0 });
    } catch (err) {
      setError(err.message || "Не удалось загрузить новости");
    } finally {
      setLoading(false);
    }
  }, [admin, endpoint, page, scopeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditorItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditorItem(item);
    setEditorOpen(true);
  };

  const save = async (payload) => {
    setSaving(true);
    try {
      if (editorItem) {
        await apiRequest(`${endpoint}/${editorItem.id}`, {
          method: "PUT",
          body: JSON.stringify({ title: payload.title, content: payload.content, cover_url: payload.cover_url, employee_ids: payload.employee_ids }),
        });
      } else {
        await apiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
      }
      setEditorOpen(false);
      setEditorItem(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (item) => {
    const shouldPublish = item.status !== "published";
    setSaving(true);
    setError("");
    try {
      await apiRequest(`${endpoint}/${item.id}/publish`, {
        method: "PUT",
        body: JSON.stringify({ is_published: shouldPublish }),
      });
      await load();
    } catch (err) {
      setError(err.message || "Не удалось изменить статус новости");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Удалить новость «${item.title}»?`)) return;
    setSaving(true);
    try {
      await apiRequest(`${endpoint}/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "Не удалось удалить новость");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="news-manager">
      <div className="news-manager__intro">
        <div>
          <span className="news-manager__eyebrow"><Newspaper size={16} /> Контент</span>
          <h3>{admin ? "Новости платформы" : "Новости"}</h3>
          <p>{admin ? "Создавайте редакционные материалы и управляйте публикациями участников." : "Рассказывайте о событиях организации и лабораторий."}</p>
        </div>
        <Button onClick={openCreate} disabled={targets.length === 0}><FilePlus2 size={17} /> Новая новость</Button>
      </div>

      {admin && (
        <div className="news-manager__filters">
          <label>Статус
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Все</option><option value="published">Опубликовано</option><option value="draft">Черновик</option><option value="blocked">Снято</option>
            </select>
          </label>
          <label>Источник
            <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}>
              <option value="">Все</option><option value="platform">Платформа</option><option value="organization">Организации</option><option value="laboratory">Лаборатории</option>
            </select>
          </label>
        </div>
      )}

      {error && <p className="news-manager__error" role="alert">{error}</p>}
      {loading ? <div className="news-manager__loading">Загружаем новости…</div> : data.items.length === 0 ? (
        <div className="news-manager__empty"><Newspaper size={32} /><strong>Новостей пока нет</strong><span>{targets.length === 0 ? "Сначала создайте профиль организации или лабораторию." : "Создайте первый материал — он сохранится как черновик."}</span></div>
      ) : (
        <div className="news-manager__list">
          {data.items.map((item) => {
            const statusInfo = STATUS[item.status] || STATUS.draft;
            const canDelete = !admin || item.scope === "platform";
            return (
              <article className="news-manager__item" key={item.id}>
                <div className="news-manager__item-main">
                  <div className="news-manager__item-meta">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <span>{item.owner?.name}</span>
                    <span>{formatNewsDate(item.published_at || item.created_at)}</span>
                    {(item.employees || []).length > 0 && <span><Users size={13} /> {item.employees.length}</span>}
                  </div>
                  <h4>{item.title}</h4>
                </div>
                <div className="news-manager__actions">
                  {item.status === "published" && <Button variant="ghost" size="small" to={`/news/${item.public_id}`} target="_blank"><Eye size={16} /> Открыть</Button>}
                  <Button variant="secondary" size="small" onClick={() => openEdit(item)} disabled={saving}><Edit3 size={16} /> Изменить</Button>
                  {item.status !== "blocked" || admin ? (
                    <Button variant="ghost" size="small" onClick={() => togglePublished(item)} disabled={saving}>
                      {item.status === "published" ? <><LockKeyhole size={16} /> Снять</> : <><UnlockKeyhole size={16} /> Опубликовать</>}
                    </Button>
                  ) : null}
                  {canDelete && <Button variant="ghost" size="small" className="news-manager__delete" onClick={() => remove(item)} disabled={saving}><Trash2 size={16} /> Удалить</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {data.total > 20 && (
        <div className="news-manager__pagination"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button><span>{page} / {Math.ceil(data.total / 20)}</span><Button variant="ghost" disabled={page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>Вперёд</Button></div>
      )}

      {editorOpen && (
        <div className="news-editor-overlay" role="dialog" aria-modal="true" aria-label="Редактор новости" onMouseDown={(e) => e.target === e.currentTarget && !saving && setEditorOpen(false)}>
          <div className="news-editor-overlay__panel">
            <NewsEditorForm item={editorItem} targets={targets} employeeEndpoint={endpoint} saving={saving} onSave={save} onCancel={() => !saving && setEditorOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
