import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import { REGISTER_STAFF } from '../../../graphql/mutations';
import { GET_USERS, GET_DASHBOARD_STATS, GET_OFFICES } from '../../../graphql/queries';
import { FormDialog } from '../../../shared/ui';
import {
  ADD_STAFF_FIELDS,
  BLANK_STAFF_FORM,
  QUICK_ADD_STAFF_SCHEMA,
} from '../staffFormConfig';

/**
 * QuickAddStaffModal – dashboard "quick hire" dialog.
 * Uses the SHARED staff form config so it can never drift from the full
 * Staff Management page again (this split previously shipped a real bug:
 * offices were submitted under `assignedOffice` and silently dropped).
 */
const QuickAddStaffModal = ({ open, onClose }) => {
  const { data: officeData } = useAppQuery(GET_OFFICES);

  const [registerStaff, { loading }] = useAppMutation(REGISTER_STAFF, {
    refetchQueries: [{ query: GET_USERS }, { query: GET_DASHBOARD_STATS }],
    successMessage: 'Employee registered successfully! 🎊',
  });

  const handleSubmit = async (form) => {
    const input = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      avatarBase64: form.avatarBase64 || undefined,
    };
    if (form.officeId) input.officeId = form.officeId; // ✅ correct key (was `assignedOffice`)

    const result = await registerStaff({ variables: { input } });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Onboard New Employee"
      loading={loading}
      maxWidth="sm"
      fields={ADD_STAFF_FIELDS((officeData?.offices || []).map((o) => ({ value: o.id, label: o.name })))}
      schema={QUICK_ADD_STAFF_SCHEMA}
      initialValues={BLANK_STAFF_FORM}
      onSubmit={handleSubmit}
      submitLabel="Create Employee"
    />
  );
};

export default QuickAddStaffModal;





