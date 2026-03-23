import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import MainLayout from "./components/MainLayout";
import DashboardLayout from "./components/DashboardLayout";
import QuickSearch from "./components/QuickSearch";

// Lazy-loaded routes
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyProjects = lazy(() => import("./pages/MyProjects"));
const NewProject = lazy(() => import("./pages/NewProject"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectRevision = lazy(() => import("./pages/ProjectRevision"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Examples = lazy(() => import("./pages/Examples"));
const Settings = lazy(() => import("./pages/Settings"));
const ChromeExtension = lazy(() => import("./pages/ChromeExtension"));
const Billing = lazy(() => import("./pages/Billing"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="text-center">
      <p className="font-heading text-xl text-primary">LovPlan</p>
      <div className="mt-4 h-0.5 w-32 overflow-hidden rounded-full bg-muted mx-auto">
        <div className="h-full w-8 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              {/* Skip to content */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
              >
                Skip to content
              </a>
              <QuickSearch />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public layout with navbar */}
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                    <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/examples" element={<Examples />} />
                  </Route>

                  {/* Dashboard layout with sidebar */}
                  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/new" element={<NewProject />} />
                    <Route path="/dashboard/projects" element={<MyProjects />} />
                    <Route path="/dashboard/billing" element={<Billing />} />
                    <Route path="/dashboard/settings" element={<Settings />} />
                    <Route path="/project/:id" element={<ProjectDetail />} />
                    <Route path="/project/:id/revise" element={<ProjectRevision />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
