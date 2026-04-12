import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PsychologistLogin from './pages/psychologist/Login';
import PsychologistDashboard from './pages/psychologist/Dashboard';
import NewBooking from './pages/psychologist/NewBooking';
import ProbationLogin from './pages/probation/Login';
import ProbationDashboard from './pages/probation/Dashboard';
import TestPage from './pages/TestPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Psychologist Routes */}
          <Route path="/psychologist/login" element={<PsychologistLogin />} />
          <Route path="/psychologist/dashboard" element={<PsychologistDashboard />} />
          <Route path="/psychologist/new-booking" element={<NewBooking />} />

          {/* Probation Officer Routes */}
          <Route path="/probation/login" element={<ProbationLogin />} />
          <Route path="/probation/dashboard" element={<ProbationDashboard />} />

          {/* Temporary Redirects or 404s */}
          <Route path="/booking" element={<Navigate to="/psychologist/login" replace />} />
          <Route path="/dashboard" element={<Navigate to="/probation/login" replace />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>


      </Layout>
    </Router>
  );
}

export default App;
