import React, {
  useState,
  useRef,
  forwardRef,
  useEffect,
  useId
} from 'react';

import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ButtonGroup from '@mui/material/ButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grow from '@mui/material/Grow';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const AppButton = forwardRef((props, ref) => {
  const {
    buttonType = 'standard',
    children,
    onClick,
    variant = 'contained',
    color = 'primary',
    size = 'medium',
    isLoading = false,
    loading = false, // legacy compat
    disabled = false,
    startIcon,
    endIcon,
    icon,
    tooltip = '',
    tooltipPlacement,
    sx = {},

    splitOptions = [],
    onSplitClick,

    menuItems = [],

    speedDialActions = [],
    speedDialDirection = 'up',

    toggleOptions = [],
    toggleValue,
    onToggleChange,
    exclusive = true,

    'aria-label': ariaLabel,
    type,
    ...rest
  } = props;

  const currentlyLoading = isLoading || loading;

  // ---------- Hooks & IDs ----------
  const uniqueId = useId();
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ---------- State Management ----------
  const [splitOpen, setSplitOpen] = useState(false);
  const [selectedSplitIndex, setSelectedSplitIndex] = useState(0);
  const splitAnchorRef = useRef(null);
  const splitTriggerRef = useRef(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const isMenuOpen = Boolean(menuAnchorEl);

  const [internalToggleValue, setInternalToggleValue] = useState(
    exclusive ? null : []
  );
  const isToggleControlled =
    toggleValue !== undefined && onToggleChange !== undefined;

  // ---------- Effects ----------
  useEffect(() => {
    if (selectedSplitIndex >= splitOptions.length) {
      setSelectedSplitIndex(0);
    }
  }, [splitOptions.length, selectedSplitIndex]);

  // ---------- Helper: Loading Spinner ----------
  const loadingSpinner = (spinnerSize = size === 'small' ? 18 : 24) => (
    <CircularProgress size={spinnerSize} color="inherit" />
  );

  const getTooltipPlacement = () => {
    if (tooltipPlacement) return tooltipPlacement;
    if (isMobile) return 'top';
    return 'top';
  };

  // Extract non-standard props so they aren't forwarded to DOM
  const {
    splitOptions: _splitOpts,
    onSplitClick: _onSplit,
    menuItems: _menuItems,
    speedDialActions: _speedActions,
    speedDialDirection: _direction,
    toggleOptions: _toggleOpts,
    toggleValue: _toggleVal,
    onToggleChange: _onToggle,
    exclusive: _excl,
    icon: _icon,
    tooltip: _tooltip,
    tooltipPlacement: _tp,
    ...safeProps
  } = rest;

  // ---------- Standard Button ----------
  const renderStandard = () => {
    return (
      <Button
        ref={ref}
        onClick={onClick}
        variant={variant}
        color={color}
        size={size}
        disabled={disabled || currentlyLoading}
        startIcon={!currentlyLoading ? startIcon : undefined}
        endIcon={!currentlyLoading ? endIcon : undefined}
        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, ...sx }}
        aria-label={ariaLabel}
        type={type}
        {...safeProps}
      >
        {currentlyLoading && !startIcon && !endIcon ? (
           <CircularProgress size={16} color="inherit" sx={{ mr: children ? 1 : 0 }} />
        ) : null}
        {currentlyLoading && startIcon ? loadingSpinner() : children}
      </Button>
    );
  };

  // ---------- Icon Button ----------
  const renderIcon = () => {
    const { variant: _variant, startIcon: _startIcon, endIcon: _endIcon, ...iconProps } = safeProps;
    return (
      <IconButton
        ref={ref}
        onClick={onClick}
        color={color}
        size={size}
        disabled={disabled || currentlyLoading}
        sx={sx}
        aria-label={ariaLabel || tooltip || 'icon button'}
        type={type}
        {...iconProps}
      >
        {currentlyLoading ? loadingSpinner() : icon}
      </IconButton>
    );
  };

  // ---------- Split Button ----------
  const renderSplit = () => {
    const { children: _children, startIcon: _startIcon, endIcon: _endIcon, ...splitRest } = safeProps;
    const splitMenuId = `split-menu-${uniqueId}`;
    const splitTriggerId = `split-trigger-${uniqueId}`;

    return (
      <React.Fragment>
        <ButtonGroup
          ref={splitAnchorRef}
          variant={variant}
          color={color}
          size={size}
          disabled={disabled || currentlyLoading}
          sx={sx}
          {...splitRest}
        >
          <Button
            ref={splitTriggerRef}
            onClick={onClick}
            sx={{ textTransform: 'none' }}
            aria-label={ariaLabel || 'split main button'}
            aria-haspopup="menu"
            aria-controls={splitMenuId}
            id={splitTriggerId}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setSplitOpen(true);
              }
            }}
          >
            {currentlyLoading
              ? loadingSpinner()
              : children || splitOptions[selectedSplitIndex]?.label}
          </Button>
          <Button
            size="small"
            aria-label="split dropdown"
            aria-haspopup="menu"
            aria-controls={splitMenuId}
            onClick={() => setSplitOpen((prev) => !prev)}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>

        <Popper
          open={splitOpen}
          anchorEl={splitAnchorRef.current}
          transition
          disablePortal
          style={{ zIndex: 1300 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
        >
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              style={{
                transformOrigin:
                  placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper elevation={8}>
                <ClickAwayListener
                  onClickAway={() => {
                    setSplitOpen(false);
                    if (splitTriggerRef.current) splitTriggerRef.current.focus();
                  }}
                >
                  <MenuList autoFocusItem id={splitMenuId}>
                    {splitOptions.map((option, index) => (
                      <MenuItem
                        key={option.value || option.label}
                        selected={index === selectedSplitIndex}
                        disabled={option.disabled}
                        onClick={() => {
                          setSelectedSplitIndex(index);
                          setSplitOpen(false);
                          if (onSplitClick) onSplitClick(option, index);
                          if (option.onClick) option.onClick(option, index);
                        }}
                      >
                        {option.label}
                      </MenuItem>
                    ))}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </React.Fragment>
    );
  };

  // ---------- Action Menu ----------
  const renderMenu = () => {
    const { children: _children, variant: _variant, startIcon: _startIcon, endIcon: _endIcon, ...menuRest } = safeProps;

    return (
      <React.Fragment>
        <IconButton
          ref={ref}
          onClick={(e) => setMenuAnchorEl(e.currentTarget)}
          disabled={disabled || currentlyLoading}
          color={color}
          size={size}
          sx={sx}
          aria-label={ariaLabel || tooltip || 'menu'}
          aria-haspopup="menu"
          type={type}
          {...menuRest}
        >
          {currentlyLoading ? loadingSpinner() : icon || <MoreVertIcon />}
        </IconButton>

        <Menu
          anchorEl={menuAnchorEl}
          open={isMenuOpen}
          onClose={() => setMenuAnchorEl(null)}
          PaperProps={{ elevation: 8 }}
        >
          {menuItems.map((item, index) =>
            item.divider ? (
              <Divider key={index} />
            ) : (
              <MenuItem
                key={index}
                disabled={item.disabled}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setMenuAnchorEl(null);
                }}
              >
                {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                <ListItemText>{item.label}</ListItemText>
              </MenuItem>
            )
          )}
        </Menu>
      </React.Fragment>
    );
  };

  // ---------- Speed Dial ----------
  const renderSpeedDial = () => {
    const { children: _children, variant: _variant, startIcon: _startIcon, endIcon: _endIcon, ...speedRest } = safeProps;
    let finalDirection = speedDialDirection;
    if (isRTL) {
      if (speedDialDirection === 'left') finalDirection = 'right';
      else if (speedDialDirection === 'right') finalDirection = 'left';
    }

    return (
      <SpeedDial
        ariaLabel={ariaLabel || 'speed dial'}
        sx={{ ...sx }}
        icon={currentlyLoading ? loadingSpinner() : <SpeedDialIcon icon={icon} />}
        direction={finalDirection}
        disabled={disabled || currentlyLoading}
        {...speedRest}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        ))}
      </SpeedDial>
    );
  };

  // ---------- Toggle Button Group ----------
  const renderToggle = () => {
    const { children: _children, variant: _variant, startIcon: _startIcon, endIcon: _endIcon, ...toggleRest } = safeProps;
    let currentToggleValue;
    let handleToggleChange;

    if (isToggleControlled) {
      currentToggleValue = toggleValue;
      handleToggleChange = onToggleChange;
    } else {
      currentToggleValue = internalToggleValue;
      handleToggleChange = (event, newValue) => {
        setInternalToggleValue(newValue);
      };
    }

    return (
      <ToggleButtonGroup
        value={currentToggleValue}
        exclusive={exclusive}
        onChange={handleToggleChange}
        aria-label={ariaLabel || 'toggle group'}
        size={size}
        color={color}
        disabled={disabled || currentlyLoading}
        sx={sx}
        {...toggleRest}
      >
        {toggleOptions.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            aria-label={opt.label || opt.value}
            disabled={opt.disabled}
          >
            {opt.icon || opt.label || opt.value}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    );
  };

  let buttonComponent;
  switch (buttonType) {
    case 'icon': buttonComponent = renderIcon(); break;
    case 'split': buttonComponent = renderSplit(); break;
    case 'menu': buttonComponent = renderMenu(); break;
    case 'speedDial': buttonComponent = renderSpeedDial(); break;
    case 'toggle': buttonComponent = renderToggle(); break;
    case 'standard':
    default: buttonComponent = renderStandard(); break;
  }

  if (tooltip && buttonType !== 'speedDial') {
    return (
      <Tooltip title={tooltip} arrow placement={getTooltipPlacement()}>
        <Box component="span" sx={{ display: 'inline-flex', pointerEvents: disabled || currentlyLoading ? 'none' : 'auto' }}>
          {buttonComponent}
        </Box>
      </Tooltip>
    );
  }

  return buttonComponent;
});

AppButton.displayName = 'AppButton';
AppButton.propTypes = {};
export default AppButton;


