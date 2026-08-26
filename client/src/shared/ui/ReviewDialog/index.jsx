import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormDialog from '../FormDialog';

/**
 * ReviewDialog – admin "decision + feedback" modal (verify/reject, approve/reject,
 * ordered/supplied…). Built ON TOP of FormDialog so validation, loading and
 * auto-close behave identically to every other dialog in the app.
 *
 * @example
 *   <ReviewDialog
 *     open={!!reviewTarget}
 *     onClose={() => setReviewTarget(null)}
 *     title="Review Document"
 *     loading={reviewing}
 *     details={[{ label: 'Document', value: reviewTarget?.title }]}
 *     options={[{ value: 'VERIFIED', label: 'Verify' }, { value: 'REJECTED', label: 'Reject' }]}
 *     onSubmit={(decision, feedback) => submitReview(reviewTarget.id, decision, feedback)}
 *   />
 */
const ReviewDialog = ({
  open,
  onClose,
  title,
  loading = false,
  details = [],
  options = [],
  initialDecision = '',
  decisionLabel = 'Decision',
  feedbackLabel = 'Feedback (Optional)',
  feedbackRows = 3,
  onSubmit,
  submitLabel = 'Save Review',
  children,
}) => {
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      loading={loading}
      maxWidth="xs"
      fields={[
        {
          name: 'decision',
          type: 'select',
          label: decisionLabel,
          required: true,
          options,
          gridSize: { xs: 12 },
        },
        { name: 'feedback', type: 'multiline', label: feedbackLabel, rows: feedbackRows, gridSize: { xs: 12 } },
      ]}
      initialValues={{ decision: initialDecision, feedback: '' }}
      onSubmit={(values) => onSubmit?.(values.decision, (values.feedback ?? '').trim())}
      submitLabel={submitLabel}
    >
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {details.map((detail) => (
          <Box key={detail.label}>
            <Typography variant="subtitle2" color="text.secondary">
              {detail.label}
            </Typography>
            <Typography variant="body1">{detail.value}</Typography>
          </Box>
        ))}
      </Stack>
      {children}
    </FormDialog>
  );
};

ReviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  loading: PropTypes.bool,
  details: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.node })),
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string }))
    .isRequired,
  initialDecision: PropTypes.string,
  decisionLabel: PropTypes.string,
  feedbackLabel: PropTypes.string,
  feedbackRows: PropTypes.number,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
  children: PropTypes.node,
};

export default ReviewDialog;
