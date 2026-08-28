import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import ProfileDialog from './ProfileDialog';

/**
 * MyProfilePage – staff self-service view. Renders the generic ProfileDialog
 * in read-only "self" mode: the staff member sees their own details, uploads
 * documents an admin has asked for, and reads their notifications. No editing.
 */
const MyProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ProfileDialog
      open
      mode="self"
      staffId={user?.id}
      onClose={() => navigate('/')}
    />
  );
};

export default MyProfilePage;
