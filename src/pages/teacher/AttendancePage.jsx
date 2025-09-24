import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import supabase from '../../utils/supabase';
import toast from 'react-hot-toast';

const AttendancePage = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingRecords, setExistingRecords] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Load classes on component mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const { data: classesData, error } = await supabase
          .from('classes')
          .select('id, name, year_level, section, is_active')
          .eq('is_active', true)
          .order('year_level', { ascending: true });

        if (error) {
          console.error('Error loading classes:', error);
          toast.error('Failed to load classes');
          return;
        }

        setClasses(classesData || []);

        // If classId is provided, select that class
        if (classId && classesData) {
          const foundClass = classesData.find(cls => cls.id === classId);
          if (foundClass) {
            setSelectedClass(foundClass);
          } else {
            toast.error('Class not found');
            navigate('/teacher');
          }
        }
      } catch (error) {
        console.error('Error in loadClasses:', error);
        toast.error('Failed to load classes');
      }
    };

    loadClasses();
  }, [classId, navigate]);

  // Load students and existing attendance when class is selected
  useEffect(() => {
    const loadStudentsAndAttendance = async () => {
      if (!selectedClass) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Load students for the selected class
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id, student_number, first_name, last_name')
          .eq('class_id', selectedClass.id)
          .eq('is_active', true)
          .order('last_name', { ascending: true });

        if (studentsError) {
          console.error('Error loading students:', studentsError);
          toast.error('Failed to load students');
          return;
        }

        setStudents(studentsData || []);

        // Load existing attendance records for the current date
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('id, student_id, status, notes')
          .eq('class_id', selectedClass.id)
          .eq('attendance_date', currentDate);

        if (attendanceError) {
          console.error('Error loading attendance:', attendanceError);
          toast.error('Failed to load existing attendance');
          return;
        }

        // Convert existing records to a lookup object
        const existingMap = {};
        const attendanceMap = {};
        
        (attendanceData || []).forEach(record => {
          existingMap[record.student_id] = record.id;
          attendanceMap[record.student_id] = {
            status: record.status,
            notes: record.notes || ''
          };
        });

        setExistingRecords(existingMap);
        setAttendance(attendanceMap);
        setHasChanges(false);

      } catch (error) {
        console.error('Error in loadStudentsAndAttendance:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadStudentsAndAttendance();
  }, [selectedClass, currentDate]);

  const handleClassChange = (newClassId) => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to switch classes? All unsaved changes will be lost.'
      );
      if (!confirmed) return;
    }

    const newClass = classes.find(cls => cls.id === newClassId);
    setSelectedClass(newClass);
    navigate(`/teacher/attendance/${newClassId}`, { replace: true });
  };

  const handleAttendanceChange = (studentId, field, value) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleQuickMark = (status) => {
    if (!selectedClass || students.length === 0) return;

    const confirmed = window.confirm(
      `Mark ALL students as "${status.toUpperCase()}"? This will overwrite any existing selections.`
    );

    if (confirmed) {
      const newAttendance = {};
      students.forEach(student => {
        newAttendance[student.id] = {
          status: status,
          notes: attendance[student.id]?.notes || ''
        };
      });
      setAttendance(newAttendance);
      setHasChanges(true);
      toast.success(`All students marked as ${status}`);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass || !user) {
      toast.error('Missing required data');
      return;
    }

    // Validate that all students have attendance marked
    const unmarkedStudents = students.filter(student => !attendance[student.id]?.status);
    if (unmarkedStudents.length > 0) {
      const confirmed = window.confirm(
        `${unmarkedStudents.length} students don't have attendance marked. Do you want to continue? Unmarked students will be skipped.`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    
    try {
      const recordsToSave = [];
      const recordsToUpdate = [];

      // Prepare records for saving/updating
      Object.entries(attendance).forEach(([studentId, data]) => {
        if (!data.status) return; // Skip students without status

        const recordData = {
          student_id: studentId,
          class_id: selectedClass.id,
          teacher_id: user.id,
          attendance_date: currentDate,
          status: data.status,
          notes: data.notes || null
        };

        if (existingRecords[studentId]) {
          // Update existing record
          recordsToUpdate.push({
            id: existingRecords[studentId],
            ...recordData
          });
        } else {
          // Create new record
          recordsToSave.push(recordData);
        }
      });

      // Insert new records
      if (recordsToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('attendance_records')
          .insert(recordsToSave);

        if (insertError) {
          console.error('Error inserting attendance:', insertError);
          throw insertError;
        }
      }

      // Update existing records
      for (const record of recordsToUpdate) {
        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({
            status: record.status,
            notes: record.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updateError) {
          console.error('Error updating attendance:', updateError);
          throw updateError;
        }
      }

      toast.success(`Attendance saved successfully! ${recordsToSave.length + recordsToUpdate.length} records processed.`);
      setHasChanges(false);

      // Reload existing records to reflect changes
      const updatedExisting = {};
      Object.entries(attendance).forEach(([studentId, data]) => {
        if (data.status && !existingRecords[studentId]) {
          // This is a new record, we don't have the ID yet, but mark as existing
          updatedExisting[studentId] = 'new';
        } else if (existingRecords[studentId]) {
          updatedExisting[studentId] = existingRecords[studentId];
        }
      });
      setExistingRecords(updatedExisting);

    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      default: return '#E0E0E0';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'present': return '#e8f5e8';
      case 'absent': return '#ffebee';
      case 'late': return '#fff3e0';
      default: return '#f5f5f5';
    }
  };

  const getAttendanceStats = () => {
    const stats = { present: 0, absent: 0, late: 0, unmarked: 0 };
    students.forEach(student => {
      const status = attendance[student.id]?.status;
      if (status) {
        stats[status]++;
      } else {
        stats.unmarked++;
      }
    });
    return stats;
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

  const stats = getAttendanceStats();

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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h1 style={{
              color: '#333',
              margin: '0 0 10px 0',
              fontSize: '28px',
              fontWeight: 'bold'
            }}>
              📋 Take Attendance
            </h1>
            <p style={{
              color: '#666',
              margin: 0,
              fontSize: '16px'
            }}>
              {selectedClass ? `${selectedClass.name} • ${new Date(currentDate).toLocaleDateString('en-GB')}` : 'Select a class to get started'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <button
              onClick={() => navigate('/teacher')}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Class Selection */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <label style={{
            color: '#333',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            Class:
          </label>
          <select
            value={selectedClass?.id || ''}
            onChange={(e) => handleClassChange(e.target.value)}
            style={{
              padding: '10px 15px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              minWidth: '200px'
            }}
          >
            <option value="">Select a class...</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          {selectedClass && (
            <span style={{
              color: '#666',
              fontSize: '14px'
            }}>
              {students.length} students
            </span>
          )}
        </div>

        {/* Quick Actions */}
        {selectedClass && students.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => handleQuickMark('present')}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Mark All Present
            </button>
            <button
              onClick={() => handleQuickMark('absent')}
              style={{
                backgroundColor: '#F44336',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Mark All Absent
            </button>
            <button
              onClick={() => handleQuickMark('late')}
              style={{
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Mark All Late
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#666', marginBottom: '15px' }}>
            Please select a class to take attendance
          </h3>
          <p style={{ color: '#999' }}>
            Choose a class from the dropdown above to view and mark student attendance.
          </p>
        </div>
      ) : students.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#666', marginBottom: '15px' }}>
            No students found in {selectedClass.name}
          </h3>
          <p style={{ color: '#999' }}>
            This class doesn't have any active students enrolled.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '20px',
              textAlign: 'center'
            }}>
              <div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#4CAF50',
                  marginBottom: '5px'
                }}>
                  {stats.present}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>Present</div>
              </div>
              <div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#FF9800',
                  marginBottom: '5px'
                }}>
                  {stats.late}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>Late</div>
              </div>
              <div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#F44336',
                  marginBottom: '5px'
                }}>
                  {stats.absent}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>Absent</div>
              </div>
              <div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#9E9E9E',
                  marginBottom: '5px'
                }}>
                  {stats.unmarked}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>Unmarked</div>
              </div>
            </div>
          </div>

          {/* Students List */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 25px',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                margin: 0,
                color: '#333',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                Student Attendance List
              </h3>
              
              {hasChanges && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <span style={{
                    color: '#FF9800',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    ● Unsaved changes
                  </span>
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    style={{
                      backgroundColor: saving ? '#ccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '12px 25px',
                      borderRadius: '6px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {saving ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #fff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        Saving...
                      </>
                    ) : (
                      <>💾 Save Attendance</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: '10px'
            }}>
              {students.map((student, index) => {
                const studentAttendance = attendance[student.id] || {};
                const isExisting = existingRecords[student.id];
                
                return (
                  <div
                    key={student.id}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '20px',
                      marginBottom: '10px',
                      backgroundColor: getStatusBgColor(studentAttendance.status),
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {isExisting && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '15px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontWeight: 'bold'
                      }}>
                        SAVED
                      </div>
                    )}

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '20px',
                      alignItems: 'start'
                    }}>
                      {/* Student Info */}
                      <div>
                        <h4 style={{
                          margin: '0 0 5px 0',
                          color: '#333',
                          fontSize: '18px',
                          fontWeight: 'bold'
                        }}>
                          {student.first_name} {student.last_name}
                        </h4>
                        <p style={{
                          margin: '0 0 15px 0',
                          color: '#666',
                          fontSize: '14px'
                        }}>
                          Student #: {student.student_number}
                        </p>

                        {/* Attendance Status Buttons */}
                        <div style={{
                          display: 'flex',
                          gap: '10px',
                          marginBottom: '15px',
                          flexWrap: 'wrap'
                        }}>
                          {['present', 'late', 'absent'].map(status => (
                            <button
                              key={status}
                              onClick={() => handleAttendanceChange(student.id, 'status', status)}
                              style={{
                                backgroundColor: studentAttendance.status === status ? getStatusColor(status) : '#f5f5f5',
                                color: studentAttendance.status === status ? 'white' : '#666',
                                border: `2px solid ${studentAttendance.status === status ? getStatusColor(status) : '#e0e0e0'}`,
                                padding: '8px 16px',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s ease',
                                minWidth: '80px'
                              }}
                            >
                              {status === 'present' && '✓ Present'}
                              {status === 'late' && '⏰ Late'}
                              {status === 'absent' && '✗ Absent'}
                            </button>
                          ))}
                        </div>

                        {/* Notes */}
                        <textarea
                          placeholder="Add notes (optional)..."
                          value={studentAttendance.notes || ''}
                          onChange={(e) => handleAttendanceChange(student.id, 'notes', e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>

                      {/* Student Number Badge */}
                      <div style={{
                        textAlign: 'center',
                        padding: '10px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        minWidth: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        color: '#666',
                        border: '2px solid #e0e0e0'
                      }}>
                        {index + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Button at Bottom */}
            <div style={{
              padding: '20px 25px',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                color: '#666',
                fontSize: '14px'
              }}>
                {stats.present + stats.late + stats.absent} of {students.length} students marked
                {hasChanges && (
                  <span style={{
                    color: '#FF9800',
                    fontWeight: 'bold',
                    marginLeft: '10px'
                  }}>
                    • Unsaved changes
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveAttendance}
                disabled={saving || !hasChanges}
                style={{
                  backgroundColor: saving ? '#ccc' : hasChanges ? '#4CAF50' : '#e0e0e0',
                  color: 'white',
                  border: 'none',
                  padding: '15px 30px',
                  borderRadius: '8px',
                  cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}
              >
                {saving ? (
                  <>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid #fff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Saving Attendance...
                  </>
                ) : (
                  <>
                    💾 Save Attendance
                    {hasChanges && (
                      <span style={{
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {Object.keys(attendance).filter(id => attendance[id].status).length} records
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Help Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginTop: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          color: '#333',
          margin: '0 0 15px 0',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          💡 Quick Tips:
        </h3>
        <ul style={{
          margin: 0,
          padding: '0 0 0 20px',
          color: '#666',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          <li>Use the "Mark All" buttons for quick bulk operations</li>
          <li>Changes are highlighted with an orange dot until saved</li>
          <li>You can update attendance for the same day by re-saving</li>
          <li>Notes are optional but helpful for tracking specific incidents</li>
          <li>All attendance records are automatically timestamped</li>
        </ul>
      </div>
    </div>
  );
};

export default AttendancePage;