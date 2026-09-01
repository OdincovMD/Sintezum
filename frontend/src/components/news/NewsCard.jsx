import React, { useState } from "react";
import { ArrowUpRight, Building2, CalendarDays, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../../constants";
import NewsPeople from "./NewsPeople";
import NewEntityBadge from "../NewEntityBadge";

export function formatNewsDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function OwnerLabel({ owner }) {
  const Icon = owner?.type === "laboratory" ? FlaskConical : Building2;
  const path = owner?.type === "organization"
    ? `/organizations/${owner.public_id}`
    : owner?.type === "laboratory"
      ? `/laboratories/${owner.public_id}`
      : null;
  const content = <><Icon size={15} aria-hidden />{owner?.name || "Синтезум"}</>;
  return path ? <Link to={path} className="news-card__owner">{content}</Link> : <span className="news-card__owner">{content}</span>;
}

export default function NewsCard({ item, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = !imageFailed && item.preview_image_url ? item.preview_image_url : DEFAULT_PLACEHOLDER_IMAGE;
  return (
    <article className={`news-card${compact ? " news-card--compact" : ""}`}>
      <Link className="news-card__media" to={`/news/${item.public_id}`} aria-label={`Открыть новость «${item.title}»`}>
        <img src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      </Link>
      <div className="news-card__body">
        <div className="news-card__meta">
          <OwnerLabel owner={item.owner} />
          <span className="news-card__date"><CalendarDays size={14} aria-hidden />{formatNewsDate(item.published_at)}</span>
        </div>
        <div className="entity-title-with-badge">
          <h2 className="news-card__title">
            <Link to={`/news/${item.public_id}`}>{item.title}</Link>
          </h2>
          <NewEntityBadge createdAt={item.published_at} />
        </div>
        {!compact && item.excerpt && <p className="news-card__excerpt">{item.excerpt}</p>}
        <NewsPeople employees={item.employees} compact />
        <Link className="news-card__more" to={`/news/${item.public_id}`}>
          Читать <ArrowUpRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
