import { useState } from 'react';
import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * RowActions – zero-boilerplate "⋮" action menu for data-grid rows.
 *
 * Replaces the hand-written IconButton + Menu + MenuItem boilerplate that was
 * copy-pasted across pages. Each grid-cell instance owns its own open state,
 * so the parent page stays completely stateless.
 *
 * @example
 *   render: (row) => (
 *     <RowActions
 *       row={row}
 *       items={[
 *         { icon: <EditIcon />, label: 'Edit', onClick: openEdit },
 *         { divider: true },
 *         { icon: <DeleteIcon />, label: 'Delete', color: 'error', onClick: askDelete },
 *       ]}
 *     />
 *   )
 *
 * Item contract:
 *   label    string            – menu text (required unless divider)
 *   icon     ReactNode         – leading icon
 *   onClick  (row) => void     – invoked with the row, menu closes first
 *   color    'error'|'warning'|'info'|'success'  – tints icon + label
 *   disabled boolean|(row)=>b  – item disabled (static or per-row)
 *   hidden   (row) => boolean  – conditionally remove the item entirely
 *   divider  boolean           – render a <Divider /> instead of an item
 */
const RowActions = ({
  row,
  items = [],
  icon,
  ariaLabel = 'Row actions',
  size = 'small',
  stopPropagation = true,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Items may declare static values OR functions of the current row.
  const resolve = (value) => (typeof value === 'function' ? value(row) : value);

  const visibleItems = items.filter((item) => item.divider || !resolve(item.hidden));

  return (
    <>
      <IconButton
        size={size}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
      >
        {icon ?? <MoreVertIcon fontSize="small" />}
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleItems.map((item, index) =>
          item.divider ? (
            <Divider key={`divider-${index}`} />
          ) : (
            <MenuItem
              key={item.label}
              disabled={resolve(item.disabled)}
              onClick={() => {
                setAnchorEl(null);
                item.onClick?.(row);
              }}
            >
              {item.icon && (
                <ListItemIcon sx={item.color ? { color: `${item.color}.main` } : undefined}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText
                primary={item.label}
                primaryTypographyProps={
                  item.color ? { color: item.color, fontSize: '0.875rem' } : undefined
                }
              />
            </MenuItem>
          ),
        )}
      </Menu>
    </>
  );
};

RowActions.propTypes = {
  row: PropTypes.object,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      icon: PropTypes.node,
      onClick: PropTypes.func,
      color: PropTypes.oneOf(['default', 'error', 'warning', 'info', 'success']),
      disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      hidden: PropTypes.func,
      divider: PropTypes.bool,
    }),
  ),
  icon: PropTypes.node,
  ariaLabel: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium']),
  stopPropagation: PropTypes.bool,
};

export default RowActions;
