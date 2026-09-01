import React, { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import GlobalSearch from "../GlobalSearch";
import NotificationsDropdown from "../NotificationsDropdown";
import CookieBanner from "../CookieBanner";
import ReleaseBanner from "../ReleaseBanner";
import FeedbackWidget from "../FeedbackWidget";

const navLinkClass = ({ isActive }) =>
  `nav-link${isActive ? " nav-link--active" : ""}`;

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function MainLayout() {
  const { auth, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const closeSearch = () => setSearchOpen(false);

  useEffect(() => {
    if (menuOpen) {
      const scrollY = window.scrollY;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty("--scroll-y", String(scrollY));
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.classList.add("nav-open");
      const handleResize = () => {
        if (window.innerWidth > 768) setMenuOpen(false);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        document.body.classList.remove("nav-open");
        document.body.style.removeProperty("--scroll-y");
        document.body.style.removeProperty("padding-right");
        window.removeEventListener("resize", handleResize);
        window.scrollTo(0, scrollY);
      };
    }
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeSearch();
    };
    if (searchOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [searchOpen]);

  const showApplicants =
    auth?.user?.role_name === "lab_admin" ||
    auth?.user?.role_name === "lab_representative" ||
    auth?.user?.role_name === "platform_admin";
  const showAdmin = auth?.user?.role_name === "platform_admin";

  return (
    <div className="main-layout">
      <header className="main-layout__header">
        <div className="header__inner">
          <Link className="logo" to="/" onClick={closeMenu}>
            Синтезум
          </Link>

          <div className="header__search header__search--desktop">
            <GlobalSearch />
          </div>

          <button
            type="button"
            className="header__search-toggle header__search-toggle--mobile"
            aria-label="Поиск"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon />
          </button>

          <div className="header__right">
            <nav className="nav" aria-label="Основное меню">
              <NavLink className={navLinkClass} to="/organizations" end={false}>
                Организации
              </NavLink>
              <NavLink className={navLinkClass} to="/laboratories" end={false}>
                Лаборатории
              </NavLink>
              <NavLink className={navLinkClass} to="/queries" end={false}>
                Запросы
              </NavLink>
              <NavLink className={navLinkClass} to="/vacancies" end={false}>
                Вакансии
              </NavLink>
              {showApplicants && (
                <NavLink className={navLinkClass} to="/applicants" end={false}>
                  Соискатели
                </NavLink>
              )}
              {showAdmin && (
                <NavLink className={navLinkClass} to="/admin" end={true}>
                  Админ
                </NavLink>
              )}
              <NavLink className={navLinkClass} to="/news" end={false}>
                Новости
              </NavLink>
              <NavLink className={navLinkClass} to="/" end={true}>
                Главная
              </NavLink>
              {auth ? (
                <div className="nav__user">
                  <NotificationsDropdown />
                  <NavLink className={navLinkClass} to="/profile">
                    Профиль
                  </NavLink>
                  <button
                    className="nav-cta nav-cta--ghost"
                    onClick={logout}
                    type="button"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `nav-cta primary-btn nav-link${isActive ? " nav-link--active" : ""}`
                  }
                >
                  Войти
                </NavLink>
              )}
            </nav>
            <div className="nav-mobile-actions">
              {auth && (
                <div className="nav-mobile-notifications">
                  <NotificationsDropdown />
                </div>
              )}
              <button
                type="button"
                className="nav-burger"
                aria-expanded={menuOpen}
                aria-controls="nav-drawer"
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="nav-burger__line" />
                <span className="nav-burger__line" />
                <span className="nav-burger__line" />
              </button>
            </div>
          </div>
        </div>

        <div
          id="nav-drawer"
          className={`nav-drawer ${menuOpen ? "nav-drawer--open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div
            className="nav-drawer__backdrop"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div className="nav-drawer__panel">
            <div className="nav-drawer__header">
              <div className="nav-drawer__brand">Синтезум</div>
              <button
                type="button"
                className="nav-drawer__close"
                onClick={closeMenu}
                aria-label="Закрыть меню"
              >
                ×
              </button>
            </div>
            <div className="nav-drawer__links">
              <NavLink
                className={navLinkClass}
                to="/"
                end={true}
                onClick={closeMenu}
              >
                Главная
              </NavLink>
              <NavLink
                className={navLinkClass}
                to="/news"
                end={false}
                onClick={closeMenu}
              >
                Новости
              </NavLink>
              <NavLink
                className={navLinkClass}
                to="/organizations"
                end={false}
                onClick={closeMenu}
              >
                Организации
              </NavLink>
              <NavLink
                className={navLinkClass}
                to="/laboratories"
                end={false}
                onClick={closeMenu}
              >
                Лаборатории
              </NavLink>
              <NavLink
                className={navLinkClass}
                to="/queries"
                end={false}
                onClick={closeMenu}
              >
                Запросы
              </NavLink>
              <NavLink
                className={navLinkClass}
                to="/vacancies"
                end={false}
                onClick={closeMenu}
              >
                Вакансии
              </NavLink>
              {showApplicants && (
                <NavLink
                  className={navLinkClass}
                  to="/applicants"
                  end={false}
                  onClick={closeMenu}
                >
                  Соискатели
                </NavLink>
              )}
              {showAdmin && (
                <NavLink
                  className={navLinkClass}
                  to="/admin"
                  end={true}
                  onClick={closeMenu}
                >
                  Админ
                </NavLink>
              )}
              {auth ? (
                <div className="nav-drawer__user">
                  <NavLink
                    className={navLinkClass}
                    to="/profile"
                    onClick={closeMenu}
                  >
                    Профиль
                  </NavLink>
                  <button
                    className="nav-cta nav-cta--ghost nav-drawer__cta"
                    onClick={() => {
                      closeMenu();
                      logout();
                    }}
                    type="button"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `primary-btn nav-drawer__cta${isActive ? " nav-link--active" : ""}`
                  }
                >
                  Войти
                </NavLink>
              )}
            </div>
          </div>
        </div>

        {searchOpen && (
          <div
            className="search-overlay"
            onClick={closeSearch}
            aria-hidden="false"
            role="dialog"
            aria-modal="true"
            aria-label="Поиск"
          >
            <div
              className="search-overlay__content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="search-overlay__header">
                <GlobalSearch />
                <button
                  type="button"
                  className="search-overlay__close"
                  onClick={closeSearch}
                  aria-label="Закрыть поиск"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="main-layout__main">
        <Outlet />
      </main>

      <footer className="main-layout__footer">
        <NavLink
          className={({ isActive }) =>
            `main-layout__footer-link${isActive ? " main-layout__footer-link--active" : ""}`
          }
          to="/privacy"
        >
          Политика конфиденциальности
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `main-layout__footer-link${isActive ? " main-layout__footer-link--active" : ""}`
          }
          to="/about"
        >
          О нас
        </NavLink>
        <FeedbackWidget className="main-layout__footer-link feedback-footer-trigger" />
        <span className="main-layout__footer-copy">© 2026 Синтезум</span>
      </footer>

      <CookieBanner />
      <ReleaseBanner />
    </div>
  );
}
