import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Compass,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Network,
  Phone,
  Search,
  Send,
} from "lucide-react";
import UserAgreement from "../components/UserAgreement";

const PROJECT_BLOCKS = [
  {
    icon: Network,
    title: "Проблема, которую решаем",
    items: [
      "слабые горизонтальные связи между НИИ и предприятиями;",
      "отсутствие прозрачных инструментов для пути: студент → практика → трудоустройство.",
    ],
  },
  {
    icon: Search,
    title: "О продукте",
    text: "Результатом работы стала облачная платформа с каталогом организаций, интерактивной картой НИИ Троицка и формой поиска партнёров.",
  },
  {
    icon: Compass,
    title: "Текущий этап",
    items: [
      "пройден первый этап гранта «Студенческий стартап»;",
      "ведётся тестирование MVP модели.",
    ],
  },
];

const ROADMAP = [
  {
    period: "Июнь-июль 2026",
    text: "разработка финальной версии.",
  },
  {
    period: "Август-сентябрь 2026",
    text: "тестирование, исправление ошибок.",
  },
  {
    period: "Октябрь 2026",
    text: "закрытие гранта.",
  },
];

const SERVICE_ITEMS = [
  "ведение Telegram, ВК, Дзен, Max;",
  "создание научно-популярного и технического контента;",
  "дизайн карточек, инфографики;",
  "участие и организация в очных мероприятиях.",
];

export default function About() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
  }, [hash]);

  return (
    <main className="main privacy-page about-page">
      <div className="privacy-page__back">
        <Link to="/" className="privacy-page__back-link">
          <ArrowLeft size={18} aria-hidden />
          <span>На главную</span>
        </Link>
      </div>

      <div className="about-page__layout">
        <article className="privacy-page__content">
          <header className="privacy-page__header">
            <div className="privacy-page__header-icon">
              <Building2 size={40} aria-hidden />
            </div>
            <h1 className="privacy-page__title">О нас</h1>
            <p className="privacy-page__lead">
              Синтезум помогает выстраивать связи между наукой, образованием и технологическим бизнесом через
              цифровую платформу и понятный путь от практики до трудоустройства.
            </p>
          </header>

          <section className="about-page__grant-section">
            <h2 className="privacy-section__title">Поддержка проекта</h2>
            <div className="about-grant-banner">
              <div className="about-grant-banner__logo">
                <img
                  src="/images/fasie.svg"
                  alt="Фонд содействия инновациям"
                  loading="lazy"
                />
              </div>
              <div className="about-grant-banner__body">
                <p className="about-grant-banner__eyebrow">При поддержке</p>
                <p className="about-grant-banner__name">Фонд содействия инновациям</p>
                <p className="about-grant-banner__text">
                  Проект реализован при поддержке <strong>Фонда содействия инновациям</strong> в рамках
                  программы <strong>«Студенческий стартап»</strong> мероприятия «Платформа университетского
                  технологического предпринимательства» федерального проекта «Технологии».
                </p>
              </div>
            </div>
          </section>

          <div className="privacy-page__body">
            <section className="privacy-section">
              <h2 className="privacy-section__title">О проекте</h2>
              <div className="about-page__story-list">
                {PROJECT_BLOCKS.map(({ icon: Icon, title, text, items }) => (
                  <div key={title} className="about-page__story-item">
                    <div className="about-page__story-icon" aria-hidden>
                      <Icon size={22} />
                    </div>
                    <div className="about-page__story-body">
                      <h3 className="about-page__story-title">{title}</h3>
                      {text ? <p>{text}</p> : null}
                      {items ? (
                        <ul>
                          {items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section__title">Дорожная карта</h2>
              <div className="about-page__timeline" aria-label="Дорожная карта проекта">
                {ROADMAP.map(({ period, text }) => (
                  <div key={period} className="about-page__timeline-item">
                    <div className="about-page__timeline-icon" aria-hidden>
                      <CalendarRange size={18} />
                    </div>
                    <div className="about-page__timeline-body">
                      <p className="about-page__timeline-period">{period}</p>
                      <p className="about-page__timeline-text">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section__title">Дополнительные услуги</h2>
              <div className="about-page__service-intro">
                <div className="about-page__story-icon" aria-hidden>
                  <Megaphone size={22} />
                </div>
                <div className="about-page__story-body">
                  <h3 className="about-page__story-title">Научный SMM-менеджмент</h3>
                  <p>
                    Помогаем наукоёмким и технологическим организациям выстраивать цифровое присутствие и усиливать
                    экспертный бренд. Комбинируем техническую точность, понятный язык и визуальный стиль, который
                    уважает специфику отрасли.
                  </p>
                  <p>
                    Формируем контент, который объясняет сложное, привлекает клиентов и повышает доверие к бренду.
                  </p>
                </div>
              </div>
              <h3 className="about-page__subheading">Что входит</h3>
              <ul className="about-page__service-list">
                {SERVICE_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="about-page__service-note">
                Объём, формат работ и цена обсуждаются индивидуально.
              </p>
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section__title">Контакты</h2>
              <div className="about-page__contacts">
                <p className="about-page__contact-row">
                  <MapPin size={18} aria-hidden className="about-page__contact-icon" />
                  <span>Москва, Борисовские пруды, 14к4, 34</span>
                </p>
                <p className="about-page__contact-row">
                  <Phone size={18} aria-hidden className="about-page__contact-icon" />
                  <a href="tel:+79299873125" className="privacy-page__link">+7 929 987-31-25</a>
                </p>
                <p className="about-page__contact-row">
                  <Mail size={18} aria-hidden className="about-page__contact-icon" />
                  <a href="mailto:info@sintezum.ru" className="privacy-page__link">info@sintezum.ru</a>
                </p>
                <p className="about-page__contact-row">
                  <Send size={18} aria-hidden className="about-page__contact-icon" />
                  <a href="https://t.me/sergiomash" className="privacy-page__link" target="_blank" rel="noreferrer">
                    Telegram: @sergiomash
                  </a>
                </p>
                <p className="about-page__contact-row">
                  <MessageCircle size={18} aria-hidden className="about-page__contact-icon" />
                  <a href="https://vk.me/smm_sergeimir" className="privacy-page__link" target="_blank" rel="noreferrer">
                    ВКонтакте: vk.me/smm_sergeimir
                  </a>
                </p>
              </div>
            </section>
          </div>

          <UserAgreement />

          <footer className="privacy-page__footer">
            <Link to="/" className="privacy-page__cta">
              Вернуться на главную
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
