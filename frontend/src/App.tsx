import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Login from './pages/auth/Login';
import CreateAccount from './pages/auth/CreateAccount';
import Logout from './pages/auth/Logout';
import MainBoard from './pages/board/MainBoard';
import RootBoard from './components/features/rootBoard';
import Navbar from './components/Navbar';
import Admin from './pages/admin/Admin';
import ManageUsers from './pages/ManageUsers';
import CreateUser from './pages/CreateUsers';
import UserRoute from './pages/UserRoutes';
import AdminRoute from './components/AdminRoute';
import About from './pages/About';
import SystemPerformance from './pages/admin/SystemPerformance';
import ServerConfiguration from './pages/admin/ServerConfiguration';
import BulkOperations from './pages/admin/BulkOperations';
import SupportRequests from './pages/admin/SupportRequests';
import AdminSettings from './pages/admin/AdminSettings';
import ProtectedRoute from './Routes/ProtectedRoute';
import NotFound from './pages/errors/NotFound';
import ServerError from './pages/errors/ServerError';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';


function AppContent(): React.ReactElement {
  const location = useLocation();
  // Hide Navbar on /board routes since RootBoard has its own header
  const showNavbar = !location.pathname.startsWith('/board');

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="/logout" element={<Logout />} />


          <Route 
            path="/board" 
            element={
              <UserRoute>
                <RootBoard />
              </UserRoute>
            } 
          />
          <Route 
            path="/board/:boardId" 
            element={
              <UserRoute>
                <RootBoard />
              </UserRoute>
            } 
          />
          <Route 
            path="/main-board" 
            element={
              <UserRoute>
                <MainBoard />
              </UserRoute>
            } 
          />
          <Route 
            path="/about"
         
            element={
               <UserRoute>
                <About/>
               </UserRoute>
            }
            />
            
          <Route 
            path="/admin/manage-users" 
            element={
              <AdminRoute>
                <ManageUsers />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/create-user" 
            element={
              <AdminRoute>
                <CreateUser />
              </AdminRoute>
            } 
          />
  
          <Route 
            path="/admin/performance" 
            element={
              <AdminRoute>
                <SystemPerformance />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/server-config" 
            element={
              <AdminRoute>
                <ServerConfiguration />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/bulk-operations" 
            element={
              <AdminRoute>
                <BulkOperations />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/support" 
            element={
              <AdminRoute>
                <SupportRequests />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/settings" 
            element={
              <AdminRoute>
                <AdminSettings />
              </AdminRoute>
            } 
          />

          {/* Error Pages */}
          <Route path="/500" element={<ServerError />} />
          <Route path="/404" element={<NotFound />} />
          
          {/* Catch-all route for 404 - must be last */}
          <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
