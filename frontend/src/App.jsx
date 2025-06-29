import { Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthProvider.jsx";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import CodeEditor from "./pages/CodeEditor.jsx";
import Home from "./pages/Home.jsx";
import PersistLogin from "./components/PersistLogin.jsx";
import "./App.css";

const App = () => {
  const {auth}=useAuth();
  const isAuthenticated=auth?.user ? true : false;
  
  return (
    <div className="app">
      <Routes>
        <Route path="/signup" element={isAuthenticated ? <Home /> : <Signup />} />
        <Route path="/login" element={isAuthenticated ? <Home /> : <Login />} />
        <Route element={<PersistLogin />}>
          <Route path="/" element={<Home />} />
          <Route path="/code-editor/:roomId" element={isAuthenticated ? <CodeEditor /> : <Navigate to="/" />}/>
        </Route>
      </Routes>
      <Toaster />
    </div>
  );
};

export default App;
