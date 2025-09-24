import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";

import "./index.css";
import App from "./App.jsx";
import AppBar from "./containers/AppBar";
import AuthProvider from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleBasedRoute from "./components/RoleBasedRoute.jsx";
import githubLogo from "/github.svg";

// Auth pages
import SignIn from "./pages/auth/SignIn.jsx";
import SignUp from "./pages/auth/SignUp.jsx";

// Dashboard pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AttendancePage from "./pages/teacher/AttendancePage.jsx";

createRoot(document.getElementById("root")).render(
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      margin: "1rem",
    }}
  >
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StrictMode>
        <AuthProvider>
          <BrowserRouter>
            <AppBar />
            <Routes>
              {/* Public routes */}
              <Route path="/auth/sign-in" element={<SignIn />} />
              <Route path="/auth/sign-up" element={<SignUp />} />
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <App />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              <Route path="/teacher" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <TeacherDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              <Route path="/teacher/attendance/:classId?" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AttendancePage />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <AdminDashboard />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </AuthProvider>

        <Toaster />
      </StrictMode>
    </div>
    <footer
      style={{
        padding: "1rem",
        textAlign: "center",
      }}
    >
      School Attendance System - Template available on{" "}
      <a
        href="https://github.com/juancarlosjr97/react-vite-supabase-vercel"
        target="_blank"
      >
        <img src={githubLogo} className="logo github" alt="GitHub logo" />
      </a>
    </footer>
  </div>
);