import {Routes, Route} from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import CodeEditor from './pages/CodeEditor.jsx';
import Home from './pages/Home.jsx';
import Footer from "./components/Footer.jsx";
import './App.css';

const App = () => {
  return (
    <div className='app'>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/code-editor" element={<CodeEditor/>}/>
      </Routes>  
    </div>
  )
}

export default App
