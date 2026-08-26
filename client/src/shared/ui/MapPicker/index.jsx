import { useState, useRef, useEffect } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, ScaleControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import { AdvancedLoader } from '../AdvancedLoader';
import MyLocationIcon from '@mui/icons-material/MyLocation';

// ── MapLibre GL + OpenFreeMap ────────────────────────────────────────────────
// GPU-accelerated VECTOR rendering (Google-Maps-grade smooth zoom/pitch/
// rotation) on OpenFreeMap's free vector tiles – NO API key, NO view limits.
const OFM_BASE = 'https://tiles.openfreemap.org/styles';
const MAP_STYLES = [
  { id: 'liberty', label: 'Standard', url: `${OFM_BASE}/liberty` },
  { id: 'positron', label: 'Light', url: `${OFM_BASE}/positron` },
  { id: 'fiord', label: 'Dark', url: `${OFM_BASE}/fiord` },
];
// Satellite stays raster (Esri World Imagery) – injected as a minimal style
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [{ id: 'esri-raster', type: 'raster', source: 'esri' }],
};
// Guaranteed-available last resort if OpenFreeMap is unreachable
const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm' }],
};

/** Great-circle polygon approximating the geofence circle (64 segments) */
const buildCircleGeoJSON = (lat, lng, meters, steps = 64) => {
  const coords = [];
  const latRad = (Math.PI * lat) / 180;
  const angular = meters / 6378137; // angular distance on the WGS84 sphere
  for (let i = 0; i <= steps; i += 1) {
    const brng = (2 * Math.PI * i) / steps;
    const lats = Math.asin(
      Math.sin(latRad) * Math.cos(angular) + Math.cos(latRad) * Math.sin(angular) * Math.cos(brng)
    );
    const lngs =
      (Math.PI * lng) / 180 +
      Math.atan2(
        Math.sin(brng) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(lats)
      );
    coords.push([(lngs * 180) / Math.PI, (lats * 180) / Math.PI]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
};

const SEARCH_DEBOUNCE_MS = 300; // snappy – Photon handles autocomplete load well
const PHOTON_API = 'https://photon.komoot.io/api';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Geocoding stack – Photon first (built for search-as-you-type, FAR faster
 * than Nominatim's public server), Nominatim as automatic fallback.
 * Results are normalized to a common { label, lat, lng } shape.
 */
const geocodeQuery = async (query, signal, bias) => {
  try {
    const biasParams = bias ? `&lat=${bias.lat}&lon=${bias.lng}` : '';
    const res = await fetch(
      `${PHOTON_API}?q=${encodeURIComponent(query)}&limit=6&lang=en${biasParams}`,
      { signal }
    );
    if (res.ok) {
      const data = await res.json();
      const hits = (data.features || [])
        .map((f) => ({
          label: f.properties?.label || f.properties?.name,
          lat: f.geometry?.coordinates?.[1],
          lng: f.geometry?.coordinates?.[0],
        }))
        .filter((h) => h.label && h.lat != null && h.lng != null);
      if (hits.length > 0) return hits;
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('Photon search failed – falling back to Nominatim', err);
  }

  const res2 = await fetch(
    `${NOMINATIM_SEARCH}?format=json&q=${encodeURIComponent(query)}&limit=6&countrycodes=in`,
    { signal }
  );
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
    if (err.name !== 'AbortError') console.warn('Photon reverse failed – falling back', err);
  }
  const res2 = await fetch(`${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}`, { signal });
  return (await res2.json()).display_name;
};

const MapPicker = ({ location, setLocation, radius }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clickedAddress, setClickedAddress] = useState('');
  const [styleId, setStyleId] = useState('liberty');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const timeoutRef = useRef(null);
  const abortRef = useRef(null);
  // True while THIS component is writing coordinates back to the parent –
  // stops the "fly to external change" effect from fighting our own updates.
  const internalPickRef = useRef(false);

  const position = location.lat && location.lng ? [Number(location.lat), Number(location.lng)] : null;
  const mapRadius = parseFloat(radius) || 0;

  /** Paint / refresh the geofence circle layer (re-applied after style swaps) */
  const drawGeofenceCircle = () => {
    const map = mapInstanceRef.current;
    if (!map || !position || !(mapRadius > 0)) return;
    const data = buildCircleGeoJSON(position[0], position[1], mapRadius);
    if (!map.getSource('geofence-circle')) {
      map.addSource('geofence-circle', { type: 'geojson', data });
      map.addLayer({
        id: 'geofence-circle-fill',
        type: 'fill',
        source: 'geofence-circle',
        paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.14 },
      });
      map.addLayer({
        id: 'geofence-circle-line',
        type: 'line',
        source: 'geofence-circle',
        paint: { 'line-color': '#1976d2', 'line-width': 2 },
      });
    } else {
      map.getSource('geofence-circle').setData(data);
    }
  };

  /** Single draggable pin managed imperatively (survives style swaps) */
  const placeMarker = (lat, lng) => {
    if (!markerRef.current) {
      markerRef.current = new Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', () => {
        const { lat: la, lng: lo } = markerRef.current.getLngLat();
        applyLocation(la, lo); // pin is already under the cursor – no flyTo needed
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  };

  // Init the GL map exactly once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return undefined;
    const initialCenter = [Number(location.lng) || 78.9629, Number(location.lat) || 20.5937];
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLES[0].url,
      center: initialCenter,
      zoom: location.lat ? 16 : 4,
      attributionControl: { compact: true },
    });
    mapInstanceRef.current = map;

    // BLACK-SCREEN FIX: maps initialised inside dialogs/transitions start at
    // 0×0 px and render nothing. Observing the container keeps the GL canvas
    // sized to its real box whenever MUI finishes animating or the layout
    // reflows.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    let styleFallbackTried = false;
    map.on('error', (e) => {
      const msg = String(e?.error?.message || e?.error || '');
      // Vector style/tiles unreachable → drop to plain OSM raster ONCE so the
      // picker never shows a dead black canvas.
      if (!styleFallbackTried && /style|fetch|network|Failed/i.test(msg)) {
        styleFallbackTried = true;
        console.warn('MapPicker: vector style failed, falling back to OSM raster –', msg);
        try {
          map.setStyle(FALLBACK_RASTER_STYLE);
        } catch {
          /* style swap raced an unmount – ignore */
        }
      } else if (msg) {
        console.warn('MapPicker map error:', msg);
      }
    });

    map.on('load', () => {
      map.resize(); // paint immediately at the true container size
      drawGeofenceCircle();
      if (position) placeMarker(position[0], position[1]);
    });
    // Vector style swaps wipe custom layers – repaint ours afterwards
    map.on('style.load', () => {
      map.resize();
      drawGeofenceCircle();
    });

    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      applyLocation(lat, lng);
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Smoothly follow coordinate edits made OUTSIDE the map (lat/lng fields)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !position || internalPickRef.current) return;
    map.flyTo({
      center: [position[1], position[0]],
      zoom: Math.max(map.getZoom(), 15),
      duration: 800,
    });
  }, [location.lat, location.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw the circle whenever the pin moves or the radius changes
  useEffect(() => {
    if (mapInstanceRef.current?.isStyleLoaded()) drawGeofenceCircle();
  }, [location.lat, location.lng, mapRadius]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel pending timers / in-flight requests on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    abortRef.current?.abort();
  }, []);

  const switchStyle = (id) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setStyleId(id);
    const target = id === 'satellite' ? SATELLITE_STYLE : MAP_STYLES.find((s) => s.id === id)?.url;
    if (target) map.setStyle(target);
  };

  const fetchSuggestions = (query) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!query || query.trim().length < 3) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      // Abort whatever search is still in flight – only the newest wins
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const bias = position ? { lat: position[0], lng: position[1] } : null;
        const hits = await geocodeQuery(query.trim(), controller.signal, bias);
        if (!controller.signal.aborted) setOptions(hits);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Search failed', err);
          setOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  /** Write coordinates + resolved address back into the parent form */
  const applyLocation = async (lat, lng) => {
    internalPickRef.current = true;
    setLocation({ lat, lng });
    try {
      const address = await reverseGeocode(lat, lng, abortRef.current?.signal);
      setClickedAddress(address);
      setLocation({ lat, lng, address });
    } catch (err) {
      setClickedAddress('');
    } finally {
      setTimeout(() => { internalPickRef.current = false; }, 1000);
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          applyLocation(latitude, longitude);
          mapInstanceRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  };

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
              internalPickRef.current = true;
              setLocation({ lat: newValue.lat, lng: newValue.lng, address: newValue.label });
              setClickedAddress(newValue.label);
              mapInstanceRef.current?.flyTo({
                center: [newValue.lng, newValue.lat],
                zoom: 16,
                duration: 1000,
              });
              setTimeout(() => { internalPickRef.current = false; }, 1200);
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

      {/* Basemap style switcher – all vector styles are keyless & unlimited */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
        {MAP_STYLES.map((s) => (
          <Chip
            key={s.id}
            size="small"
            label={s.label}
            color={styleId === s.id ? 'primary' : 'default'}
            variant={styleId === s.id ? 'filled' : 'outlined'}
            onClick={() => switchStyle(s.id)}
          />
        ))}
        <Chip
          size="small"
          label="Satellite"
          color={styleId === 'satellite' ? 'primary' : 'default'}
          variant={styleId === 'satellite' ? 'filled' : 'outlined'}
          onClick={() => switchStyle('satellite')}
        />
      </Stack>

      <Box
        ref={mapContainerRef}
        sx={{
          height: 350,
          width: '100%',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          '& .maplibregl-ctrl-group': { borderRadius: 1 },
        }}
      />

      {clickedAddress && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          📍 {clickedAddress}
        </Typography>
      )}
    </Box>
  );
};

export default MapPicker;



