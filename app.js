(() => {
  'use strict';

  const OPS = {
    add: { label: 'Addition', symbol: '+', maxLevels: 4, maxDigits: 6 },
    sub: { label: 'Subtraction', symbol: '−', maxLevels: 4, maxDigits: 6 },
    mul: { label: 'Multiplication', symbol: '×', fixedLevels: 2, maxDigits: 4 },
  };
  const DEFAULT_LEVELS = 2;
  const DEFAULT_DIGITS = 2;
  const STORE_KEY = 'mathQuestKids.users.v1';
  const CHEERS = ['Awesome!', 'Super star!', 'You got it!', 'Brilliant!', 'Fantastic!', 'Math wizard!'];
  const CHEER_EMOJI = ['🎉', '🌟', '🏆', '🥳', '🚀', '🦄'];
  const OOPS = ['Oops!', 'Nice try!', 'Almost!', 'Keep going!'];
  const OOPS_EMOJI = ['😢', '🙈', '😮', '🐢'];

  const state = {
    userKey: null,
    userName: '',
    ops: [],
    settings: {},
    session: { correct: 0, wrong: 0, totalTime: 0, count: 0 },
    problem: null,
    startTime: 0,
    timerId: null,
    sound: true,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rand(0, arr.length - 1)];

  // ---------- Storage ----------
  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function saveUsers(users) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(users)); } catch { /* storage unavailable */ }
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // Creates the user record if it doesn't exist, otherwise updates it.
  function ensureUser(name) {
    const users = loadUsers();
    const key = name.trim().toLowerCase();
    if (!users[key]) users[key] = { name: name.trim(), created: new Date().toISOString(), records: [] };
    users[key].name = name.trim();
    users[key].lastVisit = new Date().toISOString();
    saveUsers(users);
    return key;
  }
  // One record per user per date: date, correct, wrong, average time.
  function recordResult(isCorrect, seconds) {
    const users = loadUsers();
    const user = users[state.userKey];
    if (!user) return;
    const date = todayStr();
    let rec = user.records.find((r) => r.date === date);
    if (!rec) {
      rec = { date, correct: 0, wrong: 0, totalTime: 0, avgTime: 0 };
      user.records.push(rec);
    }
    if (isCorrect) rec.correct++; else rec.wrong++;
    rec.totalTime += seconds;
    rec.avgTime = rec.totalTime / (rec.correct + rec.wrong);
    saveUsers(users);
  }

  // ---------- Navigation ----------
  function showPage(id) {
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === id));
    document.body.classList.toggle('compact', id !== 'page-home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setError(el, msg) {
    el.textContent = msg;
    el.classList.remove('shake');
    void el.offsetWidth;
    if (msg) el.classList.add('shake');
  }

  // ---------- Page 1: Home ----------
  $('#home-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ops = $$('input[name="op"]:checked').map((c) => c.value);
    const nameInput = $('#username');
    const name = nameInput.value.trim();
    const fieldset = $('.ops');
    fieldset.classList.toggle('invalid', ops.length === 0);
    nameInput.classList.toggle('invalid', !name);

    let msg = '';
    if (!ops.length && !name) msg = 'Please choose at least one operation and type your name.';
    else if (!ops.length) msg = 'Please choose at least one operation (Addition, Subtraction or Multiplication).';
    else if (!name) msg = 'Please type your name so we can save your score.';
    else if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) msg = 'Please use only letters, numbers and spaces in your name.';
    setError($('#home-error'), msg);
    if (msg) { (name ? fieldset.querySelector('input') : nameInput).focus(); return; }

    state.ops = ops;
    state.userName = name;
    state.userKey = ensureUser(name);
    $$('.player-name').forEach((el) => { el.textContent = name; });
    buildSettings();
    showPage('page-settings');
  });
  $('#username').addEventListener('input', (e) => e.target.classList.remove('invalid'));
  $$('input[name="op"]').forEach((c) => c.addEventListener('change', () => $('.ops').classList.remove('invalid')));

  // ---------- Page 2: Settings ----------
  function selectHtml(id, min, max) {
    let html = `<select id="${id}"><option value="">Select (default 2)</option>`;
    for (let i = min; i <= max; i++) html += `<option value="${i}">${i}</option>`;
    return html + '</select>';
  }
  function buildSettings() {
    const list = $('#settings-list');
    list.innerHTML = '';
    state.ops.forEach((op) => {
      const cfg = OPS[op];
      const prev = state.settings[op];
      const card = document.createElement('div');
      card.className = `op-card op-${op}`;
      const levelsField = cfg.fixedLevels
        ? `<label>Number of levels</label><div class="fixed">${cfg.fixedLevels} (fixed)</div>`
        : `<label for="${op}-levels">Number of levels (max ${cfg.maxLevels})</label>${selectHtml(`${op}-levels`, 2, cfg.maxLevels)}`;
      card.innerHTML = `
        <h3>${cfg.symbol} ${cfg.label}</h3>
        <div class="field">${levelsField}</div>
        <div class="field">
          <label for="${op}-digits">Number of digits (max ${cfg.maxDigits})</label>
          ${selectHtml(`${op}-digits`, 1, cfg.maxDigits)}
        </div>`;
      list.appendChild(card);
      if (prev) {
        if (!cfg.fixedLevels) $(`#${op}-levels`).value = prev.levels;
        $(`#${op}-digits`).value = prev.digits;
      }
    });
  }
  $('#settings-back').addEventListener('click', () => showPage('page-home'));
  $('#settings-next').addEventListener('click', () => {
    state.settings = {};
    state.ops.forEach((op) => {
      const cfg = OPS[op];
      const levels = cfg.fixedLevels || parseInt($(`#${op}-levels`).value, 10) || DEFAULT_LEVELS;
      const digits = parseInt($(`#${op}-digits`).value, 10) || DEFAULT_DIGITS;
      state.settings[op] = { levels, digits };
    });
    renderHistory();
    showPage('page-history');
  });

  // ---------- Page 3: History ----------
  function renderHistory() {
    $('#settings-summary').innerHTML = state.ops.map((op) => {
      const s = state.settings[op];
      return `<span class="chip">${OPS[op].symbol} ${OPS[op].label}: ${s.levels} levels · ${s.digits} digits</span>`;
    }).join('');

    const user = loadUsers()[state.userKey];
    const records = user ? [...user.records].sort((a, b) => b.date.localeCompare(a.date)) : [];
    const wrap = $('#history-wrap');
    if (!records.length) {
      wrap.innerHTML = '<div class="empty">No games yet — this is your very first adventure! 🌈</div>';
      return;
    }
    const rows = records.map((r) => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td class="good">${r.correct}</td>
        <td class="bad">${r.wrong}</td>
        <td>${r.avgTime.toFixed(1)} s</td>
      </tr>`).join('');
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Date</th><th>Correct</th><th>Wrong</th><th>Avg. time</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  $('#history-back').addEventListener('click', () => { buildSettings(); showPage('page-settings'); });
  $('#start-btn').addEventListener('click', () => {
    unlockAudio();
    state.session = { correct: 0, wrong: 0, totalTime: 0, count: 0 };
    updateScores();
    showPage('page-game');
    nextProblem();
  });

  // ---------- Page 4: Game ----------
  function randDigits(d) { return rand(d === 1 ? 1 : 10 ** (d - 1), 10 ** d - 1); }

  function makeProblem() {
    const op = pick(state.ops);
    const { levels, digits } = state.settings[op];
    const nums = [];
    let answer;
    let width;
    if (op === 'add') {
      for (let i = 0; i < levels; i++) nums.push(randDigits(digits));
      answer = nums.reduce((a, b) => a + b, 0);
      width = String(levels * (10 ** digits - 1)).length;
    } else if (op === 'sub') {
      // Keep the result >= 0: the first number is big enough to take away all the others.
      const minDigit = digits === 1 ? 1 : 10 ** (digits - 1);
      const first = rand(Math.max((levels - 1) * minDigit, minDigit), 10 ** digits - 1);
      const cap = Math.floor(first / (levels - 1));
      nums.push(first);
      for (let i = 1; i < levels; i++) nums.push(rand(minDigit, cap));
      answer = first - nums.slice(1).reduce((a, b) => a + b, 0);
      width = digits;
    } else {
      nums.push(randDigits(digits), randDigits(digits));
      answer = nums[0] * nums[1];
      width = digits * 2;
    }
    return { op, nums, answer, width };
  }

  function nextProblem() {
    const p = makeProblem();
    state.problem = p;
    state.session.count++;
    const sym = OPS[p.op].symbol;
    $('#q-label').textContent = `Question ${state.session.count}`;
    const opLabel = $('#op-label');
    opLabel.textContent = `${sym} ${OPS[p.op].label}`;
    opLabel.className = `badge op-badge ${p.op}`;
    $('#expression').innerHTML = `${p.nums.join(` ${sym} `)} = <span class="q">${'?'.repeat(p.width)}</span>`;
    setError($('#game-msg'), '');
    renderBoard(p);
    startTimer();
  }

  function renderBoard(p) {
    const board = $('#board');
    const cols = p.width + 1; // digit columns + one column for the operator symbol at the end
    board.className = `board ${p.op}`;
    board.style.setProperty('--cols', cols);
    let html = '';

    // Helper row of checkboxes (carry / borrow cues) above the digit columns.
    html += '<div class="cue-label">Helper boxes — tick to remember a carry or borrow</div>';
    for (let c = 0; c < p.width; c++) {
      html += `<div class="cell cue"><input type="checkbox" aria-label="Helper box ${c + 1}"></div>`;
    }
    html += '<div class="cell cue"></div>';

    // Number rows: each digit in a box, right aligned, operator symbol at the end of the row.
    p.nums.forEach((n, row) => {
      const s = String(n);
      for (let c = 0; c < p.width - s.length; c++) html += '<div class="cell"></div>';
      for (const ch of s) html += `<div class="cell digit">${ch}</div>`;
      html += `<div class="cell opsym">${row > 0 ? OPS[p.op].symbol : ''}</div>`;
    });

    html += '<div class="rule"></div>';

    // Answer row.
    for (let c = 0; c < p.width; c++) {
      html += `<input class="ans" type="text" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="Answer digit ${c + 1}">`;
    }
    html += '<div class="cell opsym">=</div>';
    board.innerHTML = html;

    const inputs = $$('#board .ans');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(-1);
        // Kids solve right to left, so move focus to the left after each digit.
        if (inp.value && i > 0) inputs[i - 1].focus();
        setError($('#game-msg'), '');
      });
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); checkAnswer(); }
        else if (e.key === 'Backspace' && !inp.value && i < inputs.length - 1) {
          e.preventDefault(); inputs[i + 1].value = ''; inputs[i + 1].focus();
        } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < inputs.length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
      });
    });
    inputs[inputs.length - 1].focus();
  }

  function startTimer() {
    stopTimer();
    state.startTime = performance.now();
    $('#timer').textContent = '0';
    state.timerId = setInterval(() => {
      $('#timer').textContent = Math.floor((performance.now() - state.startTime) / 1000);
    }, 250);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function checkAnswer() {
    const p = state.problem;
    if (!p || !$('#feedback').classList.contains('hidden')) return;
    const raw = $$('#board .ans').map((i) => i.value || ' ').join('').trim();
    if (!raw) { setError($('#game-msg'), 'Type your answer in the boxes first ✏️'); return; }
    if (raw.includes(' ')) { setError($('#game-msg'), 'There is an empty box in the middle of your answer.'); return; }

    const seconds = (performance.now() - state.startTime) / 1000;
    stopTimer();
    const isCorrect = parseInt(raw, 10) === p.answer;
    const s = state.session;
    if (isCorrect) s.correct++; else s.wrong++;
    s.totalTime += seconds;
    recordResult(isCorrect, seconds);
    updateScores(isCorrect ? 'correct' : 'wrong');

    $('#board').classList.add(isCorrect ? 'correct' : 'wrong');
    showFeedback(isCorrect, p, seconds);
  }

  function updateScores(bump) {
    $('#score-correct').textContent = state.session.correct;
    $('#score-wrong').textContent = state.session.wrong;
    if (bump) {
      const el = $(`#score-${bump}`);
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  function showFeedback(isCorrect, p, seconds) {
    const fb = $('#feedback');
    fb.className = `feedback ${isCorrect ? 'win' : 'lose'}`;
    if (isCorrect) {
      $('#fb-emoji').textContent = pick(CHEER_EMOJI);
      $('#fb-title').textContent = pick(CHEERS);
      $('#fb-text').textContent = `Solved in ${seconds.toFixed(1)} seconds!`;
      confetti();
      playSuccess();
    } else {
      $('#fb-emoji').textContent = pick(OOPS_EMOJI);
      $('#fb-title').textContent = pick(OOPS);
      $('#fb-text').textContent = `The answer is ${p.answer}. You'll get the next one!`;
      rain();
      playFail();
    }
    setTimeout(() => $('#next-btn').focus(), 50);
  }

  $('#next-btn').addEventListener('click', () => {
    $('#feedback').classList.add('hidden');
    nextProblem();
  });
  $('#check-btn').addEventListener('click', checkAnswer);
  $('#clear-btn').addEventListener('click', () => {
    $$('#board input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
    const inputs = $$('#board .ans');
    inputs[inputs.length - 1].focus();
  });
  $('#finish-btn').addEventListener('click', () => {
    stopTimer();
    $('#feedback').classList.add('hidden');
    renderHistory();
    showPage('page-history');
  });
  $('#sound-btn').addEventListener('click', () => {
    state.sound = !state.sound;
    $('#sound-btn').textContent = state.sound ? '🔊' : '🔇';
  });

  // ---------- Animations ----------
  function confetti() {
    const layer = $('#fx-layer');
    const colors = ['#ff4f9a', '#ffd23f', '#3ddc97', '#4cc9f0', '#7c4dff', '#ff9f1c'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = pick(colors);
      c.style.setProperty('--dx', `${rand(-120, 120)}px`);
      c.style.setProperty('--rot', `${rand(360, 1080)}deg`);
      c.style.animationDuration = `${(Math.random() * 1.5 + 1.8).toFixed(2)}s`;
      c.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
      layer.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      s.textContent = pick(['⭐', '✨', '🌟']);
      s.style.left = '50vw';
      s.style.top = '45vh';
      const angle = (i / 12) * Math.PI * 2;
      s.style.setProperty('--dx', `${Math.cos(angle) * 220}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * 220}px`);
      layer.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }
  function rain() {
    const layer = $('#fx-layer');
    for (let i = 0; i < 24; i++) {
      const d = document.createElement('div');
      d.className = 'drop';
      d.textContent = '💧';
      d.style.left = `${Math.random() * 100}vw`;
      d.style.animationDuration = `${(Math.random() * 1 + 1.4).toFixed(2)}s`;
      d.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
      layer.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }

  // ---------- Sounds (generated with Web Audio, no files needed) ----------
  let audioCtx = null;
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { audioCtx = null; }
  }
  function tone(freq, start, dur, type, vol, endFreq) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.linearRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function playSuccess() {
    if (!state.sound) return;
    unlockAudio();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle', 0.3));
    tone(1318.5, 0.46, 0.6, 'sine', 0.2);
    tone(1567.98, 0.56, 0.6, 'sine', 0.15);
  }
  function playFail() {
    if (!state.sound) return;
    unlockAudio();
    // "Wah wah wah waaah" sad trombone
    [392, 370, 349.2].forEach((f, i) => tone(f, i * 0.32, 0.3, 'sawtooth', 0.09));
    tone(330, 0.96, 0.8, 'sawtooth', 0.09, 260);
  }

  $('#year').textContent = new Date().getFullYear();
})();
