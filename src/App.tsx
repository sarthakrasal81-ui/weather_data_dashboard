import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AirVent,
  ArrowUp,
  ChevronDown,
  Droplets,
  Gauge,
  Globe2,
  MapPin,
  Search,
  Sun,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';

type SelectedCity = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type WeatherData = {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
};

type AirData = {
  current: {
    us_aqi: number;
    pm2_5: number;
    pm10: number;
  };
};

const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Hail storm',
  99: 'Hail storm',
};

const weatherSymbols: Record<number, string> = {
  0: '☼', 1: '◌', 2: '◒', 3: '☁', 45: '≋', 48: '≋', 51: '⌁', 53: '⌁', 55: '⌁',
  61: '☂', 63: '☂', 65: '☂', 71: '❄', 73: '❄', 75: '❄', 80: '☂', 81: '☂', 82: '☂', 95: 'ϟ', 96: 'ϟ', 99: 'ϟ',
};

const defaultCity: SelectedCity = {
  name: 'Seattle',
  country: 'United States',
  admin1: 'Washington',
  latitude: 47.6062,
  longitude: -122.3321,
  timezone: 'America/Los_Angeles',
};

function formatDay(date: string, index: number) {
  if (index === 0) return 'Today';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

function getAqiLabel(aqi: number) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  return 'Very unhealthy';
}

function App() {
  const [selectedCity, setSelectedCity] = useState<SelectedCity>(defaultCity);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [air, setAir] = useState<AirData | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  // Whenever selectedCity updates, fetch weather + air quality data
  useEffect(() => {
    const fetchWeatherData = async () => {
      setLoading(true);
      setError('');
      try {
        const { latitude, longitude } = selectedCity;
        const [weatherResponse, airResponse] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=6`
          ),
          fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}` +
            `&current=us_aqi,pm2_5,pm10&timezone=auto`
          ),
        ]);
        if (!weatherResponse.ok || !airResponse.ok) throw new Error('Weather data unavailable');
        const [weatherPayload, airPayload] = await Promise.all([
          weatherResponse.json() as Promise<WeatherData>,
          airResponse.json() as Promise<AirData>,
        ]);
        setWeather(weatherPayload);
        setAir(airPayload);
      } catch {
        setError('We couldn\u2019t fetch weather data right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void fetchWeatherData();
  }, [selectedCity]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || searching) return;
    setSearching(true);
    setError('');
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=1&language=en&format=json`
      );
      if (!response.ok) throw new Error('Search request failed');
      const payload = await response.json() as { results?: SelectedCity[] };
      const result = payload.results?.[0];
      if (!result) {
        setError('City not found, please try another location.');
        return;
      }
      setSelectedCity(result);
      setQuery('');
    } catch {
      setError('City search is unavailable right now. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const today = weather?.current;
  const todayDaily = weather?.daily;
  const aqi = air?.current.us_aqi ?? 0;
  const condition = today ? weatherDescriptions[today.weather_code] ?? 'Current conditions' : 'Loading conditions';
  const displayTemperature = today ? Math.round(today.temperature_2m) : '--';
  const feelsLike = today ? Math.round(today.apparent_temperature) : '--';
  const forecast = useMemo(() => todayDaily?.time.map((date, index) => ({
    date,
    index,
    high: todayDaily.temperature_2m_max[index],
    low: todayDaily.temperature_2m_min[index],
    code: todayDaily.weather_code[index],
    rain: todayDaily.precipitation_probability_max[index],
  })) ?? [], [todayDaily]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#090d0e] text-[#f5f5ee]">
      <div className="weather-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <header className="topbar">
          <div className="brand-mark"><Sun size={18} strokeWidth={2.5} /></div>
          <div className="brand-name">weather<span>°</span></div>
          <nav className="desktop-nav"><a className="active" href="#overview">Overview</a><a href="#forecast">Forecast</a><a href="#air-quality">Air quality</a></nav>
          <form className="search-bar" onSubmit={handleSearch}>
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city..."
              aria-label="Search for a city"
            />
            <button type="submit" disabled={searching} aria-label="Search">
              {searching ? '...' : 'Go'}
            </button>
          </form>
          <div className="top-actions">
            <button className="unit-switch" type="button"><span>°F</span><ChevronDown size={14} /></button>
            <div className="location-pill"><MapPin size={14} /><span>{selectedCity.name}</span></div>
          </div>
        </header>

        <section className="hero" id="overview">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Live conditions · {selectedCity.timezone.replace('_', ' ')}</div>
            <div className="place-line"><h1>{selectedCity.name}</h1><span>{selectedCity.admin1 || selectedCity.country}</span></div>
            <p className="hero-date">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
            <div className="temperature-row">
              <div className="temperature">{displayTemperature}<span>°</span></div>
              <div className="condition"><div className="condition-symbol">{today ? weatherSymbols[today.weather_code] ?? '◌' : '◌'}</div><div><strong>{condition}</strong><small>Feels like {feelsLike}°</small></div></div>
            </div>
          </div>
          <div className="sun-orb"><div className="orb-glow" /><Sun size={86} strokeWidth={1} /><span>Good morning</span></div>
        </section>

        <section className="stats-grid" id="air-quality">
          <div className="stat-card air-card"><div className="card-top"><span>Air quality</span><AirVent size={17} /></div><div className="aqi-row"><strong>{air ? aqi : '--'}</strong><span>{air ? getAqiLabel(aqi) : 'Loading'}</span></div><div className="aqi-bar"><span style={{ width: `${Math.min((aqi / 200) * 100, 100)}%` }} /></div><p>US AQI · Updated just now</p></div>
          <div className="stat-card"><div className="card-top"><span>Humidity</span><Droplets size={17} /></div><strong className="stat-value">{today ? `${today.relative_humidity_2m}%` : '--'}</strong><p>Comfortable level</p></div>
          <div className="stat-card"><div className="card-top"><span>Wind</span><Wind size={17} /></div><strong className="stat-value">{today ? `${Math.round(today.wind_speed_10m)}` : '--'} <small>mph</small></strong><p>Local winds</p></div>
          <div className="stat-card"><div className="card-top"><span>Precipitation</span><Gauge size={17} /></div><strong className="stat-value">{today ? `${today.precipitation}` : '--'} <small>in</small></strong><p>Last hour</p></div>
        </section>

        <section className="forecast-section" id="forecast">
          <div className="section-heading"><div><p className="section-kicker">Looking ahead</p><h2>6-day forecast</h2></div><div className="forecast-tabs"><button className="selected" type="button">Daily</button><button type="button">Hourly</button></div></div>
          <div className="forecast-list">{loading && !forecast.length ? <div className="loading-state">Gathering the latest forecast...</div> : forecast.map((day) => <div className={`forecast-day ${day.index === 0 ? 'today' : ''}`} key={day.date}><div className="day-name">{formatDay(day.date, day.index)}<small>{formatDate(day.date)}</small></div><div className="day-weather"><span className="weather-glyph">{weatherSymbols[day.code] ?? '◌'}</span><span>{weatherDescriptions[day.code] ?? 'Variable'}</span></div><div className="day-rain"><Droplets size={13} /> {day.rain}%</div><div className="day-temp"><strong>{Math.round(day.high)}°</strong><span>{Math.round(day.low)}°</span></div></div>)}</div>
        </section>

        <section className="sun-section"><div><Sunrise size={19} /><span>Sunrise <strong>{todayDaily?.sunrise[0] ? formatTime(todayDaily.sunrise[0]) : '--'}</strong></span></div><div className="sun-track"><span /></div><div><Sunset size={19} /><span>Sunset <strong>{todayDaily?.sunset[0] ? formatTime(todayDaily.sunset[0]) : '--'}</strong></span></div></section>
        {error && <div className="error-message">{error}</div>}
        <footer><span>Weather data by Open-Meteo</span><span><Globe2 size={13} /> {selectedCity.timezone}</span></footer>
      </div>
    </main>
  );
}

export default App;
