import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Image,
  Users,
  Wrench,
  ClipboardCheck,
  HelpCircle,
  Briefcase,
  FileText,
  User,
  Sliders,
  Calendar,
  Award,
  Wallet,
  CalendarClock,
  Beaker,
} from "lucide-react";
import { apiRequest } from "../api/client";
import { useLabSearch } from "../hooks";
import EmployeeModal from "./profile/EmployeeModal";
import GalleryModal from "./profile/GalleryModal";
import {
  LabCard,
  LabFilters,
  LabDetailHero,
  LabDetailSidebar,
  LabSection,
  LabDetailCard,
  LabGalleryGrid,
} from "../components/lab";
import { OrgDetailCardBlock } from "../components/organization";
import { ListingSearchBar } from "../components/listing";
import { Drawer, Button, Card, Badge } from "../components/ui";
import { EmployeeCard } from "../components/EmployeeCard";
import EquipmentModal from "./profile/EquipmentModal";
import EmptySearchFallback from "../components/EmptySearchFallback";
import NewEntityBadge from "../components/NewEntityBadge";

const LABORATORIES_PAGE_SIZE = 20;

export default function Laboratories() {
  const search = useLabSearch(apiRequest);
  const [laboratories, setLaboratories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [organizationId, setOrganizationId] = useState("");
  const [withoutOrg, setWithoutOrg] = useState(false);
  const [minEmployees, setMinEmployees] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [sortBy, setSortBy] = useState("date_desc");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [gallery, setGallery] = useState({ open: false, images: [], index: 0 });
  const [galleryZoom, setGalleryZoom] = useState(1);
  const [employeePreview, setEmployeePreview] = useState(null);
  const [equipmentPreview, setEquipmentPreview] = useState(null);
  const [showEmployeePublications, setShowEmployeePublications] = useState(false);
  const [emptySuggestions, setEmptySuggestions] = useState([]);
  const [emptySuggestionsLoading, setEmptySuggestionsLoading] = useState(false);
  const { publicId } = useParams();
  const navigate = useNavigate();
  const selectedId = useMemo(() => (publicId ? String(publicId) : null), [publicId]);

  useEffect(() => {
    async function loadOrganizations() {
      try {
        const data = await apiRequest("/labs/");
        setOrganizations(data?.items ?? (Array.isArray(data) ? data : []));
      } catch {
        // ignore
      }
    }
    loadOrganizations();
  }, []);

  const hasFilters = search.searchDebounced || organizationId || withoutOrg || (minEmployees !== "" && Number(minEmployees) > 0);

  useEffect(() => {
    setPage(1);
  }, [search.searchDebounced, organizationId, withoutOrg, minEmployees, sortBy]);

  useEffect(() => {
    if (selectedId) search.hideSuggestions();
  }, [selectedId, search.hideSuggestions]);

  const handleResetFilters = useCallback(() => {
    search.setSearchQuery("");
    setOrganizationId("");
    setWithoutOrg(false);
    setMinEmployees("");
    setPage(1);
    search.hideSuggestions();
  }, [search.setSearchQuery, search.hideSuggestions]);

  useEffect(() => {
    if (!hasFilters || laboratories.length > 0 || loading) {
      setEmptySuggestions([]);
      setEmptySuggestionsLoading(false);
      return;
    }
    let cancelled = false;
    setEmptySuggestionsLoading(true);
    (async () => {
      try {
        const data = await apiRequest(
          `/home/empty-suggestions?type=laboratories&limit=12`
        );
        if (!cancelled) {
          setEmptySuggestions(data?.items ?? []);
        }
      } catch {
        if (!cancelled) setEmptySuggestions([]);
      } finally {
        if (!cancelled) setEmptySuggestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasFilters, laboratories.length, loading]);

  useEffect(() => {
    async function loadLaboratories() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("size", String(LABORATORIES_PAGE_SIZE));
        if (search.searchDebounced) params.set("q", search.searchDebounced);
        if (organizationId) params.set("organization_id", organizationId);
        if (withoutOrg) params.set("without_org", "true");
        const minEmp = minEmployees !== "" ? Number(minEmployees) : null;
        if (minEmp != null && minEmp > 0) params.set("min_employees", String(minEmp));
        if (sortBy) params.set("sort_by", sortBy);
        const data = await apiRequest(`/laboratories/?${params.toString()}`);
        const items = data?.items || [];
        setLaboratories(items);
        setTotal(data?.total ?? items.length);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadLaboratories();
  }, [hasFilters, search.searchDebounced, organizationId, withoutOrg, minEmployees, page, sortBy]);

  useEffect(() => {
    async function loadDetails() {
      if (!selectedId) {
        setDetails(null);
        setLoadingDetails(false);
        return;
      }
      try {
        setLoadingDetails(true);
        setError(null);
        const labDetails = await apiRequest(`/laboratories/public/${selectedId}/details`);
        setDetails(labDetails);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingDetails(false);
      }
    }
    loadDetails();
  }, [selectedId]);

  const openLaboratory = (publicIdValue) => {
    navigate(`/laboratories/${publicIdValue}`);
  };

  const goBack = () => {
    setError(null);
    navigate(-1);
  };

  const openQuery = (publicIdValue) => {
    if (!publicIdValue) return;
    navigate(`/queries/${publicIdValue}`);
  };

  const openVacancy = (publicIdValue) => {
    if (!publicIdValue) return;
    navigate(`/vacancies/${publicIdValue}`);
  };

  const openGallery = (images, index = 0) => {
    if (!images || images.length === 0) return;
    setGallery({ open: true, images, index });
    setGalleryZoom(1);
  };

  const closeGallery = () => {
    setGallery({ open: false, images: [], index: 0 });
    setGalleryZoom(1);
  };

  const showPrev = () => {
    setGallery((prev) => ({
      ...prev,
      index: (prev.index - 1 + prev.images.length) % prev.images.length,
    }));
  };

  const showNext = () => {
    setGallery((prev) => ({
      ...prev,
      index: (prev.index + 1) % prev.images.length,
    }));
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const zoomBy = (delta) => {
    setGalleryZoom((prev) => {
      const next = Number((prev + delta).toFixed(2));
      return clamp(next, 1, 3);
    });
  };

  const toggleZoom = () => {
    setGalleryZoom((prev) => (prev > 1 ? 1 : 1.6));
  };

  const handleGalleryWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.1 : 0.1);
  };

  useEffect(() => {
    if (!gallery.open) return;
    const onKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        showNext();
      } else if (event.key === "ArrowLeft") {
        showPrev();
      } else if (event.key === "Escape") {
        closeGallery();
      } else if (event.key === "+" || event.key === "=") {
        zoomBy(0.1);
      } else if (event.key === "-" || event.key === "_") {
        zoomBy(-0.1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gallery.open]);

  const splitMedia = (urls) => {
    const list = Array.isArray(urls) ? urls : [];
    const images = [];
    const docs = [];
    list.forEach((url) => {
      if (!url) return;
      const clean = url.split("?")[0].toLowerCase();
      if (clean.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/)) {
        images.push(url);
      } else {
        docs.push(url);
      }
    });
    return { images, docs };
  };

  const fileNameFromUrl = (url) => {
    try {
      const withoutQuery = url.split("?")[0];
      const parts = withoutQuery.split("/");
      return decodeURIComponent(parts[parts.length - 1]);
    } catch {
      return url;
    }
  };

  const labImages = (urls) => splitMedia(urls || []).images;

  const listImages = labImages(details?.image_urls ?? []);

  const getLabFilterCount = () =>
    [search.searchDebounced, organizationId, withoutOrg, minEmployees && Number(minEmployees) > 0].filter(Boolean).length;

  const handleSearchKeyDown = (e) => {
    if (!search.suggestionsVisible || search.suggestions.length === 0) return;
    if (e.key === "Escape") {
      e.preventDefault();
      search.hideSuggestions();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      search.setHighlightedIndex((i) => (i < search.suggestions.length - 1 ? i + 1 : -1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      search.setHighlightedIndex((i) => (i <= 0 ? -1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (search.highlightedIndex >= 0 && search.suggestions[search.highlightedIndex]) {
        e.preventDefault();
        search.applySuggestion(search.suggestions[search.highlightedIndex]);
      } else {
        search.hideSuggestions();
      }
    }
  };

  return (
    <main className="main lab-page">
      <section className="section" aria-label={selectedId ? "Детали лаборатории" : "Список лабораторий"}>
        {!selectedId && (
          <div className="listing-page">
            <h1 className="listing-page__title">Лаборатории</h1>
            <div className="listing-page__grid">
              <aside className="listing-page__sidebar">
                <LabFilters
                  organizationId={organizationId}
                  onOrganizationChange={setOrganizationId}
                  withoutOrg={withoutOrg}
                  onWithoutOrgChange={setWithoutOrg}
                  minEmployees={minEmployees}
                  onMinEmployeesChange={setMinEmployees}
                  organizations={organizations}
                  hasFilters={hasFilters}
                  onResetFilters={handleResetFilters}
                />
              </aside>
              <div className="listing-page__content">
                <div className="listing-page__toolbar">
                  <ListingSearchBar
                    searchQuery={search.searchQuery}
                    onSearchChange={search.setSearchQuery}
                    loading={loading}
                    suggestions={search.suggestions}
                    suggestionsLoading={search.suggestionsLoading}
                    suggestionsVisible={search.suggestionsVisible}
                    highlightedIndex={search.highlightedIndex}
                    onSuggestionMouseEnter={search.setHighlightedIndex}
                    onSuggestionClick={search.applySuggestion}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => search.searchQuery.trim().length >= 2 && search.setSuggestionsVisible(true)}
                    searchInputRef={search.searchInputRef}
                    searchWrapRef={search.searchWrapRef}
                    onClear={() => search.setSearchQuery("")}
                    suggestionApplied={search.suggestionApplied}
                    placeholder="Название, описание, сотрудники, оборудование, организация…"
                    ariaLabel="Поиск по лабораториям"
                    suggestionsId="lab-suggestions-list"
                    dataSuggestionsAttr="data-lab-suggestions"
                  />
                  <select
                    className="listing-page__sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Сортировка по дате"
                  >
                    <option value="date_desc">Сначала новые</option>
                    <option value="date_asc">Сначала старые</option>
                  </select>
                  <button
                    type="button"
                    className="listing-page__filters-toggle"
                    onClick={() => setFiltersDrawerOpen(true)}
                    aria-label="Открыть фильтры"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    Фильтры
                    {getLabFilterCount() > 0 && (
                      <span className="listing-page__filters-badge">{getLabFilterCount()}</span>
                    )}
                  </button>
                </div>

                {loading && (
                  <div className="listing-page__skeleton" aria-busy="true" role="status" aria-label="Загрузка">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="listing-card-skeleton lab-card-skeleton">
                        <div className="skeleton" style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 8 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="skeleton" style={{ height: "1.25rem", width: "70%" }} />
                          <div className="skeleton" style={{ height: "0.875rem", width: "50%", marginTop: "0.5rem" }} />
                          <div className="skeleton" style={{ height: "0.875rem", width: "100%", marginTop: "0.75rem" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {error && !loading && <p className="listing-page__error error">{error}</p>}

                {!loading && !error && (
                  <>
                    <div className="listing-page__list listing-page__list--grid">
                      {laboratories.length === 0 ? (
                        hasFilters ? (
                          <div className="listing-page__empty">
                            <EmptySearchFallback
                              entityLabel="лаборатории"
                              items={emptySuggestions}
                              loading={emptySuggestionsLoading}
                              onResetFilters={handleResetFilters}
                              renderCard={(lab) => (
                                <LabCard
                                  key={lab.id}
                                  lab={lab}
                                  labImages={labImages}
                                  onOpen={openLaboratory}
                                  navigate={navigate}
                                />
                              )}
                            />
                          </div>
                        ) : (
                          <div className="listing-page__empty listing-page__empty--no-results">
                            <p className="listing-page__empty-text">Публичные лаборатории пока не добавлены.</p>
                            <p className="listing-page__empty-hint">
                              Организации и представители лабораторий могут добавлять лаборатории в разделе «Профиль».
                            </p>
                          </div>
                        )
                      ) : (
                        laboratories.map((lab) => (
                          <LabCard
                            key={lab.id}
                            lab={lab}
                            labImages={labImages}
                            onOpen={openLaboratory}
                            navigate={navigate}
                          />
                        ))
                      )}
                    </div>

                    {total > LABORATORIES_PAGE_SIZE && (
                      <div className="listing-page__pagination">
                        <span className="listing-page__pagination-info">
                          Показано {(page - 1) * LABORATORIES_PAGE_SIZE + 1}–
                          {Math.min(page * LABORATORIES_PAGE_SIZE, total)} из {total}
                        </span>
                        <div className="listing-page__pagination-buttons">
                          <Button
                            variant="ghost"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            Назад
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={page * LABORATORIES_PAGE_SIZE >= total}
                            onClick={() => setPage((p) => p + 1)}
                          >
                            Вперёд
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <Drawer
              isOpen={filtersDrawerOpen}
              onClose={() => setFiltersDrawerOpen(false)}
              title="Фильтры лабораторий"
            >
              <LabFilters
                organizationId={organizationId}
                onOrganizationChange={setOrganizationId}
                withoutOrg={withoutOrg}
                onWithoutOrgChange={setWithoutOrg}
                minEmployees={minEmployees}
                onMinEmployeesChange={setMinEmployees}
                organizations={organizations}
                hasFilters={hasFilters}
                onResetFilters={() => {
                  handleResetFilters();
                  setFiltersDrawerOpen(false);
                }}
              />
            </Drawer>
          </div>
        )}
        {selectedId && (
          <div className="org-details-page" aria-busy={loadingDetails}>
            {!details && loadingDetails && (
              <div className="lab-page__detail-skeleton" role="status" aria-label="Загрузка деталей">
                <div className="lab-skeleton lab-skeleton--back" />
                <div className="lab-skeleton lab-skeleton--hero" />
              </div>
            )}
            {!details && !loadingDetails && error && (
              <div className="org-detail-error">
                <button className="org-detail-back" onClick={goBack} type="button">
                  ← Назад
                </button>
                <div className="org-detail-error-banner" role="alert">
                  {error}
                </div>
              </div>
            )}
            {details && (
              <div className="detail-page">
                <button className="org-detail-back" onClick={goBack} type="button">
                  ← Назад
                </button>
                <LabDetailHero
                  details={details}
                  labImages={labImages}
                  onOrgClick={(id) => navigate(`/organizations/${id}`)}
                  onHeadClick={(head) => {
                    const emp = details.employees.find((e) => e.id === head.id);
                    if (emp) {
                      setEmployeePreview(emp);
                      setShowEmployeePublications(false);
                    }
                  }}
                />
                <div className="detail-page__layout">
                  <div className="detail-page__main">
                    {listImages.length > 0 && (
                      <LabSection
                        title="Фотографии"
                        icon={<Image size={20} />}
                        badge={listImages.length}
                        empty={false}
                      >
                        <LabGalleryGrid
                          images={listImages}
                          onImageClick={(index) => openGallery(listImages, index)}
                        />
                      </LabSection>
                    )}
                    <LabSection
                      title="Сотрудники"
                      icon={<Users size={20} />}
                      badge={details.employees.length}
                      emptyMessage="Сотрудники не добавлены."
                      empty={details.employees.length === 0}
                    >
                      <div className="org-detail-grid org-detail-grid--employees">
                        {details.employees.map((employee) => (
                          <EmployeeCard
                            key={employee.id}
                            employee={employee}
                            onClick={() => {
                              setEmployeePreview(employee);
                              setShowEmployeePublications(false);
                            }}
                          />
                        ))}
                      </div>
                    </LabSection>
                    <LabSection
                      title="Оборудование"
                      icon={<Wrench size={20} />}
                      badge={details.equipment.length}
                      emptyMessage="Оборудование не добавлено."
                      empty={details.equipment.length === 0}
                    >
                      <div className="org-detail-grid">
                    {details.equipment.map((item) => {
                      const itemImages = labImages(item.image_urls);
                      return (
                        <LabDetailCard
                          key={item.id}
                          media={itemImages[0]}
                          mediaBadge={itemImages.length > 1 ? itemImages.length - 1 : 0}
                          clickable
                          variant="equipment"
                          onClick={() => setEquipmentPreview(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setEquipmentPreview(item);
                            }
                          }}
                        >
                          <div className="entity-title-with-badge">
                            <h3 className="org-detail-card__title">{item.name}</h3>
                            <NewEntityBadge createdAt={item.created_at} />
                          </div>
                          {item.characteristics && (
                            <OrgDetailCardBlock icon={Sliders} label="Характеристики">
                              <p className="org-detail-card__text" style={{ fontWeight: 500, color: 'var(--text-primary-alt)' }}>
                                {item.characteristics}
                              </p>
                            </OrgDetailCardBlock>
                          )}
                          {item.description && (
                            <OrgDetailCardBlock icon={FileText} label="Описание">
                              <p className="org-detail-card__text org-detail-card__text--truncated">
                                {item.description}
                              </p>
                            </OrgDetailCardBlock>
                          )}
                          <span className="org-detail-card__cta">Подробнее →</span>
                        </LabDetailCard>
                      );
                    })}
                      </div>
                    </LabSection>
                    <LabSection
                      title="Решённые задачи"
                      icon={<ClipboardCheck size={20} />}
                      badge={(details.task_solutions || []).length}
                      emptyMessage="Решённые задачи не добавлены."
                      empty={(details.task_solutions || []).length === 0}
                    >
                      <div className="org-detail-grid">
                    {(details.task_solutions || []).map((task) => (
                      <LabDetailCard key={task.id} variant="task">
                        <div className="entity-title-with-badge">
                          <h3 className="org-detail-card__title">{task.title}</h3>
                          <NewEntityBadge createdAt={task.created_at} />
                        </div>
                        {(task.task_description || task.solution_description) && (
                          <OrgDetailCardBlock icon={FileText} label="Описание">
                            <p className="org-detail-card__text" title={task.task_description || task.solution_description}>
                              {(task.task_description || task.solution_description || "").length > 160
                                ? `${(task.task_description || task.solution_description || "").slice(0, 160)}…`
                                : (task.task_description || task.solution_description || "")}
                            </p>
                          </OrgDetailCardBlock>
                        )}
                        <div className="org-detail-card__meta-grid">
                          {task.solution_deadline && (
                            <OrgDetailCardBlock icon={Calendar} label="Сроки" value={task.solution_deadline} />
                          )}
                          {task.grant_info && (
                            <OrgDetailCardBlock icon={Award} label="Грант" value={task.grant_info} />
                          )}
                          {task.cost && (
                            <OrgDetailCardBlock icon={Wallet} label="Стоимость" value={task.cost} />
                          )}
                        </div>
                        {(task.laboratories || []).length > 0 && (
                          <OrgDetailCardBlock icon={Beaker} label="Лаборатории">
                            <div className="org-detail-card__chips">
                              {(task.laboratories || []).slice(0, 2).map((lab) => (
                                <span key={lab.id} className="org-detail-chip">{lab.name}</span>
                              ))}
                              {(task.laboratories || []).length > 2 && (
                                <span className="org-detail-chip">+{(task.laboratories || []).length - 2}</span>
                              )}
                            </div>
                          </OrgDetailCardBlock>
                        )}
                      </LabDetailCard>
                    ))}
                      </div>
                    </LabSection>
                    <LabSection
                      title="Запросы"
                      icon={<HelpCircle size={20} />}
                      badge={(details.queries || []).length}
                      emptyMessage="Запросы не добавлены."
                      empty={(details.queries || []).length === 0}
                    >
                      <div className="org-detail-grid">
                    {(details.queries || []).map((query) => (
                      <LabDetailCard
                        key={query.id}
                        clickable={!!query.public_id}
                        variant="query"
                        onClick={() => query.public_id && openQuery(query.public_id)}
                        onKeyDown={(e) => {
                          if (query.public_id && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            openQuery(query.public_id);
                          }
                        }}
                      >
                        <div className="entity-title-with-badge">
                          <h3 className="org-detail-card__title">{query.title}</h3>
                          <NewEntityBadge createdAt={query.created_at} />
                        </div>
                        {query.status && (
                          <OrgDetailCardBlock icon={HelpCircle} label="Статус">
                            <span className="org-detail-chip org-detail-chip--status">
                              {query.status === "active" && "Активный"}
                              {query.status === "paused" && "На паузе"}
                              {query.status === "closed" && "Закрыт"}
                            </span>
                          </OrgDetailCardBlock>
                        )}
                        {query.task_description && (
                          <OrgDetailCardBlock icon={FileText} label="Описание">
                            <p className="org-detail-card__text org-detail-card__text--truncated" title={query.task_description}>
                              {query.task_description}
                            </p>
                          </OrgDetailCardBlock>
                        )}
                        <div className="org-detail-card__meta-grid">
                          {query.budget && (
                            <OrgDetailCardBlock icon={Wallet} label="Бюджет" value={query.budget} />
                          )}
                          {query.deadline && (
                            <OrgDetailCardBlock icon={CalendarClock} label="Дедлайн" value={query.deadline} />
                          )}
                        </div>
                        {(query.employees || []).length > 0 && (
                          <div className="org-detail-card__chips">
                            {(query.employees || []).slice(0, 2).map((emp) => (
                              <span key={emp.id} className="org-detail-chip">{emp.full_name}</span>
                            ))}
                            {(query.employees || []).length > 2 && (
                              <span className="org-detail-chip">+{(query.employees || []).length - 2}</span>
                            )}
                          </div>
                        )}
                        {query.public_id && (
                          <span className="org-detail-card__cta">Открыть запрос →</span>
                        )}
                      </LabDetailCard>
                    ))}
                      </div>
                    </LabSection>
                    <LabSection
                      title="Вакансии"
                      icon={<Briefcase size={20} />}
                      badge={(details.vacancies || []).length}
                      emptyMessage="Вакансии не добавлены."
                      empty={(details.vacancies || []).length === 0}
                    >
                      <div className="org-detail-grid">
                    {(details.vacancies || []).map((vacancy) => (
                      <LabDetailCard key={vacancy.id} variant="vacancy">
                        <div className="entity-title-with-badge">
                          <h3 className="org-detail-card__title">{vacancy.name}</h3>
                          <NewEntityBadge createdAt={vacancy.created_at} />
                        </div>
                        {vacancy.employment_type && (
                          <OrgDetailCardBlock icon={Briefcase} label="Тип занятости">
                            <span className="org-detail-chip org-detail-chip--status">
                              {vacancy.employment_type}
                            </span>
                          </OrgDetailCardBlock>
                        )}
                        {vacancy.description && (
                          <OrgDetailCardBlock icon={FileText} label="Описание">
                            <p className="org-detail-card__text org-detail-card__text--truncated">
                              {vacancy.description}
                            </p>
                          </OrgDetailCardBlock>
                        )}
                        {vacancy.contact_employee && (
                          <div className="org-detail-card__meta-grid">
                            <OrgDetailCardBlock icon={User} label="Контакт" value={vacancy.contact_employee.full_name} />
                          </div>
                        )}
                        {vacancy.public_id && (
                          <button
                            className="org-detail-card__cta"
                            type="button"
                            onClick={() => openVacancy(vacancy.public_id)}
                          >
                            Открыть вакансию →
                          </button>
                        )}
                      </LabDetailCard>
                    ))}
                      </div>
                    </LabSection>
                    {splitMedia(details.image_urls).docs.length > 0 && (
                      <LabSection title="Документы" icon={<FileText size={20} />} empty={false}>
                        <div className="org-detail-card__files org-detail-card__files--block">
                          {splitMedia(details.image_urls).docs.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              {fileNameFromUrl(url)}
                            </a>
                          ))}
                        </div>
                      </LabSection>
                    )}
                  </div>
                  <aside className="detail-page__sidebar">
                    <LabDetailSidebar
                      details={details}
                      onHeadClick={(head) => {
                        const emp = details.employees.find((e) => e.id === head.id);
                        if (emp) {
                          setEmployeePreview(emp);
                          setShowEmployeePublications(false);
                        }
                      }}
                      onOrgClick={(id) => navigate(`/organizations/${id}`)}
                    />
                  </aside>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      <GalleryModal
        gallery={gallery}
        galleryZoom={galleryZoom}
        closeGallery={closeGallery}
        showPrev={showPrev}
        showNext={showNext}
        handleGalleryWheel={handleGalleryWheel}
        toggleZoom={toggleZoom}
      />
      <EmployeeModal
        employeePreview={employeePreview}
        showEmployeePublications={showEmployeePublications}
        setShowEmployeePublications={setShowEmployeePublications}
        closeEmployeePreview={() => {
          setEmployeePreview(null);
          setShowEmployeePublications(false);
        }}
      />
      <EquipmentModal
        equipment={equipmentPreview}
        onClose={() => setEquipmentPreview(null)}
        openGallery={openGallery}
      />
    </main>
  );
}
