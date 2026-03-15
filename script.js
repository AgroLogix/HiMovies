// ─── CONFIG ───
// Using TMDB with a public demo key — replace with your own at https://www.themoviedb.org/settings/api
async function loadMovies(page = 1) {

  const res = await fetch(`/api/movies?page=${page}`)
  const data = await res.json()

  currentMovies = data.results
  totalPages = data.total_pages

  renderMovies(currentMovies)
  renderPagination()

}
const IMG     = 'https://image.tmdb.org/t/p/';

// Genre map
const GENRES = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',18:'Drama',14:'Fantasy',27:'Horror',10749:'Romance',878:'Sci-Fi',53:'Thriller',10751:'Family',36:'History',10402:'Music',9648:'Mystery',10752:'War'};

// State
let currentPage = 1;
let totalPages  = 1;
let currentMovies = [];
let userRatings = JSON.parse(localStorage.getItem('cvRatings') || '{}');
let searchTimer;
let currentMode = 'discover';

// ─── FETCH WRAPPER ───
async function tmdb(endpoint, params = {}) {
  const url = new URL(BASE + endpoint);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([k,v]) => { if(v !== undefined && v !== '') url.searchParams.set(k,v); });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  } catch(e) {
    console.warn('TMDB fetch failed:', e);
    return null;
  }
}

// ─── LOAD MOVIES ───
async function loadMovies(page = 1) {
  currentPage = page;
  showSkeletons();

  const search = document.getElementById('searchInput').value.trim();
  const genre  = document.getElementById('genreFilter').value;
  const sort   = document.getElementById('sortFilter').value;
  const year   = document.getElementById('yearFilter').value;

  let data;
  if (search) {
    currentMode = 'search';
    data = await tmdb('/search/movie', { query: search, page, year });
    document.getElementById('sectionTitle').textContent = `RESULTS FOR "${search.toUpperCase()}"`;
  } else {
    currentMode = 'discover';
    data = await tmdb('/discover/movie', {
      page, with_genres: genre, sort_by: sort,
      primary_release_year: year,
      'vote_count.gte': sort === 'vote_average.desc' ? 200 : undefined
    });
    document.getElementById('sectionTitle').textContent = sort === 'vote_average.desc' ? 'TOP RATED MOVIES' : sort === 'release_date.desc' ? 'NEWEST MOVIES' : 'POPULAR MOVIES';
  }

  if (!data || !data.results) {
    renderError(); return;
  }

  currentMovies = data.results;
  totalPages = Math.min(data.total_pages || 1, 500);
  document.getElementById('statMovies').textContent = (data.total_results || 0).toLocaleString() + '+';
  document.getElementById('resultsCount').textContent = `${data.total_results?.toLocaleString() || 0} results`;

  renderMovies(currentMovies);
  renderPagination();
}

// ─── RENDER MOVIES ───
function renderMovies(movies) {
  const grid = document.getElementById('moviesGrid');
  if (!movies.length) {
    grid.innerHTML = `<div class="no-results"><div class="no-results-icon">🎬</div><h3>NO MOVIES FOUND</h3><p>Try adjusting your search or filters.</p></div>`;
    return;
  }
  grid.innerHTML = movies.map((m, i) => {
    const poster  = m.poster_path ? `<img src="${IMG}w500${m.poster_path}" alt="${m.title}" loading="lazy">` : `<div class="poster-placeholder">🎬</div>`;
    const rating  = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
    const year    = m.release_date ? m.release_date.slice(0,4) : '—';
    const genre   = m.genre_ids?.[0] ? GENRES[m.genre_ids[0]] || 'Movie' : 'Movie';
    const stars   = buildMiniStars(m.id);
    return `
    <div class="movie-card" style="animation-delay:${i*0.045}s" onclick="openModal(${m.id})">
      <div class="card-poster">
        ${poster}
        <div class="badge-row">
          <span class="badge badge-genre">${genre}</span>
          <span class="badge badge-rating">⭐ ${rating}</span>
        </div>
        <div class="card-overlay">
          <div class="overlay-btns">
            <button class="overlay-btn overlay-btn-primary" onclick="event.stopPropagation();openModal(${m.id})">Details</button>
            <button class="overlay-btn overlay-btn-secondary" onclick="event.stopPropagation();rateInline(${m.id}, event)">Rate</button>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span>📅 ${year}</span>
          <span>👁 ${formatNum(m.vote_count)}</span>
        </div>
        <div class="star-rating" id="stars-${m.id}">${stars}</div>
      </div>
    </div>`;
  }).join('');
}

function buildMiniStars(movieId) {
  const rated = userRatings[movieId] || 0;
  return [1,2,3,4,5].map(s =>
    `<span class="star ${s <= rated ? 'rated' : ''}" data-val="${s}" onclick="event.stopPropagation();rateMini(${movieId}, ${s})" onmouseover="hoverMini(${movieId},${s})" onmouseout="unhoverMini(${movieId})">★</span>`
  ).join('') + `<span class="user-rating-label" id="mini-label-${movieId}">${rated ? rated+'/5' : 'Rate'}</span>`;
}

function hoverMini(id, val) {
  const wrap = document.getElementById('stars-'+id);
  if (!wrap) return;
  wrap.querySelectorAll('.star').forEach((s,i) => { s.classList.toggle('hovered', i < val); });
}
function unhoverMini(id) {
  const wrap = document.getElementById('stars-'+id);
  if (!wrap) return;
  const rated = userRatings[id] || 0;
  wrap.querySelectorAll('.star').forEach((s,i) => { s.classList.remove('hovered'); s.classList.toggle('rated', i < rated); });
}
function rateMini(id, val) {
  userRatings[id] = val;
  localStorage.setItem('cvRatings', JSON.stringify(userRatings));
  const wrap = document.getElementById('stars-'+id);
  if (wrap) {
    wrap.querySelectorAll('.star').forEach((s,i) => s.classList.toggle('rated', i < val));
    const label = document.getElementById('mini-label-'+id);
    if (label) label.textContent = val+'/5';
  }
  showToast(`You rated this ${val}★`);
}

function rateInline(id, e) {
  openModal(id);
}

function showSkeletons() {
  document.getElementById('moviesGrid').innerHTML = Array(8).fill(0).map(() =>
    `<div class="skeleton skeleton-card" style="border-radius:16px;"></div>`
  ).join('');
  document.getElementById('pagination').innerHTML = '';
}

function renderError() {
  document.getElementById('moviesGrid').innerHTML = `<div class="no-results"><div class="no-results-icon">⚠️</div><h3>COULD NOT LOAD MOVIES</h3><p>Please check your connection and try again.</p></div>`;
}

function formatNum(n) {
  if (!n) return '—';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n;
}

// ─── PAGINATION ───
function renderPagination() {
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let btns = '';
  const prev = currentPage - 1;
  const next = currentPage + 1;
  btns += `<button class="page-btn" onclick="goPage(1)" ${currentPage===1?'disabled':''}>«</button>`;
  btns += `<button class="page-btn" onclick="goPage(${prev})" ${currentPage===1?'disabled':''}>‹</button>`;
  let start = Math.max(1, currentPage - 2);
  let end   = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) {
    btns += `<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  }
  btns += `<button class="page-btn" onclick="goPage(${next})" ${currentPage===totalPages?'disabled':''}>›</button>`;
  btns += `<button class="page-btn" onclick="goPage(${totalPages})" ${currentPage===totalPages?'disabled':''}>»</button>`;
  pag.innerHTML = btns;
}

function goPage(p) {
  if (p < 1 || p > totalPages || p === currentPage) return;
  loadMovies(p);
  document.getElementById('movies').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── MODAL ───
async function openModal(id) {
  const backdrop = document.getElementById('movieModal');
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset
  document.getElementById('modalTitle').textContent = 'Loading…';
  document.getElementById('modalTagline').textContent = '';
  document.getElementById('modalOverview').textContent = '';
  document.getElementById('modalStats').innerHTML = '';
  document.getElementById('modalGenres').innerHTML = '';
  document.getElementById('modalTrailer').innerHTML = '';
  document.getElementById('modalCast').innerHTML = '';
  document.getElementById('rateSubmitted').style.display = 'none';

  const [movie, credits, videos] = await Promise.all([
    tmdb(`/movie/${id}`),
    tmdb(`/movie/${id}/credits`),
    tmdb(`/movie/${id}/videos`)
  ]);

  if (!movie) { closeModal(); return; }

  // Backdrop
  const bdPath = movie.backdrop_path || movie.poster_path;
  document.getElementById('modalBackdrop').src = bdPath ? `${IMG}w1280${bdPath}` : '';
  document.getElementById('modalPoster').src = movie.poster_path ? `${IMG}w500${movie.poster_path}` : '';
  document.getElementById('modalTitle').textContent = movie.title;
  document.getElementById('modalTagline').textContent = movie.tagline || '';

  // Stats
  const runtime = movie.runtime ? `${Math.floor(movie.runtime/60)}h ${movie.runtime%60}m` : '—';
  document.getElementById('modalStats').innerHTML = `
    <div class="modal-stat"><div class="modal-stat-val">⭐ ${movie.vote_average?.toFixed(1) || 'N/A'}</div><div class="modal-stat-label">TMDB Rating</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${movie.release_date?.slice(0,4) || '—'}</div><div class="modal-stat-label">Released</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${runtime}</div><div class="modal-stat-label">Runtime</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${formatNum(movie.vote_count)}</div><div class="modal-stat-label">Votes</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${movie.popularity?.toFixed(0) || '—'}</div><div class="modal-stat-label">Popularity</div></div>
  `;

  // Genres
  if (movie.genres?.length) {
    document.getElementById('modalGenres').innerHTML = `
      <div class="modal-section-title">Genres</div>
      <div class="genres-wrap">${movie.genres.map(g => `<span class="genre-pill">${g.name}</span>`).join('')}</div>
    `;
  }

  // Overview
  document.getElementById('modalOverview').textContent = movie.overview || 'No overview available.';

  // Trailer
  const trailer = videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos?.results?.[0];
  if (trailer) {
    document.getElementById('modalTrailer').innerHTML = `
      <div class="modal-section-title">Trailer</div>
      <div class="trailer-wrap">
        <iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  // Cast
  const cast = credits?.cast?.slice(0, 10) || [];
  if (cast.length) {
    document.getElementById('modalCast').innerHTML = `
      <div class="modal-section-title">Top Cast</div>
      <div class="cast-grid">
        ${cast.map(c => {
          const photo = c.profile_path ? `<img src="${IMG}w92${c.profile_path}" alt="${c.name}">` : c.name[0];
          return `<div class="cast-chip"><div class="cast-avatar">${c.profile_path ? `<img src="${IMG}w92${c.profile_path}" alt="${c.name}">` : c.name[0]}</div>${c.name}</div>`;
        }).join('')}
      </div>
    `;
  }

  // Rate
  const rated = userRatings[id] || 0;
  document.getElementById('rateStars').innerHTML = [1,2,3,4,5].map(s =>
    `<span class="rate-star ${s <= rated ? 'active' : ''}" onmouseover="hoverRate(${s})" onmouseout="unhoverRate(${id})" onclick="submitRate(${id}, ${s})">★</span>`
  ).join('');
  if (rated) document.getElementById('rateSubmitted').style.display = 'block', document.getElementById('rateSubmitted').textContent = `Your rating: ${'★'.repeat(rated)}`;
}

function hoverRate(val) {
  document.querySelectorAll('.rate-star').forEach((s,i) => { s.style.color = i < val ? 'var(--accent)' : ''; });
}
function unhoverRate(id) {
  const rated = userRatings[id] || 0;
  document.querySelectorAll('.rate-star').forEach((s,i) => { s.style.color = i < rated ? 'var(--accent)' : ''; });
}
function submitRate(id, val) {
  userRatings[id] = val;
  localStorage.setItem('cvRatings', JSON.stringify(userRatings));
  document.querySelectorAll('.rate-star').forEach((s,i) => { s.classList.toggle('active', i < val); s.style.color = ''; });
  document.getElementById('rateSubmitted').style.display = 'block';
  document.getElementById('rateSubmitted').textContent = `Your rating: ${'★'.repeat(val)} (${val}/5)`;
  showToast(`You rated this movie ${val}★`);
  // Update card stars
  const wrap = document.getElementById('stars-'+id);
  if (wrap) {
    wrap.querySelectorAll('.star').forEach((s,i) => s.classList.toggle('rated', i < val));
    const label = document.getElementById('mini-label-'+id);
    if (label) label.textContent = val+'/5';
  }
}

function closeModal() {
  document.getElementById('movieModal').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('modalTrailer').innerHTML = '';
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'movieModal') closeModal();
}

// ─── FILTERS ───
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadMovies(1), 450);
});

['genreFilter','sortFilter','yearFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => loadMovies(1));
});

function filterByGenre(id) {
  document.getElementById('genreFilter').value = id;
  loadMovies(1);
  document.getElementById('movies').scrollIntoView({ behavior:'smooth' });
  return false;
}

// ─── CONTACT FORM ───
function submitForm() {
  const fname   = document.getElementById('fname').value.trim();
  const email   = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();
  if (!fname || !email || !message) { showToast('Please fill in all required fields 🙏', '⚠️'); return; }
  document.getElementById('formSuccess').style.display = 'block';
  ['fname','lname','email','subject','message'].forEach(id => document.getElementById(id).value = '');
  showToast('Message sent successfully! 🎉', '✅');
  setTimeout(() => document.getElementById('formSuccess').style.display = 'none', 5000);
}

// ─── TOAST ───
let toastTimer;
function showToast(msg, icon = '⭐') {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.querySelector('.toast-icon').textContent = icon;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── NAV ───
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('navLinks').classList.remove('open');
}

// ─── SCROLL TOP ───
window.addEventListener('scroll', () => {
  document.getElementById('scrollTop').classList.toggle('visible', window.scrollY > 500);
});

// ─── KEYBOARD ───
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── INIT ───
loadMovies(1);