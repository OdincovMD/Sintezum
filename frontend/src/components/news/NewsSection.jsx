import React, { useEffect, useState } from "react";
import { ArrowRight, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/client";
import NewsCard from "./NewsCard";

export default function NewsSection({ organizationId, laboratoryId, title }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ size: "3", page: "1" });
    if (organizationId) params.set("organization_id", organizationId);
    if (laboratoryId) params.set("laboratory_id", laboratoryId);
    apiRequest(`/news?${params}`)
      .then((data) => active && setItems(data?.items || []))
      .catch(() => active && setItems([]));
    return () => { active = false; };
  }, [organizationId, laboratoryId]);

  if (items.length === 0) return null;
  const allParams = new URLSearchParams();
  if (organizationId) allParams.set("organization_id", organizationId);
  if (laboratoryId) allParams.set("laboratory_id", laboratoryId);

  return (
    <section className="entity-news-section" aria-labelledby={`entity-news-${organizationId || laboratoryId}`}>
      <div className="entity-news-section__header">
        <h2 id={`entity-news-${organizationId || laboratoryId}`}>
          <Newspaper size={20} aria-hidden /> {title}
        </h2>
        <Link to={`/news?${allParams}`} className="entity-news-section__all">
          Все новости <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="entity-news-section__grid">
        {items.map((item) => <NewsCard key={item.id} item={item} compact />)}
      </div>
    </section>
  );
}
