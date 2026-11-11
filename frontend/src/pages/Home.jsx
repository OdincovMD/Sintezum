import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FlaskConical, GraduationCap } from "lucide-react";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import GlobalSearch from "../components/GlobalSearch";
import FeaturedCarousel from "../components/FeaturedCarousel";
import { OrganizationCard } from "../components/organization";
import { LabCard } from "../components/lab";
import { VacancyCard } from "../components/vacancies";
import { Card, Button } from "../components/ui";

const FALLBACK_DIRECTIONS = [
  "AI", "Biomed", "Physics", "Climate", "Genomics", "Robotics",
  "Materials", "Neuroscience", "Quantum", "Chemistry", "Bioinformatics",
  "Machine Learning", "Synthetic Biology", "Nanotech", "Energy",
];

/** Склонение для русского: 1 — одна форма, 2–4 — вторая, 0/5+ — третья (11–14 тоже третья). */
function pluralRu(n, one, few, many) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 !== 11 && mod10 === 1) return one;
  if (mod100 < 12 || mod100 > 14) {
    if (mod10 >= 2 && mod10 <= 4) return few;
  }
  return many;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function getMetricLabelLaboratories(n) {
  const word = pluralRu(n, "лаборатория", "лаборатории", "лабораторий");
  return `${cap(word)} на платформе`;
}

function getMetricLabelVacancies(n) {
  return cap(pluralRu(n, "открытая позиция", "открытые позиции", "открытых позиций"));
}

function getMetricLabelResponses(n) {
  return cap(pluralRu(n, "отклик отправлен", "отклика отправлено", "откликов отправлено"));
}

const IMG_EXT = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;

function labImages(urls) {
  const list = Array.isArray(urls) ? urls : [];
  return list.filter((u) => u && IMG_EXT.test(u));
}

function HomeSkeletonCard({ type = "org" }) {
  return (
    <div className="modern-entity-card listing-card-skeleton">
      <div className="modern-entity-card__media">
        <div className="skeleton" aria-hidden="true" style={{ width: "100%", height: "100%", minHeight: "160px" }} />
      </div>
      <div className="modern-entity-card__body">
        <div className="skeleton listing-card-skeleton__line--title" aria-hidden="true" style={{ height: "1.125rem", width: "80%" }} />
        <div className="skeleton" aria-hidden="true" style={{ height: "0.875rem", width: "90%" }} />
        <div className="skeleton" aria-hidden="true" style={{ height: "0.875rem", width: "70%" }} />
      </div>
    </div>
  );
}

export default function Home() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [laboratories, setLaboratories] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [featuredJson, statsJson] = await Promise.all([
          apiRequest("/home/featured"),
          apiRequest("/stats/").catch(() => null),
        ]);
        setOrgs(featuredJson?.organizations ?? []);
        setLaboratories(featuredJson?.laboratories ?? []);
        setVacancies(featuredJson?.vacancies ?? []);
        setStats(statsJson);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [auth]);

  const formatMetric = (val) => {
    if (val == null || val === 0) return "0";
    if (val >= 1000) return `${Math.floor(val / 1000)}k+`;
    if (val >= 100) return `${val}+`;
    return String(val);
  };

  const featuredOrgs = useMemo(() => orgs, [orgs]);
  const featuredLabs = useMemo(() => laboratories, [laboratories]);
  const featuredVacancies = useMemo(() => vacancies, [vacancies]);

  const directions = useMemo(() => {
    const fromApi = (stats?.research_interests || []).filter(Boolean);
    const combined = [...new Set([...fromApi, ...FALLBACK_DIRECTIONS])];
    return combined.length > 0 ? combined : FALLBACK_DIRECTIONS;
  }, [stats?.research_interests]);

  return (
    <main className="main">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-search-wrap hero-search-wrap--large">
            <GlobalSearch size="large" />
          </div>
          <div className="hero-main">
            <div className="hero-copy">
              <h1>Найдите лабораторию и начните новый проект</h1>
              <p>
                Платформа, где лаборатории публикуют исследования и вакансии, а исследователи и
                студенты находят подходящие возможности и ускоряют научные открытия.
              </p>
            </div>
          </div>
          <div className="hero-directions-marquee-wrap">
            <div className="hero-directions-marquee" aria-hidden="true">
              <div className="hero-directions-marquee-copy">
                {directions.map((d) => (
                  <span key={`a-${d}`} className="hero-direction-tag">{d}</span>
                ))}
              </div>
              <div className="hero-directions-marquee-copy" aria-hidden="true">
                {directions.map((d) => (
                  <span key={`b-${d}`} className="hero-direction-tag">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics">
        <Card variant="glass" padding="md" className="metrics__card">
          <div className="metric-value">
            {loading && !stats ? "…" : formatMetric(stats?.laboratories ?? 0)}
          </div>
          <div className="metric-label">{getMetricLabelLaboratories(stats?.laboratories ?? 0)}</div>
        </Card>
        <Card variant="glass" padding="md" className="metrics__card">
          <div className="metric-value">
            {loading && !stats ? "…" : formatMetric(stats?.vacancies ?? 0)}
          </div>
          <div className="metric-label">{getMetricLabelVacancies(stats?.vacancies ?? 0)}</div>
        </Card>
        <Card variant="glass" padding="md" className="metrics__card">
          <div className="metric-value">
            {loading && !stats ? "…" : formatMetric(stats?.responses ?? 0)}
          </div>
          <div className="metric-label">{getMetricLabelResponses(stats?.responses ?? 0)}</div>
        </Card>
      </section>

      {(loading || featuredOrgs.length > 0) && (
        <section id="orgs" className="section">
          <div className="section-header">
            <h2>Организации недели</h2>
            <p>Организации на платформе с лабораториями и вакансиями.</p>
          </div>
          {error && <p className="error">{error}</p>}
          {loading && !error && (
            <div className="org-cards-grid home-skeleton-grid" aria-busy="true" role="status" aria-label="Загрузка">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <HomeSkeletonCard key={i} type="org" />
              ))}
            </div>
          )}
          {!loading && !error && (
            <FeaturedCarousel
              items={featuredOrgs}
              renderCard={(org) => (
                <OrganizationCard
                  org={org}
                  onOpen={(id) => navigate(`/organizations/${id}`)}
                />
              )}
              ariaLabel="Организации недели"
              phaseIndex={0}
            />
          )}
        </section>
      )}

      {(loading || featuredLabs.length > 0) && (
        <section id="labs" className="section">
          <div className="section-header">
            <h2>Лаборатории недели</h2>
            <p>Лаборатории на платформе с открытыми позициями и задачами.</p>
          </div>
          {error && <p className="error">{error}</p>}
          {loading && !error && (
            <div className="org-cards-grid labs-skeleton-grid" aria-busy="true" role="status" aria-label="Загрузка">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <HomeSkeletonCard key={i} type="lab" />
              ))}
            </div>
          )}
          {!loading && !error && (
            <FeaturedCarousel
              items={featuredLabs}
              renderCard={(lab) => (
                <LabCard
                  lab={lab}
                  labImages={labImages}
                  onOpen={(id) => navigate(`/laboratories/${id}`)}
                  navigate={navigate}
                />
              )}
              ariaLabel="Лаборатории недели"
              phaseIndex={1}
            />
          )}
        </section>
      )}

      {(loading || featuredVacancies.length > 0) && (
        <section id="vacancies" className="section">
          <div className="section-header">
            <h2>Открытые вакансии</h2>
            <p>Новые роли из университетов, институтов и исследовательских стартапов.</p>
          </div>
          {error && <p className="error">{error}</p>}
          {loading && !error && (
            <div className="org-cards-grid home-skeleton-grid" aria-busy="true" role="status" aria-label="Загрузка">
              {[1, 2, 3, 4, 5].map((i) => (
                <HomeSkeletonCard key={i} type="org" />
              ))}
            </div>
          )}
          {!loading && !error && (
            <FeaturedCarousel
              items={featuredVacancies}
              renderCard={(vacancy) => (
                <VacancyCard
                  vacancy={vacancy}
                  onClick={() => vacancy.public_id && navigate(`/vacancies/${vacancy.public_id}`)}
                  onKeyDown={(e) => {
                    if (vacancy.public_id && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      navigate(`/vacancies/${vacancy.public_id}`);
                    }
                  }}
                />
              )}
              ariaLabel="Открытые вакансии"
              phaseIndex={2}
            />
          )}
        </section>
      )}

      <section className="section how-it-works-section">
        <div className="section-header">
          <h2>Как работает платформа</h2>
          <p>Синтезум объединяет ключевых участников научной экосистемы.</p>
        </div>
        <div className="hiw-grid">
          <div className="hiw-card">
            <div className="hiw-card__icon" aria-hidden="true"><Building2 size={32} /></div>
            <h3 className="hiw-card__title">Лаборатории и организации</h3>
            <p className="hiw-card__text">
              Публикуйте профили лабораторий, открытые позиции и исследовательские запросы.
              Привлекайте квалифицированных специалистов и управляйте профилем в личном кабинете.
            </p>
          </div>
          <div className="hiw-card">
            <div className="hiw-card__icon" aria-hidden="true"><FlaskConical size={32} /></div>
            <h3 className="hiw-card__title">Исследователи</h3>
            <p className="hiw-card__text">
              Находите лаборатории, соответствующие вашим научным интересам.
              Подавайте заявки на вступление в команды и развивайте исследовательскую карьеру.
            </p>
          </div>
          <div className="hiw-card">
            <div className="hiw-card__icon" aria-hidden="true"><GraduationCap size={32} /></div>
            <h3 className="hiw-card__title">Студенты</h3>
            <p className="hiw-card__text">
              Откликайтесь на вакансии и стажировки в ведущих лабораториях страны.
              Получите первый опыт в научной среде и найдите свою область исследований.
            </p>
          </div>
        </div>
      </section>

      <section className="section grant-section">
        <div className="grant-banner">
          <div className="grant-banner__logos">
            <div className="grant-banner__logo">
              <img
                src="/images/fasie.svg"
                alt="Фонд содействия инновациям"
                width="153"
                height="74"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="grant-banner__logo">
              <img
                src="/images/university-technology-entrepreneurship-platform.png"
                alt="Платформа университетского технологического предпринимательства"
                width="1888"
                height="1472"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
          <div className="grant-banner__body">
            <span className="grant-banner__eyebrow">При поддержке</span>
            <p className="grant-banner__text">
              Проект реализован при поддержке <strong>Фонда содействия инновациям</strong> в рамках
              программы «Студенческий стартап» мероприятия «Платформа университетского
              технологического предпринимательства» федерального проекта «Технологии».
            </p>
          </div>
        </div>
      </section>

      {!auth && (
        <section className="section section-cta">
          <Card variant="elevated" padding="lg" className="cta-card">
            <div className="cta__content">
              <h2 className="cta__title">Присоединяйтесь к платформе</h2>
              <p className="cta__text">
                Добавляйте лаборатории и вакансии, откликайтесь на позиции или найдите команду для своего проекта — для организаций, лабораторий, исследователей и студентов.
              </p>
            </div>
            <Button variant="primary" size="large" to="/login" className="cta__btn">
              Начать
            </Button>
          </Card>
        </section>
      )}
    </main>
  );
}
