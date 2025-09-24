import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from './context/AuthContext';
import supabase from './utils/supabase';
import toast from 'react-hot-toast';

function App() {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const getUserProfile = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        console.log('Fetching profile for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            status,
            default_class_id,
            classes:default_class_id (
              id,
              name,
              year_level,
              section
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          toast.error('Failed to load user profile');
          return;
        }

        console.log('Profile loaded:', profile);
        setProfile(profile);
        setUserRole(profile.role);

        // Check if user is paused or deleted
        if (profile.status === 'paused') {
          toast.error('Your account has been suspended. Please contact administration.');
          await supabase.auth.signOut();
          return;
        }

        if (profile.status === 'deleted') {
          toast.error('Your account has been deactivated. Please contact administration.');
          await supabase.auth.signOut();
          return;
        }

        // Redirect based on role and default class
        setTimeout(() => {
          if (profile.role === 'admin') {
            console.log('Redirecting admin to admin dashboard');
            navigate('/admin', { replace: true });
          } else if (profile.role === 'teacher') {
            if (profile.default_class_id && profile.classes) {
              console.log('Redirecting teacher to default class attendance:', profile.classes.name);
              navigate(`/teacher/attendance/${profile.default_class_id}`, { replace: true });
            } else {
              console.log('Redirecting teacher to teacher dashboard (no default class)');
              navigate('/teacher', { replace: true });
            }
          }
        }, 100);

      } catch (error) {
        console.error('Error in getUserProfile:', error);
        toast.error('An error occurred while loading your profile');
      } finally {
        setRoleLoading(false);
      }
    };

    if (!loading && user) {
      getUserProfile();
    } else if (!loading && !user) {
      navigate('/auth/sign-in', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || roleLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        backgroundColor: '#f5f5f5',
        borderRadius: '10px',
        margin: '20px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <h3 style={{
          marginTop: '20px',
          color: '#333',
          fontSize: '18px'
        }}>
          Loading your dashboard...
        </h3>
        <p style={{
          color: '#666',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '300px',
          lineHeight: '1.5'
        }}>
          {roleLoading ? 'Checking your access permissions...' : 'Authenticating...'}
        </p>
        
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

  // If we get here, something went wrong with the redirect
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh',
      backgroundColor: '#f5f5f5',
      borderRadius: '10px',
      margin: '20px',
      textAlign: 'center'
    }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>
        Welcome to School Attendance System
      </h2>
      
      {profile && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>
            Hello, {profile.full_name}!
          </h3>
          <p style={{ color: '#666', marginBottom: '10px' }}>
            Role: <strong>{profile.role}</strong>
          </p>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Email: <strong>{profile.email}</strong>
          </p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {profile.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Go to Admin Dashboard
              </button>
            )}
            
            {profile.role === 'teacher' && (
              <>
                <button
                  onClick={() => navigate('/teacher')}
                  style={{
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  Teacher Dashboard
                </button>
                
                {profile.default_class_id && (
                  <button
                    onClick={() => navigate(`/teacher/attendance/${profile.default_class_id}`)}
                    style={{
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Take Attendance ({profile.classes?.name})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;