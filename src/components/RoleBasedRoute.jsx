// components/RoleBasedRoute.jsx
import { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { AuthContext } from '../context/AuthContext';
import supabase from '../utils/supabase';
import toast from 'react-hot-toast';

const RoleBasedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        console.log('Checking role for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single();

        console.log('Profile data:', profile);
        console.log('Profile error:', error);

        if (error) {
          console.error('Error fetching user profile:', error);
          // If profile doesn't exist, treat as teacher
          setUserRole('teacher');
        } else {
          const role = profile?.role || 'teacher';
          console.log('Setting user role to:', role);
          setUserRole(role);
          
          // Only redirect teachers away from admin pages
          // Admins can access both admin dashboard and student results
          setTimeout(() => {
            const currentPath = location.pathname;
            console.log('Current path:', currentPath, 'User role:', role);
            
            if (role === 'teacher') {
              // If teacher is trying to access admin, redirect to root
              if (currentPath === '/admin') {
                console.log('Redirecting teacher away from admin');
                toast.error('Access denied. Admin privileges required.');
                navigate('/', { replace: true });
                return;
              }
            }
            // Admins can access both '/' and '/admin' freely - no auto-redirect
          }, 100);
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole('teacher');
      } finally {
        setRoleLoading(false);
      }
    };

    if (!loading && user) {
      checkUserRole();
    }
  }, [user, loading, navigate, location.pathname]);

  // Show loading spinner while checking role
  if (loading || roleLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // If not authenticated, don't render anything (ProtectedRoute will handle redirect)
  if (!user) {
    return null;
  }

  return children;
};


export default RoleBasedRoute;
