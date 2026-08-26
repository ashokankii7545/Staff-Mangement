import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import AdvancedLoader from '../../../shared/ui/AdvancedLoader';
import AppChip from '../../../shared/ui/AppChip';
import Box from '@mui/material/Box';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MyLocationIcon from '@mui/icons-material/MyLocation';

const LocationCard = ({ location, loading, error }) => {
  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <AdvancedLoader isLoading={true} variant="spinner" size={24} />
            <Box>
              <Typography variant="subtitle2">Acquiring GPS Location...</Typography>
              <Typography variant="caption" color="text.secondary">
                Please allow location access when prompted
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'error.main' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ErrorIcon color="error" />
            <Box>
              <Typography variant="subtitle2" color="error">
                Location Error
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {error}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!location) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <MyLocationIcon color="action" />
            <Typography variant="body2" color="text.secondary">
              Location will be captured when you proceed
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const accuracyOk = location.accuracy < 500;

  return (
    <Card variant="outlined" sx={{ borderColor: accuracyOk ? 'success.main' : 'warning.main' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationOnIcon color={accuracyOk ? 'success' : 'warning'} />
            <Typography variant="subtitle2">GPS Location</Typography>
            <AppChip
              icon={accuracyOk ? <CheckCircleIcon /> : <GpsFixedIcon />}
              label={accuracyOk ? 'GPS Verified' : 'Low Accuracy'}
              tone={accuracyOk ? 'success' : 'warning'}
              size="small"
              variant="outlined"
            />
          </Stack>

          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="caption" color="text.secondary">Latitude</Typography>
              <Typography variant="body2" fontWeight={500}>
                {location.latitude.toFixed(6)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Longitude</Typography>
              <Typography variant="body2" fontWeight={500}>
                {location.longitude.toFixed(6)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Accuracy</Typography>
              <Typography variant="body2" fontWeight={500}>
                ±{Math.round(location.accuracy)}m
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LocationCard;

