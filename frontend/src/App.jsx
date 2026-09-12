import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthProvider.jsx";
import PersistLogin from "./components/PersistLogin.jsx";
import RedirectIfAuth from "./components/RedirectIfAuth.jsx";
import "./App.css";

// Lazy-load heavy routes so the Home page bundle stays small.
const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const CodeEditor = lazy(() => import("./pages/CodeEditor.jsx"));
const Canvas = lazy(() => import("./pages/Canvas.jsx"));

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "#1e1e1e",
      color: "#ccc",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    Loading…
  </div>
);

const App = () => {
  const { auth } = useAuth();

  return (
    <div className="app">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PersistLogin />}>
            <Route element={<RedirectIfAuth />}>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
            </Route>
            <Route path="/" element={<Home />} />
            <Route
              path="/code-editor/:roomId"
              element={auth?.accessToken ? <CodeEditor /> : <Navigate to="/login" />}
            />
            <Route
              path="/canvas"
              element={auth?.accessToken ? <Canvas /> : <Navigate to="/login" />}
            />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </div>
  );
};

export default App;
