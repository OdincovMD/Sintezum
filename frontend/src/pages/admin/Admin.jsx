import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Layout,
  Building2,
  Beaker,
  Users,
  Wrench,
  HelpCircle,
  User,
  Coins,
  Link2,
  Mail,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Newspaper,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Badge, Button, Card, Input } from "../../components/ui";
import AdminMediaField from "./shared/AdminMediaField";
import { EntityCheckboxList, EntitySelect } from "./shared/EntitySelect";
import { useEditOverlayScrollLock } from "../../hooks";
import NewsAdminTab from "./NewsAdminTab";

const TAB_GROUPS = [
  { label: null, tabs: [{ id: "dashboard", label: "Дашборд", icon: Layout }] },
  { label: "Организации", tabs: [{ id: "organizations", label: "Организации", icon: Building2 }, { id: "laboratories", label: "Лаборатории", icon: Beaker }] },
  { label: "Контент", tabs: [{ id: "news", label: "Новости", icon: Newspaper }, { id: "vacancies", label: "Вакансии", icon: Link2 }, { id: "queries", label: "Запросы", icon: BookOpen }, { id: "equipment", label: "Оборудование", icon: Wrench }, { id: "tasks", label: "Решённые задачи", icon: TrendingUp }, { id: "employees", label: "Сотрудники", icon: User }] },
  { label: "Участники", tabs: [{ id: "students", label: "Студенты", icon: GraduationCap }, { id: "researchers", label: "Исследователи", icon: Beaker }, { id: "users", label: "Пользователи", icon: Users }] },
  { label: "Подписки", tabs: [{ id: "subscriptions", label: "Подписки", icon: Coins }] },
  { label: "Модерация", tabs: [{ id: "join-requests", label: "Заявки", icon: HelpCircle }, { id: "vacancy-responses", label: "Отклики", icon: Mail }, { id: "feedback", label: "Обратная связь", icon: MessageSquareWarning }] },
];

const TABS = TAB_GROUPS.flatMap((g) => g.tabs);
const PAGE_SIZE = 20;

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Admin() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "organizations");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editDrawer, setEditDrawer] = useState({
    open: false,
    type: null,
    item: null,
    form: null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [subsUserId, setSubsUserId] = useState("");
  const [subsList, setSubsList] = useState([]);
  const [subsUser, setSubsUser] = useState(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState(null);
  const [subRequests, setSubRequests] = useState([]);
  const [subRequestsLoading, setSubRequestsLoading] = useState(false);
  const [subRequestsError, setSubRequestsError] = useState(null);
  const [subRequestAction, setSubRequestAction] = useState(null);
  const [subRequestStatusFilter, setSubRequestStatusFilter] = useState("pending");
  const [subsInnerTab, setSubsInnerTab] = useState("requests");
  const [subApproveModal, setSubApproveModal] = useState({ open: false, req: null, expiresAt: "", trialEndsAt: "" });
  const [subRejectModal, setSubRejectModal] = useState({ open: false, req: null, reason: "" });
  const [subExtendModal, setSubExtendModal] = useState({ open: false, sub: null, newExpiresAt: "" });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, type: null, item: null });
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [createSubForm, setCreateSubForm] = useState({ userId: "", tier: "pro", expiresAt: "", trialEndsAt: "", isTrial: false });
  const [createSubSaving, setCreateSubSaving] = useState(false);
  const [orgLabs, setOrgLabs] = useState([]);
  const [orgQueries, setOrgQueries] = useState([]);
  const [orgEmployees, setOrgEmployees] = useState([]);
  const [orgEquipment, setOrgEquipment] = useState([]);
  const [orgTasks, setOrgTasks] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersRoleFilter, setUsersRoleFilter] = useState("");
  const [usersSearchQ, setUsersSearchQ] = useState("");
  const [usersSearchApplied, setUsersSearchApplied] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [labJoinRequests, setLabJoinRequests] = useState([]);
  const [orgJoinRequests, setOrgJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [joinRequestsTab, setJoinRequestsTab] = useState("lab");
  const [vacancyResponses, setVacancyResponses] = useState([]);
  const [vacancyResponsesTotal, setVacancyResponsesTotal] = useState(0);
  const [vacancyResponsesPage, setVacancyResponsesPage] = useState(1);
  const [vacancyResponsesLoading, setVacancyResponsesLoading] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("new");
  const [feedbackDetail, setFeedbackDetail] = useState(null);
  const [feedbackDetailLoading, setFeedbackDetailLoading] = useState(false);
  const [feedbackActionLoading, setFeedbackActionLoading] = useState(false);
  const [subEventsOpen, setSubEventsOpen] = useState(null);
  const [subEventsData, setSubEventsData] = useState(null);

  const anySubModalOpen =
    subApproveModal.open ||
    subRejectModal.open ||
    subExtendModal.open ||
    deleteConfirmModal.open ||
    !!feedbackDetail;
  useEditOverlayScrollLock(editDrawer.open || anySubModalOpen);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (subApproveModal.open) setSubApproveModal({ open: false, req: null, expiresAt: "", trialEndsAt: "" });
        else if (subRejectModal.open) setSubRejectModal({ open: false, req: null, reason: "" });
        else if (subExtendModal.open) setSubExtendModal({ open: false, sub: null, newExpiresAt: "" });
        else if (deleteConfirmModal.open) setDeleteConfirmModal({ open: false, type: null, item: null });
        else if (feedbackDetail) setFeedbackDetail(null);
        else closeEdit();
      }
    };
    if (editDrawer.open || subApproveModal.open || subRejectModal.open || subExtendModal.open || deleteConfirmModal.open || feedbackDetail) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [editDrawer.open, subApproveModal.open, subRejectModal.open, subExtendModal.open, deleteConfirmModal.open, feedbackDetail]);

  useEffect(() => {
    if (tabFromUrl && TABS.some((t) => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!auth?.token || auth?.user?.role_name !== "platform_admin") {
      navigate(auth?.token ? "/" : "/login", { replace: true });
      return;
    }
  }, [auth, navigate]);

  const fetchList = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    if (["subscriptions", "dashboard", "users", "join-requests", "vacancy-responses", "feedback", "news"].includes(activeTab)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/admin/${activeTab}?page=${page}&size=${PAGE_SIZE}`);
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, auth?.user?.role_name]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchUserSubscriptions = async () => {
    const uid = subsUserId.trim();
    if (!uid) return;
    setSubsLoading(true);
    setSubsError(null);
    setSubsList([]);
    setSubsUser(null);
    try {
      const data = await apiRequest(`/admin/subscriptions/user/${uid}`);
      setSubsList(data.items || []);
      setSubsUser(data.user || null);
    } catch (e) {
      setSubsError(e.message);
    } finally {
      setSubsLoading(false);
    }
  };

  const fetchSubscriptionRequests = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setSubRequestsLoading(true);
    setSubRequestsError(null);
    try {
      const data = await apiRequest(`/admin/subscription-requests?status=${subRequestStatusFilter || "pending"}`);
      setSubRequests(data.items || []);
    } catch (e) {
      setSubRequestsError(e.message);
      setSubRequests([]);
    } finally {
      setSubRequestsLoading(false);
    }
  }, [auth?.user?.role_name, subRequestStatusFilter]);

  useEffect(() => {
    if (activeTab === "subscriptions") fetchSubscriptionRequests();
  }, [activeTab, fetchSubscriptionRequests]);

  const fetchDashboardStats = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setDashboardLoading(true);
    try {
      const data = await apiRequest("/admin/dashboard/stats");
      setDashboardStats(data);
    } catch (e) {
      setDashboardStats(null);
    } finally {
      setDashboardLoading(false);
    }
  }, [auth?.user?.role_name]);

  const fetchUsers = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: usersPage, size: PAGE_SIZE });
      if (usersRoleFilter) params.set("role", usersRoleFilter);
      if (usersSearchApplied.trim()) params.set("q", usersSearchApplied.trim());
      const data = await apiRequest(`/admin/users?${params}`);
      setUsersList(data.items || []);
      setUsersTotal(data.total ?? 0);
    } catch (e) {
      setUsersList([]);
      setUsersTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [auth?.user?.role_name, usersPage, usersRoleFilter, usersSearchApplied]);

  const fetchJoinRequests = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setJoinRequestsLoading(true);
    try {
      const [labData, orgData] = await Promise.all([
        apiRequest("/admin/join-requests/lab?status=pending"),
        apiRequest("/admin/join-requests/org?status=pending"),
      ]);
      setLabJoinRequests(labData.items || []);
      setOrgJoinRequests(orgData.items || []);
    } catch (e) {
      setLabJoinRequests([]);
      setOrgJoinRequests([]);
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [auth?.user?.role_name]);

  const fetchVacancyResponses = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setVacancyResponsesLoading(true);
    try {
      const params = new URLSearchParams({ page: vacancyResponsesPage, size: PAGE_SIZE });
      const data = await apiRequest(`/admin/vacancy-responses?${params}`);
      setVacancyResponses(data.items || []);
      setVacancyResponsesTotal(data.total ?? 0);
    } catch (e) {
      setVacancyResponses([]);
      setVacancyResponsesTotal(0);
    } finally {
      setVacancyResponsesLoading(false);
    }
  }, [auth?.user?.role_name, vacancyResponsesPage]);

  const fetchFeedback = useCallback(async () => {
    if (auth?.user?.role_name !== "platform_admin") return;
    setFeedbackLoading(true);
    try {
      const params = new URLSearchParams({ page: feedbackPage, size: PAGE_SIZE });
      if (feedbackStatusFilter) params.set("status", feedbackStatusFilter);
      const data = await apiRequest(`/admin/feedback?${params}`);
      setFeedbackItems(data.items || []);
      setFeedbackTotal(data.total ?? 0);
    } catch (e) {
      setFeedbackItems([]);
      setFeedbackTotal(0);
      setError(e.message);
    } finally {
      setFeedbackLoading(false);
    }
  }, [auth?.user?.role_name, feedbackPage, feedbackStatusFilter]);

  useEffect(() => {
    if (activeTab === "dashboard") fetchDashboardStats();
  }, [activeTab, fetchDashboardStats]);

  useEffect(() => {
    if (activeTab === "users") fetchUsers();
  }, [activeTab, usersPage, usersRoleFilter, usersSearchApplied, fetchUsers]);

  useEffect(() => {
    if (activeTab === "join-requests") fetchJoinRequests();
  }, [activeTab, fetchJoinRequests]);

  useEffect(() => {
    if (activeTab === "vacancy-responses") fetchVacancyResponses();
  }, [activeTab, fetchVacancyResponses]);

  useEffect(() => {
    if (activeTab === "feedback") fetchFeedback();
  }, [activeTab, fetchFeedback]);

  const openApproveModal = (req) => {
    const defaultTrial = req.is_trial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
    const defaultExpires = !req.is_trial ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
    setSubApproveModal({ open: true, req, expiresAt: defaultExpires, trialEndsAt: defaultTrial });
  };

  const handleApproveSubmit = async () => {
    const { req, expiresAt, trialEndsAt } = subApproveModal;
    if (!req) return;
    setSubRequestAction(req.id);
    try {
      await apiRequest(`/admin/subscription-requests/${req.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          expires_at: expiresAt ? `${expiresAt}T23:59:59Z` : null,
          trial_ends_at: trialEndsAt ? `${trialEndsAt}T23:59:59Z` : null,
        }),
      });
      setSubApproveModal({ open: false, req: null, expiresAt: "", trialEndsAt: "" });
      await fetchSubscriptionRequests();
      if (subsUserId.trim()) fetchUserSubscriptions();
    } catch (e) {
      setSubRequestsError(e.message);
    } finally {
      setSubRequestAction(null);
    }
  };

  const openRejectModal = (req) => setSubRejectModal({ open: true, req, reason: "" });

  const handleRejectSubmit = async () => {
    const { req, reason } = subRejectModal;
    if (!req) return;
    setSubRequestAction(req.id);
    try {
      await apiRequest(`/admin/subscription-requests/${req.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || null }),
      });
      setSubRejectModal({ open: false, req: null, reason: "" });
      await fetchSubscriptionRequests();
    } catch (e) {
      setSubRequestsError(e.message);
    } finally {
      setSubRequestAction(null);
    }
  };

  useEffect(() => {
    if (!userSearchQuery || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const data = await apiRequest(`/admin/users/search?q=${encodeURIComponent(userSearchQuery)}`);
        setUserSearchResults(data.items || []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearchQuery]);

  const openExtendModal = (sub) => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setSubExtendModal({ open: true, sub, newExpiresAt: nextYear.toISOString().slice(0, 10) });
  };

  const handleExtendSubmit = async () => {
    const { sub, newExpiresAt } = subExtendModal;
    if (!sub || !newExpiresAt) return;
    try {
      await apiRequest(`/admin/subscriptions/${sub.id}/extend`, {
        method: "POST",
        body: JSON.stringify({ new_expires_at: `${newExpiresAt}T23:59:59Z` }),
      });
      setSubExtendModal({ open: false, sub: null, newExpiresAt: "" });
      if (subsUserId.trim()) fetchUserSubscriptions();
    } catch (e) {
      setSubsError(e.message);
    }
  };

  const handleCreateSubscription = async () => {
    const uid = String(createSubForm.userId || "").trim();
    if (!uid) return;
    setCreateSubSaving(true);
    setSubsError(null);
    try {
      const body = {
        user_id: parseInt(uid, 10),
        tier: createSubForm.tier,
        audience: "representative",
      };
      if (createSubForm.isTrial) {
        body.trial_ends_at = createSubForm.trialEndsAt
          ? `${createSubForm.trialEndsAt}T23:59:59Z`
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + "T23:59:59Z";
      } else if (createSubForm.expiresAt) {
        body.expires_at = `${createSubForm.expiresAt}T23:59:59Z`;
      } else {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        body.expires_at = nextYear.toISOString().slice(0, 10) + "T23:59:59Z";
      }
      await apiRequest("/admin/subscriptions", { method: "POST", body: JSON.stringify(body) });
      setCreateSubForm({ userId: "", tier: "pro", expiresAt: "", trialEndsAt: "", isTrial: false });
      setSubsUserId(uid);
      setSubsInnerTab("user");
      await fetchUserSubscriptions();
    } catch (e) {
      setSubsError(e.message);
    } finally {
      setCreateSubSaving(false);
    }
  };

  const handleCancelSubscription = async (sub) => {
    if (!confirm(`Отменить подписку ID ${sub.id} пользователя ${sub.user_id}?`)) return;
    try {
      await apiRequest(`/admin/subscriptions/${sub.id}/cancel`, { method: "POST" });
      if (subsUserId.trim()) fetchUserSubscriptions();
    } catch (e) {
      setSubsError(e.message);
    }
  };

  const handleBlockUser = async (userId, blocked) => {
    try {
      await apiRequest(`/admin/users/${userId}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked }),
      });
      fetchUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await apiRequest(`/admin/users/${userId}/reset-password`, { method: "POST" });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const openFeedbackDetail = async (feedbackId) => {
    setFeedbackDetailLoading(true);
    setFeedbackDetail({ id: feedbackId, subject: "", status: "new", attachments: [] });
    try {
      const data = await apiRequest(`/admin/feedback/${feedbackId}`);
      setFeedbackDetail(data);
      setError(null);
    } catch (e) {
      setFeedbackDetail(null);
      setError(e.message);
    } finally {
      setFeedbackDetailLoading(false);
    }
  };

  const handleFeedbackStatusToggle = async () => {
    if (!feedbackDetail) return;
    const nextStatus = feedbackDetail.status === "done" ? "new" : "done";
    setFeedbackActionLoading(true);
    try {
      const updated = await apiRequest(`/admin/feedback/${feedbackDetail.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedbackDetail(updated);
      await fetchFeedback();
    } catch (e) {
      setError(e.message);
    } finally {
      setFeedbackActionLoading(false);
    }
  };

  const handleApproveLabJoin = async (id) => {
    try {
      await apiRequest(`/admin/join-requests/lab/${id}/approve`, { method: "POST" });
      fetchJoinRequests();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRejectLabJoin = async (id) => {
    try {
      await apiRequest(`/admin/join-requests/lab/${id}/reject`, { method: "POST" });
      fetchJoinRequests();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleApproveOrgJoin = async (id) => {
    try {
      await apiRequest(`/admin/join-requests/org/${id}/approve`, { method: "POST" });
      fetchJoinRequests();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRejectOrgJoin = async (id) => {
    try {
      await apiRequest(`/admin/join-requests/org/${id}/reject`, { method: "POST" });
      fetchJoinRequests();
    } catch (e) {
      setError(e.message);
    }
  };

  const openSubEvents = async (subId) => {
    if (subEventsOpen === subId) {
      setSubEventsOpen(null);
      setSubEventsData(null);
      return;
    }
    setSubEventsOpen(subId);
    setSubEventsData(null);
    try {
      const data = await apiRequest(`/admin/subscriptions/${subId}/events`);
      setSubEventsData(data.items || []);
    } catch {
      setSubEventsData([]);
    }
  };

  const openEdit = async (type, item) => {
    setSaveError(null);
    setOrgLabs([]);
    setOrgQueries([]);
    setOrgEmployees([]);
    setOrgEquipment([]);
    setOrgTasks([]);
    if (type === "student") {
      const uid = item.user_id ?? item.id;
      try {
        const data = await apiRequest(`/admin/students/${uid}`);
        const form = {
          full_name: data.full_name || "",
          status: data.status || "",
          skills: Array.isArray(data.skills) ? data.skills.join(", ") : (data.skills || ""),
          summary: data.summary || "",
          resume_url: data.resume_url || "",
          education: Array.isArray(data.education) ? data.education.join(", ") : (data.education || ""),
          research_interests: Array.isArray(data.research_interests) ? data.research_interests.join(", ") : (data.research_interests || ""),
          is_published: data.is_published ?? false,
        };
        setError(null);
        setEditDrawer({ open: true, type: "student", item: { ...item, ...data, user_id: uid }, form });
        return;
      } catch (e) {
        setError(e.message);
        return;
      }
    }
    if (type === "researcher") {
      const uid = item.user_id ?? item.id;
      try {
        const data = await apiRequest(`/admin/researchers/${uid}`);
        const form = {
          full_name: data.full_name || "",
          position: data.position || "",
          academic_degree: data.academic_degree || "",
          research_interests: Array.isArray(data.research_interests) ? data.research_interests.join(", ") : (data.research_interests || ""),
          education: Array.isArray(data.education) ? data.education.join(", ") : (data.education || ""),
          resume_url: data.resume_url || "",
          is_published: data.is_published ?? false,
        };
        setError(null);
        setEditDrawer({ open: true, type: "researcher", item: { ...item, ...data, user_id: uid }, form });
        return;
      } catch (e) {
        setError(e.message);
        return;
      }
    }
    if (type === "equipment" || type === "task" || type === "employee") {
      const id = item.id;
      const path = type === "equipment" ? "equipment" : type === "task" ? "tasks" : "employees";
      try {
        const data = await apiRequest(`/admin/${path}/${id}`);
        let orgLabs = [];
        const orgId = data.organization_id;
        const creatorId = data.creator_user_id;
        if (orgId) {
          try {
            const labsRes = await apiRequest(`/admin/organizations/${orgId}/laboratories`);
            orgLabs = labsRes.items || [];
          } catch {
            orgLabs = [];
          }
        } else if (creatorId) {
          try {
            const labsRes = await apiRequest(`/admin/creators/${creatorId}/laboratories`);
            orgLabs = labsRes.items || [];
          } catch {
            orgLabs = [];
          }
        }
        if (type === "equipment") {
          const form = {
            name: data.name || "",
            description: data.description || "",
            characteristics: data.characteristics || "",
            image_urls: Array.isArray(data.image_urls) ? [...data.image_urls] : (typeof data.image_urls === "string" && data.image_urls ? data.image_urls.split("\n").map((s) => s.trim()).filter(Boolean) : []),
            laboratory_ids: data.laboratory_ids || [],
          };
          setError(null);
          setEditDrawer({ open: true, type: "equipment", item: { ...item, ...data }, form, orgLabs });
        } else if (type === "task") {
          const form = {
            title: data.title || "",
            task_description: data.task_description || "",
            solution_description: data.solution_description || "",
            article_links: (data.article_links || []).join("\n"),
            solution_deadline: data.solution_deadline || "",
            grant_info: data.grant_info || "",
            cost: data.cost || "",
            external_solutions: data.external_solutions || "",
            laboratory_ids: data.laboratory_ids || [],
          };
          setError(null);
          setEditDrawer({ open: true, type: "task", item: { ...item, ...data }, form, orgLabs });
        } else {
          const form = {
            full_name: data.full_name || "",
            positions: (data.positions || []).join(", "),
            academic_degree: data.academic_degree || "",
            photo_url: data.photo_url || "",
            research_interests: Array.isArray(data.research_interests) ? data.research_interests.join(", ") : (data.research_interests || ""),
            education: Array.isArray(data.education) ? data.education.join(", ") : (data.education || ""),
            hindex_wos: data.hindex_wos ?? "",
            hindex_scopus: data.hindex_scopus ?? "",
            hindex_rsci: data.hindex_rsci ?? "",
            hindex_openalex: data.hindex_openalex ?? "",
            contacts: data.contacts || {},
            laboratory_ids: data.laboratory_ids || [],
          };
          setError(null);
          setEditDrawer({ open: true, type: "employee", item: { ...item, ...data }, form, orgLabs });
        }
        return;
      } catch (e) {
        setError(e.message);
        return;
      }
    }
    setError(null);
    if (type === "organization" || type === "laboratory" || type === "vacancy" || type === "query") {
      try {
        const path = type === "organization" ? "organizations" : type === "laboratory" ? "laboratories" : type === "vacancy" ? "vacancies" : "queries";
        const id = item.id;
        const data = await apiRequest(`/admin/${path}/${id}`);
        if (type === "vacancy" && (data.organization_id || data.creator_user_id)) {
          try {
            const base = data.organization_id
              ? `/admin/organizations/${data.organization_id}`
              : `/admin/creators/${data.creator_user_id}`;
            const [labsRes, queriesRes, empsRes] = await Promise.all([
              apiRequest(`${base}/laboratories`),
              apiRequest(`${base}/queries`),
              apiRequest(`${base}/employees`),
            ]);
            setOrgLabs(labsRes.items || []);
            setOrgQueries(queriesRes.items || []);
            setOrgEmployees(empsRes.items || []);
          } catch {
            setOrgLabs([]);
            setOrgQueries([]);
            setOrgEmployees([]);
          }
        }
        if (type === "query" && (data.organization_id || data.creator_user_id)) {
          try {
            const base = data.organization_id
              ? `/admin/organizations/${data.organization_id}`
              : `/admin/creators/${data.creator_user_id}`;
            const [labsRes, empsRes, tasksRes] = await Promise.all([
              apiRequest(`${base}/laboratories`),
              apiRequest(`${base}/employees`),
              apiRequest(`${base}/tasks`),
            ]);
            setOrgLabs(labsRes.items || []);
            setOrgEmployees(empsRes.items || []);
            setOrgTasks(tasksRes.items || []);
          } catch {
            setOrgLabs([]);
            setOrgEmployees([]);
            setOrgTasks([]);
          }
        }
        if (type === "laboratory" && (data.organization_id || data.creator_user_id)) {
          try {
            const base = data.organization_id
              ? `/admin/organizations/${data.organization_id}`
              : `/admin/creators/${data.creator_user_id}`;
            const [empsRes, eqRes, tasksRes] = await Promise.all([
              apiRequest(`${base}/employees`),
              apiRequest(`${base}/equipment`),
              apiRequest(`${base}/tasks`),
            ]);
            setOrgEmployees(empsRes.items || []);
            setOrgEquipment(eqRes.items || []);
            setOrgTasks(tasksRes.items || []);
          } catch {
            setOrgEmployees([]);
            setOrgEquipment([]);
            setOrgTasks([]);
          }
        }
        const baseForm = type === "organization"
          ? {
              name: data.name || "",
              description: data.description || "",
              address: data.address || "",
              website: data.website || "",
              avatar_url: data.avatar_url || "",
              ror_id: data.ror_id || "",
              is_published: data.is_published ?? false,
            }
          : type === "laboratory"
            ? {
                name: data.name || "",
                description: data.description || "",
                activities: data.activities || "",
                image_urls: Array.isArray(data.image_urls) ? [...data.image_urls] : (typeof data.image_urls === "string" && data.image_urls ? data.image_urls.split("\n").map((s) => s.trim()).filter(Boolean) : []),
                is_published: data.is_published ?? false,
                employee_ids: (data.employees || []).map((e) => e.id),
                head_employee_id: data.head_employee_id ?? "",
                equipment_ids: (data.equipment || []).map((e) => e.id),
                task_solution_ids: (data.task_solutions || []).map((t) => t.id),
              }
            : type === "vacancy"
              ? {
                  name: data.name || "",
                  requirements: data.requirements || "",
                  description: data.description || "",
                  employment_type: data.employment_type || "",
                  is_published: data.is_published ?? false,
                  query_id: data.query_id ?? "",
                  laboratory_id: data.laboratory_id ?? "",
                  contact_employee_id: data.contact_employee_id ?? "",
                  contact_email: data.contact_email || "",
                  contact_phone: data.contact_phone || "",
                }
              : {
                  title: data.title || "",
                  task_description: data.task_description || "",
                  completed_examples: data.completed_examples || "",
                  grant_info: data.grant_info || "",
                  budget: data.budget || "",
                  deadline: data.deadline || "",
                  status: data.status || "active",
                  is_published: data.is_published ?? false,
                  linked_task_solution_id: data.linked_task_solution_id ?? "",
                  laboratory_ids: (data.laboratories || []).map((l) => l.id),
                  employee_ids: (data.employees || []).map((e) => e.id),
                };
        setEditDrawer({ open: true, type, item: { ...item, ...data }, form: baseForm });
        return;
      } catch (e) {
        setError(e.message);
        return;
      }
    }
  };

  const closeEdit = () => {
    setEditDrawer({ open: false, type: null, item: null, form: null });
    setSaveError(null);
  };

  const uploadAdminMedia = async (files, category) => {
    if (!files?.length) return [];
    setUploading(true);
    setSaveError(null);
    try {
      const urls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);
        const res = await apiRequest("/storage/upload", { method: "POST", body: formData });
        if (res?.public_url) urls.push(res.public_url);
      }
      return urls;
    } catch (e) {
      setSaveError(e.message);
      return [];
    } finally {
      setUploading(false);
    }
  };

  const updateForm = (field, value) => {
    setEditDrawer((prev) => ({
      ...prev,
      form: { ...prev.form, [field]: value },
    }));
  };

  const handlePublish = () => updateForm("is_published", true);
  const handleUnpublish = () => {
    if (!window.confirm("Снять с публикации? Запись будет скрыта от пользователей.")) return;
    updateForm("is_published", false);
  };

  const toggleLabId = (labId) => {
    setEditDrawer((prev) => {
      const ids = prev.form?.laboratory_ids || [];
      const included = ids.includes(labId);
      const next = included ? ids.filter((id) => id !== labId) : [...ids, labId];
      return { ...prev, form: { ...prev.form, laboratory_ids: next } };
    });
  };

  const handleSave = async () => {
    const { type, item, form } = editDrawer;
    if (!item || !form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form };
      if (type === "laboratory") {
        payload.image_urls = Array.isArray(form.image_urls) ? form.image_urls : (typeof form.image_urls === "string" ? form.image_urls.split("\n").map((s) => s.trim()).filter(Boolean) : []);
        if (payload.head_employee_id === "" || payload.head_employee_id == null) payload.head_employee_id = null;
      }
      if (type === "vacancy") {
        ["query_id", "laboratory_id", "contact_employee_id"].forEach((k) => {
          if (payload[k] === "" || payload[k] == null) payload[k] = null;
        });
      }
      if (type === "query") {
        if (payload.linked_task_solution_id === "" || payload.linked_task_solution_id == null) payload.linked_task_solution_id = null;
      }
      if (type === "student") {
        payload.skills = typeof form.skills === "string"
          ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : form.skills;
        payload.education = typeof form.education === "string"
          ? form.education.split(",").map((s) => s.trim()).filter(Boolean)
          : form.education;
        payload.research_interests = typeof form.research_interests === "string"
          ? form.research_interests.split(",").map((s) => s.trim()).filter(Boolean)
          : form.research_interests;
      }
      if (type === "researcher") {
        payload.research_interests = typeof form.research_interests === "string"
          ? form.research_interests.split(",").map((s) => s.trim()).filter(Boolean)
          : form.research_interests;
        payload.education = typeof form.education === "string"
          ? form.education.split(",").map((s) => s.trim()).filter(Boolean)
          : form.education;
      }
      if (type === "equipment") {
        payload.image_urls = Array.isArray(form.image_urls) ? form.image_urls : (typeof form.image_urls === "string" ? form.image_urls.split("\n").map((s) => s.trim()).filter(Boolean) : []);
      }
      if (type === "task") {
        payload.article_links = typeof form.article_links === "string"
          ? form.article_links.split("\n").map((s) => s.trim()).filter(Boolean)
          : form.article_links;
      }
      if (type === "employee") {
        payload.positions = typeof form.positions === "string"
          ? form.positions.split(",").map((s) => s.trim()).filter(Boolean)
          : form.positions;
        payload.research_interests = typeof form.research_interests === "string"
          ? form.research_interests.split(",").map((s) => s.trim()).filter(Boolean)
          : form.research_interests;
        payload.education = typeof form.education === "string"
          ? form.education.split(",").map((s) => s.trim()).filter(Boolean)
          : form.education;
        ["hindex_wos", "hindex_scopus", "hindex_rsci", "hindex_openalex"].forEach((k) => {
          if (payload[k] === "" || payload[k] == null) delete payload[k];
        });
      }
      const pathMap = {
        organization: "organizations",
        laboratory: "laboratories",
        vacancy: "vacancies",
        query: "queries",
        equipment: "equipment",
        task: "tasks",
        employee: "employees",
        student: "students",
        researcher: "researchers",
      };
      const path = pathMap[type];
      const id = (type === "student" || type === "researcher") ? (item.user_id ?? item.id) : item.id;
      await apiRequest(`/admin/${path}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      closeEdit();
      fetchList();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (type, item) => {
    setDeleteConfirmModal({ open: true, type, item });
  };

  const handleDeleteConfirm = async () => {
    const { type, item } = deleteConfirmModal;
    if (!type || !item) return;
    setDeleting(true);
    setError(null);
    try {
      const pathMap = {
        organization: "organizations",
        laboratory: "laboratories",
        vacancy: "vacancies",
        query: "queries",
        equipment: "equipment",
        task: "tasks",
        employee: "employees",
        student: "students",
        researcher: "researchers",
      };
      const path = pathMap[type];
      const id = (type === "student" || type === "researcher") ? (item.user_id ?? item.id) : item.id;
      await apiRequest(`/admin/${path}/${id}`, { method: "DELETE" });
      if (editDrawer.open && editDrawer.item && (editDrawer.item.id === item.id || editDrawer.item.user_id === item.user_id)) {
        closeEdit();
      }
      fetchList();
      setDeleteConfirmModal({ open: false, type: null, item: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!auth?.token || auth?.user?.role_name !== "platform_admin") {
    return null;
  }

  const getEditTitle = () => {
    const t = editDrawer.type;
    if (t === "organization") return "Редактировать организацию";
    if (t === "laboratory") return "Редактировать лабораторию";
    if (t === "vacancy") return "Редактировать вакансию";
    if (t === "query") return "Редактировать запрос";
    if (t === "equipment") return "Редактировать оборудование";
    if (t === "task") return "Редактировать задачу";
    if (t === "employee") return "Редактировать сотрудника";
    if (t === "student") return "Редактировать студента";
    if (t === "researcher") return "Редактировать исследователя";
    return "Редактировать";
  };

  const getOverlayClass = () => {
    const t = editDrawer.type;
    if (t === "organization") return "organization-edit-overlay";
    if (t === "laboratory") return "lab-edit-overlay";
    if (t === "vacancy") return "vacancy-edit-overlay";
    if (t === "query") return "query-edit-overlay";
    if (t === "equipment") return "equipment-edit-overlay";
    if (t === "task") return "task-edit-overlay";
    if (t === "employee") return "employee-edit-overlay";
    if (t === "student") return "student-edit-overlay";
    if (t === "researcher") return "researcher-edit-overlay";
    return "employee-edit-overlay";
  };

  const getFormClass = () => {
    const t = editDrawer.type;
    if (t === "organization") return "organization-edit-form";
    if (t === "laboratory") return "lab-edit-form";
    if (t === "vacancy") return "vacancy-edit-form";
    if (t === "query") return "query-edit-form";
    if (t === "equipment") return "equipment-edit-form";
    if (t === "task") return "task-edit-form";
    if (t === "employee") return "employee-edit-form";
    if (t === "student") return "student-edit-form";
    if (t === "researcher") return "researcher-edit-form";
    return "employee-edit-form";
  };

  return (
    <main className="main admin-page">
      <div className="admin-page__inner">
        <h1 className="admin-page__title">Админ-панель</h1>

        <div className="admin-page__tabs">
          {TAB_GROUPS.map((group, gi) => (
            <div key={gi} className="admin-page__tab-group">
              {group.label && <span className="admin-page__tab-group-label">{group.label}</span>}
              <div className="admin-page__tab-list">
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`admin-page__tab ${activeTab === tab.id ? "admin-page__tab--active" : ""}`}
                      onClick={() => { setActiveTab(tab.id); setPage(1); }}
                    >
                      {Icon && <Icon size={16} aria-hidden />}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {gi < TAB_GROUPS.length - 1 && <span className="admin-page__tab-sep" aria-hidden />}
            </div>
          ))}
        </div>

        {error && (
          <p className="admin-page__error" role="alert">
            {error}
          </p>
        )}

        {activeTab === "dashboard" && (
          <div className="admin-page__dashboard">
            <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
              <div className="admin-page__card-header">
                <h2 className="profile-section-card__title">Сводка</h2>
                <Button variant="ghost" size="small" onClick={fetchDashboardStats} loading={dashboardLoading}>Обновить</Button>
              </div>
              {dashboardLoading ? (
                <div className="admin-page__empty-state">
                  <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                  <p className="admin-page__hint">Загрузка…</p>
                </div>
              ) : dashboardStats ? (
                <>
                  <div className="admin-page__dashboard-grid">
                    <div className="admin-page__dashboard-card">
                      <span className="admin-page__dashboard-value">{dashboardStats.organizations ?? 0}</span>
                      <span className="admin-page__dashboard-label">Организации</span>
                    </div>
                    <div className="admin-page__dashboard-card">
                      <span className="admin-page__dashboard-value">{dashboardStats.laboratories ?? 0}</span>
                      <span className="admin-page__dashboard-label">Лаборатории</span>
                    </div>
                    <div className="admin-page__dashboard-card">
                      <span className="admin-page__dashboard-value">{dashboardStats.vacancies ?? 0}</span>
                      <span className="admin-page__dashboard-label">Вакансии</span>
                    </div>
                    <div className="admin-page__dashboard-card">
                      <span className="admin-page__dashboard-value">{dashboardStats.queries ?? 0}</span>
                      <span className="admin-page__dashboard-label">Запросы</span>
                    </div>
                    <div className="admin-page__dashboard-card">
                      <span className="admin-page__dashboard-value">{dashboardStats.users_count ?? 0}</span>
                      <span className="admin-page__dashboard-label">Пользователи</span>
                    </div>
                  </div>
                  <div className="admin-page__dashboard-pending">
                    <h3 className="admin-page__subtitle">Требуют внимания</h3>
                    <ul className="admin-page__sub-requests-list">
                      {(dashboardStats.pending_subscription_requests > 0) && (
                        <li className="admin-page__sub-request-item">
                          <span>Запросы на подписку: {dashboardStats.pending_subscription_requests}</span>
                          <Button variant="primary" size="small" onClick={() => { setActiveTab("subscriptions"); setSubsInnerTab("requests"); }}>Перейти</Button>
                        </li>
                      )}
                      {(dashboardStats.pending_lab_join_requests > 0) && (
                        <li className="admin-page__sub-request-item">
                          <span>Заявки в лаборатории: {dashboardStats.pending_lab_join_requests}</span>
                          <Button variant="primary" size="small" onClick={() => { setActiveTab("join-requests"); setJoinRequestsTab("lab"); }}>Перейти</Button>
                        </li>
                      )}
                      {(dashboardStats.pending_org_join_requests > 0) && (
                        <li className="admin-page__sub-request-item">
                          <span>Заявки в организацию: {dashboardStats.pending_org_join_requests}</span>
                          <Button variant="primary" size="small" onClick={() => { setActiveTab("join-requests"); setJoinRequestsTab("org"); }}>Перейти</Button>
                        </li>
                      )}
                      {(!dashboardStats.pending_subscription_requests && !dashboardStats.pending_lab_join_requests && !dashboardStats.pending_org_join_requests) && (
                        <li className="admin-page__sub-request-item admin-page__sub-request-item--empty">
                          <span className="admin-page__hint">Нет ожидающих заявок</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="admin-page__empty-state">
                  <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                  <p className="admin-page__hint">Не удалось загрузить сводку</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "users" && (
          <div className="admin-page__users">
            <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
              <h2 className="profile-section-card__title">Пользователи</h2>
              <div className="admin-page__filter-bar">
                <div className="admin-page__filter-group">
                  <Input
                    label="Поиск"
                    placeholder="Email или имя"
                    value={usersSearchQ}
                    onChange={(e) => setUsersSearchQ(e.target.value)}
                  />
                  <div className="admin-page__filter-select-wrap">
                    <label htmlFor="users-role" className="admin-page__filter-label">Роль</label>
                    <select
                      id="users-role"
                      className="ui-input admin-page__filter-select"
                      value={usersRoleFilter}
                      onChange={(e) => setUsersRoleFilter(e.target.value)}
                      aria-label="Роль"
                    >
                      <option value="">Все роли</option>
                      <option value="platform_admin">Админ</option>
                      <option value="lab_representative">Представитель</option>
                      <option value="researcher">Исследователь</option>
                      <option value="student">Студент</option>
                    </select>
                  </div>
                  <div className="admin-page__filter-actions">
                    <Button variant="primary" size="medium" onClick={() => setUsersSearchApplied(usersSearchQ)} loading={usersLoading}>Поиск</Button>
                  </div>
                </div>
              </div>
              {usersLoading ? (
                <div className="admin-page__empty-state">
                  <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                  <p className="admin-page__hint">Загрузка…</p>
                </div>
              ) : usersList.length === 0 ? (
                <div className="admin-page__empty-state">
                  <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                  <p className="admin-page__hint">Пользователи не найдены</p>
                </div>
              ) : (
                <div className="admin-page__table-wrap">
                  <table className="admin-page__table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Имя</th>
                        <th>Роль</th>
                        <th>Заблокирован</th>
                        <th>Дата</th>
                        <th className="admin-page__table-actions-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>{u.mail}</td>
                          <td>{u.full_name || "—"}</td>
                          <td>{u.role_name}</td>
                          <td>{u.is_blocked ? <Badge variant="rejected">Да</Badge> : "Нет"}</td>
                          <td>{formatDate(u.created_at)}</td>
                          <td className="admin-page__table-actions-col">
                            <div className="admin-page__table-actions">
                              <Button variant="ghost" size="small" onClick={() => handleBlockUser(u.id, !u.is_blocked)} disabled={u.id === auth?.user?.id}>
                                {u.is_blocked ? "Разблокировать" : "Заблокировать"}
                              </Button>
                              <Button variant="ghost" size="small" onClick={() => handleResetPassword(u.id)}>Сброс пароля</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(usersTotal > 0 || usersList.length > 0) && (
                <div className="admin-page__pagination">
                  <span className="admin-page__pagination-info">
                    Показано {usersList.length} из {usersTotal}
                  </span>
                  <div className="admin-page__pagination-btns">
                    <Button variant="ghost" size="small" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>Назад</Button>
                    <Button variant="ghost" size="small" disabled={usersPage * PAGE_SIZE >= usersTotal} onClick={() => setUsersPage((p) => p + 1)}>Вперёд</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "join-requests" && (
          <div className="admin-page__join-requests">
            <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
              <div className="admin-page__card-header">
                <h2 className="profile-section-card__title">Заявки</h2>
                <Button variant="ghost" size="small" onClick={fetchJoinRequests} loading={joinRequestsLoading}>Обновить</Button>
              </div>
              <div className="admin-page__join-tabs">
                {["lab", "org"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`admin-page__subs-tab ${joinRequestsTab === t ? "admin-page__subs-tab--active" : ""}`}
                    onClick={() => setJoinRequestsTab(t)}
                  >
                    {t === "lab" ? "В лаборатории" : "В организацию"}
                  </button>
                ))}
              </div>
              {joinRequestsLoading ? (
                <div className="admin-page__empty-state">
                  <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                  <p className="admin-page__hint">Загрузка…</p>
                </div>
              ) : joinRequestsTab === "lab" ? (
                labJoinRequests.length === 0 ? (
                  <div className="admin-page__empty-state">
                    <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                    <p className="admin-page__hint">Нет ожидающих заявок в лаборатории</p>
                  </div>
                ) : (
                  <ul className="admin-page__sub-requests-list admin-page__join-list">
                    {labJoinRequests.map((r) => (
                      <li key={r.id} className="admin-page__sub-request-item">
                        <div className="admin-page__sub-request-info">
                          <strong>{r.researcher_full_name || `Исследователь #${r.researcher_id}`}</strong>
                          <span className="admin-page__sub-request-meta">→ {r.laboratory_name} {r.organization_name ? `(${r.organization_name})` : ""}</span>
                          <span className="admin-page__sub-request-meta">{formatDate(r.created_at)}</span>
                        </div>
                        <div className="admin-page__sub-request-actions">
                          <Button variant="primary" size="small" onClick={() => handleApproveLabJoin(r.id)}>Согласовать</Button>
                          <Button variant="ghost" size="small" onClick={() => handleRejectLabJoin(r.id)}>Отклонить</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : orgJoinRequests.length === 0 ? (
                <div className="admin-page__empty-state">
                  <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                  <p className="admin-page__hint">Нет ожидающих заявок в организацию</p>
                </div>
              ) : (
                <ul className="admin-page__sub-requests-list admin-page__join-list">
                  {orgJoinRequests.map((r) => (
                      <li key={r.id} className="admin-page__sub-request-item">
                        <div className="admin-page__sub-request-info">
                          <strong>{r.laboratory_name || `Лаб #${r.laboratory_id}`}</strong>
                          <span className="admin-page__sub-request-meta">→ {r.organization_name || `Орг #${r.organization_id}`}</span>
                          <span className="admin-page__sub-request-meta">{formatDate(r.created_at)}</span>
                        </div>
                        <div className="admin-page__sub-request-actions">
                          <Button variant="primary" size="small" onClick={() => handleApproveOrgJoin(r.id)}>Согласовать</Button>
                          <Button variant="ghost" size="small" onClick={() => handleRejectOrgJoin(r.id)}>Отклонить</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
              )}
            </Card>
          </div>
        )}

        {activeTab === "vacancy-responses" && (
          <div className="admin-page__vacancy-responses">
            <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
              <h2 className="profile-section-card__title">Отклики на вакансии</h2>
              {vacancyResponsesLoading ? (
                <div className="admin-page__empty-state">
                  <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                  <p className="admin-page__hint">Загрузка…</p>
                </div>
              ) : vacancyResponses.length === 0 ? (
                <div className="admin-page__empty-state">
                  <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                  <p className="admin-page__hint">Откликов пока нет</p>
                </div>
              ) : (
                <div className="admin-page__table-wrap">
                  <table className="admin-page__table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Соискатель</th>
                        <th>Вакансия</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th className="admin-page__table-actions-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacancyResponses.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.user_full_name || r.user_id}</td>
                          <td>{r.vacancy_name || r.vacancy_id}</td>
                          <td><Badge variant={r.status === "accepted" ? "success" : r.status === "rejected" ? "rejected" : "draft"}>{r.status === "new" ? "Новый" : r.status === "accepted" ? "Принят" : r.status === "rejected" ? "Отклонён" : r.status}</Badge></td>
                          <td>{formatDate(r.created_at)}</td>
                          <td className="admin-page__table-actions-col">
                            {r.user_public_id && (
                              <a href={`/applicants/${r.user_public_id}`} target="_blank" rel="noopener noreferrer" className="admin-resume-link">Профиль</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {vacancyResponsesTotal > 0 && (
              <div className="admin-page__pagination">
                <span className="admin-page__pagination-info">Показано {vacancyResponses.length} из {vacancyResponsesTotal}</span>
                <div className="admin-page__pagination-btns">
                  <Button variant="ghost" size="small" disabled={vacancyResponsesPage <= 1} onClick={() => setVacancyResponsesPage((p) => p - 1)}>Назад</Button>
                  <Button variant="ghost" size="small" disabled={vacancyResponsesPage * PAGE_SIZE >= vacancyResponsesTotal} onClick={() => setVacancyResponsesPage((p) => p + 1)}>Вперёд</Button>
                </div>
              </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="admin-page__feedback">
            <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
              <div className="admin-page__card-header">
                <div>
                  <h2 className="profile-section-card__title">Обратная связь</h2>
                  <p className="profile-section-desc">Сообщения пользователей и гостей со скриншотами и контекстом страницы.</p>
                </div>
                <div className="admin-page__sub-actions">
                  <select
                    className="ui-input admin-page__sub-status-select"
                    value={feedbackStatusFilter}
                    onChange={(e) => {
                      setFeedbackStatusFilter(e.target.value);
                      setFeedbackPage(1);
                    }}
                    aria-label="Фильтр статуса обратной связи"
                  >
                    <option value="new">Новые</option>
                    <option value="done">Обработанные</option>
                  </select>
                  <Button variant="ghost" size="small" onClick={fetchFeedback} loading={feedbackLoading} disabled={feedbackLoading}>
                    Обновить
                  </Button>
                </div>
              </div>

              {feedbackLoading ? (
                <div className="admin-page__empty-state">
                  <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                  <p className="admin-page__hint">Загрузка…</p>
                </div>
              ) : feedbackItems.length === 0 ? (
                <div className="admin-page__empty-state">
                  <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                  <p className="admin-page__hint">Обращений пока нет</p>
                </div>
              ) : (
                <div className="admin-page__table-wrap">
                  <table className="admin-page__table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Дата</th>
                        <th>Тема</th>
                        <th>Пользователь</th>
                        <th>URL</th>
                        <th>Вложения</th>
                        <th>Статус</th>
                        <th className="admin-page__table-actions-col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedbackItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{formatDateTime(item.created_at)}</td>
                          <td>{item.subject}</td>
                          <td>
                            {item.user
                              ? item.user.full_name || item.user.mail || `#${item.user.id}`
                              : "Гость"}
                          </td>
                          <td>
                            <a href={item.current_url} target="_blank" rel="noopener noreferrer" className="admin-resume-link">
                              {item.current_url}
                            </a>
                          </td>
                          <td>{item.attachments?.length || 0}</td>
                          <td>
                            <Badge variant={item.status === "done" ? "success" : "draft"}>
                              {item.status === "done" ? "Обработано" : "Новое"}
                            </Badge>
                          </td>
                          <td className="admin-page__table-actions-col">
                            <Button variant="ghost" size="small" onClick={() => openFeedbackDetail(item.id)}>
                              Открыть
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {feedbackTotal > 0 && (
                <div className="admin-page__pagination">
                  <span className="admin-page__pagination-info">Показано {feedbackItems.length} из {feedbackTotal}</span>
                  <div className="admin-page__pagination-btns">
                    <Button variant="ghost" size="small" disabled={feedbackPage <= 1} onClick={() => setFeedbackPage((p) => p - 1)}>
                      Назад
                    </Button>
                    <Button variant="ghost" size="small" disabled={feedbackPage * PAGE_SIZE >= feedbackTotal} onClick={() => setFeedbackPage((p) => p + 1)}>
                      Вперёд
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "news" && <NewsAdminTab />}

        {activeTab === "subscriptions" && (
          <div className="admin-page__subscriptions">
            <div className="admin-page__subs-tabs">
              <div className="admin-page__subs-tabs-view">
                <button
                  type="button"
                  className={`admin-page__subs-tab ${subsInnerTab === "requests" ? "admin-page__subs-tab--active" : ""}`}
                  onClick={() => setSubsInnerTab("requests")}
                >
                  Запросы
                </button>
                <button
                  type="button"
                  className={`admin-page__subs-tab ${subsInnerTab === "user" ? "admin-page__subs-tab--active" : ""}`}
                  onClick={() => setSubsInnerTab("user")}
                >
                  Подписки пользователя
                </button>
              </div>
              <span className="admin-page__subs-tabs-sep" aria-hidden />
              <button
                type="button"
                className={`admin-page__subs-tab admin-page__subs-tab--action ${subsInnerTab === "create" ? "admin-page__subs-tab--active" : ""}`}
                onClick={() => setSubsInnerTab("create")}
              >
                Создать подписку
              </button>
            </div>

            {subsInnerTab === "requests" && (
              <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
                <div className="admin-page__sub-header">
                  <div>
                    <h2 className="profile-section-card__title">Запросы на подписку</h2>
                    <p className="profile-section-desc admin-page__sub-desc">
                      Согласуйте или отклоните запросы. Для Trial можно указать срок пробного периода.
                    </p>
                  </div>
                  <div className="admin-page__sub-actions">
                    <select
                      className="ui-input admin-page__sub-status-select"
                      value={subRequestStatusFilter}
                      onChange={(e) => setSubRequestStatusFilter(e.target.value)}
                      aria-label="Фильтр статуса"
                    >
                      <option value="pending">Ожидающие</option>
                      <option value="all">Все</option>
                      <option value="approved">Согласованные</option>
                      <option value="rejected">Отклонённые</option>
                    </select>
                    <Button variant="ghost" size="small" onClick={fetchSubscriptionRequests} loading={subRequestsLoading} disabled={subRequestsLoading}>
                      Обновить
                    </Button>
                  </div>
                </div>
                {subRequestsError && <p className="admin-page__error" role="alert">{subRequestsError}</p>}
                {subRequestsLoading ? (
                  <div className="admin-page__empty-state">
                    <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                    <p className="admin-page__hint">Загрузка…</p>
                  </div>
                ) : subRequests.length === 0 ? (
                  <div className="admin-page__empty-state">
                    <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                    <p className="admin-page__hint">Запросов не найдено</p>
                  </div>
                ) : (
                  <ul className="admin-page__sub-requests-list">
                    {subRequests.map((r) => (
                      <li key={r.id} className="admin-page__sub-request-item">
                        <div className="admin-page__sub-request-info">
                          <strong>{r.user_full_name || r.user_mail || `ID ${r.user_id}`}</strong>
                          <span className="admin-page__sub-request-meta">
                            {r.tier === "pro" ? "Pro" : "Basic"} {r.is_trial ? "(Trial)" : ""} · {formatDate(r.created_at)}
                          </span>
                          {r.user_mail && <span className="admin-page__sub-request-mail">{r.user_mail}</span>}
                          {r.status && r.status !== "pending" && (
                            <Badge variant={r.status === "approved" ? "success" : "rejected"}>{r.status === "approved" ? "Согласовано" : "Отклонено"}</Badge>
                          )}
                        </div>
                        {r.status === "pending" && (
                          <div className="admin-page__sub-request-actions">
                            <Button variant="primary" size="small" onClick={() => openApproveModal(r)} disabled={subRequestAction != null}>
                              Согласовать
                            </Button>
                            <Button variant="ghost" size="small" onClick={() => openRejectModal(r)} disabled={subRequestAction != null}>
                              Отклонить
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {subsInnerTab === "user" && (
              <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
                <h2 className="profile-section-card__title">Подписки пользователя</h2>
                <p className="profile-section-desc">Найдите пользователя по email/имени или введите ID.</p>
                <div className="admin-page__subs-form admin-page__subs-form--user">
                  <div className="admin-page__subs-user-search">
                    <Input
                      label="Поиск пользователя"
                      type="text"
                      placeholder="Email или имя (минимум 2 символа)"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                    {userSearchResults.length > 0 && (
                      <div className="admin-page__user-results">
                        {userSearchResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="admin-page__user-result-item"
                            onClick={() => {
                              setSubsUserId(String(u.id));
                              setUserSearchQuery("");
                              setUserSearchResults([]);
                              setTimeout(() => fetchUserSubscriptions(), 0);
                            }}
                          >
                            {u.full_name || u.mail || `ID ${u.id}`}
                            <span className="admin-page__user-result-mail">{u.mail}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {userSearchLoading && <span className="admin-page__hint">Поиск…</span>}
                  </div>
                  <Input
                    label="ID пользователя"
                    type="number"
                    placeholder="Например: 2"
                    value={subsUserId}
                    onChange={(e) => setSubsUserId(e.target.value)}
                  />
                  <Button variant="primary" onClick={fetchUserSubscriptions} loading={subsLoading} disabled={subsLoading || !subsUserId.trim()}>
                    Показать
                  </Button>
                </div>
                {subsError && <p className="admin-page__error" role="alert">{subsError}</p>}
                {subsList.length > 0 && (
                  <div className="admin-page__subs-block">
                    <div className="admin-page__subs-user-header">
                      <span className="admin-page__subs-user-label">Пользователь</span>
                      <strong className="admin-page__subs-user-name">{subsUser?.full_name || subsUser?.mail || `ID ${subsUserId}`}</strong>
                      {subsUser?.mail && <span className="admin-page__subs-user-mail">{subsUser.mail}</span>}
                      <span className="admin-page__subs-user-id">ID: {subsUserId}</span>
                    </div>
                    <div className="admin-page__subs-list">
                      {subsList.map((s) => (
                        <div key={s.id}>
                        <div className={`admin-page__subs-item admin-page__subs-item--${s.status}`}>
                          <div className="admin-page__subs-item-main">
                            <div className="admin-page__subs-item-row">
                              <span className="admin-page__subs-item-tier">
                                {s.tier === "pro" ? "Pro" : "Basic"}
                                {s.trial_ends_at && " · Trial"}
                              </span>
                              <Badge variant={s.status === "active" ? "success" : s.status === "cancelled" ? "rejected" : "draft"}>
                                {s.status === "active" ? "Активна" : s.status === "cancelled" ? "Отменена" : s.status === "expired" ? "Истекла" : s.status}
                              </Badge>
                            </div>
                            <div className="admin-page__subs-item-meta">
                              <span>Подписка #{s.id}</span>
                              {s.started_at && <span>С {formatDate(s.started_at)}</span>}
                              {s.expires_at && <span>До {formatDate(s.expires_at)}</span>}
                              {s.trial_ends_at && <span>Trial до {formatDate(s.trial_ends_at)}</span>}
                              {s.cancelled_at && <span>Отменена {formatDate(s.cancelled_at)}</span>}
                            </div>
                          </div>
                          <div className="admin-page__subs-item-actions">
                            <Button variant="ghost" size="small" onClick={() => openSubEvents(s.id)} title="История событий">
                              События
                            </Button>
                            {s.status === "active" && (
                              <>
                                <Button variant="ghost" size="small" onClick={() => openExtendModal(s)} title="Продлить подписку">
                                  Продлить
                                </Button>
                                <Button variant="ghost" size="small" className="admin-delete-btn" onClick={() => handleCancelSubscription(s)} title="Отменить подписку">
                                  Отменить
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {subEventsOpen === s.id && (
                          <div className="admin-page__sub-events" style={{ padding: "0.75rem 1rem", marginTop: "0.5rem", background: "var(--page-bg-alt)", borderRadius: "0.5rem", fontSize: "0.875rem" }}>
                            {subEventsData ? (
                              subEventsData.length === 0 ? (
                                <p className="admin-page__hint">Событий нет</p>
                              ) : (
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                  {subEventsData.map((ev) => (
                                    <li key={ev.id} style={{ padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
                                      <strong>{ev.event_type}</strong>
                                      {ev.details && <span style={{ marginLeft: "0.5rem", color: "var(--text-muted)" }}>{JSON.stringify(ev.details)}</span>}
                                      <span style={{ marginLeft: "0.5rem", color: "var(--text-muted)" }}>{formatDate(ev.created_at)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )
                            ) : (
                              <p className="admin-page__hint">Загрузка…</p>
                            )}
                          </div>
                        )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subsList.length === 0 && !subsLoading && subsUserId.trim() && !subsError && <p className="admin-page__hint">Подписок не найдено</p>}
              </Card>
            )}

            {subsInnerTab === "create" && (
              <Card variant="solid" padding="lg" className="profile-section-card admin-page__card admin-page__card--create-sub">
                <div className="admin-page__create-sub-header">
                  <h2 className="profile-section-card__title">Создать подписку</h2>
                  <p className="profile-section-desc admin-page__sub-desc">Подключите подписку пользователю. Существующие активные подписки будут отменены.</p>
                </div>
                {subsError && <p className="admin-page__error" role="alert">{subsError}</p>}
                <div className="admin-page__subs-create-form">
                  <fieldset className="admin-page__create-sub-section">
                    <legend className="admin-page__create-sub-legend">Пользователь</legend>
                    <div className="admin-page__subs-create-grid">
                      <div className="admin-page__subs-user-search">
                        <Input
                          label="Поиск"
                          type="text"
                          placeholder="Email или имя (мин. 2 символа)"
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                        />
                        {userSearchResults.length > 0 && (
                          <div className="admin-page__user-results">
                            {userSearchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                className="admin-page__user-result-item"
                                onClick={() => {
                                  setCreateSubForm((f) => ({ ...f, userId: String(u.id) }));
                                  setUserSearchQuery("");
                                  setUserSearchResults([]);
                                }}
                              >
                                {u.full_name || u.mail || `ID ${u.id}`}
                                <span className="admin-page__user-result-mail">{u.mail}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        label="ID"
                        type="number"
                        placeholder="или введите ID"
                        value={createSubForm.userId}
                        onChange={(e) => setCreateSubForm((f) => ({ ...f, userId: e.target.value }))}
                      />
                    </div>
                  </fieldset>
                  <fieldset className="admin-page__create-sub-section">
                    <legend className="admin-page__create-sub-legend">Параметры подписки</legend>
                    <div className="admin-page__subs-create-row">
                      <div className="ui-input-group admin-page__subs-tier">
                        <label htmlFor="create-sub-tier">Тариф</label>
                        <select
                          id="create-sub-tier"
                          className="ui-input"
                          value={createSubForm.tier}
                          onChange={(e) => setCreateSubForm((f) => ({ ...f, tier: e.target.value }))}
                        >
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                        </select>
                      </div>
                      <label className="admin-page__subs-check">
                        <input
                          type="checkbox"
                          checked={createSubForm.isTrial}
                          onChange={(e) => setCreateSubForm((f) => ({ ...f, isTrial: e.target.checked }))}
                        />
                        Trial
                      </label>
                    </div>
                    {createSubForm.isTrial ? (
                      <div className="admin-page__subs-date-field">
                        <Input
                          label="Конец Trial"
                          type="date"
                          value={createSubForm.trialEndsAt}
                          onChange={(e) => setCreateSubForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div className="admin-page__subs-date-field">
                        <Input
                          label="Дата окончания"
                          type="date"
                          value={createSubForm.expiresAt}
                          onChange={(e) => setCreateSubForm((f) => ({ ...f, expiresAt: e.target.value }))}
                        />
                      </div>
                    )}
                  </fieldset>
                  <div className="admin-page__create-sub-actions">
                    <Button
                      variant="primary"
                      onClick={handleCreateSubscription}
                      loading={createSubSaving}
                      disabled={createSubSaving || !(createSubForm.userId || subsUserId).trim()}
                    >
                      Создать подписку
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {subApproveModal.open && subApproveModal.req && (
              <div
                className="admin-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="approve-modal-title"
                onClick={(e) => e.target === e.currentTarget && setSubApproveModal({ open: false, req: null, expiresAt: "", trialEndsAt: "" })}
              >
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 id="approve-modal-title">Согласовать запрос</h3>
                  <p className="admin-modal-desc">
                    {subApproveModal.req.user_full_name || subApproveModal.req.user_mail} — {subApproveModal.req.tier === "pro" ? "Pro" : "Basic"}
                    {subApproveModal.req.is_trial ? " (Trial)" : ""}
                  </p>
                  {subApproveModal.req.is_trial && (
                    <Input
                      label="Дата окончания Trial"
                      type="date"
                      value={subApproveModal.trialEndsAt}
                      onChange={(e) => setSubApproveModal((m) => ({ ...m, trialEndsAt: e.target.value }))}
                    />
                  )}
                  {!subApproveModal.req.is_trial && (
                    <Input
                      label="Дата окончания подписки"
                      type="date"
                      value={subApproveModal.expiresAt}
                      onChange={(e) => setSubApproveModal((m) => ({ ...m, expiresAt: e.target.value }))}
                    />
                  )}
                  <div className="admin-modal-actions">
                    <Button variant="primary" onClick={handleApproveSubmit} loading={subRequestAction === subApproveModal.req.id}>
                      Согласовать
                    </Button>
                    <Button variant="ghost" onClick={() => setSubApproveModal({ open: false, req: null, expiresAt: "", trialEndsAt: "" })}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {subRejectModal.open && subRejectModal.req && (
              <div
                className="admin-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reject-modal-title"
                onClick={(e) => e.target === e.currentTarget && setSubRejectModal({ open: false, req: null, reason: "" })}
              >
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 id="reject-modal-title">Отклонить запрос</h3>
                  <p className="admin-modal-desc">{subRejectModal.req.user_full_name || subRejectModal.req.user_mail}</p>
                  <Input
                    label="Причина (опционально)"
                    type="text"
                    placeholder="Причина отклонения"
                    value={subRejectModal.reason}
                    onChange={(e) => setSubRejectModal((m) => ({ ...m, reason: e.target.value }))}
                  />
                  <div className="admin-modal-actions">
                    <Button variant="ghost" className="admin-delete-btn" onClick={handleRejectSubmit} loading={subRequestAction === subRejectModal.req.id}>
                      Отклонить
                    </Button>
                    <Button variant="ghost" onClick={() => setSubRejectModal({ open: false, req: null, reason: "" })}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {subExtendModal.open && subExtendModal.sub && (
              <div
                className="admin-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="extend-modal-title"
                onClick={(e) => e.target === e.currentTarget && setSubExtendModal({ open: false, sub: null, newExpiresAt: "" })}
              >
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 id="extend-modal-title">Продлить подписку</h3>
                  <p className="admin-modal-desc">
                    Подписка #{subExtendModal.sub.id} ({subExtendModal.sub.tier === "pro" ? "Pro" : "Basic"})
                  </p>
                  <Input
                    label="Новая дата окончания"
                    type="date"
                    value={subExtendModal.newExpiresAt}
                    onChange={(e) => setSubExtendModal((m) => ({ ...m, newExpiresAt: e.target.value }))}
                  />
                  <div className="admin-modal-actions">
                    <Button variant="primary" onClick={handleExtendSubmit}>
                      Продлить
                    </Button>
                    <Button variant="ghost" onClick={() => setSubExtendModal({ open: false, sub: null, newExpiresAt: "" })}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!["dashboard", "subscriptions", "users", "join-requests", "vacancy-responses", "news"].includes(activeTab) && (
          <Card variant="solid" padding="lg" className="profile-section-card admin-page__card">
            <h2 className="profile-section-card__title">
              {TABS.find((t) => t.id === activeTab)?.label ?? activeTab}
            </h2>
            {loading ? (
              <div className="admin-page__empty-state" aria-busy="true">
                <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                <p className="admin-page__hint">Загрузка…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="admin-page__empty-state">
                <Inbox size={32} strokeWidth={1.5} className="admin-page__empty-icon" aria-hidden />
                <p className="admin-page__hint">Нет данных</p>
              </div>
            ) : (
              <div className="admin-page__table-wrap">
                <table className="admin-page__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Название</th>
                      {(activeTab === "equipment" || activeTab === "tasks" || activeTab === "employees") && (
                        <th>Организация</th>
                      )}
                      {activeTab !== "equipment" && activeTab !== "tasks" && (
                        <th>Опубликовано</th>
                      )}
                      <th>Дата</th>
                      <th className="admin-page__table-actions-col"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.id ?? it.user_id}</td>
                          <td>{it.name || it.title || it.full_name || "—"}</td>
                          {(activeTab === "equipment" || activeTab === "tasks" || activeTab === "employees") && (
                            <td>{it.organization_name || "—"}</td>
                          )}
                          {activeTab !== "equipment" && activeTab !== "tasks" && (
                            <td>{it.is_published ? "Да" : "Нет"}</td>
                          )}
                          <td>{formatDate(it.created_at)}</td>
                          <td className="admin-page__table-actions-col">
                            <div className="admin-page__table-actions">
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() =>
                                openEdit(
                                  activeTab === "organizations"
                                    ? "organization"
                                    : activeTab === "laboratories"
                                      ? "laboratory"
                                      : activeTab === "vacancies"
                                        ? "vacancy"
                                        : activeTab === "queries"
                                          ? "query"
                                          : activeTab === "equipment"
                                            ? "equipment"
                                            : activeTab === "tasks"
                                              ? "task"
                                              : activeTab === "employees"
                                                ? "employee"
                                                : activeTab === "students"
                                                  ? "student"
                                                  : "researcher",
                                  it
                                )
                              }
                            >
                              Редактировать
                            </Button>
                            <Button
                              variant="ghost"
                              size="small"
                              className="admin-delete-btn"
                              onClick={() =>
                                openDeleteConfirm(
                                  activeTab === "organizations"
                                    ? "organization"
                                    : activeTab === "laboratories"
                                      ? "laboratory"
                                      : activeTab === "vacancies"
                                        ? "vacancy"
                                        : activeTab === "queries"
                                          ? "query"
                                          : activeTab === "equipment"
                                            ? "equipment"
                                            : activeTab === "tasks"
                                              ? "task"
                                              : activeTab === "employees"
                                                ? "employee"
                                                : activeTab === "students"
                                                  ? "student"
                                                  : "researcher",
                                  it
                                )
                              }
                              disabled={deleting}
                              title="Удалить"
                            >
                              Удалить
                            </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && total > PAGE_SIZE && (
              <div className="admin-page__pagination">
                <span className="admin-page__pagination-info">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} из {total}
                </span>
                <div className="admin-page__pagination-btns">
                  <Button
                    variant="ghost"
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    disabled={page * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {feedbackDetail && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-detail-title"
          onClick={(e) => e.target === e.currentTarget && !feedbackActionLoading && setFeedbackDetail(null)}
        >
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="admin-page__feedback-detail-header">
              <div>
                <h3 id="feedback-detail-title">Обращение #{feedbackDetail.id}</h3>
                <p className="admin-modal-desc">{feedbackDetail.subject}</p>
              </div>
              <Badge variant={feedbackDetail.status === "done" ? "success" : "draft"}>
                {feedbackDetail.status === "done" ? "Обработано" : "Новое"}
              </Badge>
            </div>

            {feedbackDetailLoading ? (
              <div className="admin-page__empty-state">
                <Loader2 size={28} strokeWidth={1.5} className="admin-page__empty-icon admin-page__empty-icon--spin" aria-hidden />
                <p className="admin-page__hint">Загрузка…</p>
              </div>
            ) : (
              <div className="admin-page__feedback-detail">
                <div className="admin-page__feedback-grid">
                  <div className="admin-page__feedback-block">
                    <span className="admin-page__feedback-label">Пользователь</span>
                    <strong>{feedbackDetail.user ? feedbackDetail.user.full_name || feedbackDetail.user.mail || `#${feedbackDetail.user.id}` : "Гость"}</strong>
                    {feedbackDetail.user?.mail && <span>{feedbackDetail.user.mail}</span>}
                    {feedbackDetail.user?.role_name && <span>{feedbackDetail.user.role_name}</span>}
                  </div>
                  <div className="admin-page__feedback-block">
                    <span className="admin-page__feedback-label">Дата</span>
                    <strong>{formatDateTime(feedbackDetail.created_at)}</strong>
                  </div>
                  <div className="admin-page__feedback-block">
                    <span className="admin-page__feedback-label">URL</span>
                    <a href={feedbackDetail.current_url} target="_blank" rel="noopener noreferrer" className="admin-resume-link">
                      {feedbackDetail.current_url}
                    </a>
                  </div>
                  <div className="admin-page__feedback-block">
                    <span className="admin-page__feedback-label">Viewport</span>
                    <strong>
                      {feedbackDetail.viewport_width || "—"} × {feedbackDetail.viewport_height || "—"}
                    </strong>
                  </div>
                </div>

                <div className="admin-page__feedback-block">
                  <span className="admin-page__feedback-label">Описание</span>
                  <p className="admin-page__feedback-text">{feedbackDetail.description}</p>
                </div>

                <div className="admin-page__feedback-block">
                  <span className="admin-page__feedback-label">Что делали перед ошибкой</span>
                  <p className="admin-page__feedback-text">{feedbackDetail.steps_to_reproduce || "Не указано"}</p>
                </div>

                <div className="admin-page__feedback-block">
                  <span className="admin-page__feedback-label">User agent</span>
                  <p className="admin-page__feedback-mono">{feedbackDetail.user_agent || "Не указан"}</p>
                </div>

                <div className="admin-page__feedback-block">
                  <span className="admin-page__feedback-label">Скриншоты</span>
                  {feedbackDetail.attachments?.length ? (
                    <div className="admin-page__feedback-attachments">
                      {feedbackDetail.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-page__feedback-attachment"
                        >
                          <img src={attachment.file_url} alt={attachment.original_name} />
                          <span>{attachment.original_name}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-page__hint">Скриншоты не приложены</p>
                  )}
                </div>
              </div>
            )}

            <div className="admin-modal-actions">
              <Button variant="primary" onClick={handleFeedbackStatusToggle} loading={feedbackActionLoading} disabled={feedbackDetailLoading}>
                {feedbackDetail.status === "done" ? "Вернуть в новые" : "Отметить обработанным"}
              </Button>
              <Button variant="ghost" onClick={() => setFeedbackDetail(null)} disabled={feedbackActionLoading || feedbackDetailLoading}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmModal.open && deleteConfirmModal.item && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={(e) => e.target === e.currentTarget && !deleting && setDeleteConfirmModal({ open: false, type: null, item: null })}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-confirm-title">Подтверждение удаления</h3>
            <p className="admin-modal-desc">
              Удалить «{deleteConfirmModal.item.name || deleteConfirmModal.item.title || deleteConfirmModal.item.full_name || `#${deleteConfirmModal.item.id ?? deleteConfirmModal.item.user_id}`}»? Это действие нельзя отменить.
            </p>
            <div className="admin-modal-actions">
              <Button variant="ghost" className="admin-delete-btn" onClick={handleDeleteConfirm} loading={deleting}>
                Удалить
              </Button>
              <Button variant="ghost" onClick={() => setDeleteConfirmModal({ open: false, type: null, item: null })} disabled={deleting}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {editDrawer.open && editDrawer.form && (
        <div className={getOverlayClass()}>
          <div className={getFormClass()}>
            <div className={`${getFormClass()}__header`}>
              <h5>{getEditTitle()}</h5>
            </div>
            <div className={`${getFormClass()}__scroll`}>
              <div className="profile-form profile-form--grouped lab-form-grouped">
            {editDrawer.type === "organization" && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Building2 size={16} /> Основные данные
                  </div>
                  <Input
                    label="Название"
                    value={editDrawer.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Описание</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Контакты и интеграции
                  </div>
                  <Input
                    label="Адрес"
                    value={editDrawer.form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                  />
                  <Input
                    label="Сайт"
                    value={editDrawer.form.website}
                    onChange={(e) => updateForm("website", e.target.value)}
                  />
                  <AdminMediaField
                    urls={editDrawer.form.avatar_url ? [editDrawer.form.avatar_url] : []}
                    onChange={(urls) => updateForm("avatar_url", urls[0] || "")}
                    onUpload={(files) => uploadAdminMedia(files, "organization")}
                    uploading={uploading}
                    disabled={saving}
                  />
                  <Input
                    label="ROR ID"
                    value={editDrawer.form.ror_id}
                    onChange={(e) => updateForm("ror_id", e.target.value)}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "laboratory" && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Основная информация
                  </div>
                  <Input
                    label="Название"
                    value={editDrawer.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                  <Input
                    label="Описание"
                    value={editDrawer.form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Деятельность</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.activities}
                      onChange={(e) => updateForm("activities", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Users size={16} /> Команда
                  </div>
                  <div className="lab-select-group">
                    <label>Руководитель</label>
                    <EntitySelect
                      items={editDrawer.item?.employees || orgEmployees}
                      value={editDrawer.form.head_employee_id}
                      onChange={(v) => updateForm("head_employee_id", v)}
                      placeholder="Не выбран"
                      labelKey="full_name"
                    />
                  </div>
                  <EntityCheckboxList
                    variant="lab"
                    listLabel="Участники"
                    items={editDrawer.item?.employees || orgEmployees}
                    selectedIds={editDrawer.form.employee_ids || []}
                    onChange={(ids) => updateForm("employee_ids", ids)}
                    labelKey="full_name"
                  />
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Wrench size={16} /> Оборудование и задачи
                  </div>
                  <EntityCheckboxList
                    variant="lab"
                    listLabel="Оборудование"
                    items={editDrawer.item?.equipment || orgEquipment}
                    selectedIds={editDrawer.form.equipment_ids || []}
                    onChange={(ids) => updateForm("equipment_ids", ids)}
                  />
                  <div style={{ marginTop: "1rem" }}>
                    <EntityCheckboxList
                      variant="lab"
                      listLabel="Решённые задачи"
                      items={editDrawer.item?.task_solutions || orgTasks}
                      selectedIds={editDrawer.form.task_solution_ids || []}
                      onChange={(ids) => updateForm("task_solution_ids", ids)}
                      labelKey="title"
                    />
                  </div>
                </div>
                <AdminMediaField
                  urls={editDrawer.form.image_urls}
                  onChange={(urls) => updateForm("image_urls", urls)}
                  onUpload={(files) => uploadAdminMedia(files, "laboratory")}
                  uploading={uploading}
                  disabled={saving}
                />
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "vacancy" && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Основная информация
                  </div>
                  <Input
                    label="Название"
                    value={editDrawer.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Требования</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.requirements}
                      onChange={(e) => updateForm("requirements", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Описание</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Input
                    label="Тип занятости"
                    value={editDrawer.form.employment_type}
                    onChange={(e) => updateForm("employment_type", e.target.value)}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <HelpCircle size={16} /> Связанный запрос
                  </div>
                  <div className="lab-select-group">
                    <label>Запрос</label>
                    <EntitySelect
                      items={orgQueries}
                      value={editDrawer.form.query_id}
                      onChange={(v) => updateForm("query_id", v)}
                      placeholder="Не выбран"
                      labelKey="title"
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Beaker size={16} /> Лаборатория
                  </div>
                  <div className="lab-select-group">
                    <label>Лаборатория</label>
                    <EntitySelect
                      items={orgLabs}
                      value={editDrawer.form.laboratory_id}
                      onChange={(v) => updateForm("laboratory_id", v)}
                      placeholder="Не выбрана"
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <User size={16} /> Контакт для связи
                  </div>
                  <div className="lab-select-group">
                    <label>Контактное лицо</label>
                    <EntitySelect
                      items={orgEmployees}
                      value={editDrawer.form.contact_employee_id}
                      onChange={(v) => updateForm("contact_employee_id", v)}
                      placeholder="Не выбран"
                      labelKey="full_name"
                    />
                  </div>
                  <Input
                    label="Контактный email"
                    value={editDrawer.form.contact_email}
                    onChange={(e) => updateForm("contact_email", e.target.value)}
                  />
                  <Input
                    label="Контактный телефон"
                    value={editDrawer.form.contact_phone}
                    onChange={(e) => updateForm("contact_phone", e.target.value)}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "query" && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Основная информация
                  </div>
                  <Input
                    label="Заголовок"
                    value={editDrawer.form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Описание задачи</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.task_description}
                      onChange={(e) => updateForm("task_description", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Input
                    label="Статус"
                    value={editDrawer.form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Примеры выполненных работ</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.completed_examples}
                      onChange={(e) => updateForm("completed_examples", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Coins size={16} /> Бюджет, сроки и грант
                  </div>
                  <Input
                    label="Информация о гранте"
                    value={editDrawer.form.grant_info}
                    onChange={(e) => updateForm("grant_info", e.target.value)}
                  />
                  <Input
                    label="Бюджет"
                    value={editDrawer.form.budget}
                    onChange={(e) => updateForm("budget", e.target.value)}
                  />
                  <Input
                    label="Дедлайн"
                    value={editDrawer.form.deadline}
                    onChange={(e) => updateForm("deadline", e.target.value)}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Link2 size={16} /> Связанная задача
                  </div>
                  <div className="lab-select-group">
                    <label>Привязанная задача</label>
                    <EntitySelect
                      items={orgTasks}
                      value={editDrawer.form.linked_task_solution_id}
                      onChange={(v) => updateForm("linked_task_solution_id", v)}
                      placeholder="Не выбрана"
                      labelKey="title"
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Beaker size={16} /> Лаборатории
                  </div>
                  <EntityCheckboxList
                    variant="lab"
                    items={editDrawer.item?.laboratories || orgLabs}
                    selectedIds={editDrawer.form.laboratory_ids || []}
                    onChange={(ids) => updateForm("laboratory_ids", ids)}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Users size={16} /> Ответственные сотрудники
                  </div>
                  <EntityCheckboxList
                    variant="lab"
                    items={editDrawer.item?.employees || orgEmployees}
                    selectedIds={editDrawer.form.employee_ids || []}
                    onChange={(ids) => updateForm("employee_ids", ids)}
                    labelKey="full_name"
                  />
                </div>
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "student" && editDrawer.form && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <GraduationCap size={16} /> Основная информация
                  </div>
                  <Input
                    label="ФИО"
                    value={editDrawer.form.full_name}
                    onChange={(e) => updateForm("full_name", e.target.value)}
                  />
                  <Input
                    label="Статус"
                    value={editDrawer.form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Навыки (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.skills}
                      onChange={(e) => updateForm("skills", e.target.value)}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>О себе</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.summary}
                      onChange={(e) => updateForm("summary", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Input
                    label="URL резюме"
                    value={editDrawer.form.resume_url}
                    onChange={(e) => updateForm("resume_url", e.target.value)}
                  />
                  {editDrawer.form.resume_url && (
                    <a href={editDrawer.form.resume_url} target="_blank" rel="noreferrer" className="file-link">
                      Открыть резюме
                    </a>
                  )}
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <BookOpen size={16} /> Образование и интересы
                  </div>
                  <div className="ui-input-group">
                    <label>Образование (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.education}
                      onChange={(e) => updateForm("education", e.target.value)}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Научные интересы (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.research_interests}
                      onChange={(e) => updateForm("research_interests", e.target.value)}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "researcher" && editDrawer.form && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <User size={16} /> Основная информация
                  </div>
                  <Input
                    label="ФИО"
                    value={editDrawer.form.full_name}
                    onChange={(e) => updateForm("full_name", e.target.value)}
                  />
                  <Input
                    label="Должность"
                    value={editDrawer.form.position}
                    onChange={(e) => updateForm("position", e.target.value)}
                  />
                  <Input
                    label="Учёная степень"
                    value={editDrawer.form.academic_degree}
                    onChange={(e) => updateForm("academic_degree", e.target.value)}
                  />
                  <Input
                    label="URL резюме"
                    value={editDrawer.form.resume_url}
                    onChange={(e) => updateForm("resume_url", e.target.value)}
                  />
                  {editDrawer.form.resume_url && (
                    <a href={editDrawer.form.resume_url} target="_blank" rel="noreferrer" className="file-link">
                      Открыть резюме
                    </a>
                  )}
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <BookOpen size={16} /> Образование и интересы
                  </div>
                  <div className="ui-input-group">
                    <label>Научные интересы (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.research_interests}
                      onChange={(e) => updateForm("research_interests", e.target.value)}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Образование (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.education}
                      onChange={(e) => updateForm("education", e.target.value)}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="lab-form-actions" style={{ gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {editDrawer.form.is_published ? "Опубликовано" : "Снято с публикации"}
                    </span>
                    {editDrawer.form.is_published ? (
                      <Button variant="ghost" size="small" onClick={handleUnpublish}>
                        Снять с публикации
                      </Button>
                    ) : (
                      <Button variant="ghost" size="small" onClick={handlePublish}>
                        Опубликовать
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {editDrawer.type === "equipment" && editDrawer.form && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Основная информация
                  </div>
                  <Input
                    label="Название"
                    value={editDrawer.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Характеристики</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.characteristics}
                      onChange={(e) => updateForm("characteristics", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Описание</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Beaker size={16} /> Размещение
                  </div>
                  {(editDrawer.orgLabs || []).length > 0 && (
                    <div className="equipment-checkbox-list">
                      <label className="equipment-checkbox-list__label">Где установлено (лаборатории)</label>
                      <div className="equipment-checkbox-grid">
                        {(editDrawer.orgLabs || []).map((lab) => (
                          <label key={lab.id} className="equipment-selection-item">
                            <input
                              type="checkbox"
                              checked={(editDrawer.form.laboratory_ids || []).includes(lab.id)}
                              onChange={() => toggleLabId(lab.id)}
                            />
                            <span>{lab.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <AdminMediaField
                  urls={editDrawer.form.image_urls}
                  onChange={(urls) => updateForm("image_urls", urls)}
                  onUpload={(files) => uploadAdminMedia(files, "equipment")}
                  uploading={uploading}
                  disabled={saving}
                />
              </>
            )}
            {editDrawer.type === "task" && editDrawer.form && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Layout size={16} /> Основная информация
                  </div>
                  <Input
                    label="Заголовок"
                    value={editDrawer.form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Описание задачи</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.task_description}
                      onChange={(e) => updateForm("task_description", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Решение и результат</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.solution_description}
                      onChange={(e) => updateForm("solution_description", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Ссылки на статьи (каждая с новой строки)</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.article_links}
                      onChange={(e) => updateForm("article_links", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Input
                    label="Сроки"
                    value={editDrawer.form.solution_deadline}
                    onChange={(e) => updateForm("solution_deadline", e.target.value)}
                  />
                  <Input
                    label="Грант"
                    value={editDrawer.form.grant_info}
                    onChange={(e) => updateForm("grant_info", e.target.value)}
                  />
                  <Input
                    label="Стоимость"
                    value={editDrawer.form.cost}
                    onChange={(e) => updateForm("cost", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Альтернативы</label>
                    <textarea
                      className="ui-input"
                      value={editDrawer.form.external_solutions}
                      onChange={(e) => updateForm("external_solutions", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Beaker size={16} /> Лаборатории
                  </div>
                  {(editDrawer.orgLabs || []).length > 0 && (
                    <div className="equipment-checkbox-list">
                      <label className="equipment-checkbox-list__label">Лаборатории</label>
                      <div className="equipment-checkbox-grid">
                        {(editDrawer.orgLabs || []).map((lab) => (
                          <label key={lab.id} className="equipment-selection-item">
                            <input
                              type="checkbox"
                              checked={(editDrawer.form.laboratory_ids || []).includes(lab.id)}
                              onChange={() => toggleLabId(lab.id)}
                            />
                            <span>{lab.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            {editDrawer.type === "employee" && editDrawer.form && (
              <>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <User size={16} /> Основная информация
                  </div>
                  <Input
                    label="ФИО"
                    value={editDrawer.form.full_name}
                    onChange={(e) => updateForm("full_name", e.target.value)}
                  />
                  <div className="ui-input-group">
                    <label>Должности (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.positions}
                      onChange={(e) => updateForm("positions", e.target.value)}
                    />
                  </div>
                  <Input
                    label="Учёная степень"
                    value={editDrawer.form.academic_degree}
                    onChange={(e) => updateForm("academic_degree", e.target.value)}
                  />
                  <AdminMediaField
                    urls={editDrawer.form.photo_url ? [editDrawer.form.photo_url] : []}
                    onChange={(urls) => updateForm("photo_url", urls[0] || "")}
                    onUpload={(files) => uploadAdminMedia(files, "profile")}
                    uploading={uploading}
                    disabled={saving}
                  />
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <BookOpen size={16} /> Научные интересы и образование
                  </div>
                  <div className="ui-input-group">
                    <label>Научные интересы (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.research_interests}
                      onChange={(e) => updateForm("research_interests", e.target.value)}
                    />
                  </div>
                  <div className="ui-input-group">
                    <label>Образование (через запятую)</label>
                    <input
                      type="text"
                      className="ui-input"
                      value={editDrawer.form.education}
                      onChange={(e) => updateForm("education", e.target.value)}
                    />
                  </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <TrendingUp size={16} /> Индексы Хирша
                  </div>
                  <div className="researcher-hindex-grid">
                  <Input
                    label="h-index WoS"
                    type="number"
                    value={editDrawer.form.hindex_wos ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateForm("hindex_wos", v === "" ? null : (parseInt(v, 10) || null));
                    }}
                  />
                  <Input
                    label="h-index Scopus"
                    type="number"
                    value={editDrawer.form.hindex_scopus ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateForm("hindex_scopus", v === "" ? null : (parseInt(v, 10) || null));
                    }}
                  />
                  <Input
                    label="h-index РИНЦ"
                    type="number"
                    value={editDrawer.form.hindex_rsci ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateForm("hindex_rsci", v === "" ? null : (parseInt(v, 10) || null));
                    }}
                  />
                  <Input
                    label="h-index OpenAlex"
                    type="number"
                    value={editDrawer.form.hindex_openalex ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateForm("hindex_openalex", v === "" ? null : (parseInt(v, 10) || null));
                    }}
                  />
                </div>
                </div>
                <div className="profile-form-group">
                  <div className="profile-form-group-title">
                    <Beaker size={16} /> Лаборатории
                  </div>
                  {(editDrawer.orgLabs || []).length > 0 && (
                    <div className="lab-checkbox-list">
                      <label className="lab-checkbox-list__label">Лаборатории</label>
                      <div className="lab-checkbox-grid">
                        {(editDrawer.orgLabs || []).map((lab) => (
                          <label key={lab.id} className="lab-selection-item">
                            <input
                              type="checkbox"
                              checked={(editDrawer.form.laboratory_ids || []).includes(lab.id)}
                              onChange={() => toggleLabId(lab.id)}
                            />
                            <span>{lab.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
              </div>
            </div>
            <div className={`${getFormClass()}__footer`}>
              {saveError && (
                <p className="ui-input-error" style={{ marginRight: "auto" }} role="alert">
                  {saveError}
                </p>
              )}
              <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                Сохранить
              </Button>
              <Button variant="ghost" onClick={closeEdit} disabled={saving}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
