// ─────────────────────────────────────────────────────────────
// api/countries.js
//
// All backend communication lives here.
// To connect your real MySQL backend:
//   1. Set VITE_API_BASE in a .env file:  VITE_API_BASE=http://localhost:4000
//   2. Set VITE_USE_MOCK=false
//   3. Make sure your backend returns JSON matching the shape below.
//
// Expected API response shape:
// {
//   iso_code:        "USA",
//   country:         "United States",
//   capital:         "Washington D.C.",
//   region:          "Americas",
//   population:      "331,000,000",
//   gdp:             "$23.0T",
//   currency:        "USD",
//   area:            "9,833,517 km²",
//   life_expectancy: "78.9 yrs",
//   languages:       "English",
//   exports:         "Machinery, Electronics",
//   imports:         "Consumer Goods, Oil",
//   hdi:             "0.921",
//   ...any other columns from your table
// }
// ─────────────────────────────────────────────────────────────

const API_BASE    = import.meta.env.VITE_API_BASE    ?? '';
const KEY_COLUMN  = import.meta.env.VITE_KEY_COLUMN  ?? 'iso_code';
const USE_MOCK    = import.meta.env.VITE_USE_MOCK !== 'false'; // default true

// ── Mock data (remove once your API is live) ──────────────────
const MOCK_DATA = {
  USA: { country:'United States',    capital:'Washington D.C.', region:'Americas',    population:'331,000,000',   gdp:'$23.0T',  currency:'USD', area:'9,833,517 km²',   life_expectancy:'78.9 yrs', languages:'English',             exports:'Machinery, Electronics',      imports:'Consumer Goods, Oil',       hdi:'0.921' },
  GBR: { country:'United Kingdom',   capital:'London',          region:'Europe',      population:'67,200,000',    gdp:'$3.1T',   currency:'GBP', area:'243,610 km²',      life_expectancy:'81.3 yrs', languages:'English',             exports:'Financial Services, Aircraft', imports:'Fuel, Food',               hdi:'0.932' },
  DEU: { country:'Germany',          capital:'Berlin',          region:'Europe',      population:'83,100,000',    gdp:'$4.2T',   currency:'EUR', area:'357,114 km²',      life_expectancy:'81.3 yrs', languages:'German',              exports:'Vehicles, Machinery',         imports:'Chemicals, Vehicles',       hdi:'0.947' },
  CHN: { country:'China',            capital:'Beijing',         region:'Asia',        population:'1,412,000,000', gdp:'$17.7T',  currency:'CNY', area:'9,596,960 km²',   life_expectancy:'77.4 yrs', languages:'Mandarin',            exports:'Electronics, Machinery',      imports:'Oil, Semiconductors',       hdi:'0.768' },
  BRA: { country:'Brazil',           capital:'Brasília',        region:'Americas',    population:'214,000,000',   gdp:'$1.6T',   currency:'BRL', area:'8,515,767 km²',   life_expectancy:'76.6 yrs', languages:'Portuguese',          exports:'Soybeans, Iron Ore',          imports:'Machinery, Electronics',    hdi:'0.754' },
  IND: { country:'India',            capital:'New Delhi',       region:'Asia',        population:'1,380,000,000', gdp:'$3.2T',   currency:'INR', area:'3,287,263 km²',   life_expectancy:'70.2 yrs', languages:'Hindi, English',      exports:'Petroleum, Software',         imports:'Oil, Gold',                 hdi:'0.633' },
  AUS: { country:'Australia',        capital:'Canberra',        region:'Oceania',     population:'25,500,000',    gdp:'$1.7T',   currency:'AUD', area:'7,741,220 km²',   life_expectancy:'83.4 yrs', languages:'English',             exports:'Iron Ore, Coal',              imports:'Machinery, Oil',            hdi:'0.944' },
  RUS: { country:'Russia',           capital:'Moscow',          region:'Europe/Asia', population:'144,000,000',   gdp:'$1.8T',   currency:'RUB', area:'17,098,242 km²',  life_expectancy:'72.4 yrs', languages:'Russian',             exports:'Oil, Gas',                    imports:'Machinery, Food',           hdi:'0.824' },
  JPN: { country:'Japan',            capital:'Tokyo',           region:'Asia',        population:'125,700,000',   gdp:'$4.9T',   currency:'JPY', area:'377,915 km²',      life_expectancy:'84.3 yrs', languages:'Japanese',            exports:'Vehicles, Electronics',       imports:'Fuel, Food',               hdi:'0.919' },
  FRA: { country:'France',           capital:'Paris',           region:'Europe',      population:'67,400,000',    gdp:'$2.9T',   currency:'EUR', area:'643,801 km²',      life_expectancy:'82.7 yrs', languages:'French',              exports:'Aircraft, Machinery',         imports:'Crude Oil, Vehicles',       hdi:'0.903' },
  CAN: { country:'Canada',           capital:'Ottawa',          region:'Americas',    population:'38,200,000',    gdp:'$2.0T',   currency:'CAD', area:'9,984,670 km²',   life_expectancy:'82.9 yrs', languages:'English, French',     exports:'Oil, Vehicles',               imports:'Vehicles, Machinery',       hdi:'0.936' },
  ZAF: { country:'South Africa',     capital:'Pretoria',        region:'Africa',      population:'60,000,000',    gdp:'$419B',   currency:'ZAR', area:'1,221,037 km²',   life_expectancy:'64.1 yrs', languages:'11 Official Languages', exports:'Gold, Diamonds',            imports:'Machinery, Oil',            hdi:'0.713' },
  MEX: { country:'Mexico',           capital:'Mexico City',     region:'Americas',    population:'130,000,000',   gdp:'$1.3T',   currency:'MXN', area:'1,964,375 km²',   life_expectancy:'75.1 yrs', languages:'Spanish',             exports:'Vehicles, Electronics',       imports:'Metal Parts, Oil',          hdi:'0.758' },
  ARG: { country:'Argentina',        capital:'Buenos Aires',    region:'Americas',    population:'45,400,000',    gdp:'$490B',   currency:'ARS', area:'2,780,400 km²',   life_expectancy:'76.7 yrs', languages:'Spanish',             exports:'Soybeans, Vehicles',          imports:'Machinery, Chemicals',      hdi:'0.842' },
  NGA: { country:'Nigeria',          capital:'Abuja',           region:'Africa',      population:'218,000,000',   gdp:'$477B',   currency:'NGN', area:'923,768 km²',      life_expectancy:'62.6 yrs', languages:'English',             exports:'Oil, Natural Gas',            imports:'Machinery, Food',           hdi:'0.535' },
  KOR: { country:'South Korea',      capital:'Seoul',           region:'Asia',        population:'51,700,000',    gdp:'$1.8T',   currency:'KRW', area:'100,210 km²',      life_expectancy:'83.5 yrs', languages:'Korean',              exports:'Semiconductors, Vehicles',    imports:'Oil, Semiconductors',       hdi:'0.925' },
  IDN: { country:'Indonesia',        capital:'Jakarta',         region:'Asia',        population:'277,000,000',   gdp:'$1.2T',   currency:'IDR', area:'1,904,569 km²',   life_expectancy:'71.7 yrs', languages:'Indonesian',          exports:'Palm Oil, Coal',              imports:'Machinery, Oil',            hdi:'0.705' },
  SAU: { country:'Saudi Arabia',     capital:'Riyadh',          region:'Middle East', population:'35,000,000',    gdp:'$833B',   currency:'SAR', area:'2,149,690 km²',   life_expectancy:'75.5 yrs', languages:'Arabic',              exports:'Oil, Petrochemicals',         imports:'Machinery, Vehicles',       hdi:'0.875' },
  TUR: { country:'Turkey',           capital:'Ankara',          region:'Europe/Asia', population:'85,000,000',    gdp:'$815B',   currency:'TRY', area:'783,356 km²',      life_expectancy:'77.7 yrs', languages:'Turkish',             exports:'Vehicles, Textiles',          imports:'Gold, Oil',                 hdi:'0.838' },
  EGY: { country:'Egypt',            capital:'Cairo',           region:'Africa',      population:'104,000,000',   gdp:'$404B',   currency:'EGP', area:'1,001,450 km²',   life_expectancy:'72.0 yrs', languages:'Arabic',              exports:'Oil, Cotton',                 imports:'Machinery, Food',           hdi:'0.731' },
  PAK: { country:'Pakistan',         capital:'Islamabad',       region:'Asia',        population:'231,000,000',   gdp:'$347B',   currency:'PKR', area:'881,913 km²',      life_expectancy:'67.3 yrs', languages:'Urdu, English',       exports:'Textiles, Rice',              imports:'Petroleum, Machinery',      hdi:'0.544' },
  COL: { country:'Colombia',         capital:'Bogotá',          region:'Americas',    population:'51,600,000',    gdp:'$314B',   currency:'COP', area:'1,141,748 km²',   life_expectancy:'77.3 yrs', languages:'Spanish',             exports:'Oil, Coffee',                 imports:'Machinery, Electronics',    hdi:'0.752' },
  ESP: { country:'Spain',            capital:'Madrid',          region:'Europe',      population:'47,400,000',    gdp:'$1.4T',   currency:'EUR', area:'505,990 km²',      life_expectancy:'83.2 yrs', languages:'Spanish',             exports:'Vehicles, Machinery',         imports:'Energy, Chemicals',         hdi:'0.905' },
  ITA: { country:'Italy',            capital:'Rome',            region:'Europe',      population:'60,400,000',    gdp:'$2.1T',   currency:'EUR', area:'301,340 km²',      life_expectancy:'83.4 yrs', languages:'Italian',             exports:'Machinery, Vehicles',         imports:'Energy, Chemicals',         hdi:'0.895' },
};

// ── Public fetch function ─────────────────────────────────────
/**
 * Fetch country data by ISO-3 code.
 * Automatically uses mock data or real API based on env config.
 *
 * @param {string} iso3 - e.g. "USA", "GBR"
 * @returns {Promise<object|null>}
 */
export async function fetchCountry(iso3) {
  if (!iso3) return null;

  if (USE_MOCK) {
    // Simulate network latency so the loading state is visible
    await new Promise(r => setTimeout(r, 450));
    return MOCK_DATA[iso3] ?? null;
  }

  // ── Real API call ──────────────────────────────────────────
  const url = `${API_BASE}/api/countries?${KEY_COLUMN}=${iso3}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── SQL string helper (for display in sidebar) ────────────────
export function buildSqlString(iso3) {
  return `SELECT * FROM countries WHERE ${KEY_COLUMN} = '${iso3}'`;
}

export { MOCK_DATA };
