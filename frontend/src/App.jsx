import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import CodeEditor from "./pages/CodeEditor.jsx";
import Home from "./pages/Home.jsx";
import "./App.css";
import PersistLogin from "./components/PersistLogin.jsx";

const App = () => {
  return (
    <div className="app">
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route element={<PersistLogin />}>
          <Route path="/" element={<Home />} />
          <Route path="/code-editor/:roomId" element={<CodeEditor />} />
        </Route>
      </Routes>
      <Toaster />
    </div>
  );
};

export default App;
