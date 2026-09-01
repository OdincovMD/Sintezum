import React, { lazy, Suspense, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import PageLoader from "../components/PageLoader";
import { MainLayout } from "../components/layout";
import { getOrCreateSessionId, getEntityFromPath, sendEvents } from "../analytics";

const Home = lazy(() => import("./Home"));
const Login = lazy(() => import("./Login"));
const Register = lazy(() => import("./Register"));
const AuthCallback = lazy(() => import("./AuthCallback"));
const RegisterOrcid = lazy(() => import("./RegisterOrcid"));
const VerifyEmail = lazy(() => import("./VerifyEmail"));
const ForgotPassword = lazy(() => import("./ForgotPassword"));
const ResetPassword = lazy(() => import("./ResetPassword"));
const SetPassword = lazy(() => import("./SetPassword"));
const Profile = lazy(() => import("./Profile"));
const Organizations = lazy(() => import("./Organizations"));
const Laboratories = lazy(() => import("./Laboratories"));
const Queries = lazy(() => import("./Queries"));
const Vacancies = lazy(() => import("./Vacancies"));
const Applicants = lazy(() => import("./Applicants"));
const Admin = lazy(() => import("./admin/Admin"));
const Privacy = lazy(() => import("./Privacy"));
const About = lazy(() => import("./About"));
const News = lazy(() => import("./News"));
const NotFound = lazy(() => import("./NotFound"));

export default function App() {
  const location = useLocation();
  const viewStartRef = useRef(null);
  const lastEntityRef = useRef(null);

  useEffect(() => {
    const { entity_type, entity_id } = getEntityFromPath(location.pathname);
    if (entity_type) {
      viewStartRef.current = Date.now();
      lastEntityRef.current = { entity_type, entity_id };
      const sessionId = getOrCreateSessionId();
      sendEvents([
        {
          event_type: "page_view",
          session_id: sessionId,
          entity_type,
          entity_id: entity_id || undefined,
        },
      ]);
    } else {
      lastEntityRef.current = null;
      viewStartRef.current = null;
    }
  }, [location.pathname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const last = lastEntityRef.current;
      const start = viewStartRef.current;
      if (!last || start == null) return;
      const durationSec = Math.round((Date.now() - start) / 1000);
      const sessionId = getOrCreateSessionId();
      sendEvents([
        {
          event_type: "page_leave",
          session_id: sessionId,
          entity_type: last.entity_type,
          entity_id: last.entity_id || undefined,
          payload: { duration_sec: durationSec },
        },
      ]);
      viewStartRef.current = null;
      lastEntityRef.current = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="page">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/laboratories/:publicId" element={<Laboratories />} />
            <Route path="/laboratories" element={<Laboratories />} />
            <Route path="/organizations/:publicId" element={<Organizations />} />
            <Route path="/organizations" element={<Organizations />} />
            <Route path="/vacancies/:publicId" element={<Vacancies />} />
            <Route path="/vacancies" element={<Vacancies />} />
            <Route path="/queries/:publicId" element={<Queries />} />
            <Route path="/queries" element={<Queries />} />
            <Route path="/applicants/:publicId" element={<Applicants />} />
            <Route path="/applicants" element={<Applicants />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="/news/:publicId" element={<News />} />
            <Route path="/news" element={<News />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/register/orcid" element={<RegisterOrcid />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}
