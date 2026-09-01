/**
 * Аналитика: отправка событий (page_view, page_leave, button_click) на бэкенд.
 * session_id в sessionStorage; авторизация подставляется при наличии.
 */

import { getStoredAuth } from "./api/client";

const STORAGE_KEY_SESSION = "analytics_session_id";
const API_EVENTS = "/api/analytics/events";

function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (!id) {
      id = generateId();
      sessionStorage.setItem(STORAGE_KEY_SESSION, id);
    }
    return id;
  } catch {
    return generateId();
  }
}

/**
 * По pathname возвращает { entity_type, entity_id } для текущей страницы.
 */
export function getEntityFromPath(pathname) {
  if (!pathname || typeof pathname !== "string") return { entity_type: null, entity_id: null };
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/") return { entity_type: "home", entity_id: null };
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "organizations") {
    return { entity_type: "organization", entity_id: parts[1] || null };
  }
  if (parts[0] === "laboratories") {
    return { entity_type: "laboratory", entity_id: parts[1] || null };
  }
  if (parts[0] === "queries") {
    return { entity_type: "query", entity_id: parts[1] || null };
  }
  if (parts[0] === "vacancies") {
    return { entity_type: "vacancy", entity_id: parts[1] || null };
  }
  if (parts[0] === "news") {
    return { entity_type: "news", entity_id: parts[1] || null };
  }
  if (parts[0] === "profile") {
    return { entity_type: "profile", entity_id: null };
  }
  return { entity_type: null, entity_id: null };
}

/**
 * Отправить события на бэкенд. Не блокирует UI, ошибки логируются в консоль.
 */
export function sendEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  const auth = getStoredAuth();
  const headers = { "Content-Type": "application/json" };
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  fetch(API_EVENTS, {
    method: "POST",
    headers,
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[analytics] sendEvents failed:", err);
    }
  });
}
