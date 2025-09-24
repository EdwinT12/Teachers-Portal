// pages/auth/SignIn.jsx - Fixed with Immediate Paused User Detection
import { memo, useContext, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";
import AccountForm from "../../containers/AccountForm";
import supabase from "../../utils/supabase";

const SignIn = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  
  // State for paused user modal
  const [showPausedModal, setShowPausedModal] = useState(false);
  const [pausedUserInfo, setPausedUserInfo] = useState(null);

  useEffect(() => {
    // If user is already authenticated, redirect to main app
    if (user) {
      navigate("/");
    }

    // Security: Clear any sensitive data on sign-in page load
    if (window.studentData) delete window.studentData;
    if (window.csvData) delete window.csvData;
  }, [user, navigate]);

  // Security: Rate limiting for login attempts
  useEffect(() => {
    if (attempts >= 5) {
      setLocked(true);
      toast.error("Too many login attempts. Please wait 5 minutes.");
      
      setTimeout(() => {
        setLocked(false);
        setAttempts(0);
      }, 300000); 
    }
  }, [attempts]);

  // Function to close paused modal
  const closePausedModal = () => {
    setShowPausedModal(false);
    setPausedUserInfo(null);
  };

  // Function to check user status
  const checkUserStatus = async (email) => {
    try {
      console.log('🔍 Checking user status for:', email);
      
      const { data, error } = await supabase.rpc('get_user_status', {
        user_email: email.toLowerCase().trim()
      });

      if (error) {
        console.error('❌ Error checking user status:', error);
        throw error;
      }

      console.log('📋 User status data received:', data);
      
      const userStatus = data?.[0];
      if (!userStatus) {
        console.warn('⚠️ No user status found for email:', email);
        return { status: 'active' };
      }

      console.log('✅ User status:', userStatus.status);
      return userStatus;
    } catch (error) {
      console.error('💥 Error in checkUserStatus:', error);
      throw error;
    }
  };

  // Show paused modal with professional fallback
  const showPausedUserModal = (userInfo) => {
    console.log('🚫 Showing paused user modal for:', userInfo);
    
    setPausedUserInfo(userInfo);
    setShowPausedModal(true);
    
    // Professional fallback toast if modal doesn't appear
    setTimeout(() => {
      if (!document.querySelector('[data-paused-modal]')) {
        toast.error(`Account suspended: Please contact administration to reactivate your account.`, {
          duration: 6000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b',
            maxWidth: '400px',
            fontSize: '14px'
          }
        });
      }
    }, 500);
  };

  const signIn = async (email, password) => {
    // Prevent sign-in if the account is locked
    if (locked) {
      toast.error("Account temporarily locked. Please wait.");
      return;
    }

    // Basic validation for empty fields
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    // Security: Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    console.log('🔑 Starting sign-in process for:', email);

    try {
      // STEP 1: Check user status FIRST before authentication
      console.log('👀 Pre-checking user status...');
      const userStatus = await checkUserStatus(email);
      
      if (userStatus.status === 'paused') {
        console.log('⏸️ User is paused - blocking sign-in attempt');
        
        showPausedUserModal({
          email: email,
          fullName: userStatus.full_name || 'User',
          role: userStatus.role || 'teacher'
        });
        
        // Reset form
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          if (form.reset) form.reset();
        });
        
        setIsLoading(false);
        return;
      }
      
      if (userStatus.status === 'deleted') {
        console.log('🗑️ User account is deleted');
        toast.error("This account has been deleted. Please contact administration if you believe this is an error.");
        setIsLoading(false);
        return;
      }

      // STEP 2: Proceed with authentication only if user is active
      console.log('✅ User status is active, proceeding with authentication...');
      
      const result = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (!result.error) {
        console.log('🎉 Authentication successful!');
        
        // Double-check status after authentication (in case it changed)
        const finalStatus = await checkUserStatus(email);
        
        if (finalStatus.status === 'paused') {
          console.log('⏸️ User became paused during sign-in, signing out...');
          await supabase.auth.signOut();
          
          showPausedUserModal({
            email: email,
            fullName: finalStatus.full_name || 'User',
            role: finalStatus.role || 'teacher'
          });
          
          setIsLoading(false);
          return;
        }
        
        if (finalStatus.status === 'deleted') {
          console.log('🗑️ User became deleted during sign-in, signing out...');
          await supabase.auth.signOut();
          toast.error("This account has been deleted. Please contact administration.");
          setIsLoading(false);
          return;
        }
        
        // Success!
        setAttempts(0);
        toast.success("Welcome back!");
        
        // Security: Clear form data after successful sign-in
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          if (form.reset) form.reset();
        });
        
        console.log('🚀 Redirecting to dashboard...');
        navigate("/", { replace: true });
        
      } else {
        // Authentication failed
        setAttempts(prev => prev + 1);
        console.log('❌ Authentication failed:', result.error.message);
        
        if (result.error.message.includes('Invalid login credentials')) {
          toast.error("Invalid email or password.");
        } else if (result.error.message.includes('Email not confirmed')) {
          toast.error("Please check your email and confirm your account.");
        } else {
          toast.error(result.error.message || "Sign in failed. Please try again.");
        }
      }
    } catch (error) {
      console.error('💥 Sign in error:', error);
      setAttempts(prev => prev + 1);
      
      // Check if it's a user status error
      if (error.message && error.message.includes('get_user_status')) {
        toast.error("Unable to verify account status. Please contact administration.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/logo.png"
            alt="SJMV Logo" 
            style={{
              width: '100px',
              height: 'auto',
              marginBottom: '20px',
              display: 'block',
              margin: '0 auto',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
            }}
            onError={(e) => e.target.style.display = 'none'}
          />
          
          <h2 style={{
            color: '#333',
            marginBottom: '10px',
            fontSize: '28px',
            fontWeight: 'bold'
          }}>
            Sign In
          </h2>
          <p style={{
            color: '#666',
            fontSize: '14px',
            margin: 0
          }}>
            Access your secure teacher dashboard
          </p>
        </div>

        {/* Professional loading indicator */}
        {isLoading && (
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#4a5568',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e2e8f0',
              borderTop: '2px solid #4a5568',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Verifying account status...
          </div>
        )}

        {/* Security warning for multiple attempts */}
        {attempts > 2 && !locked && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            padding: '10px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#856404',
            textAlign: 'center'
          }}>
            ⚠️ Warning: {5 - attempts} attempts remaining
          </div>
        )}

        {locked && (
          <div style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px',
            padding: '15px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#721c24',
            textAlign: 'center'
          }}>
            🔒 Account temporarily locked due to too many failed attempts.
            <br />Please wait 5 minutes before trying again.
          </div>
        )}
        
        <AccountForm 
          onSubmit={signIn} 
          buttonText={isLoading ? "Verifying..." : "Sign In"}
          disabled={locked || isLoading}
          formType="signIn"
        />
        
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          Don't have an account?{" "}
          <Link 
            to="/auth/sign-up" 
            style={{
              color: '#4CAF50',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Sign up here
          </Link>
        </div>

        <div style={{
          marginTop: '10px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          <Link 
            to="/auth/forgot-password" 
            style={{
              color: '#2196f3',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Security notice */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#e8f5fe',
          border: '1px solid #bbdefb',
          borderRadius: '5px',
          fontSize: '12px',
          color: '#1565c0'
        }}>
          <strong>🔒 Security Notice:</strong>
          <br />• Your session will expire automatically
          <br />• Student data is never stored permanently
          <br />• All data is cleared when you leave the page
        </div>
      </div>

      {/* Professional Paused Account Modal */}
      {showPausedModal && (
        <div 
          data-paused-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePausedModal();
            }
          }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
            position: 'relative',
            border: '1px solid #e2e8f0',
            animation: 'modalFadeIn 0.3s ease-out'
          }}>
            {/* Close button */}
            <button
              onClick={closePausedModal}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = '#6b7280'}
              onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
            >
              ✕
            </button>

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#f59e0b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                marginRight: '16px',
                flexShrink: 0
              }}>
                ⏸️
              </div>
              <div>
                <h2 style={{
                  color: '#111827',
                  fontSize: '24px',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                  lineHeight: '1.2'
                }}>
                  Account Access Suspended
                </h2>
                <p style={{
                  color: '#6b7280',
                  fontSize: '16px',
                  margin: '0',
                  lineHeight: '1.4'
                }}>
                  Your sign-in request has been blocked
                </p>
              </div>
            </div>

            {/* User Information */}
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                color: '#92400e',
                fontSize: '18px',
                fontWeight: '600',
                margin: '0 0 12px 0'
              }}>
                Hello {pausedUserInfo?.fullName || 'User'},
              </h3>
              <p style={{
                color: '#b45309',
                fontSize: '15px',
                lineHeight: '1.5',
                margin: '0 0 16px 0'
              }}>
                Your account <strong>({pausedUserInfo?.email})</strong> has been temporarily suspended by the system administrator.
              </p>
              
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d97706',
                borderRadius: '6px',
                padding: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#dc2626',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '8px',
                    fontSize: '12px'
                  }}>
                    !
                  </div>
                  <span style={{
                    color: '#991b1b',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Account Status: Suspended
                  </span>
                </div>
                <p style={{
                  color: '#7c2d12',
                  fontSize: '14px',
                  margin: '0',
                  lineHeight: '1.4'
                }}>
                  You cannot access the system until your account is reactivated by an administrator.
                </p>
              </div>
            </div>

            {/* Action Steps */}
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h4 style={{
                color: '#0c4a6e',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '18px' }}>📞</span>
                Required Actions
              </h4>
              <ol style={{
                color: '#075985',
                fontSize: '14px',
                lineHeight: '1.6',
                margin: '0',
                paddingLeft: '20px'
              }}>
                <li style={{ marginBottom: '8px' }}>
                  Contact your school's IT administrator or main office
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Inquire about the reason for the account suspension
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Follow the provided instructions to resolve any issues
                </li>
                <li>
                  Request account reactivation once the matter is resolved
                </li>
              </ol>
            </div>

            {/* Action Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={closePausedModal}
                style={{
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#1f2937'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
              >
                Understood
              </button>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb',
              fontSize: '12px',
              color: '#9ca3af',
              textAlign: 'center'
            }}>
              For security reasons, you have been automatically signed out.
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes modalFadeIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default memo(SignIn);
