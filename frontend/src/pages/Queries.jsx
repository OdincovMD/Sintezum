import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ClipboardList,
  ClipboardCheck,
  Beaker,
  Users,
  Briefcase,
  FileText,
  Layers,
  Calendar,
  Award,
  Wallet,
  User,
} from "lucide-react";
import { apiRequest } from "../api/client";
import { useQuerySearch } from "../hooks";
import EmployeeModal from "./profile/EmployeeModal";
import EmptySearchFallback from "../components/EmptySearchFallback";
import { QueryCard, QueryFilters, QuerySearchBar, QueryDetailSidebar, QueryDetailHero } from "../components/queries";
import { OrganizationSection, OrganizationDetailCard, OrgDetailCardBlock } from "../components/organization";
import { Drawer, Button, Card, Badge } from "../components/ui";
import { EmployeeCard } from "../components/EmployeeCard";
import NewEntityBadge from "../components/NewEntityBadge";

export default function Queries() {
  const navigate = useNavigate();
  const { publicId } = useParams();
  const selectedId = useMemo(() => (publicId ? String(publicId) : null), [publicId]);

  const search = useQuerySearch(apiRequest);

  const [queries, setQueries] = useState([]);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [employeePreview, setEmployeePreview] = useState(null);
  const [showEmployeePublications, setShowEmployeePublications] = useState(false);
  const [status, setStatus] = useState("");
  const [laboratoryId, setLaboratoryId] = useState("");
  const [budgetContains, setBudgetContains] = useState("");
  const [budgetDebounced, setBudgetDebounced] = useState("");
  const [laboratories, setLaboratories] = useState([]);
  const [sortBy, setSortBy] = useState("date_desc");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [emptySuggestions, setEmptySuggestions] = useState([]);
  const [emptySuggestionsLoading, setEmptySuggestionsLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBudgetDebounced(budgetContains.trim()), 350);
    return () => clearTimeout(t);
  }, [budgetContains]);

  useEffect(() => {
    async function loadLaboratories() {
      try {
        const data = await apiRequest("/laboratories/");
        setLaboratories(data?.items ?? (Array.isArray(data) ? data : []));
      } catch {
        setLaboratories([]);
      }
    }
    loadLaboratories();
  }, []);

  const hasFilters = Boolean(
    search.searchDebounced || status || laboratoryId || budgetDebounced
  );

  const getActiveFilterCount = useCallback(() => {
    return [status, laboratoryId, budgetDebounced].filter(Boolean).length;
  }, [status, laboratoryId, budgetDebounced]);

  useEffect(() => {
    if (!hasFilters || queries.length > 0 || loading) {
      setEmptySuggestions([]);
      setEmptySuggestionsLoading(false);
      return;
    }
    let cancelled = false;
    setEmptySuggestionsLoading(true);
    (async () => {
      try {
        const data = await apiRequest(
          `/home/empty-suggestions?type=queries&limit=12`
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
  }, [hasFilters, queries.length, loading]);

  useEffect(() => {
    async function loadQueries() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search.searchDebounced) params.set("q", search.searchDebounced);
        if (status) params.set("status", status);
        if (laboratoryId) params.set("laboratory_id", laboratoryId);
        if (budgetDebounced) params.set("budget_contains", budgetDebounced);
        if (sortBy && sortBy !== "date_desc") params.set("sort_by", sortBy);
        const url = params.toString() ? `/queries/?${params.toString()}` : "/queries/";
        const data = await apiRequest(url);
        setQueries(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadQueries();
  }, [search.searchDebounced, status, laboratoryId, budgetDebounced, sortBy]);

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
        const q = await apiRequest(`/queries/public/${selectedId}/details`);
        setDetails(q);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingDetails(false);
      }
    }
    loadDetails();
  }, [selectedId]);

  const openQuery = (publicIdValue) => {
    navigate(`/queries/${publicIdValue}`);
  };

  const goBack = () => {
    navigate(-1);
  };

  const openLab = (publicIdValue) => {
    if (!publicIdValue) return;
    navigate(`/laboratories/${publicIdValue}`);
  };

  const openVacancy = (publicIdValue) => {
    if (!publicIdValue) return;
    navigate(`/vacancies/${publicIdValue}`);
  };

  const handleSearchKeyDown = (e) => {
    if (!search.suggestionsVisible || search.suggestions.length === 0) return;
    if (e.key === "Escape") {
      e.preventDefault();
      search.hideSuggestions();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      search.setHighlightedIndex((i) =>
        i < search.suggestions.length - 1 ? i + 1 : -1
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      search.setHighlightedIndex((i) => (i <= 0 ? -1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (
        search.highlightedIndex >= 0 &&
        search.suggestions[search.highlightedIndex]
      ) {
        e.preventDefault();
        search.applySuggestion(search.suggestions[search.highlightedIndex]);
      } else {
        search.hideSuggestions();
      }
      return;
    }
  };

  const handleResetFilters = useCallback(() => {
    search.setSearchQuery("");
    setStatus("");
    setLaboratoryId("");
    setBudgetContains("");
    setBudgetDebounced("");
    search.hideSuggestions();
    setFiltersDrawerOpen(false);
  }, [search]);

  if (selectedId && details) {
    return (
      <main className="main">
        <section className="section">
          <div className="detail-page">
            <button className="org-detail-back" onClick={goBack} type="button">
              ← Назад
            </button>
            <QueryDetailHero details={details} />
            <div className="detail-page__layout">
              <div className="detail-page__main">
                {details.completed_examples && (
                  <OrganizationSection title="Примеры выполнения" icon={<ClipboardList size={20} />}>
                    <Card variant="glass" padding="md">
                      <p className="org-detail-card__text">{details.completed_examples}</p>
                    </Card>
                  </OrganizationSection>
                )}
                
                {details.linked_task_solution && (
                  <OrganizationSection title="Связанная решённая задача" icon={<ClipboardCheck size={20} />}>
                    <OrganizationDetailCard variant="task">
                      <div className="entity-title-with-badge">
                        <h3 className="org-detail-card__title">
                          {details.linked_task_solution.title}
                        </h3>
                        <NewEntityBadge createdAt={details.linked_task_solution.created_at} />
                      </div>
                      {(details.linked_task_solution.task_description ||
                        details.linked_task_solution.solution_description) && (
                        <OrgDetailCardBlock icon={FileText} label="Описание">
                          <p className="org-detail-card__text">
                            {details.linked_task_solution.task_description ||
                              details.linked_task_solution.solution_description}
                          </p>
                        </OrgDetailCardBlock>
                      )}
                      <div className="org-detail-card__meta-grid">
                        {details.linked_task_solution.solution_deadline && (
                          <OrgDetailCardBlock icon={Calendar} label="Сроки" value={details.linked_task_solution.solution_deadline} />
                        )}
                        {details.linked_task_solution.grant_info && (
                          <OrgDetailCardBlock icon={Award} label="Грант" value={details.linked_task_solution.grant_info} />
                        )}
                        {details.linked_task_solution.cost && (
                          <OrgDetailCardBlock icon={Wallet} label="Стоимость" value={details.linked_task_solution.cost} />
                        )}
                      </div>
                    </OrganizationDetailCard>
                  </OrganizationSection>
                )}

                <OrganizationSection
                  title="Лаборатории"
                  icon={<Beaker size={20} />}
                  badge={(details.laboratories || []).length}
                  empty={(details.laboratories || []).length === 0}
                  emptyMessage="Лаборатории не связаны с этим запросом."
                >
                  <div className="org-detail-grid">
                    {(details.laboratories || []).map((lab) => (
                      <OrganizationDetailCard key={lab.id} clickable onClick={() => openLab(lab.public_id)}>
                        <div className="entity-title-with-badge">
                          <h3 className="org-detail-card__title">{lab.name}</h3>
                          <NewEntityBadge createdAt={lab.created_at} />
                        </div>
                        {lab.activities && (
                          <OrgDetailCardBlock icon={Layers} label="Направления">
                            <p className="org-detail-card__text org-detail-card__text--truncated">{lab.activities}</p>
                          </OrgDetailCardBlock>
                        )}
                        <span className="org-detail-card__cta">В лабораторию →</span>
                      </OrganizationDetailCard>
                    ))}
                  </div>
                </OrganizationSection>

                <OrganizationSection
                  title="Ответственные сотрудники"
                  icon={<Users size={20} />}
                  badge={(details.employees || []).length}
                  empty={(details.employees || []).length === 0}
                  emptyMessage="Сотрудники не указаны."
                >
                  <div className="org-detail-grid org-detail-grid--employees">
                    {(details.employees || []).map((employee) => (
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
                </OrganizationSection>

                <OrganizationSection
                  title="Вакансии"
                  icon={<Briefcase size={20} />}
                  badge={(details.vacancies || []).length}
                  empty={(details.vacancies || []).length === 0}
                  emptyMessage="Связанных опубликованных вакансий нет."
                >
                  <div className="org-detail-grid">
                    {(details.vacancies || []).map((vacancy) => (
                      <OrganizationDetailCard key={vacancy.id} variant="vacancy">
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
                            <p className="org-detail-card__text org-detail-card__text--truncated">{vacancy.description}</p>
                          </OrgDetailCardBlock>
                        )}
                        <div className="org-detail-card__meta-grid">
                          {vacancy.laboratory && (
                            <OrgDetailCardBlock icon={Beaker} label="Лаборатория" value={vacancy.laboratory.name} />
                          )}
                          {vacancy.contact_employee && (
                            <OrgDetailCardBlock icon={User} label="Контакт" value={vacancy.contact_employee.full_name} />
                          )}
                        </div>
                        {vacancy.public_id && (
                          <button
                            className="org-detail-card__cta"
                            type="button"
                            onClick={() => openVacancy(vacancy.public_id)}
                          >
                            Открыть вакансию →
                          </button>
                        )}
                      </OrganizationDetailCard>
                    ))}
                  </div>
                </OrganizationSection>
              </div>
              <aside className="detail-page__sidebar">
                <QueryDetailSidebar
                  details={details}
                  onOrgClick={(id) => navigate(`/organizations/${id}`)}
                />
              </aside>
            </div>
          </div>
        </section>
        <EmployeeModal
          employeePreview={employeePreview}
          showEmployeePublications={showEmployeePublications}
          setShowEmployeePublications={setShowEmployeePublications}
          closeEmployeePreview={() => {
            setEmployeePreview(null);
            setShowEmployeePublications(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="main">
      <section className="section">
        <div className="listing-page">
          <h1 className="listing-page__title">Запросы</h1>
          <div className="listing-page__grid">
        <aside className="listing-page__sidebar">
          <QueryFilters
            status={status}
            onStatusChange={setStatus}
            laboratoryId={laboratoryId}
            onLaboratoryChange={setLaboratoryId}
            budgetContains={budgetContains}
            onBudgetChange={setBudgetContains}
            laboratories={laboratories}
            hasFilters={hasFilters}
            onResetFilters={handleResetFilters}
          />
        </aside>
        <div className="listing-page__content">
          <div className="listing-page__toolbar">
            <QuerySearchBar
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
              onFocus={() =>
                search.searchQuery.trim().length >= 2 &&
                search.setSuggestionsVisible(true)
              }
              searchInputRef={search.searchInputRef}
              searchWrapRef={search.searchWrapRef}
              onClear={() => search.setSearchQuery("")}
              suggestionApplied={search.suggestionApplied}
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Фильтры
              {getActiveFilterCount() > 0 && (
                <span className="listing-page__filters-badge">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>
          </div>

          {loading && (
            <div
              className="listing-page__skeleton listing-page__list listing-page__list--grid"
              aria-busy="true"
              role="status"
              aria-label="Загрузка"
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="listing-card-skeleton">
                  <div
                    className="skeleton"
                    style={{ height: "1.25rem", width: "70%" }}
                  />
                  <div
                    className="skeleton"
                    style={{
                      height: "0.875rem",
                      width: "50%",
                      marginTop: "0.5rem",
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{
                      height: "0.875rem",
                      width: "100%",
                      marginTop: "0.75rem",
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{
                      height: "0.875rem",
                      width: "90%",
                      marginTop: "0.25rem",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="listing-page__error error">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div className="listing-page__list listing-page__list--grid">
                {queries.length === 0 ? (
                  hasFilters ? (
                    <div className="listing-page__empty">
                      <EmptySearchFallback
                        entityLabel="запросы"
                        items={emptySuggestions}
                        loading={emptySuggestionsLoading}
                        onResetFilters={handleResetFilters}
                        renderCard={(query) => (
                          <QueryCard
                            key={query.id}
                            query={query}
                            onOpen={openQuery}
                            navigate={navigate}
                          />
                        )}
                      />
                    </div>
                  ) : (
                    <div className="listing-page__empty listing-page__empty--no-results">
                      <p className="listing-page__empty-text">
                        Публичные запросы пока не добавлены.
                      </p>
                      <p className="listing-page__empty-hint">
                        Организации добавляют запросы в разделе «Профиль».
                      </p>
                    </div>
                  )
                ) : (
                  queries.map((query) => (
                    <QueryCard
                      key={query.id}
                      query={query}
                      onOpen={openQuery}
                      navigate={navigate}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
        </div>
      </section>

      <Drawer
        isOpen={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        title="Фильтры запросов"
      >
        <QueryFilters
          status={status}
          onStatusChange={setStatus}
          laboratoryId={laboratoryId}
          onLaboratoryChange={setLaboratoryId}
          budgetContains={budgetContains}
          onBudgetChange={setBudgetContains}
          laboratories={laboratories}
          hasFilters={hasFilters}
          onResetFilters={() => {
            handleResetFilters();
            setFiltersDrawerOpen(false);
          }}
        />
      </Drawer>

      <EmployeeModal
        employeePreview={employeePreview}
        showEmployeePublications={showEmployeePublications}
        setShowEmployeePublications={setShowEmployeePublications}
        closeEmployeePreview={() => {
          setEmployeePreview(null);
          setShowEmployeePublications(false);
        }}
      />
    </main>
  );
}
