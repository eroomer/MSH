import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CallPage from './pages/CallPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/call/:roomId" element={<CallPage />} />
      </Routes>
    </Router>
  );
}

export default App;
