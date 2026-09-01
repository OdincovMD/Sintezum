import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Download, FileText, Images, Newspaper } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Button } from "../components/ui";
import { NewsCard, NewsContent, NewsPeople } from "../components/news";
import { formatNewsDate } from "../components/news/NewsCard";
import GalleryModal from "./profile/GalleryModal";

const PAGE_SIZE = 12;

function NewsOwner({ owner }) {
  const path = owner?.type === "organization"
    ? `/organizations/${owner.public_id}`
    : owner?.type === "laboratory"
      ? `/laboratories/${owner.public_id}`
      : null;
  if (!path) return <span>{owner?.name || "Синтезум"}</span>;
  return <Link to={path}>{owner.name}</Link>;
}

function formatFileSize(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

export default function News() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organization_id");
  const laboratoryId = searchParams.get("laboratory_id");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState({ open: false, images: [], index: 0 });
  const [galleryZoom, setGalleryZoom] = useState(1);

  useEffect(() => setPage(1), [organizationId, laboratoryId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (publicId) {
      apiRequest(`/news/public/${publicId}`)
        .then((result) => active && setDetail(result))
        .catch((err) => active && setError(err.message || "Новость не найдена"))
        .finally(() => active && setLoading(false));
    } else {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (organizationId) params.set("organization_id", organizationId);
      if (laboratoryId) params.set("laboratory_id", laboratoryId);
      apiRequest(`/news?${params}`)
        .then((result) => active && setData(result || { items: [], total: 0 }))
        .catch((err) => active && setError(err.message || "Не удалось загрузить новости"))
        .finally(() => active && setLoading(false));
    }
    return () => { active = false; };
  }, [publicId, page, organizationId, laboratoryId]);

  const openGallery = (images, index) => {
    setGallery({ open: true, images, index });
    setGalleryZoom(1);
  };
  const closeGallery = () => {
    setGallery({ open: false, images: [], index: 0 });
    setGalleryZoom(1);
  };
  const showPrev = () => setGallery((current) => ({
    ...current,
    index: (current.index - 1 + current.images.length) % current.images.length,
  }));
  const showNext = () => setGallery((current) => ({
    ...current,
    index: (current.index + 1) % current.images.length,
  }));
  const toggleZoom = () => setGalleryZoom((current) => (current > 1 ? 1 : 1.6));
  const handleGalleryWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setGalleryZoom((current) => Math.min(3, Math.max(1, Number((current + (event.deltaY > 0 ? -0.1 : 0.1)).toFixed(2)))));
  };

  if (publicId) {
    return (
      <div className="news-page news-page--detail">
        <button type="button" className="news-detail__back" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Назад</button>
        {loading && <div className="news-loading">Загружаем публикацию…</div>}
        {error && <div className="news-error" role="alert">{error}</div>}
        {!loading && detail && (
          <article className="news-detail">
            <header className="news-detail__header">
              <span className="news-detail__kicker"><Newspaper size={16} /> Новости</span>
              <h1>{detail.title}</h1>
              <div className="news-detail__meta">
                <NewsOwner owner={detail.owner} />
                <span><CalendarDays size={15} /> {formatNewsDate(detail.published_at)}</span>
              </div>
            </header>
            {detail.cover_url && <img className="news-detail__cover" src={detail.cover_url} alt="Обложка новости" />}
            <NewsPeople employees={detail.employees} />
            <NewsContent content={detail.content} className="news-detail__content" />
            {(detail.gallery_urls || []).length > 0 && (
              <section className="news-detail__gallery" aria-labelledby="news-gallery-title">
                <h2 id="news-gallery-title"><Images size={20} /> Фотоальбом</h2>
                <div className="news-detail__gallery-grid">
                  {detail.gallery_urls.map((url, index) => (
                    <button type="button" key={url} onClick={() => openGallery(detail.gallery_urls, index)} aria-label={`Открыть фотографию ${index + 1}`}>
                      <img src={url} alt={`Фотография ${index + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {(detail.attachments || []).length > 0 && (
              <section className="news-detail__attachments" aria-labelledby="news-attachments-title">
                <h2 id="news-attachments-title"><FileText size={20} /> Файлы</h2>
                <div className="news-detail__attachment-list">
                  {detail.attachments.map((attachment) => (
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" key={attachment.url}>
                      <FileText size={20} />
                      <span><strong>{attachment.name}</strong><small>{formatFileSize(attachment.size)}</small></span>
                      <Download size={18} />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </article>
        )}
        <GalleryModal gallery={gallery} galleryZoom={galleryZoom} closeGallery={closeGallery} showPrev={showPrev} showNext={showNext} handleGalleryWheel={handleGalleryWheel} toggleZoom={toggleZoom} />
      </div>
    );
  }

  const filtered = organizationId || laboratoryId;
  return (
    <div className="news-page">
      <header className="news-page__header">
        <div>
          <h1 className="listing-page__title">{filtered ? "Новости профиля" : "Новости"}</h1>
          <p>{filtered ? "Последние публикации выбранной организации или лаборатории." : "События платформы, организаций и лабораторий — в одном потоке."}</p>
        </div>
      </header>

      {filtered && <Link to="/news" className="news-page__clear-filter"><ArrowLeft size={16} /> Все новости</Link>}
      {loading && data.items.length === 0 && <div className="news-loading">Собираем свежие новости…</div>}
      {error && <div className="news-error" role="alert">{error}</div>}
      {!loading && !error && data.items.length === 0 && (
        <div className="news-empty"><Newspaper size={36} /><h2>Публикаций пока нет</h2><p>Здесь появятся новые материалы после публикации.</p></div>
      )}
      {data.items.length > 0 && (
        <>
          <div className={`news-grid${loading ? " news-grid--loading" : ""}`} aria-busy={loading}>{data.items.map((item) => <NewsCard key={item.id} item={item} />)}</div>
          {data.total > PAGE_SIZE && (
            <div className="news-pagination">
              <Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Назад</Button>
              <span>{loading ? "Загружаем…" : `Страница ${page} из ${Math.ceil(data.total / PAGE_SIZE)}`}</span>
              <Button variant="ghost" disabled={loading || page * PAGE_SIZE >= data.total} onClick={() => setPage((value) => value + 1)}>Вперёд</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
