import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';

/**
 * MonoId – monospace Employee/Record-ID badge used across all data tables.
 * (Was previously duplicated as an inline `renderEmpId` in multiple pages.)
 *
 * @example
 *   render: (row) => <MonoId value={row.employeeId} />
 */
const MonoId = ({ value, label }) => {
  const text = value ?? label ?? null;
  if (!text) return <>—</>;

  return (
    <Typography
      component="span"
      sx={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.75rem',
        fontWeight: 600,
        bgcolor: 'action.hover',
        color: 'text.secondary',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {text}
    </Typography>
  );
};

MonoId.propTypes = {
  value: PropTypes.string,
  label: PropTypes.string,
};

export default MonoId;
