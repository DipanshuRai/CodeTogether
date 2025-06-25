import {Routes, Route} from "react-router-dom";
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import CodeEditor from './pages/CodeEditor.jsx';
import Home from './pages/Home.jsx';
import './App.css';

const App = () => {
  return (
    <div className='app'>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/signup" element={<Signup/>}/>
        <Route path="/login" element={<Login/>}/>
        <Route path="/code-editor" element={<CodeEditor/>}/>
      </Routes>  
    </div>
  )
}

export default App
