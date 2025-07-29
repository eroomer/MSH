import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import CalibrationPage from './pages/CalibrationPage';
import { UserProvider } from './contexts/UserContext';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/cali" element={<CalibrationPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
