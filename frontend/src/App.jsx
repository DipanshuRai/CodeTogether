import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthProvider.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import CodeEditor from "./pages/CodeEditor.jsx";
import Home from "./pages/Home.jsx";
import PersistLogin from "./components/PersistLogin.jsx";
import RedirectIfAuth from "./components/RedirectIfAuth.jsx";
import "./App.css";
import Whiteboard from "./pages/Whiteboard.jsx";

const App = () => {
  const {auth}=useAuth();
  
  return (
    <div className="app">
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
            path="/whiteboard" 
            element={auth?.accessToken ? <Whiteboard /> : <Navigate to="/login" />} 
          />
        </Route>
      </Routes>
      <Toaster />
    </div>
  );
};

export default App;
