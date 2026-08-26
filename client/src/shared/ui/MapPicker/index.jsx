import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import { AdvancedLoader } from '../AdvancedLoader';
import MyLocationIcon from '@mui/icons-material/MyLocation';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MAP_STYLES = [
  { id: 'standard', label: 'Standard', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }
];

const SEARCH_DEBOUNCE_MS = 300;
const PHOTON_API = 'https://photon.komoot.io/api';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

const geocodeQuery = async (query, signal, bias) => {
  try {
    const biasParams = bias ? `&lat=${bias.lat}&lon=${bias.lng}` : '';
    const res = await fetch(`${PHOTON_API}?q=${encodeURIComponent(query)}&limit=6&lang=en${biasParams}`, { signal });
    if (res.ok) {
      const data = await res.json();
      const hits = (data.features || []).map((f) => ({
        label: f.properties?.label || f.properties?.name,
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
      })).filter((h) => h.label && h.lat != null && h.lng != null);
      if (hits.length > 0) return hits;
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('Photon search failed', err);
  }

  const res2 = await fetch(`${NOMINATIM_SEARCH}?format=json&q=${encodeURIComponent(query)}&limit=6&countrycodes=in`, { signal });
  const data2 = await res2.json();
  return (data2 || []).map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }));
};

const reverseGeocode = async (lat, lng, signal) => {
  try {
    const res = await fetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lng}`, { signal });
    if (res.ok) {
      const label = (await res.json())?.features?.[0]?.properties?.label;
      if (label) return label;
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('Photon reverse failed', err);
  }
  const res2 = await fetch(`${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}`, { signal });
  return (await res2.json()).display_name;
};

// Component to handle map clicks and centering
function MapController({ position, setLocation, setClickedAddress, abortRef, internalPickRef }) {
  const map = useMap();
  
  // Fly to new position when it changes from outside
  useEffect(() => {
    if (position && !internalPickRef.current) {
      map.flyTo(position, map.getZoom() > 14 ? map.getZoom() : 16);
    }
  }, [position, map, internalPickRef]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      applyLocation(lat, lng, setLocation, setClickedAddress, abortRef, internalPickRef);
    },
  });

  return null;
}

const applyLocation = async (lat, lng, setLocation, setClickedAddress, abortRef, internalPickRef) => {
  internalPickRef.current = true;
  setLocation({ lat, lng });
  try {
    const address = await reverseGeocode(lat, lng, abortRef.current?.signal);
    setClickedAddress(address);
    setLocation({ lat, lng, address });
  } catch (_err) {
    setClickedAddress('');
  } finally {
    setTimeout(() => { internalPickRef.current = false; }, 1000);
  }
};

const MapPicker = ({ location, setLocation, radius }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clickedAddress, setClickedAddress] = useState(location.address || '');
  const [styleId, setStyleId] = useState('standard');

  const timeoutRef = useRef(null);
  const abortRef = useRef(null);
  const internalPickRef = useRef(false);

  const position = location.lat && location.lng ? [Number(location.lat), Number(location.lng)] : null;
  const initialCenter = position || [20.5937, 78.9629];
  const mapRadius = parseFloat(radius) || 0;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    abortRef.current?.abort();
  }, []);

  const activeStyleUrl = MAP_STYLES.find((s) => s.id === styleId)?.url || MAP_STYLES[0].url;

  const fetchSuggestions = (query) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!query || query.trim().length < 3) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const bias = position ? { lat: position[0], lng: position[1] } : null;
        const hits = await geocodeQuery(query.trim(), controller.signal, bias);
        if (!controller.signal.aborted) setOptions(hits);
      } catch (err) {
        if (err.name !== 'AbortError') setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          applyLocation(latitude, longitude, setLocation, setClickedAddress, abortRef, internalPickRef);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  };

  const markerEventHandlers = useMemo(
    () => ({
      dragend(e) {
        const marker = e.target;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          applyLocation(lat, lng, setLocation, setClickedAddress, abortRef, internalPickRef);
        }
      },
    }),
    [setLocation]
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Autocomplete
          fullWidth
          size="small"
          options={options}
          getOptionLabel={(option) => option.label || ''}
          isOptionEqualToValue={(a, b) => a.label === b.label && a.lat === b.lat}
          filterOptions={(x) => x}
          onInputChange={(event, newInputValue) => fetchSuggestions(newInputValue)}
          onChange={(event, newValue) => {
            if (newValue) {
              internalPickRef.current = false; // allow flyTo
              setLocation({ lat: newValue.lat, lng: newValue.lng, address: newValue.label });
              setClickedAddress(newValue.label);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search location..."
              placeholder="e.g. Connaught Place, Delhi"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <AdvancedLoader isLoading variant="spinner" displayMode="inline" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <IconButton onClick={handleCurrentLocation} color="primary" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <MyLocationIcon />
        </IconButton>
      </Box>

      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
        {MAP_STYLES.map((s) => (
          <Chip
            key={s.id}
            size="small"
            label={s.label}
            color={styleId === s.id ? 'primary' : 'default'}
            variant={styleId === s.id ? 'filled' : 'outlined'}
            onClick={() => setStyleId(s.id)}
          />
        ))}
      </Stack>

      <Box sx={{ height: 350, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <MapContainer center={initialCenter} zoom={position ? 16 : 4} style={{ height: '100%', width: '100%' }} zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url={activeStyleUrl}
          />
          {position && (
            <>
              <Marker position={position} draggable={true} eventHandlers={markerEventHandlers} />
              {mapRadius > 0 && (
                <Circle 
                  center={position} 
                  radius={mapRadius} 
                  pathOptions={{ color: '#1976d2', fillColor: '#1976d2', fillOpacity: 0.14 }} 
                />
              )}
            </>
          )}
          <MapController 
            position={position} 
            setLocation={setLocation} 
            setClickedAddress={setClickedAddress} 
            abortRef={abortRef} 
            internalPickRef={internalPickRef} 
          />
        </MapContainer>
      </Box>

      {clickedAddress && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          📍 {clickedAddress}
        </Typography>
      )}
    </Box>
  );
};

export default MapPicker;
