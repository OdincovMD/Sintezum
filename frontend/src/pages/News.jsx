import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Newspaper } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Button } from "../components/ui";
import { NewsCard, NewsContent, NewsPeople } from "../components/news";
import { formatNewsDate } from "../components/news/NewsCard";

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
          </article>
        )}
      </div>
    );
  }

  const filtered = organizationId || laboratoryId;
  return (
    <div className="news-page">
      <header className="news-page__hero">
        <div>
          <span className="news-page__eyebrow"><Newspaper size={17} /> Синтезум · редакция</span>
          <h1>{filtered ? "Новости профиля" : "Новости"}</h1>
          <p>{filtered ? "Последние публикации выбранной организации или лаборатории." : "События платформы, организаций и лабораторий — в одном потоке."}</p>
        </div>
        <div className="news-page__hero-mark" aria-hidden>НОВОСТИ</div>
      </header>

      {filtered && <Link to="/news" className="news-page__clear-filter"><ArrowLeft size={16} /> Все новости</Link>}
      {loading && <div className="news-loading">Собираем свежие новости…</div>}
      {error && <div className="news-error" role="alert">{error}</div>}
      {!loading && !error && data.items.length === 0 && (
        <div className="news-empty"><Newspaper size={36} /><h2>Публикаций пока нет</h2><p>Здесь появятся новые материалы после публикации.</p></div>
      )}
      {!loading && data.items.length > 0 && (
        <>
          <div className="news-grid">{data.items.map((item) => <NewsCard key={item.id} item={item} />)}</div>
          {data.total > PAGE_SIZE && (
            <div className="news-pagination">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Назад</Button>
              <span>Страница {page} из {Math.ceil(data.total / PAGE_SIZE)}</span>
              <Button variant="ghost" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((value) => value + 1)}>Вперёд</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
