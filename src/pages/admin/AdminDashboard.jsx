import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  
  // Teacher form state
  const [teacherForm, setTeacherForm] = useState({
    email: '',
    full_name: '',
    password: '',
    default_class_id: '',
    role: 'teacher'
  });
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [saving, setSaving] = useState(false);

  // Student form state
  const [studentForm, setStudentForm] = useState({
    student_number: '',
    first_name: '',
    last_name: '',
    class_id: '',
    date_of_birth: '',
    enrollment_date: new Date().toISOString().split('T')[0]
  });
  const [editingStudent, setEditingStudent] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          role,
          status,
          default_class_id,
          created_at,
          classes:default_class_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (teachersError) {
        console.error('Error loading teachers:', teachersError);
        toast.error('Failed to load teachers');
      } else {
        setTeachers(teachersData || []);
      }

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          year_level,
          section,
          is_active,
          created_at,
          students!inner (id)
        `)
        .order('year_level', { ascending: true });

      if (classesError) {
        console.error('Error loading classes:', classesError);
        toast.error('Failed to load classes');
      } else {
        // Transform to include student counts
        const classesWithCounts = classesData?.map(cls => ({
          ...cls,
          student_count: cls.students?.length || 0,
          students: undefined
        })) || [];
        setClasses(classesWithCounts);
      }

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          student_number,
          first_name,
          last_name,
          class_id,
          date_of_birth,
          enrollment_date,
          is_active,
          created_at,
          classes (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (studentsError) {
        console.error('Error loading students:', studentsError);
        toast.error('Failed to load students');
      } else {
        setStudents(studentsData || []);
      }

      // Calculate stats
      const statsData = {
        totalTeachers: teachersData?.filter(t => t.role === 'teacher' && t.status === 'active').length || 0,
        totalAdmins: teachersData?.filter(t => t.role === 'admin' && t.status === 'active').length || 0,
        totalClasses: classesData?.filter(c => c.is_active).length || 0,
        totalStudents: studentsData?.filter(s => s.is_active).length || 0
      };
      setStats(statsData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async () => {
    if (!teacherForm.email || !teacherForm.full_name || !teacherForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: teacherForm.email,
        password: teacherForm.password,
        email_confirm: true,
        user_metadata: {
          full_name: teacherForm.full_name,
          role: teacherForm.role
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: teacherForm.email,
          full_name: teacherForm.full_name,
          role: teacherForm.role,
          default_class_id: teacherForm.default_class_id || null,
          status: 'active'
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      toast.success(`${teacherForm.role === 'admin' ? 'Admin' : 'Teacher'} created successfully!`);
      setTeacherForm({
        email: '',
        full_name: '',
        password: '',
        default_class_id: '',
        role: 'teacher'
      });
      loadDashboardData();

    } catch (error) {
      console.error('Error creating teacher:', error);
      if (error.message?.includes('User already registered')) {
        toast.error('A user with this email already exists');
      } else {
        toast.error('Failed to create teacher. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeacher = async (teacherId, updates) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', teacherId);

      if (error) throw error;

      toast.success('Teacher updated successfully!');
      loadDashboardData();
      setEditingTeacher(null);

    } catch (error) {
      console.error('Error updating teacher:', error);
      toast.error('Failed to update teacher');
    }
  };

  const handleToggleTeacherStatus = async (teacherId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const confirmed = window.confirm(
      `Are you sure you want to ${newStatus === 'paused' ? 'suspend' : 'reactivate'} this teacher's account?`
    );

    if (confirmed) {
      await handleUpdateTeacher(teacherId, { status: newStatus });
    }
  };

  const handleCreateStudent = async () => {
    if (!studentForm.student_number || !studentForm.first_name || !studentForm.last_name || !studentForm.class_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .insert({
          student_number: studentForm.student_number,
          first_name: studentForm.first_name,
          last_name: studentForm.last_name,
          class_id: studentForm.class_id,
          date_of_birth: studentForm.date_of_birth || null,
          enrollment_date: studentForm.enrollment_date,
          is_active: true
        });

      if (error) throw error;

      toast.success('Student created successfully!');
      setStudentForm({
        student_number: '',
        first_name: '',
        last_name: '',
        class_id: '',
        date_of_birth: '',
        enrollment_date: new Date().toISOString().split('T')[0]
      });
      loadDashboardData();

    } catch (error) {
      console.error('Error creating student:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('A student with this number already exists');
      } else {
        toast.error('Failed to create student');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStudentStatus = async (studentId, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmed = window.confirm(
      `Are you sure you want to ${newStatus ? 'reactivate' : 'deactivate'} this student?`
    );

    if (confirmed) {
      try {
        const { error } = await supabase
          .from('students')
          .update({ is_active: newStatus })
          .eq('id', studentId);

        if (error) throw error;

        toast.success(`Student ${newStatus ? 'reactivated' : 'deactivated'} successfully!`);
        loadDashboardData();

      } catch (error) {
        console.error('Error updating student status:', error);
        toast.error('Failed to update student status');
      }
    }
  };

  const renderOverviewTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
      {/* Stats Cards */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#4CAF50', fontSize: '32px', margin: '0 0 10px 0' }}>
          {stats.totalTeachers}
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          Active Teachers
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#2196F3', fontSize: '32px', margin: '0 0 10px 0' }}>
          {stats.totalClasses}
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          Active Classes
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#FF9800', fontSize: '32px', margin: '0 0 10px 0' }}>
          {stats.totalStudents}
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          Active Students
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#9C27B0', fontSize: '32px', margin: '0 0 10px 0' }}>
          {stats.totalAdmins}
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          System Admins
        </p>
      </div>
    </div>
  );

  const renderTeachersTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
      {/* Create Teacher Form */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        height: 'fit-content'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
          Create New User
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Role *
          </label>
          <select
            value={teacherForm.role}
            onChange={(e) => setTeacherForm(prev => ({ ...prev, role: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Email *
          </label>
          <input
            type="email"
            value={teacherForm.email}
            onChange={(e) => setTeacherForm(prev => ({ ...prev, email: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="teacher@school.com"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Full Name *
          </label>
          <input
            type="text"
            value={teacherForm.full_name}
            onChange={(e) => setTeacherForm(prev => ({ ...prev, full_name: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="John Smith"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Password *
          </label>
          <input
            type="password"
            value={teacherForm.password}
            onChange={(e) => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Minimum 8 characters"
          />
        </div>

        {teacherForm.role === 'teacher' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
              Default Class
            </label>
            <select
              value={teacherForm.default_class_id}
              onChange={(e) => setTeacherForm(prev => ({ ...prev, default_class_id: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">No default class</option>
              {classes.filter(c => c.is_active).map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleCreateTeacher}
          disabled={saving}
          style={{
            width: '100%',
            backgroundColor: saving ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {saving ? 'Creating...' : `Create ${teacherForm.role === 'admin' ? 'Admin' : 'Teacher'}`}
        </button>
      </div>

      {/* Teachers List */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
          All Users ({teachers.length})
        </h3>
        
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {teachers.map(teacher => (
            <div key={teacher.id} style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '10px',
              backgroundColor: teacher.status === 'paused' ? '#ffebee' : '#fafafa'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '10px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>
                    {teacher.full_name}
                    <span style={{
                      backgroundColor: teacher.role === 'admin' ? '#9C27B0' : '#4CAF50',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      marginLeft: '8px',
                      textTransform: 'uppercase'
                    }}>
                      {teacher.role}
                    </span>
                    {teacher.status === 'paused' && (
                      <span style={{
                        backgroundColor: '#F44336',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        marginLeft: '5px',
                        textTransform: 'uppercase'
                      }}>
                        SUSPENDED
                      </span>
                    )}
                  </h4>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>
                    {teacher.email}
                  </p>
                  {teacher.classes && (
                    <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
                      Default Class: {teacher.classes.name}
                    </p>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleToggleTeacherStatus(teacher.id, teacher.status)}
                    style={{
                      backgroundColor: teacher.status === 'paused' ? '#4CAF50' : '#FF9800',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {teacher.status === 'paused' ? 'Reactivate' : 'Suspend'}
                  </button>
                  
                  <button
                    onClick={() => setEditingTeacher(teacher)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStudentsTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
      {/* Create Student Form */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        height: 'fit-content'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
          Add New Student
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Student Number *
          </label>
          <input
            type="text"
            value={studentForm.student_number}
            onChange={(e) => setStudentForm(prev => ({ ...prev, student_number: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="STU001"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            First Name *
          </label>
          <input
            type="text"
            value={studentForm.first_name}
            onChange={(e) => setStudentForm(prev => ({ ...prev, first_name: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="John"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Last Name *
          </label>
          <input
            type="text"
            value={studentForm.last_name}
            onChange={(e) => setStudentForm(prev => ({ ...prev, last_name: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Smith"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Class *
          </label>
          <select
            value={studentForm.class_id}
            onChange={(e) => setStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Select a class</option>
            {classes.filter(c => c.is_active).map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Date of Birth
          </label>
          <input
            type="date"
            value={studentForm.date_of_birth}
            onChange={(e) => setStudentForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold' }}>
            Enrollment Date
          </label>
          <input
            type="date"
            value={studentForm.enrollment_date}
            onChange={(e) => setStudentForm(prev => ({ ...prev, enrollment_date: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <button
          onClick={handleCreateStudent}
          disabled={saving}
          style={{
            width: '100%',
            backgroundColor: saving ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {saving ? 'Adding...' : 'Add Student'}
        </button>
      </div>

      {/* Students List */}
      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
          All Students ({students.length})
        </h3>
        
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {students.map(student => (
            <div key={student.id} style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '10px',
              backgroundColor: student.is_active ? '#fafafa' : '#ffebee'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '10px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>
                    {student.first_name} {student.last_name}
                    {!student.is_active && (
                      <span style={{
                        backgroundColor: '#F44336',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        marginLeft: '8px',
                        textTransform: 'uppercase'
                      }}>
                        INACTIVE
                      </span>
                    )}
                  </h4>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>
                    Student #: {student.student_number}
                  </p>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>
                    Class: {student.classes?.name || 'No class assigned'}
                  </p>
                  {student.date_of_birth && (
                    <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>
                      DOB: {new Date(student.date_of_birth).toLocaleDateString('en-GB')}
                    </p>
                  )}
                  <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
                    Enrolled: {new Date(student.enrollment_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleToggleStudentStatus(student.id, student.is_active)}
                    style={{
                      backgroundColor: student.is_active ? '#FF9800' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {student.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  
                  <button
                    onClick={() => setEditingStudent(student)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderClassesTab = () => (
    <div style={{
      backgroundColor: 'white',
      padding: '25px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
        All Classes ({classes.length})
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {classes.map(cls => (
          <div key={cls.id} style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: cls.is_active ? '#fafafa' : '#ffebee'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '18px', fontWeight: 'bold' }}>
              {cls.name}
              {!cls.is_active && (
                <span style={{
                  backgroundColor: '#F44336',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  marginLeft: '8px',
                  textTransform: 'uppercase'
                }}>
                  INACTIVE
                </span>
              )}
            </h4>
            
            <div style={{ marginBottom: '15px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>
                Year Level: {cls.year_level === 0 ? 'Reception' : `Year ${cls.year_level}`}
              </p>
              {cls.section && (
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>
                  Section: {cls.section}
                </p>
              )}
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Students: {cls.student_count}
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              {cls.student_count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
        padding: '25px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          color: '#333',
          margin: '0 0 10px 0',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          🔧 Admin Dashboard
        </h1>
        <p style={{
          color: '#666',
          margin: 0,
          fontSize: '16px'
        }}>
          Manage teachers, students, and system settings
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0'
        }}>
          {['overview', 'teachers', 'students', 'classes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                backgroundColor: activeTab === tab ? '#4CAF50' : 'transparent',
                color: activeTab === tab ? 'white' : '#666',
                border: 'none',
                padding: '15px 25px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                textTransform: 'capitalize',
                borderRadius: activeTab === tab ? '10px 10px 0 0' : '0'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '25px' }}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'teachers' && renderTeachersTab()}
          {activeTab === 'students' && renderStudentsTab()}
          {activeTab === 'classes' && renderClassesTab()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;