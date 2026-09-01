import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ToastContext";
import ProfileSummary from "./profile/ProfileSummary";
import SummaryTabContent from "./profile/SummaryTabContent";
import SubscriptionTab from "./profile/SubscriptionTab";
import StudentProfileSection from "./profile/StudentProfileSection";
import ResearcherProfileSection from "./profile/ResearcherProfileSection";
import OrganizationProfileSection from "./profile/OrganizationProfileSection";
import MyJoinRequestsSection from "./profile/MyJoinRequestsSection";
import MyVacancyResponsesSection from "./profile/MyVacancyResponsesSection";
import GalleryModal from "./profile/GalleryModal";
import EmployeeModal from "./profile/EmployeeModal";
import PersonalProfileSection from "./profile/PersonalProfileSection";
import ProfileSidebar from "./profile/ProfileSidebar";

const EMPTY_ORG_PROFILE = {
  name: "",
  avatar_url: "",
  description: "",
  address: "",
  website: "",
  hidden_public_sections: [],
};

export default function Profile() {
  const { auth, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [orgProfile, setOrgProfile] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [researcherProfile, setResearcherProfile] = useState(null);
  const [orgEquipment, setOrgEquipment] = useState([]);
  const [orgLabs, setOrgLabs] = useState([]);
  const [orgEmployees, setOrgEmployees] = useState([]);
  const [orgTasks, setOrgTasks] = useState([]);
  const [orgQueries, setOrgQueries] = useState([]);
  const [orgVacancies, setOrgVacancies] = useState([]);
  const [equipmentDraft, setEquipmentDraft] = useState({
    name: "",
    description: "",
    characteristics: "",
    image_urls: [],
    laboratory_ids: [],
  });
  const [labDraft, setLabDraft] = useState({
    name: "",
    description: "",
    activities: "",
    image_urls: [],
    employee_ids: [],
    head_employee_id: null,
    equipment_ids: [],
    task_solution_ids: [],
    hidden_public_sections: [],
  });
  const [editingEquipmentId, setEditingEquipmentId] = useState(null);
  const [editingLabId, setEditingLabId] = useState(null);
  const [equipmentEdit, setEquipmentEdit] = useState(null);
  const [labEdit, setLabEdit] = useState(null);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    task_description: "",
    solution_description: "",
    article_links: [],
    solution_deadline: "",
    grant_info: "",
    cost: "",
    external_solutions: "",
    laboratory_ids: [],
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskEdit, setTaskEdit] = useState(null);
  const [queryDraft, setQueryDraft] = useState({
    title: "",
    task_description: "",
    completed_examples: "",
    grant_info: "",
    budget: "",
    deadline: "",
    status: "active",
    linked_task_solution_id: null,
    laboratory_ids: [],
    employee_ids: [],
  });
  const [editingQueryId, setEditingQueryId] = useState(null);
  const [queryEdit, setQueryEdit] = useState(null);
  const [vacancyDraft, setVacancyDraft] = useState({
    name: "",
    requirements: "",
    description: "",
    employment_type: "",
    query_id: null,
    laboratory_id: null,
    contact_employee_id: null,
    contact_email: "",
    contact_phone: "",
  });
  const [editingVacancyId, setEditingVacancyId] = useState(null);
  const [vacancyEdit, setVacancyEdit] = useState(null);
  const [employeeDraft, setEmployeeDraft] = useState({
    full_name: "",
    positions: [],
    academic_degree: "",
    photo_url: "",
    research_interests: [],
    laboratory_ids: [],
    education: [],
    publications: [],
    hindex_wos: "",
    hindex_scopus: "",
    hindex_rsci: "",
    hindex_openalex: null,
    contacts: { email: "", phone: "", website: "", telegram: "" },
  });
  const [employeeEditId, setEmployeeEditId] = useState(null);
  const [employeeEdit, setEmployeeEdit] = useState(null);
  const [employeeDraftPositionInput, setEmployeeDraftPositionInput] = useState("");
  const [employeeEditPositionInput, setEmployeeEditPositionInput] = useState("");
  const [employeePreview, setEmployeePreview] = useState(null);
  const [showDraftPublications, setShowDraftPublications] = useState(false);
  const [showEditPublications, setShowEditPublications] = useState(false);
  const [showEmployeePublications, setShowEmployeePublications] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gallery, setGallery] = useState({ open: false, images: [], index: 0 });
  const [galleryZoom, setGalleryZoom] = useState(1);
  const [orgTab, setOrgTab] = useState("profile");
  const profileContentRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const errorRef = useRef(null);
  const [orcidError, setOrcidError] = useState(null);
  const researcherFileInputRefs = React.useRef([]);
  const studentFileInputRefs = React.useRef([]);
  const orgAvatarInputRef = React.useRef(null);
  const orgStaffFileInputRefs = React.useRef([]);
  const orgEquipmentFileInputRefs = React.useRef([]);
  const orgLabFileInputRefs = React.useRef([]);
  const pendingLabEditIdRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [error]);

  const clearFileInputs = (refs) => {
    (refs?.current ?? refs)?.forEach((r) => r?.current && (r.current.value = ""));
  };

  const clearError = () => setError(null);

  const roleKey = useMemo(() => {
    if (!profile?.role_id) return null;
    const byId = roles.find((role) => Number(role.id) === Number(profile.role_id));
    return byId?.name ?? null;
  }, [profile, roles]);

  const ALLOWED_SECTIONS_BY_ROLE = {
    lab_admin: ["summary", "personal", "subscription", "organization"],
    lab_representative: ["summary", "personal", "subscription", "organization"],
    student: ["summary", "personal", "student", "my-vacancy-responses"],
    researcher: ["summary", "personal", "researcher", "my-requests", "my-vacancy-responses"],
  };

  const emailVerified = (profile?.email_verified ?? auth?.user?.email_verified) === true;
  const profileSection = (() => {
    const fromUrl = searchParams.get("section");
    const allowed = !emailVerified
      ? ["summary", "personal"]
      : roleKey
        ? (ALLOWED_SECTIONS_BY_ROLE[roleKey] || ["summary"])
        : ["summary"];
    if (fromUrl && allowed.includes(fromUrl)) return fromUrl;
    return allowed[0] || "summary";
  })();

  const setProfileSection = (section) => {
    setSearchParams({ section }, { replace: true });
  };

  const roleName = useMemo(() => {
    if (!profile?.role_id) return "—";
    const byId = roles.find((r) => Number(r.id) === Number(profile.role_id));
    return byId?.display_name ?? byId?.name ?? `Роль #${profile.role_id}`;
  }, [profile, roles]);

  const isOrgRole = roleKey === "lab_admin" || roleKey === "lab_representative";
  const isResearcherRole = roleKey === "researcher";

  useEffect(() => {
    if (roleKey === "lab_representative" && orgTab === "profile") {
      setOrgTab("labs");
    }
  }, [roleKey, orgTab]);

  useEffect(() => {
    if (profileSection === "organization" && profileContentRef.current) {
      profileContentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [profileSection, orgTab]);

  const roleLabelByName = (name) => {
    const r = roles.find((x) => x.name === name);
    return r?.display_name ?? name;
  };

  const loadLabs = async () => {
    try {
      const labsList = await apiRequest("/profile/organization/laboratories");
      setOrgLabs(labsList);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    }
  };

  const loadEquipment = async () => {
    try {
      const list = await apiRequest("/profile/organization/equipment");
      setOrgEquipment(list);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    }
  };

  const loadTasks = async () => {
    try {
      const list = await apiRequest("/profile/organization/tasks");
      setOrgTasks(list);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    }
  };

  const loadEmployees = async () => {
    try {
      const list = await apiRequest("/profile/organization/employees");
      setOrgEmployees(list);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    }
  };

  const loadOrganizationSection = async (signal) => {
    const opts = signal ? { signal } : {};
    const [equipmentList, labsList, employeesList, tasksList, queriesList, vacanciesList] =
      await Promise.all([
        apiRequest("/profile/organization/equipment", opts),
        apiRequest("/profile/organization/laboratories", opts),
        apiRequest("/profile/organization/employees", opts),
        apiRequest("/profile/organization/tasks", opts),
        apiRequest("/profile/organization/queries", opts),
        apiRequest("/profile/organization/vacancies", opts),
      ]);

    setOrgEquipment(equipmentList);
    setOrgLabs(labsList);
    setOrgEmployees(employeesList);
    setOrgTasks(tasksList);
    setOrgQueries(queriesList);
    setOrgVacancies(vacanciesList);

    try {
      const org = await apiRequest("/profile/organization", opts);
      setOrgProfile(org ?? EMPTY_ORG_PROFILE);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      setOrgProfile(EMPTY_ORG_PROFILE);
    }
  };

  const orcidLinked = searchParams.get("orcid") === "linked";
  const orcidErrorFromUrl = searchParams.get("error");

  useEffect(() => {
    if (orcidErrorFromUrl && ["link_failed", "orcid_already_linked", "user_not_found", "invalid_link", "link_expired", "orcid_unavailable"].includes(orcidErrorFromUrl)) {
      setOrcidError(orcidErrorFromUrl);
      setSearchParams({}, { replace: true });
    }
  }, [orcidErrorFromUrl]);
  useEffect(() => {
    if (orcidLinked) {
      setSearchParams({}, { replace: true });
    }
  }, [orcidLinked]);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "dashboard") {
      setOrgTab("dashboard");
      setSearchParams({ section: "organization" }, { replace: true });
    } else if (tab === "join-requests") {
      setOrgTab("join-requests");
      setSearchParams({ section: "organization" }, { replace: true });
    } else if (tab === "vacancy-responses") {
      setOrgTab("vacancy-responses");
      setSearchParams({ section: "organization" }, { replace: true });
    } else if (tab === "my-requests") {
      if (roleKey === "lab_representative") {
        setOrgTab("my-requests");
        setSearchParams({ section: "organization" }, { replace: true });
      } else {
        setSearchParams({ section: "my-requests" }, { replace: true });
      }
    }
  }, [searchParams, roleKey]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("profile-refresh", handler);
    return () => window.removeEventListener("profile-refresh", handler);
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      navigate("/login");
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    async function loadProfile() {
      try {
        setLoading(true);
        const opts = { signal };
        const [user, rolesList] = await Promise.all([
          apiRequest("/users/me", opts),
          apiRequest("/roles/", opts),
        ]);
        setProfile(user);
        setSelectedRoleId(String(user.role_id));
        setRoles(rolesList);
        const role = rolesList.find((item) => Number(item.id) === Number(user.role_id));
        const isOrg = role?.name === "lab_admin" || role?.name === "lab_representative";
        const isResearcher = role?.name === "researcher";
        if (isOrg) {
          await loadOrganizationSection(signal);
        } else {
          setOrgProfile(null);
          setOrgEquipment([]);
          setOrgLabs([]);
          setOrgEmployees([]);
          setOrgTasks([]);
          setOrgQueries([]);
          setOrgVacancies([]);
        }
        if (!isResearcher) {
          setResearcherProfile(null);
        }
        const isStudent = role?.name === "student";
        if (isStudent) {
          try {
            const student = await apiRequest("/profile/student", opts);
            setStudentProfile(student);
          } catch (e) {
            if (e.name === "AbortError") throw e;
            setStudentProfile(null);
          }
        } else {
          setStudentProfile(null);
        }
        if (isResearcher) {
          try {
            const researcher = await apiRequest("/profile/researcher", opts);
            setResearcherProfile(researcher);
          } catch (e) {
            if (e.name === "AbortError") throw e;
            setResearcherProfile(null);
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
    return () => controller.abort();
  }, [auth, navigate, refreshKey]);

  const handleOrgChange = (field, value) => {
    setOrgProfile((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handleStudentChange = (field, value) => {
    setStudentProfile((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handleResearcherChange = (field, value) => {
    setResearcherProfile((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handlePersonalChange = (field, value) => {
    setProfile((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handlePersonalContactsChange = (field, value) => {
    setProfile((prev) => ({
      ...(prev || {}),
      contacts: { ...(prev?.contacts || {}), [field]: value },
    }));
  };

  const savePersonalProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: profile.full_name?.trim() || "",
        contacts: profile.contacts || {},
      };
      const data = await apiRequest("/users/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProfile(data);
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = (value) => {
    setSelectedRoleId(value);
  };

  const saveRole = async () => {
    if (!selectedRoleId || Number(selectedRoleId) === Number(profile?.role_id)) return;
    setRoleSaving(true);
    setError(null);
    try {
      const updated = await apiRequest("/users/me/role", {
        method: "PUT",
        body: JSON.stringify({ role_id: Number(selectedRoleId) }),
      });
      setProfile(updated);
      await refreshUser();
      const updatedRole = roles.find((item) => Number(item.id) === Number(updated.role_id));
      const isOrg = updatedRole?.name === "lab_admin" || updatedRole?.name === "lab_representative";
      const isResearcher = updatedRole?.name === "researcher";
      if (isOrg) {
        await loadOrganizationSection();
      } else {
        setOrgProfile(null);
        setOrgEquipment([]);
        setOrgLabs([]);
        setOrgEmployees([]);
        setOrgTasks([]);
        setOrgQueries([]);
        setOrgVacancies([]);
      }
      if (isResearcher) {
        try {
          const researcher = await apiRequest("/profile/researcher");
          setResearcherProfile(researcher);
        } catch {
          setResearcherProfile(null);
        }
      } else {
        setResearcherProfile(null);
      }
      showToast("Роль сохранена");
    } catch (e) {
      setError(e.message);
    } finally {
      setRoleSaving(false);
    }
  };

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

  const parseInterests = (raw) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const normalizePositions = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  };

  const parsePositions = (raw) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const addInterestPreset = (value, isEdit = false) => {
    if (isEdit && employeeEdit) {
      const list = employeeEdit.research_interests || [];
      if (list.includes(value)) return;
      handleEmployeeEditChange("research_interests", [...list, value]);
    } else {
      setEmployeeDraft((prev) => {
        const list = prev.research_interests || [];
        if (list.includes(value)) return prev;
        return { ...prev, research_interests: [...list, value] };
      });
    }
  };


  const uploadOrgAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "organization");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setOrgProfile((prev) => ({ ...(prev || {}), avatar_url: response.public_url }));
      showToast("Логотип загружен");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadUserAvatar = async (file) => {
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError("Допустимые форматы: JPEG, PNG, WebP, GIF");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Максимальный размер файла — 5 МБ");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "user");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      await apiRequest("/users/me/avatar", {
        method: "PUT",
        body: JSON.stringify({ photo_url: response.public_url }),
      });
      const updatedUser = await apiRequest("/users/me");
      setProfile(updatedUser);
      showToast("Фото загружено");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
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

  const saveOrganization = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: orgProfile?.name || "",
        avatar_url: orgProfile?.avatar_url || "",
        description: orgProfile?.description || "",
        address: orgProfile?.address || "",
        website: orgProfile?.website || "",
        hidden_public_sections: orgProfile?.hidden_public_sections || [],
      };
      const data = await apiRequest("/profile/organization", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgProfile(data);
      orgAvatarInputRef.current?.current && (orgAvatarInputRef.current.current.value = "");
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleOrgPublish = async (nextState) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest("/profile/organization/publish", {
        method: "PUT",
        body: JSON.stringify({ is_published: Boolean(nextState) }),
      });
      setOrgProfile(updated);
      showToast(nextState ? "Организация опубликована" : "Публикация снята");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleLabPublish = async (labId, nextState) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest(`/profile/organization/laboratories/${labId}/publish`, {
        method: "PUT",
        body: JSON.stringify({ is_published: Boolean(nextState) }),
      });
      setOrgLabs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(nextState ? "Лаборатория опубликована" : "Публикация снята");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleQueryPublish = async (queryId, nextState) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest(`/profile/organization/queries/${queryId}/publish`, {
        method: "PUT",
        body: JSON.stringify({ is_published: Boolean(nextState) }),
      });
      setOrgQueries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(nextState ? "Запрос опубликован" : "Публикация снята");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVacancyPublish = async (vacancyId, nextState) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest(`/profile/organization/vacancies/${vacancyId}/publish`, {
        method: "PUT",
        body: JSON.stringify({ is_published: Boolean(nextState) }),
      });
      setOrgVacancies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(nextState ? "Вакансия опубликована" : "Публикация снята");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEquipmentDraft = (field, value) => {
    setEquipmentDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabDraft = (field, value) => {
    setLabDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmployeeDraftChange = (field, value) => {
    setEmployeeDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmployeeEditChange = (field, value) => {
    setEmployeeEdit((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmployeeContacts = (field, value, isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({
      ...prev,
      contacts: { ...(prev?.contacts || {}), [field]: value },
    }));
  };

  const toggleEmployeeLab = (labId, isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => {
      const current = prev?.laboratory_ids || [];
      const next = current.includes(labId)
        ? current.filter((id) => id !== labId)
        : [...current, labId];
      return { ...prev, laboratory_ids: next };
    });
  };

  const toggleLabEquipment = (equipmentId, isEdit = false) => {
    const setter = isEdit ? setLabEdit : setLabDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.equipment_ids || [];
      const next = current.includes(equipmentId)
        ? current.filter((id) => id !== equipmentId)
        : [...current, equipmentId];
      return { ...prev, equipment_ids: next };
    });
  };

  const toggleLabTaskSolution = (taskId, isEdit = false) => {
    const setter = isEdit ? setLabEdit : setLabDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.task_solution_ids || [];
      const next = current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId];
      return { ...prev, task_solution_ids: next };
    });
  };

  const toggleEquipmentLab = (labId, isEdit = false) => {
    const setter = isEdit ? setEquipmentEdit : setEquipmentDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.laboratory_ids || [];
      const next = current.includes(labId)
        ? current.filter((id) => id !== labId)
        : [...current, labId];
      return { ...prev, laboratory_ids: next };
    });
  };

  const addEducation = (value, isEdit = false) => {
    if (!value?.trim()) return;
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({ ...prev, education: [...(prev.education || []), value.trim()] }));
  };

  const removeEducation = (index, isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({
      ...prev,
      education: (prev.education || []).filter((_, idx) => idx !== index),
    }));
  };

  const addPublication = (isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({
      ...prev,
      publications: [...(prev.publications || []), { title: "", link: "", source: "", notes: "" }],
    }));
  };

  const updatePublication = (index, field, value, isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({
      ...prev,
      publications: (prev.publications || []).map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removePublication = (index, isEdit = false) => {
    const setter = isEdit ? setEmployeeEdit : setEmployeeDraft;
    setter((prev) => ({
      ...prev,
      publications: (prev.publications || []).filter((_, idx) => idx !== index),
    }));
  };

  const uploadImage = async (file, category) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      return response.public_url;
    } finally {
      setUploading(false);
    }
  };

  const handleLabFiles = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const uploads = [];
      for (const file of files) {
        uploads.push(await uploadImage(file, "laboratory"));
      }
      setLabDraft((prev) => ({ ...prev, image_urls: [...(prev.image_urls || []), ...uploads] }));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEquipmentFiles = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const uploads = [];
      for (const file of files) {
        uploads.push(await uploadImage(file, "equipment"));
      }
      setEquipmentDraft((prev) => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...uploads],
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const startEditEquipment = (item) => {
    setEditingEquipmentId(item.id);
    setEquipmentEdit({
      name: item.name || "",
      description: item.description || "",
      characteristics: item.characteristics || "",
      image_urls: item.image_urls || [],
      laboratory_ids: (item.laboratories || []).map((lab) => lab.id),
    });
  };

  const startEditLab = async (item) => {
    const id = item.id;
    pendingLabEditIdRef.current = id;
    setEditingLabId(id);
    setLabEdit(null);
    try {
      const labsList = await apiRequest("/profile/organization/laboratories");
      if (pendingLabEditIdRef.current !== id) return;
      setOrgLabs(labsList);
      const lab = labsList.find((l) => l.id === id) || item;
      if (pendingLabEditIdRef.current !== id) return;
      setLabEdit({
        name: lab.name || "",
        description: lab.description || "",
        activities: lab.activities || "",
        image_urls: lab.image_urls || [],
        employee_ids: (lab.employees || []).map((e) => e.id),
        head_employee_id: lab.head_employee_id ?? lab.head_employee?.id ?? null,
        equipment_ids: (lab.equipment || []).map((e) => e.id),
        task_solution_ids: (lab.task_solutions || []).map((t) => t.id),
        hidden_public_sections: lab.hidden_public_sections || [],
      });
    } catch (e) {
      if (pendingLabEditIdRef.current === id) {
        setError(e.message);
        setEditingLabId(null);
      }
    }
  };

  const cancelEditEquipment = () => {
    setEditingEquipmentId(null);
    setEquipmentEdit(null);
  };

  const cancelEditLab = () => {
    setEditingLabId(null);
    setLabEdit(null);
  };

  // Синхронизация labEdit при обновлении orgLabs (напр. после создания сотрудника с привязкой к лаборатории)
  useEffect(() => {
    if (!editingLabId || !labEdit) return;
    const lab = orgLabs.find((l) => l.id === editingLabId);
    if (!lab) return;
    setLabEdit((prev) => ({
      ...prev,
      equipment_ids: (lab.equipment || []).map((e) => e.id),
      task_solution_ids: (lab.task_solutions || []).map((t) => t.id),
      employee_ids: (lab.employees || []).map((e) => e.id),
      head_employee_id: lab.head_employee_id ?? lab.head_employee?.id ?? null,
    }));
  }, [orgLabs, editingLabId]);

  const handleEquipmentEditChange = (field, value) => {
    setEquipmentEdit((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabEditChange = (field, value) => {
    setLabEdit((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLabEmployee = (employeeId, isEdit = false) => {
    if (isEdit) {
      setLabEdit((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.employee_ids || []);
        if (next.has(employeeId)) {
          next.delete(employeeId);
        } else {
          next.add(employeeId);
        }
        const head = next.has(prev.head_employee_id) ? prev.head_employee_id : null;
        return { ...prev, employee_ids: Array.from(next), head_employee_id: head };
      });
      return;
    }
    setLabDraft((prev) => {
      const next = new Set(prev.employee_ids || []);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      const head = next.has(prev.head_employee_id) ? prev.head_employee_id : null;
      return { ...prev, employee_ids: Array.from(next), head_employee_id: head };
    });
  };

  const setLabHead = (employeeId, isEdit = false) => {
    const nextHead = employeeId ?? null;
    if (isEdit) {
      setLabEdit((prev) => {
        if (!prev) return prev;
        const eids = new Set(prev.employee_ids || []);
        if (nextHead != null) eids.add(nextHead);
        return { ...prev, head_employee_id: nextHead, employee_ids: Array.from(eids) };
      });
      return;
    }
    setLabDraft((prev) => {
      const eids = new Set(prev.employee_ids || []);
      if (nextHead != null) eids.add(nextHead);
      return { ...prev, head_employee_id: nextHead, employee_ids: Array.from(eids) };
    });
  };

  const handleEquipmentEditFiles = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const uploads = [];
      for (const file of files) {
        uploads.push(await uploadImage(file, "equipment"));
      }
      setEquipmentEdit((prev) => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...uploads],
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLabEditFiles = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const uploads = [];
      for (const file of files) {
        uploads.push(await uploadImage(file, "laboratory"));
      }
      setLabEdit((prev) => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...uploads],
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const removeDraftImage = (type, index) => {
    if (type === "lab") {
      setLabDraft((prev) => ({
        ...prev,
        image_urls: (prev.image_urls || []).filter((_, idx) => idx !== index),
      }));
      return;
    }
    setEquipmentDraft((prev) => ({
      ...prev,
      image_urls: (prev.image_urls || []).filter((_, idx) => idx !== index),
    }));
  };

  const removeEditImage = (type, index) => {
    if (type === "lab") {
      setLabEdit((prev) => ({
        ...prev,
        image_urls: (prev?.image_urls || []).filter((_, idx) => idx !== index),
      }));
      return;
    }
    setEquipmentEdit((prev) => ({
      ...prev,
      image_urls: (prev?.image_urls || []).filter((_, idx) => idx !== index),
    }));
  };

  const updateEquipment = async () => {
    if (!editingEquipmentId || !equipmentEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: equipmentEdit.name.trim(),
        description: equipmentEdit.description.trim(),
        characteristics: equipmentEdit.characteristics.trim(),
        image_urls: equipmentEdit.image_urls || [],
        laboratory_ids: equipmentEdit.laboratory_ids || [],
      };
      const updated = await apiRequest(`/profile/organization/equipment/${editingEquipmentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgEquipment((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      clearFileInputs(orgEquipmentFileInputRefs);
      cancelEditEquipment();
      loadLabs();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateLab = async () => {
    if (!editingLabId || !labEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: labEdit.name.trim(),
        description: labEdit.description.trim(),
        activities: labEdit.activities.trim(),
        image_urls: labEdit.image_urls || [],
        employee_ids: labEdit.employee_ids || [],
        head_employee_id: labEdit.head_employee_id != null ? labEdit.head_employee_id : null,
        equipment_ids: labEdit.equipment_ids || [],
        task_solution_ids: labEdit.task_solution_ids || [],
        hidden_public_sections: labEdit.hidden_public_sections || [],
      };
      const updated = await apiRequest(`/profile/organization/laboratories/${editingLabId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgLabs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      loadEquipment();
      loadTasks();
      loadEmployees();
      clearFileInputs(orgLabFileInputRefs);
      cancelEditLab();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createEmployee = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: employeeDraft.full_name.trim(),
        positions: parsePositions(employeeDraftPositionInput),
        academic_degree: employeeDraft.academic_degree.trim(),
        photo_url: employeeDraft.photo_url || null,
        research_interests: employeeDraft.research_interests || [],
        laboratory_ids: employeeDraft.laboratory_ids || [],
        education: employeeDraft.education || [],
        publications: employeeDraft.publications || [],
        hindex_wos: employeeDraft.hindex_wos ? Number(employeeDraft.hindex_wos) : null,
        hindex_scopus: employeeDraft.hindex_scopus ? Number(employeeDraft.hindex_scopus) : null,
        hindex_rsci: employeeDraft.hindex_rsci ? Number(employeeDraft.hindex_rsci) : null,
        hindex_openalex: employeeDraft.hindex_openalex != null ? Number(employeeDraft.hindex_openalex) : null,
        contacts: employeeDraft.contacts || {},
      };
      if (!payload.full_name) {
        setError("Укажите ФИО сотрудника.");
        return false;
      }
      const created = await apiRequest("/profile/organization/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgEmployees((prev) => [created, ...prev]);
      loadLabs();
      clearFileInputs(orgStaffFileInputRefs);
      setEmployeeDraft({
        full_name: "",
        positions: [],
        academic_degree: "",
        photo_url: "",
        research_interests: [],
        laboratory_ids: [],
        education: [],
        publications: [],
        hindex_wos: "",
        hindex_scopus: "",
        hindex_rsci: "",
        hindex_openalex: null,
        contacts: { email: "", phone: "", website: "", telegram: "" },
      });
      setEmployeeDraftPositionInput("");
      setShowDraftPublications(false);
      showToast("Сотрудник создан");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEditEmployee = (employee) => {
    setEmployeeEditId(employee.id);
    setEmployeeEdit({
      full_name: employee.full_name || "",
      positions: normalizePositions(employee.positions),
      academic_degree: employee.academic_degree || "",
      photo_url: employee.photo_url || "",
      research_interests: employee.research_interests || [],
      laboratory_ids: (employee.laboratories || []).map((lab) => lab.id),
      education: employee.education || [],
      publications: employee.publications || [],
      hindex_wos: employee.hindex_wos ?? "",
      hindex_scopus: employee.hindex_scopus ?? "",
      hindex_rsci: employee.hindex_rsci ?? "",
      hindex_openalex: employee.hindex_openalex ?? "",
      contacts: employee.contacts || { email: "", phone: "", website: "", telegram: "" },
    });
    setEmployeeEditPositionInput(normalizePositions(employee.positions).join(", "));
    setShowEditPublications(false);
  };

  const cancelEditEmployee = () => {
    setEmployeeEditId(null);
    setEmployeeEdit(null);
    setEmployeeEditPositionInput("");
  };

  const updateEmployee = async () => {
    if (!employeeEditId || !employeeEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: employeeEdit.full_name.trim(),
        positions: parsePositions(employeeEditPositionInput),
        academic_degree: employeeEdit.academic_degree.trim(),
        photo_url: employeeEdit.photo_url || null,
        research_interests: employeeEdit.research_interests || [],
        laboratory_ids: employeeEdit.laboratory_ids || [],
        education: employeeEdit.education || [],
        publications: employeeEdit.publications || [],
        hindex_wos: employeeEdit.hindex_wos ? Number(employeeEdit.hindex_wos) : null,
        hindex_scopus: employeeEdit.hindex_scopus ? Number(employeeEdit.hindex_scopus) : null,
        hindex_rsci: employeeEdit.hindex_rsci ? Number(employeeEdit.hindex_rsci) : null,
        hindex_openalex: employeeEdit.hindex_openalex ? Number(employeeEdit.hindex_openalex) : null,
        contacts: employeeEdit.contacts || {},
      };
      const updated = await apiRequest(`/profile/organization/employees/${employeeEditId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgEmployees((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      clearFileInputs(orgStaffFileInputRefs);
      cancelEditEmployee();
      loadLabs();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const [employeeDraftImporting, setEmployeeDraftImporting] = useState(false);

  const importEmployeeOpenAlexPreview = async (orcid, openalexId) => {
    if (!orcid?.trim() && !openalexId?.trim()) return;
    setEmployeeDraftImporting(true);
    setError(null);
    try {
      const body = {};
      if (orcid?.trim()) body.orcid = orcid.trim();
      if (openalexId?.trim()) body.openalex_id = openalexId.trim();
      const data = await apiRequest("/profile/organization/employees/import-openalex-preview", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setEmployeeDraft((prev) => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        research_interests: data.research_interests || prev.research_interests || [],
        education: data.education || prev.education || [],
        publications: data.publications || prev.publications || [],
        hindex_openalex: data.hindex_openalex ?? prev.hindex_openalex,
      }));
      if (data.publications?.length) setShowDraftPublications(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEmployeeDraftImporting(false);
    }
  };

  const importEmployeeOpenAlex = async (employeeId, orcid, openalexId) => {
    if (!employeeId || (!orcid?.trim() && !openalexId?.trim())) return;
    setSaving(true);
    setError(null);
    try {
      const body = {};
      if (orcid?.trim()) body.orcid = orcid.trim();
      if (openalexId?.trim()) body.openalex_id = openalexId.trim();
      const updated = await apiRequest(`/profile/organization/employees/${employeeId}/import-openalex`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOrgEmployees((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (employeeEditId === employeeId) {
        setEmployeeEdit({
          ...employeeEdit,
          full_name: updated.full_name,
          research_interests: updated.research_interests || [],
          education: updated.education || [],
          publications: updated.publications || [],
          hindex_wos: updated.hindex_wos,
          hindex_scopus: updated.hindex_scopus,
          hindex_rsci: updated.hindex_rsci,
          hindex_openalex: updated.hindex_openalex,
        });
      }
      showToast("Данные импортированы");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (employeeId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/employees/${employeeId}`, { method: "DELETE" });
      setOrgEmployees((prev) => prev.filter((item) => item.id !== employeeId));
      loadLabs();
      if (employeePreview?.id === employeeId) {
        setEmployeePreview(null);
      }
      setRefreshKey((k) => k + 1);
      showToast("Сотрудник удалён");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadEmployeePhoto = async (file, isEdit = false) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "employee");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      if (isEdit) {
        setEmployeeEdit((prev) => ({ ...prev, photo_url: response.public_url }));
      } else {
        setEmployeeDraft((prev) => ({ ...prev, photo_url: response.public_url }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const createEquipment = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: equipmentDraft.name.trim(),
        description: equipmentDraft.description.trim(),
        characteristics: equipmentDraft.characteristics.trim(),
        image_urls: equipmentDraft.image_urls || [],
        laboratory_ids: equipmentDraft.laboratory_ids || [],
      };
      if (!payload.name) {
        setError("Укажите название оборудования.");
        return false;
      }
      const created = await apiRequest("/profile/organization/equipment", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgEquipment((prev) => [created, ...prev]);
      loadLabs();
      clearFileInputs(orgEquipmentFileInputRefs);
      setEquipmentDraft({ name: "", description: "", characteristics: "", image_urls: [], laboratory_ids: [] });
      showToast("Оборудование создано");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async (equipmentId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/equipment/${equipmentId}`, { method: "DELETE" });
      setOrgEquipment((prev) => prev.filter((item) => item.id !== equipmentId));
      loadLabs();
      showToast("Оборудование удалено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createLab = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: labDraft.name.trim(),
        description: labDraft.description.trim(),
        activities: labDraft.activities.trim(),
        image_urls: labDraft.image_urls || [],
        employee_ids: labDraft.employee_ids || [],
        head_employee_id: labDraft.head_employee_id != null ? labDraft.head_employee_id : null,
        equipment_ids: labDraft.equipment_ids || [],
        task_solution_ids: labDraft.task_solution_ids || [],
        hidden_public_sections: labDraft.hidden_public_sections || [],
      };
      if (!payload.name) {
        setError("Укажите название лаборатории.");
        return false;
      }
      const created = await apiRequest("/profile/organization/laboratories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgLabs((prev) => [created, ...prev]);
      clearFileInputs(orgLabFileInputRefs);
      setLabDraft({
        name: "",
        description: "",
        activities: "",
        image_urls: [],
        employee_ids: [],
        head_employee_id: null,
        equipment_ids: [],
        task_solution_ids: [],
        hidden_public_sections: [],
      });
      showToast("Лаборатория создана");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteLab = async (labId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/laboratories/${labId}`, { method: "DELETE" });
      setOrgLabs((prev) => prev.filter((item) => item.id !== labId));
      loadEquipment();
      loadTasks();
      loadEmployees();
      showToast("Лаборатория удалена");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createTask = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: taskDraft.title.trim(),
        task_description: taskDraft.task_description.trim(),
        solution_description: taskDraft.solution_description.trim(),
        article_links: taskDraft.article_links || [],
        solution_deadline: taskDraft.solution_deadline.trim(),
        grant_info: taskDraft.grant_info.trim(),
        cost: taskDraft.cost.trim(),
        external_solutions: taskDraft.external_solutions.trim(),
        laboratory_ids: taskDraft.laboratory_ids || [],
      };
      if (!payload.title) {
        setError("Укажите название задачи.");
        return false;
      }
      const created = await apiRequest("/profile/organization/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgTasks((prev) => [created, ...prev]);
      loadLabs();
      setTaskDraft({
        title: "",
        task_description: "",
        solution_description: "",
        article_links: [],
        solution_deadline: "",
        grant_info: "",
        cost: "",
        external_solutions: "",
        laboratory_ids: [],
      });
      showToast("Задача создана");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEditTask = (item) => {
    setEditingTaskId(item.id);
    setTaskEdit({
      title: item.title || "",
      task_description: item.task_description || "",
      solution_description: item.solution_description || "",
      article_links: item.article_links || [],
      solution_deadline: item.solution_deadline || "",
      grant_info: item.grant_info || "",
      cost: item.cost || "",
      external_solutions: item.external_solutions || "",
      laboratory_ids: (item.laboratories || []).map((lab) => lab.id),
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setTaskEdit(null);
  };

  const handleTaskEditChange = (field, value) => {
    setTaskEdit((prev) => ({ ...prev, [field]: value }));
  };

  const updateTask = async () => {
    if (!editingTaskId || !taskEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: taskEdit.title.trim(),
        task_description: taskEdit.task_description.trim(),
        solution_description: taskEdit.solution_description.trim(),
        article_links: taskEdit.article_links || [],
        solution_deadline: taskEdit.solution_deadline.trim(),
        grant_info: taskEdit.grant_info.trim(),
        cost: taskEdit.cost.trim(),
        external_solutions: taskEdit.external_solutions.trim(),
        laboratory_ids: taskEdit.laboratory_ids || [],
      };
      const updated = await apiRequest(`/profile/organization/tasks/${editingTaskId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelEditTask();
      loadLabs();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/tasks/${taskId}`, { method: "DELETE" });
      setOrgTasks((prev) => prev.filter((item) => item.id !== taskId));
      loadLabs();
      showToast("Задача удалена");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleQueryLab = (labId, isEdit = false, query = null) => {
    const setter = isEdit ? setQueryEdit : setQueryDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.laboratory_ids || [];
      const isRemoving = current.includes(labId);
      const next = isRemoving ? current.filter((id) => id !== labId) : [...current, labId];
      if (isEdit && isRemoving && next.length === 0 && query?.is_published) {
        setError("Снимите запрос с публикации, затем удалите лабораторию.");
        return prev;
      }
      return { ...prev, laboratory_ids: next };
    });
  };

  const toggleQueryEmployee = (employeeId, isEdit = false) => {
    const setter = isEdit ? setQueryEdit : setQueryDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.employee_ids || [];
      const next = current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId];
      return { ...prev, employee_ids: next };
    });
  };

  const toggleTaskLab = (labId, isEdit = false) => {
    const setter = isEdit ? setTaskEdit : setTaskDraft;
    setter((prev) => {
      if (!prev) return prev;
      const current = prev.laboratory_ids || [];
      const next = current.includes(labId)
        ? current.filter((id) => id !== labId)
        : [...current, labId];
      return { ...prev, laboratory_ids: next };
    });
  };

  const createQuery = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: queryDraft.title.trim(),
        task_description: queryDraft.task_description.trim(),
        completed_examples: queryDraft.completed_examples.trim(),
        grant_info: queryDraft.grant_info.trim(),
        budget: queryDraft.budget.trim(),
        deadline: queryDraft.deadline.trim(),
        status: queryDraft.status || "active",
        linked_task_solution_id: queryDraft.linked_task_solution_id || null,
        laboratory_ids: queryDraft.laboratory_ids || [],
        employee_ids: queryDraft.employee_ids || [],
      };
      const created = await apiRequest("/profile/organization/queries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgQueries((prev) => [created, ...prev]);
      loadLabs();
      loadEmployees();
      setQueryDraft({
        title: "",
        task_description: "",
        completed_examples: "",
        grant_info: "",
        budget: "",
        deadline: "",
        status: "active",
        linked_task_solution_id: null,
        laboratory_ids: [],
        employee_ids: [],
      });
      showToast("Запрос создан");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEditQuery = (query) => {
    setEditingQueryId(query.id);
    setQueryEdit({
      title: query.title || "",
      task_description: query.task_description || "",
      completed_examples: query.completed_examples || "",
      grant_info: query.grant_info || "",
      budget: query.budget || "",
      deadline: query.deadline || "",
      status: query.status || "active",
      linked_task_solution_id: query.linked_task_solution_id || null,
      laboratory_ids: (query.laboratories || []).map((lab) => lab.id),
      employee_ids: (query.employees || []).map((employee) => employee.id),
    });
  };

  const cancelEditQuery = () => {
    setEditingQueryId(null);
    setQueryEdit(null);
  };

  const updateQuery = async () => {
    if (!queryEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: queryEdit.title.trim(),
        task_description: queryEdit.task_description.trim(),
        completed_examples: queryEdit.completed_examples.trim(),
        grant_info: queryEdit.grant_info.trim(),
        budget: queryEdit.budget.trim(),
        deadline: queryEdit.deadline.trim(),
        status: queryEdit.status || "active",
        linked_task_solution_id: queryEdit.linked_task_solution_id || null,
        laboratory_ids: queryEdit.laboratory_ids || [],
        employee_ids: queryEdit.employee_ids || [],
      };
      const updated = await apiRequest(`/profile/organization/queries/${editingQueryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgQueries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelEditQuery();
      loadLabs();
      loadEmployees();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuery = async (queryId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/queries/${queryId}`, { method: "DELETE" });
      setOrgQueries((prev) => prev.filter((item) => item.id !== queryId));
      loadEmployees();
      showToast("Запрос удалён");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createVacancy = async () => {
    if (!vacancyDraft.contact_employee_id) {
      const email = (vacancyDraft.contact_email || "").trim();
      const phone = (vacancyDraft.contact_phone || "").trim();
      if (!email || !phone) {
        setError("Укажите контактное лицо (сотрудника) или заполните email и телефон для связи.");
        return false;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: vacancyDraft.name.trim(),
        requirements: vacancyDraft.requirements.trim(),
        description: vacancyDraft.description.trim(),
        employment_type: vacancyDraft.employment_type.trim(),
        query_id: vacancyDraft.query_id || null,
        laboratory_id: vacancyDraft.laboratory_id || null,
        contact_employee_id: vacancyDraft.contact_employee_id || null,
        contact_email: vacancyDraft.contact_employee_id ? null : (vacancyDraft.contact_email || "").trim() || null,
        contact_phone: vacancyDraft.contact_employee_id ? null : (vacancyDraft.contact_phone || "").trim() || null,
      };
      const created = await apiRequest("/profile/organization/vacancies", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOrgVacancies((prev) => [created, ...prev]);
      setVacancyDraft({
        name: "",
        requirements: "",
        description: "",
        employment_type: "",
        query_id: null,
        laboratory_id: null,
        contact_employee_id: null,
        contact_email: "",
        contact_phone: "",
      });
      showToast("Вакансия создана");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEditVacancy = (vacancy) => {
    setEditingVacancyId(vacancy.id);
    setVacancyEdit({
      name: vacancy.name || "",
      requirements: vacancy.requirements || "",
      description: vacancy.description || "",
      employment_type: vacancy.employment_type || "",
      query_id: vacancy.query_id || null,
      laboratory_id: vacancy.laboratory_id || null,
      contact_employee_id: vacancy.contact_employee_id || null,
      contact_email: vacancy.contact_email || "",
      contact_phone: vacancy.contact_phone || "",
    });
  };

  const cancelEditVacancy = () => {
    setEditingVacancyId(null);
    setVacancyEdit(null);
  };

  const updateVacancy = async () => {
    if (!vacancyEdit) return;
    if (!vacancyEdit.contact_employee_id) {
      const email = (vacancyEdit.contact_email || "").trim();
      const phone = (vacancyEdit.contact_phone || "").trim();
      if (!email || !phone) {
        setError("Укажите контактное лицо (сотрудника) или заполните email и телефон для связи.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: vacancyEdit.name.trim(),
        requirements: vacancyEdit.requirements.trim(),
        description: vacancyEdit.description.trim(),
        employment_type: vacancyEdit.employment_type.trim(),
        query_id: vacancyEdit.query_id || null,
        laboratory_id: vacancyEdit.laboratory_id || null,
        contact_employee_id: vacancyEdit.contact_employee_id || null,
        contact_email: vacancyEdit.contact_employee_id ? null : (vacancyEdit.contact_email || "").trim() || null,
        contact_phone: vacancyEdit.contact_employee_id ? null : (vacancyEdit.contact_phone || "").trim() || null,
      };
      const updated = await apiRequest(`/profile/organization/vacancies/${editingVacancyId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setOrgVacancies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelEditVacancy();
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteVacancy = async (vacancyId) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/profile/organization/vacancies/${vacancyId}`, { method: "DELETE" });
      setOrgVacancies((prev) => prev.filter((item) => item.id !== vacancyId));
      showToast("Вакансия удалена");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveStudent = async (patch = {}) => {
    setSaving(true);
    setError(null);
    try {
      const s = { ...(studentProfile || {}), ...patch };
      const payload = {
        full_name: profile?.full_name || s.full_name?.trim() || "Студент",
        university: s.university?.trim() || "",
        level: s.level?.trim() || "",
        direction: s.direction?.trim() || "",
        status: s.status?.trim() || "",
        skills: s.skills || [],
        summary: s.summary?.trim() || "",
        photo_url: s.photo_url || null,
        resume_url: s.resume_url || null,
        document_urls: s.document_urls || [],
        education: s.education || [],
        research_interests: s.research_interests || [],
        contacts: s.contacts || {},
        is_published: s.is_published ?? false,
      };
      const data = await apiRequest("/profile/student", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStudentProfile(data);
      clearFileInputs(studentFileInputRefs);
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadStudentPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "student");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setStudentProfile((prev) => ({ ...(prev || {}), photo_url: response.public_url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadStudentResume = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "student");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setStudentProfile((prev) => ({ ...(prev || {}), resume_url: response.public_url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadStudentDocument = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "student");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setStudentProfile((prev) => ({
        ...(prev || {}),
        document_urls: [...(prev?.document_urls || []), response.public_url],
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeStudentDocument = (index) => {
    setStudentProfile((prev) => ({
      ...(prev || {}),
      document_urls: (prev?.document_urls || []).filter((_, i) => i !== index),
    }));
  };

  const saveResearcher = async (patch = {}) => {
    setSaving(true);
    setError(null);
    try {
      const r = { ...(researcherProfile || {}), ...patch };
      const payload = {
        full_name: r.full_name?.trim() || profile?.full_name || "Исследователь",
        positions: r.positions || [],
        academic_degree: r.academic_degree?.trim() || null,
        photo_url: r.photo_url || null,
        research_interests: r.research_interests || [],
        education: r.education || [],
        publications: r.publications || [],
        hindex_wos: r.hindex_wos ?? null,
        hindex_scopus: r.hindex_scopus ?? null,
        hindex_rsci: r.hindex_rsci ?? null,
        contacts: r.contacts || {},
        job_search_status: r.job_search_status || null,
        desired_positions: Array.isArray(r.desired_positions) ? r.desired_positions.join(", ") : (r.desired_positions?.trim() || null),
        employment_type_preference: Array.isArray(r.employment_type_preference) ? r.employment_type_preference.join(", ") : (r.employment_type_preference?.trim() || null),
        preferred_region: r.preferred_region?.trim() || null,
        availability_date: r.availability_date?.trim() || null,
        salary_expectation: r.salary_expectation?.trim() || null,
        job_search_notes: r.job_search_notes?.trim() || null,
        resume_url: r.resume_url || null,
        document_urls: r.document_urls || [],
        is_published: r.is_published ?? false,
      };
      const data = await apiRequest("/profile/researcher", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setResearcherProfile(data);
      clearFileInputs(researcherFileInputRefs);
      showToast("Сохранено");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStudentPublish = async () => {
    const next = !(studentProfile?.is_published ?? false);
    setStudentProfile((prev) => ({ ...(prev || {}), is_published: next }));
    await saveStudent({ is_published: next });
  };

  const toggleResearcherPublish = async () => {
    const next = !(researcherProfile?.is_published ?? false);
    setResearcherProfile((prev) => ({ ...(prev || {}), is_published: next }));
    await saveResearcher({ is_published: next });
  };

  const uploadResearcherPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "researcher");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setResearcherProfile((prev) => ({ ...(prev || {}), photo_url: response.public_url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadResearcherResume = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "researcher");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setResearcherProfile((prev) => ({ ...(prev || {}), resume_url: response.public_url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadResearcherDocument = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", "researcher");
      formData.append("file", file);
      const response = await apiRequest("/storage/upload", {
        method: "POST",
        body: formData,
      });
      setResearcherProfile((prev) => ({
        ...(prev || {}),
        document_urls: [...(prev?.document_urls || []), response.public_url],
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeResearcherDocument = (index) => {
    setResearcherProfile((prev) => ({
      ...(prev || {}),
      document_urls: (prev?.document_urls || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <main className="main profile-page">
      {error && (
        <div ref={errorRef} className="profile-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Закрыть">×</button>
        </div>
      )}
      <div className="profile-page__layout">
        <aside className="profile-page__sidebar">
          {profile && roleKey && (
            <>
              <ProfileSummary
                profile={profile}
                roleName={roleName}
                onAvatarUpload={uploadUserAvatar}
                uploading={uploading}
                loading={loading}
              />
              {roleKey !== "platform_admin" && (
                <ProfileSidebar
                  roleKey={roleKey}
                  currentSection={profileSection}
                  onSectionChange={setProfileSection}
                  orgTab={orgTab}
                  onOrgTabChange={(tabId) => {
                    setProfileSection("organization");
                    setOrgTab(tabId);
                  }}
                  showProfileTab={roleKey === "lab_admin"}
                  emailVerified={emailVerified}
                />
              )}
            </>
          )}
          <div className="profile-actions profile-actions--sidebar">
            <button type="button" className="primary-btn" onClick={() => navigate("/")}>
              На главную
            </button>
            <button type="button" className="secondary-btn" onClick={logout}>
              Выйти
            </button>
          </div>
        </aside>
        <div className="profile-page__content profile-content" ref={profileContentRef}>
          <div className="profile-content-inner">
            {loading && !profile && <p className="muted">Загрузка…</p>}
            {!loading && profile && !roleKey && profileSection !== "summary" && (
              <p className="muted">Выберите роль в разделе «Обзор».</p>
            )}
            {profileSection === "summary" && (
              <SummaryTabContent
                loading={loading}
                error={error}
                profile={profile}
                roleName={roleName}
                roles={roles}
                selectedRoleId={selectedRoleId}
                onRoleChange={handleRoleChange}
                onRoleSave={saveRole}
                roleSaving={roleSaving}
                roleLabelByName={roleLabelByName}
                isPlatformAdmin={roleKey === "platform_admin"}
                orcidError={orcidError}
                orcidLinked={orcidLinked}
                onOrcidLinked={() => apiRequest("/users/me").then(setProfile)}
                onOrcidErrorDismiss={() => setOrcidError(null)}
                onOpenAlexLinked={async () => {
                  const user = await apiRequest("/users/me");
                  setProfile(user);
                  if (isResearcherRole) {
                    try {
                      const researcher = await apiRequest("/profile/researcher");
                      setResearcherProfile(researcher);
                    } catch {
                      setResearcherProfile(null);
                    }
                  }
                }}
              />
            )}
            {profileSection === "subscription" && profile && isOrgRole && (
              <SubscriptionTab
                onError={setError}
                orgProfile={orgProfile}
                orgLabs={orgLabs}
                orgVacancies={orgVacancies}
                orgQueries={orgQueries}
              />
            )}
            {profileSection === "personal" && profile && (
              <PersonalProfileSection
                hideTitle
                profile={profile}
                onChange={handlePersonalChange}
                onContactsChange={handlePersonalContactsChange}
                onSave={savePersonalProfile}
                saving={saving}
              />
            )}
            {profileSection === "organization" && profile && isOrgRole && (
              <OrganizationProfileSection
                title={roleKey === "lab_representative" ? "Профиль лаборатории" : "Профиль организации"}
                hideTitle
                orgTab={orgTab}
                setOrgTab={setOrgTab}
                onNavigateToSubscription={() => setProfileSection("subscription")}
                showProfileTab={roleKey === "lab_admin"}
                roleKey={roleKey}
                onError={setError}
                orgProfile={orgProfile}
                handleOrgChange={handleOrgChange}
                uploadOrgAvatar={uploadOrgAvatar}
            uploading={uploading}
            saving={saving}
            saveOrganization={saveOrganization}
            onOrgAvatarInputRefReady={(ref) => {
              orgAvatarInputRef.current = ref;
            }}
            onOrgStaffFileInputRefsReady={(refs) => {
              orgStaffFileInputRefs.current = refs || [];
            }}
            onOrgEquipmentFileInputRefsReady={(refs) => {
              orgEquipmentFileInputRefs.current = refs || [];
            }}
            onOrgLabFileInputRefsReady={(refs) => {
              orgLabFileInputRefs.current = refs || [];
            }}
            toggleOrgPublish={toggleOrgPublish}
            labDraft={labDraft}
            handleLabDraft={handleLabDraft}
            orgEmployees={orgEmployees}
            toggleLabEmployee={toggleLabEmployee}
            setLabHead={setLabHead}
            toggleLabEquipment={toggleLabEquipment}
            handleLabFiles={handleLabFiles}
            removeDraftImage={removeDraftImage}
            splitMedia={splitMedia}
            fileNameFromUrl={fileNameFromUrl}
            createLab={createLab}
            orgLabs={orgLabs}
            editingLabId={editingLabId}
            labEdit={labEdit}
            handleLabEditChange={handleLabEditChange}
            handleLabEditFiles={handleLabEditFiles}
            removeEditImage={removeEditImage}
            updateLab={updateLab}
            cancelEditLab={cancelEditLab}
            startEditLab={startEditLab}
            deleteLab={deleteLab}
            equipmentDraft={equipmentDraft}
            handleEquipmentDraft={handleEquipmentDraft}
            handleEquipmentFiles={handleEquipmentFiles}
            createEquipment={createEquipment}
            orgEquipment={orgEquipment}
            editingEquipmentId={editingEquipmentId}
            equipmentEdit={equipmentEdit}
            handleEquipmentEditChange={handleEquipmentEditChange}
            handleEquipmentEditFiles={handleEquipmentEditFiles}
            updateEquipment={updateEquipment}
            cancelEditEquipment={cancelEditEquipment}
            startEditEquipment={startEditEquipment}
            deleteEquipment={deleteEquipment}
            openGallery={openGallery}
            taskDraft={taskDraft}
            setTaskDraft={setTaskDraft}
            createTask={createTask}
            orgTasks={orgTasks}
            editingTaskId={editingTaskId}
            taskEdit={taskEdit}
            handleTaskEditChange={handleTaskEditChange}
            updateTask={updateTask}
            cancelEditTask={cancelEditTask}
            startEditTask={startEditTask}
            deleteTask={deleteTask}
            toggleTaskLab={toggleTaskLab}
            orgQueries={orgQueries}
            queryDraft={queryDraft}
            setQueryDraft={setQueryDraft}
            createQuery={createQuery}
            editingQueryId={editingQueryId}
            queryEdit={queryEdit}
            setQueryEdit={setQueryEdit}
            updateQuery={updateQuery}
            cancelEditQuery={cancelEditQuery}
            startEditQuery={startEditQuery}
            deleteQuery={deleteQuery}
            toggleQueryLab={toggleQueryLab}
            toggleQueryEmployee={toggleQueryEmployee}
            orgVacancies={orgVacancies}
            vacancyDraft={vacancyDraft}
            setVacancyDraft={setVacancyDraft}
            createVacancy={createVacancy}
            editingVacancyId={editingVacancyId}
            vacancyEdit={vacancyEdit}
            setVacancyEdit={setVacancyEdit}
            updateVacancy={updateVacancy}
            cancelEditVacancy={cancelEditVacancy}
            startEditVacancy={startEditVacancy}
            deleteVacancy={deleteVacancy}
            employeeDraft={employeeDraft}
            handleEmployeeDraftChange={handleEmployeeDraftChange}
            uploadEmployeePhoto={uploadEmployeePhoto}
            employeeDraftPositionInput={employeeDraftPositionInput}
            setEmployeeDraftPositionInput={setEmployeeDraftPositionInput}
            toggleEmployeeLab={toggleEmployeeLab}
            addEducation={addEducation}
            removeEducation={removeEducation}
            showDraftPublications={showDraftPublications}
            setShowDraftPublications={setShowDraftPublications}
            updatePublication={updatePublication}
            removePublication={removePublication}
            addPublication={addPublication}
            handleEmployeeContacts={handleEmployeeContacts}
            createEmployee={createEmployee}
            employeeEditId={employeeEditId}
            employeeEdit={employeeEdit}
            handleEmployeeEditChange={handleEmployeeEditChange}
            employeeEditPositionInput={employeeEditPositionInput}
            setEmployeeEditPositionInput={setEmployeeEditPositionInput}
            showEditPublications={showEditPublications}
            setShowEditPublications={setShowEditPublications}
            updateEmployee={updateEmployee}
            cancelEditEmployee={cancelEditEmployee}
            startEditEmployee={startEditEmployee}
            deleteEmployee={deleteEmployee}
            setEmployeeDraft={setEmployeeDraft}
            setEmployeeEdit={setEmployeeEdit}
            setEmployeePreview={setEmployeePreview}
            setShowEmployeePublications={setShowEmployeePublications}
            importEmployeeOpenAlex={importEmployeeOpenAlex}
            importEmployeeOpenAlexPreview={importEmployeeOpenAlexPreview}
            employeeDraftImporting={employeeDraftImporting}
            toggleLabPublish={toggleLabPublish}
            toggleQueryPublish={toggleQueryPublish}
            toggleVacancyPublish={toggleVacancyPublish}
            toggleEquipmentLab={toggleEquipmentLab}
            onOrgRorLinked={async () => {
              const org = await apiRequest("/profile/organization");
              setOrgProfile(org ?? EMPTY_ORG_PROFILE);
            }}
          />
            )}
            {profileSection === "student" && profile && roleKey === "student" && (
              <StudentProfileSection
                title="Профиль студента"
                hideTitle
                studentProfile={studentProfile}
                handleStudentChange={handleStudentChange}
                saveStudent={saveStudent}
                togglePublish={toggleStudentPublish}
                uploadStudentPhoto={uploadStudentPhoto}
                uploadStudentResume={uploadStudentResume}
                uploadStudentDocument={uploadStudentDocument}
                removeStudentDocument={removeStudentDocument}
                saving={saving}
                uploading={uploading}
                onFileInputRefsReady={(refs) => {
                  studentFileInputRefs.current = refs || [];
                }}
              />
            )}
            {profileSection === "my-requests" && profile && roleKey === "researcher" && (
              <MyJoinRequestsSection
                roleKey={roleKey}
                onError={setError}
                creatorLabs={[]}
              />
            )}
            {profileSection === "my-vacancy-responses" && profile && (roleKey === "student" || roleKey === "researcher") && (
              <MyVacancyResponsesSection onError={setError} />
            )}
            {profileSection === "researcher" && profile && roleKey === "researcher" && (
              <ResearcherProfileSection
                hideTitle
                researcherProfile={researcherProfile}
                handleResearcherChange={handleResearcherChange}
                saveResearcher={saveResearcher}
                togglePublish={toggleResearcherPublish}
                uploadResearcherPhoto={uploadResearcherPhoto}
                uploadResearcherResume={uploadResearcherResume}
                uploadResearcherDocument={uploadResearcherDocument}
                removeResearcherDocument={removeResearcherDocument}
                saving={saving}
                uploading={uploading}
                onFileInputRefsReady={(refs) => {
                  researcherFileInputRefs.current = refs || [];
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="profile-actions profile-actions--mobile">
        <button type="button" className="primary-btn" onClick={() => navigate("/")}>
          На главную
        </button>
        <button type="button" className="secondary-btn" onClick={logout}>
          Выйти
        </button>
      </div>
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
    </main>
  );
}
