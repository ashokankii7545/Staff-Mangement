const fs = require('fs');
let content = fs.readFileSync('layout/Sidebar.jsx', 'utf8');

const importsToAdd = `import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Divider from '@mui/material/Divider';
import React from 'react';`;

content = content.replace("import Box from '@mui/material/Box';", importsToAdd + '\n' + "import Box from '@mui/material/Box';");

const stateLogic = `
  const [expanded, setExpanded] = useState({
    'User Management': true,
    'Operations & Medical': false,
    'My Records': true,
    'Operations': false,
  });

  const handleToggle = (groupTitle) => {
    setExpanded(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const adminGroups = [
    { title: null, items: ['/'] },
    { title: 'User Management', items: ['/staff', '/approvals', '/history', '/holidays'] },
    { title: 'Operations & Medical', items: ['/stock', '/medicines', '/offices', '/documents', '/settings'] }
  ];

  const staffGroups = [
    { title: null, items: ['/', '/attendance'] },
    { title: 'My Records', items: ['/history', '/leaves'] },
    { title: 'Operations', items: ['/stock', '/documents'] }
  ];

  const groups = isAdmin ? adminGroups : staffGroups;
;

content = content.replace(const navItems = (isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_STAFF).filter((item) =>, stateLogic + '\n  const navItems = (isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_STAFF).filter((item) =>');

const oldListRegex = /<List sx=\{\{\s*px: isRail \? 1 : 1\.5,\s*py: 0\.5\s*\}\}>[\s\S]*?<\/List>/;
const newList = <List sx={{ px: isRail ? 1 : 1.5, py: 0.5 }}>
        {groups.map((group, idx) => {
          const groupNavItems = group.items.map(path => navItems.find(i => i.path === path)).filter(Boolean);
          if (groupNavItems.length === 0) return null;

          return (
            <React.Fragment key={idx}>
              {group.title && !isRail && (
                <ListItemButton onClick={() => handleToggle(group.title)} sx={{ borderRadius: 1.5, mb: 0.5, mt: idx > 0 ? 1 : 0 }}>
                  <ListItemText 
                    primary={group.title} 
                    primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                  />
                  {expanded[group.title] ? <ExpandLess sx={{color: 'text.secondary', fontSize: 18}} /> : <ExpandMore sx={{color: 'text.secondary', fontSize: 18}} />}
                </ListItemButton>
              )}
              {group.title && isRail && (
                <Divider sx={{ my: 1 }} />
              )}
              <Collapse in={!group.title || isRail || expanded[group.title]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {groupNavItems.map((item) => {
                    const Icon = iconMap[item.icon] || DashboardIcon;
                    const isActive = location.pathname === item.path;

                    const navButton = (
                      <ListItemButton
                        onClick={() => go(item.path)}
                        sx={{
                          borderRadius: 1.5,
                          justifyContent: isRail ? 'center' : 'flex-start',
                          minHeight: 42,
                          px: isRail ? 1 : 1.5,
                          bgcolor: isActive ? ACTIVE_PILL_BG : 'transparent',
                          color: isActive ? ACTIVE_TEXT : 'text.secondary',
                          transition: 'all 0.15s ease',
                          mb: 0.5,
                          '&:hover': {
                            bgcolor: isActive ? ACTIVE_PILL_BG : 'action.hover',
                            color: isActive ? ACTIVE_TEXT : 'text.primary',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: isActive ? ACTIVE_TEXT : 'text.secondary',
                            minWidth: isRail ? 0 : 36,
                            justifyContent: 'center',
                          }}
                        >
                          <Icon sx={{ fontSize: 20 }} />
                        </ListItemIcon>
                        {!isRail && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: '0.8125rem',
                              fontWeight: isActive ? 600 : 500,
                            }}
                          />
                        )}
                      </ListItemButton>
                    );

                    return (
                      <ListItem key={item.path} disablePadding>
                        {isRail ? (
                          <Tooltip title={item.label} placement="right" arrow>
                            {navButton}
                          </Tooltip>
                        ) : (
                          navButton
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        })}
      </List>;

content = content.replace(oldListRegex, newList);

content = content.replace(<Typography
          variant="overline"
          sx={{
            px: 2.5,
            pt: 1.5,
            pb: 0.25,
            display: 'block',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.09em',
            color: 'text.disabled',
          }}
        >
          Menu
        </Typography>, '');

fs.writeFileSync('layout/Sidebar.jsx', content);
console.log('Sidebar patched successfully!');
