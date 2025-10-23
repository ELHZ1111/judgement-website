// Judgement Global Leaderboard - Supabase live fetch, with categories and ranking mode bar in same style (smaller pill buttons)
// Table shows 15 rows (max-height: 510px)
// Scrollbar styled black
// Now: fetches ALL figures (up to 10,000) using chunked paging, not limit 10000

const SUPABASE_URL = 'https://nfgrgcaqordmwupelgrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ3JnY2Fxb3JkbXd1cGVsZ3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzY4MjksImV4cCI6MjA3MjMxMjgyOX0.I6vA1a__54F76nGFRpGh4jSYvNEnY9LnrxdlN55yOFw';

const CATEGORIES = ['All', 'Politicians', 'Executives', 'Influencers', 'Historical', 'Fictional'];
const RANK_MODES = [
  { key: 'percent', label: '% Resonance' },
  { key: 'resonate', label: 'Total Resonance' },
  { key: 'reject', label: 'Total Rejection' }
];

let figures = [];
let votes = [];
let selectedCategory = 'All';
let allCountries = [];
let selectedCountry = '';
let selectedRankMode = 'percent';

// Helper to fetch ALL rows from a table using .range() and chunking
async function fetchAllRows(supabase, table, columns, pageSize = 1000) {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

(function loadSupabaseCDN() {
  if (!window.supabase) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
    script.onload = () => main();
    document.head.appendChild(script);
  } else {
    main();
  }
})();

function createSupabaseClient() {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function main() {
  try {
    const el = document.querySelector('.leaderboard-scroll');
    el.innerHTML = `<div class="loading">Loading leaderboard…</div>`;

    const supabase = createSupabaseClient();

    // Fetch ALL figures (up to 10k)
    figures = await fetchAllRows(supabase, 'figures', 'id, name, category, country');

    // Fetch ALL votes (up to 50k)
    votes = await fetchAllRows(supabase, 'fingerprint_votes', 'figure_id, direction', 5000);

    // Aggregate vote counts per figure
    const voteCounts = {};
    votes.forEach(({ figure_id, direction }) => {
      if (!voteCounts[figure_id]) {
        voteCounts[figure_id] = { resonate: 0, reject: 0, ambivalent: 0 };
      }
      if (direction === 'resonate') voteCounts[figure_id].resonate++;
      else if (direction === 'reject') voteCounts[figure_id].reject++;
      else if (direction === 'ambivalent') voteCounts[figure_id].ambivalent++;
    });

    // Merge vote counts into figures
    figures = figures.map(f => {
      const counts = voteCounts[f.id] || { resonate: 0, reject: 0, ambivalent: 0 };
      const total = counts.resonate + counts.reject;
      return {
        ...f,
        ...counts,
        percent: total > 0 ? Math.round((counts.resonate / total) * 100) : 0,
      };
    });

    // Build country list for politicians
    allCountries = Array.from(
      new Set(figures.filter(f => f.category === 'Politicians' && f.country).map(f => f.country))
    ).sort((a, b) => a.localeCompare(b));
    allCountries.unshift('All');

    renderCategoryBar();
    renderCountryBar();
    renderRankModeBar();
    renderLeaderboard();
  } catch (err) {
    document.querySelector('.leaderboard-scroll').innerHTML =
      `<div class="error">Error loading leaderboard.<br>${err.message || err}</div>`;
  }
}

// --- Render category bar, pill style ---
function renderCategoryBar() {
  let categoryBar = document.getElementById('categoryBar');
  if (!categoryBar) {
    categoryBar = document.createElement('div');
    categoryBar.id = 'categoryBar';
    categoryBar.className = 'category-bar pill-bar';
    document.querySelector('.main-content').insertBefore(categoryBar, document.querySelector('.leaderboard-box'));
  }
  categoryBar.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = 'pill-btn' + (selectedCategory === cat ? ' active' : '');
    btn.onclick = () => {
      selectedCategory = cat;
      selectedCountry = '';
      renderCategoryBar();
      renderCountryBar();
      renderLeaderboard();
    };
    categoryBar.appendChild(btn);
  });
}

// --- Render country bar for politicians ---
function renderCountryBar() {
  let countryBar = document.getElementById('countryBar');
  if (!countryBar) {
    countryBar = document.createElement('div');
    countryBar.id = 'countryBar';
    countryBar.className = 'country-bar';
    countryBar.style.display = 'none';
    countryBar.innerHTML = `
      <span class="country-label">Country:</span>
      <select class="country-select" id="countrySelect"></select>
      <input type="text" class="country-search" id="countrySearch" placeholder="Search country…" />
    `;
    document.querySelector('.main-content').insertBefore(countryBar, document.querySelector('.leaderboard-box'));
  }
  const countrySelect = countryBar.querySelector('#countrySelect');
  const countrySearch = countryBar.querySelector('#countrySearch');
  if (selectedCategory === 'Politicians') {
    countryBar.style.display = '';
    countrySelect.innerHTML = '';
    allCountries.forEach(c => {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c;
      countrySelect.appendChild(option);
    });
    countrySelect.value = selectedCountry || 'All';
    countrySelect.onchange = () => {
      selectedCountry = countrySelect.value;
      countrySearch.value = '';
      renderLeaderboard();
    };
    countrySearch.value = '';
    countrySearch.oninput = () => {
      selectedCountry = countrySearch.value;
      renderLeaderboard();
    };
  } else {
    countryBar.style.display = 'none';
  }
}

// --- Render ranking mode bar (smaller pills, same style as categories) ---
function renderRankModeBar() {
  let rankBar = document.getElementById('rankModeBar');
  if (!rankBar) {
    rankBar = document.createElement('div');
    rankBar.id = 'rankModeBar';
    rankBar.className = 'pill-bar pill-bar-small';
    document.querySelector('.main-content').insertBefore(rankBar, document.querySelector('.leaderboard-box'));
  }
  rankBar.innerHTML = RANK_MODES.map(({ key, label }) =>
    `<button class="pill-btn pill-btn-small${selectedRankMode === key ? ' active' : ''}" onclick="window.setLeaderboardRankMode('${key}')">${label}</button>`
  ).join('');
  window.setLeaderboardRankMode = function(mode) {
    selectedRankMode = mode;
    renderRankModeBar();
    renderLeaderboard();
  };
}

// --- Render leaderboard ---
function renderLeaderboard() {
  const el = document.querySelector('.leaderboard-scroll');
  let filtered = figures;
  if (selectedCategory !== 'All') {
    filtered = filtered.filter(f => f.category === selectedCategory);
  }
  if (selectedCategory === 'Politicians') {
    if (selectedCountry && selectedCountry !== 'All') {
      filtered = filtered.filter(f =>
        f.country && f.country.toLowerCase().includes(selectedCountry.toLowerCase())
      );
    }
  }

  // Sort by selected mode
  filtered = filtered.slice().sort((a, b) => {
    if (selectedRankMode === 'percent') return b.percent - a.percent;
    if (selectedRankMode === 'resonate') return b.resonate - a.resonate;
    if (selectedRankMode === 'reject') return b.reject - a.reject;
    return 0;
  });

  let table = `
    <div style="max-height:510px;overflow-y:auto;">
      <table style="background:transparent;border:none;width:100%;">
        <thead>
          <tr style="background:transparent;">
            <th style="color:#fff;font-weight:bold;font-size:1em;">#</th>
            <th style="color:#fff;font-weight:bold;font-size:1em;">Name</th>
            <th style="color:#fff;font-weight:bold;font-size:1em;">Resonate</th>
            <th style="color:#fff;font-weight:bold;font-size:1em;">Reject</th>
            <th style="color:#fff;font-weight:bold;font-size:1em;">Ambivalent</th>
            <th style="color:#fff;font-weight:bold;font-size:1em;">% Resonance</th>
          </tr>
        </thead>
        <tbody style="background:transparent;">
  `;

  filtered.forEach((f, i) => {
    table += `
      <tr style="background:transparent;">
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${i + 1}</td>
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${f.name}</td>
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${f.resonate ?? 0}</td>
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${f.reject ?? 0}</td>
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${f.ambivalent ?? 0}</td>
        <td style="color:#bbb;font-weight:normal;font-size:0.97em;">${f.percent}%</td>
      </tr>
    `;
  });
  table += `</tbody></table></div>`;

  if (filtered.length > 1000) {
    table += `<div style="color:#aaa; font-size:0.93em; margin-top:8px; text-align:center;">Showing ${filtered.length} results (scroll for more)</div>`;
  }

  el.innerHTML = table;
}

// --- Insert pill bar styles for both category and rank mode bars, and style scrollbar black ---
(function addPillBarStyles() {
  const css = `
    .pill-bar {
      width: 100%;
      max-width: 940px;
      margin: 10px auto 0 auto;
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      padding-bottom: 0;
      position: relative;
      flex-wrap: wrap;
    }
    .pill-btn {
      background: none;
      border: 1.5px solid #222;
      color: #aaa;
      border-radius: 14px;
      padding: 8px 18px;
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.18s, background 0.18s;
      margin: 0 1px;
    }
    .pill-btn.active {
      background: #151515;
      color: #fff;
      border-color: #333;
      font-weight: 700;
    }
    .pill-bar-small {
      gap: 6px;
      margin-top: 6px;
    }
    .pill-btn-small {
      padding: 5px 10px;
      font-size: 12px;
      border-radius: 10px;
    }
    /* Black scrollbar styling for leaderboard-scroll */
    .leaderboard-scroll {
      scrollbar-color: #000 #000;
      scrollbar-width: thin;
    }
    .leaderboard-scroll::-webkit-scrollbar {
      width: 8px;
      background: #000;
    }
    .leaderboard-scroll::-webkit-scrollbar-thumb {
      background: #000;
      border-radius: 5px;
    }
    .leaderboard-scroll::-webkit-scrollbar-track {
      background: #000;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();