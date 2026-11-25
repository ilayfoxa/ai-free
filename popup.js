const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('results');
const statusEl = document.getElementById('status');
const googleDorkLink = document.getElementById('googleDorkLink');

// Load previous search on popup open
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastQuery', 'lastResults'], (data) => {
    if (data.lastQuery) {
      searchInput.value = data.lastQuery;
      updateGoogleDork(data.lastQuery);
    } else {
      updateGoogleDork('AI tools');
    }
    if (data.lastResults) {
      renderResults(data.lastResults);
    } else {
      performSearch('free AI API credits');
    }
  });
});

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim() || 'free AI credits';
  performSearch(query);
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim() || 'free AI credits';
    performSearch(query);
  }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const query = chip.getAttribute('data-query');
    searchInput.value = query;
    performSearch(query);
  });
});

function updateGoogleDork(query) {
  const dork = `"${query}" ("promo code" OR "coupon" OR "free credits" OR "100% off" OR "free tier")`;
  googleDorkLink.href = `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
}

// Extract potential uppercase promo codes (e.g., SAVE20, AI50, FREE100)
function extractPromoCode(text) {
  const blacklist = new Set(['FREE', 'PROMO', 'CODE', 'HTTPS', 'HTTP', 'OPENAI', 'CLAUDE', 'GPT4', 'API', 'REDDIT', 'GITHUB']);
  const matches = text.match(/\b[A-Z0-9]{4,15}\b/g);
  if (!matches) return null;

  for (const word of matches) {
    // Must contain at least one letter and one number, or common discount patterns
    if (!blacklist.has(word) && /[A-Z]/.test(word) && /[0-9]/.test(word)) {
      return word;
    }
  }
  return null;
}

async function fetchRedditDeals(query) {
  const searchQuery = `${query} (promo OR coupon OR "free credits" OR discount OR "free trial")`;
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchQuery)}&sort=new&limit=12`;
  
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  
  return json.data.children.map(item => {
    const post = item.data;
    const combinedText = `${post.title} ${post.selftext || ''}`;
    return {
      source: `r/${post.subreddit}`,
      title: post.title,
      url: `https://www.reddit.com${post.permalink}`,
      date: new Date(post.created_utc * 1000).toLocaleDateString(),
      detectedCode: extractPromoCode(combinedText)
    };
  });
}

async function fetchGitHubDeals(query) {
  const searchQuery = `${query} free credits OR promo OR awesome-free`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=updated&per_page=6`;
  
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  
  return (json.items || []).map(repo => ({
    source: 'GitHub Repo',
    title: `${repo.full_name} — ${repo.description || 'No description'}`,
    url: repo.html_url,
    date: `⭐ ${repo.stargazers_count}`,
    detectedCode: null
  }));
}

async function performSearch(query) {
  updateGoogleDork(query);
  resultsContainer.innerHTML = '';
  statusEl.classList.remove('hidden');

  try {
    const [redditResults, githubResults] = await Promise.all([
      fetchRedditDeals(query),
      fetchGitHubDeals(query)
    ]);

    const combined = [...redditResults, ...githubResults];
    chrome.storage.local.set({ lastQuery: query, lastResults: combined });
    renderResults(combined);
  } catch (err) {
    resultsContainer.innerHTML = `<div class="status">Error fetching deals. Check your connection.</div>`;
  } finally {
    statusEl.classList.add('hidden');
  }
}

function renderResults(items) {
  resultsContainer.innerHTML = '';

  if (!items || items.length === 0) {
    resultsContainer.innerHTML = `<div class="status">No live deals found. Try the Deep Web Search link above!</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';

    const codeHtml = item.detectedCode 
      ? `<div class="promo-pill" title="Click to copy" data-code="${item.detectedCode}">Code: ${item.detectedCode} 📋</div>` 
      : '';

    card.innerHTML = `
      <div class="card-header">
        <span class="badge">${item.source}</span>
        <span>${item.date}</span>
      </div>
      <a href="${item.url}" target="_blank" class="card-title">${escapeHtml(item.title)}</a>
      ${codeHtml}
    `;

    resultsContainer.appendChild(card);
  });

  // Add click-to-copy functionality for detected promo codes
  document.querySelectorAll('.promo-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const code = pill.getAttribute('data-code');
      navigator.clipboard.writeText(code);
      const original = pill.textContent;
      pill.textContent = 'Copied! ✅';
      setTimeout(() => (pill.textContent = original), 1500);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
