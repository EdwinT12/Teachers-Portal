import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';

const TeacherDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentAttendance, setRecentAttendance] = useState([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        // Load teacher profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
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

        if (profileError) {
          console.error('Error loading profile:', profileError);
          toast.error('Failed to load profile');
          return;
        }

        setProfile(profileData);

        // Load all available classes
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            year_level,
            section,
            is_active,
            students!inner (
              id
            )
          `)
          .eq('is_active', true)
          .order('year_level', { ascending: true });

        if (classesError) {
          console.error('Error loading classes:', classesError);
          toast.error('Failed to load classes');
        } else {
          // Transform the data to include student count
          const classesWithCounts = classesData.map(cls => ({
            ...cls,
            student_count: cls.students?.length || 0,
            students: undefined // Remove nested students to reduce payload
          }));
          setClasses(classesWithCounts);
        }

        // Load recent attendance records for this teacher
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select(`
            id,
            attendance_date,
            status,
            created_at,
            students (
              first_name,
              last_name,
              student_number
            ),
            classes (
              name
            )
          `)
          .eq('teacher_id', user.id)
          .gte('attendance_date', sevenDaysAgo.toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(10);

        if (attendanceError) {
          console.error('Error loading recent attendance:', attendanceError);
        } else {
          setRecentAttendance(attendanceData || []);
        }

      } catch (error) {
        console.error('Error in loadDashboardData:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const handleTakeAttendance = (classId) => {
    navigate(`/teacher/attendance/${classId}`);
  };

  const handleQuickAttendance = () => {
    if (profile?.default_class_id) {
      navigate(`/teacher/attendance/${profile.default_class_id}`);
    } else {
      toast.error('No default class set. Please select a class.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return '✓';
      case 'absent': return '✗';
      case 'late': return '⏰';
      default: return '?';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
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

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          color: '#333',
          margin: '0 0 10px 0',
          fontSize: '32px',
          fontWeight: 'bold'
        }}>
          Welcome, {profile?.full_name}!
        </h1>
        <p style={{
          color: '#666',
          margin: '0 0 20px 0',
          fontSize: '16px'
        }}>
          Teacher Dashboard - {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>

        {/* Quick Actions */}
        <div style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleQuickAttendance}
            disabled={!profile?.default_class_id}
            style={{
              backgroundColor: profile?.default_class_id ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              padding: '15px 25px',
              borderRadius: '8px',
              cursor: profile?.default_class_id ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            📋 Take Attendance
            {profile?.classes && (
              <span style={{ fontSize: '14px', opacity: 0.9 }}>
                ({profile.classes.name})
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/teacher/attendance')}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '15px 25px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            🏫 Select Different Class
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Available Classes */}
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            color: '#333',
            margin: '0 0 20px 0',
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🏫 Available Classes
          </h2>

          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {classes.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No classes available
              </p>
            ) : (
              classes.map(cls => (
                <div
                  key={cls.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '10px',
                    backgroundColor: profile?.default_class_id === cls.id ? '#e8f5e8' : '#fafafa',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      color: '#333',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}>
                      {cls.name}
                      {profile?.default_class_id === cls.id && (
                        <span style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          marginLeft: '10px'
                        }}>
                          Default
                        </span>
                      )}
                    </h3>
                    <span style={{
                      color: '#666',
                      fontSize: '14px'
                    }}>
                      {cls.student_count} students
                    </span>
                  </div>

                  <button
                    onClick={() => handleTakeAttendance(cls.id)}
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      width: '100%',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
                  >
                    Take Attendance
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Attendance Activity */}
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            color: '#333',
            margin: '0 0 20px 0',
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Recent Activity
          </h2>

          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {recentAttendance.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#666',
                padding: '40px 20px'
              }}>
                <p style={{ fontSize: '16px', marginBottom: '10px' }}>
                  No recent attendance records
                </p>
                <p style={{ fontSize: '14px' }}>
                  Start taking attendance to see activity here
                </p>
              </div>
            ) : (
              recentAttendance.map(record => (
                <div
                  key={record.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <strong style={{ color: '#333' }}>
                        {record.students?.first_name} {record.students?.last_name}
                      </strong>
                      <div style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '2px'
                      }}>
                        {record.students?.student_number} • {record.classes?.name}
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        color: getStatusColor(record.status),
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}>
                        {getStatusIcon(record.status)}
                      </span>
                      <span style={{
                        color: getStatusColor(record.status),
                        fontSize: '12px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {record.status}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {new Date(record.attendance_date).toLocaleDateString('en-GB')} • {' '}
                    {new Date(record.created_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          gridColumn: 'span 2'
        }}>
          <h2 style={{
            color: '#333',
            margin: '0 0 20px 0',
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📈 Quick Stats (Last 7 Days)
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#e8f5e8',
              borderRadius: '8px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#4CAF50',
                marginBottom: '10px'
              }}>
                {recentAttendance.filter(r => r.status === 'present').length}
              </div>
              <div style={{ color: '#666', fontWeight: 'bold' }}>
                Present
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#fff3e0',
              borderRadius: '8px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#FF9800',
                marginBottom: '10px'
              }}>
                {recentAttendance.filter(r => r.status === 'late').length}
              </div>
              <div style={{ color: '#666', fontWeight: 'bold' }}>
                Late
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#ffebee',
              borderRadius: '8px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#F44336',
                marginBottom: '10px'
              }}>
                {recentAttendance.filter(r => r.status === 'absent').length}
              </div>
              <div style={{ color: '#666', fontWeight: 'bold' }}>
                Absent
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '10px'
              }}>
                {recentAttendance.length}
              </div>
              <div style={{ color: '#666', fontWeight: 'bold' }}>
                Total Records
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginTop: '20px'
      }}>
        <h2 style={{
          color: '#333',
          margin: '0 0 15px 0',
          fontSize: '20px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          💡 Quick Help
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          fontSize: '14px',
          color: '#666'
        }}>
          <div>
            <strong>📋 Taking Attendance:</strong>
            <br />Use your default class button for quick access, or select any class from the list.
          </div>
          <div>
            <strong>⏰ Late Arrivals:</strong>
            <br />Mark students as "Late" if they arrive after the session starts.
          </div>
          <div>
            <strong>📊 Activity Tracking:</strong>
            <br />All attendance records are automatically saved and can be viewed in recent activity.
          </div>
          <div>
            <strong>🔄 Updating Records:</strong>
            <br />You can modify attendance for the current day by retaking attendance for the same class.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;