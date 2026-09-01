/**
 * Боковая панель профиля: список разделов по роли; «Профиль организации» раскрывается подпунктами в сайдбаре.
 * Блок «Профиль организации» можно скрыть; выбор сохраняется в localStorage.
 */
import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

const ORG_HIDDEN_STORAGE_KEY = "profile_sidebar_org_hidden";

function getOrgHidden() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ORG_HIDDEN_STORAGE_KEY) === "1";
}

function setOrgHidden(hidden) {
  if (hidden) localStorage.setItem(ORG_HIDDEN_STORAGE_KEY, "1");
  else localStorage.removeItem(ORG_HIDDEN_STORAGE_KEY);
}

const SECTIONS = [
  { id: "summary", labelKey: "summary", roles: ["lab_admin", "lab_representative", "student", "researcher"] },
  { id: "personal", labelKey: "personal", roles: ["lab_admin", "lab_representative", "student", "researcher"] },
  { id: "subscription", labelKey: "subscription", roles: ["lab_admin", "lab_representative"] },
  { id: "organization", labelKey: "organization", roles: ["lab_admin", "lab_representative"] },
  { id: "student", labelKey: "student", roles: ["student"] },
  { id: "researcher", labelKey: "researcher", roles: ["researcher"] },
  { id: "my-requests", labelKey: "my-requests", roles: ["researcher"] },
  { id: "my-vacancy-responses", labelKey: "my-vacancy-responses", roles: ["student", "researcher"] },
];

const LABELS = {
  summary: "Обзор",
  subscription: "Подписка",
  personal: "Личные данные",
  organization: "Профиль организации",
  student: "Профиль студента",
  researcher: "Профиль исследователя",
  "my-requests": "Мои запросы",
  "my-vacancy-responses": "Мои отклики",
};

function getOrgLabel(roleKey) {
  return roleKey === "lab_representative" ? "Профиль лаборатории" : "Профиль организации";
}

function getItemsForRole(roleKey) {
  if (!roleKey) return [];
  return SECTIONS.filter((s) => s.roles.includes(roleKey)).map((s, i) => ({
    id: s.id,
    label: s.id === "organization" ? getOrgLabel(roleKey) : LABELS[s.labelKey],
    step: i + 1,
  }));
}

const ORG_GROUP_DATA = "Данные организации";
const ORG_GROUP_DATA_LAB = "Данные лаборатории";
const ORG_GROUP_CONTENT = "Контент";
const ORG_GROUP_RECRUIT = "Набор и отклики";

function getOrgSubItems(showProfileTab, roleKey) {
  const dataGroup = roleKey === "lab_representative" ? ORG_GROUP_DATA_LAB : ORG_GROUP_DATA;
  const items = [
    ...(showProfileTab ? [{ id: "profile", label: "Профиль", group: dataGroup }] : []),
    { id: "labs", label: "Лаборатории", group: dataGroup },
    { id: "equipment", label: "Оборудование", group: dataGroup },
    { id: "staff", label: "Сотрудники", group: dataGroup },
    { id: "tasks", label: "Задачи", group: ORG_GROUP_CONTENT },
    { id: "queries", label: "Запросы", group: ORG_GROUP_CONTENT },
    { id: "news", label: "Новости", group: ORG_GROUP_CONTENT },
    { id: "vacancies", label: "Вакансии", group: ORG_GROUP_RECRUIT },
    { id: "dashboard", label: "Дашборд", group: ORG_GROUP_RECRUIT },
    { id: "join-requests", label: "Запросы на присоединение", group: ORG_GROUP_RECRUIT },
    { id: "vacancy-responses", label: "Отклики на вакансии", group: ORG_GROUP_RECRUIT },
    ...(roleKey === "lab_representative" ? [{ id: "my-requests", label: "Мои запросы", group: ORG_GROUP_RECRUIT }] : []),
  ];
  return items.map((it, i) => ({ ...it, step: i + 1 }));
}

const ALLOWED_WHEN_UNVERIFIED = ["summary", "personal"];

export default function ProfileSidebar({
  roleKey,
  currentSection,
  onSectionChange,
  orgTab,
  onOrgTabChange,
  showProfileTab = false,
  emailVerified = true,
}) {
  const items = getItemsForRole(roleKey);
  const isOrgSection = currentSection === "organization";
  const [orgExpanded, setOrgExpanded] = useState(false);
  const [orgSectionHidden, setOrgSectionHiddenState] = useState(getOrgHidden);
  const isOrgRole = roleKey === "lab_admin" || roleKey === "lab_representative";
  const locked = !emailVerified;

  useEffect(() => {
    if (!isOrgSection) setOrgExpanded(false);
  }, [isOrgSection]);

  const setOrgSectionHidden = (hidden) => {
    setOrgSectionHiddenState(hidden);
    setOrgHidden(hidden);
    if (hidden && currentSection === "organization") onSectionChange("summary");
  };

  const handleOrgHeaderClick = () => {
    if (locked) return;
    if (!isOrgSection) {
      onSectionChange("organization");
      setOrgExpanded(true);
    } else {
      setOrgExpanded((prev) => !prev);
    }
  };

  const handleOrgSubClick = (tabId) => {
    if (locked) return;
    onSectionChange("organization");
    onOrgTabChange?.(tabId);
    setOrgExpanded(true);
  };

  const handleToggleOrgVisibility = () => {
    if (orgSectionHidden) {
      setOrgSectionHidden(false);
      onSectionChange("organization");
      setOrgExpanded(true);
    } else {
      setOrgSectionHidden(true);
    }
  };

  const orgSubItems = isOrgRole ? getOrgSubItems(showProfileTab, roleKey) : [];
  const showOrgInList = isOrgRole && !orgSectionHidden;

  return (
    <Card variant="solid" padding="md" className="profile-sidebar-card">
      <nav className="profile-sidebar" aria-label="Разделы профиля">
        <ul className="profile-sidebar__list">
          {items.map((item) => {
            const itemLocked = locked && !ALLOWED_WHEN_UNVERIFIED.includes(item.id);
            if (item.id !== "organization") {
              return (
                <li key={item.id} className="profile-sidebar__list-item">
                  <span
                    className={itemLocked ? "profile-sidebar__item-wrap profile-sidebar__item-wrap--locked" : "profile-sidebar__item-wrap"}
                    title={itemLocked ? "Подтвердите email для доступа" : undefined}
                  >
                    <Button
                      type="button"
                      variant={currentSection === item.id ? "secondary" : "ghost"}
                      size="small"
                      className={`profile-sidebar__btn ${itemLocked ? "profile-sidebar__item--locked" : ""}`}
                      onClick={() => !itemLocked && onSectionChange(item.id)}
                      aria-current={currentSection === item.id ? "page" : undefined}
                      disabled={itemLocked}
                    >
                      {item.step != null && (
                        <span className="profile-sidebar__step" aria-hidden>{item.step}</span>
                      )}
                      {item.label}
                    </Button>
                  </span>
                </li>
              );
            }
          if (!showOrgInList) return null;
          const expanded = !locked && orgExpanded;
          return (
            <li
              key={item.id}
              className={`profile-sidebar__list-item profile-sidebar__list-item--with-children${expanded ? " profile-sidebar__list-item--expanded" : ""} ${locked ? " profile-sidebar__list-item--locked" : ""}`}
            >
              <div className="profile-sidebar__parent-row">
                <span
                  className={locked ? "profile-sidebar__item-wrap profile-sidebar__item-wrap--locked profile-sidebar__item-wrap--parent" : "profile-sidebar__item-wrap profile-sidebar__item-wrap--parent"}
                  title={locked ? "Подтвердите email для доступа" : undefined}
                >
                <Button
                  type="button"
                  variant={isOrgSection ? "secondary" : "ghost"}
                  size="small"
                  className={`profile-sidebar__btn profile-sidebar__item--parent ${locked ? "profile-sidebar__item--locked" : ""}`}
                  onClick={handleOrgHeaderClick}
                  aria-expanded={expanded}
                  aria-current={isOrgSection ? "page" : undefined}
                  disabled={locked}
                  title={expanded ? "Свернуть" : "Развернуть"}
                >
                  <span className="profile-sidebar__parent-label">{item.label}</span>
                  <span className={`profile-sidebar__expand-icon ${expanded ? "profile-sidebar__expand-icon--open" : ""}`} aria-hidden>
                    <ChevronDown size={16} />
                  </span>
                </Button>
                </span>
              </div>
              {expanded && orgSubItems.length > 0 && (
                <ul className="profile-sidebar__sublist">
                  {(() => {
                    let lastGroup = "";
                    return orgSubItems.map((sub) => {
                      const showGroup = sub.group !== lastGroup;
                      if (showGroup) lastGroup = sub.group;
                      return (
                        <React.Fragment key={sub.id}>
                          {showGroup && (
                            <li className="profile-sidebar__subgroup" aria-hidden="true">
                              {sub.group}
                            </li>
                          )}
                          <li>
                            <Button
                              type="button"
                              variant={orgTab === sub.id ? "secondary" : "ghost"}
                              size="small"
                              className={`profile-sidebar__btn profile-sidebar__subitem ${orgTab === sub.id ? "profile-sidebar__subitem--active" : ""}`}
                              onClick={() => handleOrgSubClick(sub.id)}
                              aria-current={orgTab === sub.id ? "page" : undefined}
                              disabled={locked}
                            >
                              {sub.step != null && (
                                <span className="profile-sidebar__substep" aria-hidden>{sub.step}</span>
                              )}
                              {sub.label}
                            </Button>
                          </li>
                        </React.Fragment>
                      );
                    });
                  })()}
                </ul>
              )}
            </li>
          );
        })}
        {isOrgRole && orgSectionHidden && (
          <li className="profile-sidebar__list-item">
            <Button
              variant="ghost"
              size="small"
              className="profile-sidebar__btn profile-sidebar__item--show-org"
              onClick={handleToggleOrgVisibility}
              title="Вернуть блок в меню"
            >
              {roleKey === "lab_representative"
                ? "Показать профиль лаборатории"
                : "Показать профиль организации"}
            </Button>
          </li>
        )}
      </ul>
    </nav>
    </Card>
  );
}
