import { useState, memo, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";

import { AuthContext } from "../context/AuthContext";
import supabase from "../utils/supabase";
import toast from "react-hot-toast";

function ResponsiveAppBar() {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            status,
            default_class_id,
            classes:default_class_id (
              name
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
          return;
        }

        setProfile(profileData);
      } catch (error) {
        console.error('Error in loadProfile:', error);
      }
    };

    if (user) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  // Define navigation pages based on user role and authentication status
  const getNavigationPages = () => {
    if (!user || !profile) {
      return [
        { pageName: "Sign In", link: "/auth/sign-in", protected: false },
        { pageName: "Sign Up", link: "/auth/sign-up", protected: false },
      ];
    }

    const pages = [
      { pageName: "Dashboard", link: "/", protected: true },
    ];

    if (profile.role === 'teacher') {
      pages.push(
        { pageName: "Take Attendance", link: "/teacher", protected: true },
      );
      
      if (profile.default_class_id) {
        pages.push({
          pageName: `Quick: ${profile.classes?.name || 'Default Class'}`,
          link: `/teacher/attendance/${profile.default_class_id}`,
          protected: true
        });
      }
    }

    if (profile.role === 'admin') {
      pages.push(
        { pageName: "Teacher Dashboard", link: "/teacher", protected: true },
        { pageName: "Admin Panel", link: "/admin", protected: true },
      );
    }

    return pages;
  };

  const pages = getNavigationPages();

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSignOut = async () => {
    try {
      // Clear sensitive data
      if (window.studentData) delete window.studentData;
      if (window.csvData) delete window.csvData;
      if (window.emailData) delete window.emailData;

      await supabase.auth.signOut();
      toast.success("Signed out successfully!");
      navigate('/auth/sign-in', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Error signing out");
    } finally {
      handleCloseUserMenu();
    }
  };

  const handleNavigation = (link) => {
    navigate(link);
    handleCloseNavMenu();
    handleCloseUserMenu();
  };

  const userMenuItems = user ? [
    { name: 'Profile', action: () => toast.info('Profile page coming soon!') },
    { name: 'Settings', action: () => toast.info('Settings page coming soon!') },
    { name: 'Sign Out', action: handleSignOut }
  ] : [];

  if (loading) {
    return null;
  }

  const isCurrentPage = (link) => {
    if (link === '/' && location.pathname === '/') return true;
    if (link !== '/' && location.pathname.startsWith(link)) return true;
    return false;
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: '#fff', boxShadow: 2 }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo/Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <img 
              src="/logo.png" 
              alt="School Logo" 
              style={{ 
                width: '32px', 
                height: '32px', 
                marginRight: '10px',
                cursor: 'pointer'
              }}
              onClick={() => handleNavigation('/')}
              onError={(e) => e.target.style.display = 'none'}
            />
            <Button
              onClick={() => handleNavigation('/')}
              sx={{
                fontWeight: 'bold',
                fontSize: '20px',
                color: '#333',
                textDecoration: 'none',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'none'
                }
              }}
            >
              School Attendance
            </Button>
          </Box>

          {/* Mobile Navigation */}
          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              sx={{ color: '#333' }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {pages.map((page) => (
                <MenuItem key={page.pageName} onClick={() => handleNavigation(page.link)}>
                  <span style={{ 
                    color: isCurrentPage(page.link) ? '#4CAF50' : '#333',
                    fontWeight: isCurrentPage(page.link) ? 'bold' : 'normal'
                  }}>
                    {page.pageName}
                  </span>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Desktop Navigation */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
            {pages.map((page) => (
              <Button
                key={page.pageName}
                onClick={() => handleNavigation(page.link)}
                sx={{
                  my: 2,
                  mx: 1,
                  display: "block",
                  color: isCurrentPage(page.link) ? '#4CAF50' : '#333',
                  fontWeight: isCurrentPage(page.link) ? 'bold' : 'normal',
                  borderBottom: isCurrentPage(page.link) ? '2px solid #4CAF50' : 'none',
                  borderRadius: 0,
                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  }
                }}
              >
                {page.pageName}
              </Button>
            ))}
          </Box>

          {/* User Menu */}
          {user && profile ? (
            <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', mr: 2 }}>
                <span style={{ 
                  color: '#666', 
                  fontSize: '14px',
                  marginRight: '8px'
                }}>
                  Welcome,
                </span>
                <span style={{ 
                  color: '#333', 
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {profile.full_name}
                </span>
                <span style={{
                  backgroundColor: profile.role === 'admin' ? '#9C27B0' : '#4CAF50',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  marginLeft: '8px',
                  textTransform: 'uppercase',
                  fontWeight: 'bold'
                }}>
                  {profile.role}
                </span>
              </Box>
              
              <Tooltip title="User menu">
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: profile.role === 'admin' ? '#9C27B0' : '#4CAF50',
                      width: 36,
                      height: 36,
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    {profile.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: "45px" }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
              >
                {/* User Info */}
                <MenuItem disabled>
                  <Box>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                      {profile.full_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {profile.email}
                    </div>
                    {profile.classes && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Default: {profile.classes.name}
                      </div>
                    )}
                  </Box>
                </MenuItem>
                
                {/* Divider */}
                <MenuItem disabled sx={{ borderBottom: '1px solid #e0e0e0', py: 0, minHeight: '1px' }}>
                </MenuItem>
                
                {userMenuItems.map((item) => (
                  <MenuItem key={item.name} onClick={item.action}>
                    <span style={{
                      color: item.name === 'Sign Out' ? '#F44336' : '#333',
                      fontWeight: item.name === 'Sign Out' ? 'bold' : 'normal'
                    }}>
                      {item.name}
                    </span>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          ) : (
            // Show sign in button for non-authenticated users
            <Box sx={{ flexGrow: 0 }}>
              <Button
                onClick={() => handleNavigation('/auth/sign-in')}
                sx={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: '#45a049',
                  }
                }}
              >
                Sign In
              </Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default memo(ResponsiveAppBar);