import { useAppMutation } from '../../shared/hooks';
import { useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { gql, useApolloClient } from '@apollo/client';
import { Button, TextField } from '@mui/material';
import GenericDialog from '../../shared/ui/GenericDialog';
import SelfieCapture from '../attendance/components/SelfieCapture';

const CHECK_AVATAR = gql`
  query CheckAvatar($identifier: String!) {
    checkAvatar(identifier: $identifier)
  }
`;

const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

import { GoogleLogin } from '@react-oauth/google';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Divider from '@mui/material/Divider';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AdvancedLoader from '../../shared/ui/AdvancedLoader';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import BadgeIcon from '@mui/icons-material/Badge';
import LockIcon from '@mui/icons-material/Lock';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import InputAdornment from '@mui/material/InputAdornment';

import { z } from 'zod';
import { GenericFormEngine, useNotification } from '../../shared/ui';
import {
  LOGIN,
  GOOGLE_LOGIN,
  SIGNUP,
} from '../../graphql/mutations';
import { useAuth } from '../../shared/auth/AuthContext';

// ── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({
    employeeId: z.string().min(1, 'Employee ID is required'),
    password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
    name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Za-z]/, 'Must contain at least one letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

/** Distinguish "awaiting admin approval" from hard failures */
const getApprovalCode = (err) => {
  const gqError = err?.graphQLErrors?.[0];
  return gqError?.extensions?.code || '';
};

const LoginPage = () => {
  const navigate = useNavigate();
  const notify = useNotification();
  const apolloClient = useApolloClient();
  const [baselinePic, setBaselinePic] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loginAvatar, setLoginAvatar] = useState(null);
  const { login } = useAuth();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [requestReset, { loading: resetting }] = useAppMutation(REQUEST_PASSWORD_RESET, { successMessage: 'If your email is registered, a reset link has been sent.', onCompleted: () => setForgotOpen(false) });

  const handleForgotSubmit = async () => { await requestReset({ variables: { email: resetEmail } }); };
  const [info, setInfo] = useState('');

  // ── Sign In ────────────────────────────────────────────────────────────────
  const [loginMutation, { loading: loginLoading }] = useAppMutation(LOGIN, {
    onCompleted: (data) => {
      login(data.login.user, data.login.token);
      navigate('/');
    },
    onError: (err) => {
      const code = getApprovalCode(err);
      if (code === 'APPROVAL_PENDING') setError('');
      if (code === 'APPROVAL_PENDING' || code === 'APPROVAL_REJECTED') {
        setInfo(err.message);
      } else {
        setInfo('');
        setError(err.message || 'Login failed. Please try again.');
      }
    },
  });

  // ── Google Sign In / first-time Google signup ─────────────────────────────
  const [googleLoginMutation, { loading: googleLoading }] = useAppMutation(GOOGLE_LOGIN, {
    onCompleted: (data) => {
      login(data.googleLogin.user, data.googleLogin.token);
      navigate('/');
    },
    onError: (err) => {
      const code = getApprovalCode(err);
      // First-time Google users are auto-registered as PENDING – guide them
      if (code === 'APPROVAL_PENDING') {
        setInfo(
          `${err.message} You can sign in with your Employee ID once approved, or simply try Google again later.`
        );
      } else if (code === 'APPROVAL_REJECTED') {
        setInfo(err.message);
      } else {
        setError(err.message || 'Google login failed. Please try again.');
      }
    },
  });

  // ── Public Sign Up → PENDING account until admin approves ─────────────────
  const [signupMutation, { loading: signupLoading }] = useAppMutation(SIGNUP, {
    onCompleted: (data) => {
      setTab(0);
      setBaselinePic(null);
      setInfo(data.signup.message);
    },
    onError: (err) => {
      setError(err.message || 'Signup failed. Please try again.');
    },
  });

  const onSignIn = async (values) => {
    setError('');
    setInfo('');
    await loginMutation({
      variables: {
        employeeId: values.employeeId,
        password: values.password,
      },
    });
  };

  const onSignUp = async (values) => {
    if (!baselinePic) {
      notify.error('Please capture a baseline photo first');
      return;
    }
    setError('');
    setInfo('');
    await signupMutation({
      variables: {
        input: {
          
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
          avatarBase64: baselinePic,
          
        },
      },
    });
  };

  const handleGoogleSuccess = (credentialResponse) => {
    setError('');
    setInfo('');
    googleLoginMutation({
      variables: { credential: credentialResponse.credential },
    });
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
  };

    const handleLoginIdChange = async (val) => {
    if (val.length > 2) {
      const res = await apolloClient.query({ query: CHECK_AVATAR, variables: { identifier: val }, fetchPolicy: 'network-only' });
      setLoginAvatar(res.data?.checkAvatar);
    } else {
      setLoginAvatar(null);
    }
  };

  const signInFields = [
    {
      // Custom render so typing can ALSO trigger the live avatar lookup
      name: 'employeeId', label: 'Employee ID', type: 'custom', required: true,
      gridSize: { xs: 12 },
      render: ({ value, onChange, error }) => (
        <TextField
          fullWidth
          size="small"
          required
          label="Employee ID"
          placeholder="e.g. ADMIN001"
          value={value ?? ''}
          error={!!error}
          helperText={error}
          onChange={(e) => {
            onChange(e.target.value);
            handleLoginIdChange(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BadgeIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
      ),
    },
    {
      name: 'password', label: 'Password', type: 'password', required: true,
      props: {
        InputProps: {
          startAdornment: (
            <InputAdornment position="start">
              <LockIcon color="action" />
            </InputAdornment>
          ),
        },
      },
    },
    {
      name: 'forgotPassword',
      type: 'custom',
      gridSize: { xs: 12 },
      render: () => (
        <Box sx={{ textAlign: 'right', mt: -1.5, mb: -1 }}>
          <Typography variant="caption" sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }} onClick={() => setForgotOpen(true)}>
            Forgot Password?
          </Typography>
        </Box>
      )
    }
  ];

  const signUpFields = [
    { name: 'name', label: 'Full Name', type: 'text', required: true, gridSize: { xs: 12, sm: 6 } },
    { name: 'email', label: 'Email (for Google sign-in)', type: 'email', required: true, gridSize: { xs: 12, sm: 6 } },
    { name: 'password', label: 'Choose Password', type: 'password', required: true, helperText: 'Minimum 8 characters with letters & numbers', gridSize: { xs: 12 } },
  ];

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: { xs: 4, sm: 2 }, // Explicit vertical padding for mobile
      }}
    >
      <Card sx={{ maxWidth: 460, width: '100%' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            setError('');
            setInfo('');
          }}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Sign In" />
          <Tab label="Sign Up" />
        </Tabs>

        <CardContent sx={{ p: { xs: 3, sm: 4 }, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
          <Stack alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
              <FingerprintIcon sx={{ fontSize: 32 }} />
            </Avatar>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5">AttendEase</Typography>
              <Typography variant="body2" color="text.secondary">
                Staff Attendance System
              </Typography>
            </Box>
          </Stack>

          {/* Approval-pending / rejected → informational, not an error */}
          {info && (
            <Alert severity="info" sx={{ mb: 3 }} onClose={() => setInfo('')}>
              <AlertTitle>Approval needed</AlertTitle>
              {info}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {tab === 0 ? (
            <>
              <Stack alignItems="center" sx={{ mb: 2 }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  width="352"
                  text="signin_with"
                  shape="rectangular"
                />
              </Stack>

              {googleLoading && (
                <Stack alignItems="center" sx={{ mb: 2 }}>
                  <AdvancedLoader isLoading variant="spinner" size={24} />
                  <Typography variant="caption" color="text.secondary">
                    Signing in with Google...
                  </Typography>
                </Stack>
              )}

              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  OR
                </Typography>
              </Divider>

              {loginAvatar && (
                  <Stack alignItems="center" sx={{ mb: 2 }}>
                    <Avatar src={loginAvatar} sx={{ width: 80, height: 80, border: '2px solid primary.main' }} />
                  </Stack>
                )}
                <GenericFormEngine
                schema={loginSchema}
                fields={signInFields}
                onSubmit={onSignIn}
                submitLabel={loginLoading ? 'Signing In…' : 'Sign In'}
                resetLabel="Clear"
                validateOn="onSubmit"
                />

              


              <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 2 }}>
                New here? Switch to <strong>Sign Up</strong> – an admin will approve your access.
              </Typography>
            </>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                Sign-up requests stay <strong>PENDING</strong> until an
                administrator approves them. Login unlocks right after approval.
              </Alert>
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                  {!baselinePic ? (
                    <Button variant="outlined" color="primary" startIcon={<CameraAltIcon />} onClick={() => setCameraOpen(true)} fullWidth>
                      Capture Baseline Photo *
                    </Button>
                  ) : (
                    <Stack alignItems="center" spacing={1}>
                      <Avatar src={baselinePic} sx={{ width: 100, height: 100, border: '2px solid', borderColor: 'primary.main' }} />
                      <Button size="small" variant="text" onClick={() => setCameraOpen(true)}>Retake Photo</Button>
                    </Stack>
                  )}
                </Box>
                <GenericDialog open={cameraOpen} onClose={() => setCameraOpen(false)} title="Capture Baseline Photo" maxWidth="xs">
                  <SelfieCapture onCapture={(pic) => { setBaselinePic(pic); setCameraOpen(false); }} isPunching={false} buttonText="Capture & Save" requireCenteredFace />
                </GenericDialog>
                <GenericFormEngine
                schema={signupSchema}
                fields={signUpFields}
                initialValues={{}}
                onSubmit={onSignUp}
                submitLabel={signupLoading ? 'Submitting…' : 'Request Access'}
                resetLabel="Clear"
                validateOn="onSubmit"
                resetAfterSubmit={true}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Forgot Password – wires the server's requestPasswordReset flow */}
      <GenericDialog
        open={forgotOpen}
        onClose={() => !resetting && setForgotOpen(false)}
        title="Reset Password"
        maxWidth="xs"
      >
        <Stack spacing={2}>
          <Alert severity="info">
            Enter the email linked to your account and we will send a reset link.
          </Alert>
          <TextField
            required
            type="email"
            label="Email Address"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            disabled={!resetEmail || resetting}
            onClick={handleForgotSubmit}
          >
            {resetting ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </Stack>
      </GenericDialog>
    </Box>
  );
};

export default LoginPage;

