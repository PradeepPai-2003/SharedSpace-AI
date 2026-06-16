import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Space from './pages/Space';
import AIChat from './pages/AIChat';
import JoinSpace from './pages/JoinSpace';
import StarredMessages from './pages/StarredMessages';
import ProtectedLayout from './components/ProtectedLayout';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:token" element={<JoinSpace />} />

        {/* Protected Dashboard/Space Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/space/:spaceId" element={<Space />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/starred" element={<StarredMessages />} />
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </Router>
  );
}

export default App;
