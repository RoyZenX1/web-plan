(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = reduceMotion ? 'auto' : 'smooth';

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('empieza-a-tiempo:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('empieza-a-tiempo:' + key, JSON.stringify(value));
      } catch (_) { /* almacenamiento no disponible: la página sigue funcionando */ }
    }
  };

  /* ---------- Luz del cristal que sigue al cursor ---------- */
  document.addEventListener('pointermove', (e) => {
    const glass = e.target.closest && e.target.closest('.glass');
    if (!glass) return;
    const rect = glass.getBoundingClientRect();
    glass.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
    glass.style.setProperty('--my', (e.clientY - rect.top) + 'px');
  }, { passive: true });

  /* ---------- Navegación ---------- */
  const nav = $('#nav');
  const menuBtn = $('#menuBtn');

  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  // Enlace activo según la sección visible
  const spyLinks = $$('[data-spy]');
  const spyMap = new Map(spyLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach((l) => l.classList.remove('active'));
        const link = spyMap.get(entry.target.id);
        if (link) link.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', ...spyMap.keys()].forEach((id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ---------- Temporizador ---------- */
  const MODES = {
    2: {
      label: 'Regla de los 2 minutos',
      hint: 'Solo abre el archivo. Nada más.',
      done: '¡Ya arrancaste! Lo más difícil pasó. ¿Sigues con un bloque más largo?'
    },
    25: {
      label: 'Pomodoro de 25 minutos',
      hint: 'Un solo micro-paso. Silencia todo lo demás.',
      done: 'Bloque completo. Date algo pequeño y marca tu check.'
    },
    40: {
      label: 'Bloque de 40 minutos',
      hint: 'Presión controlada: trabaja como si lo entregaras mañana.',
      done: '40 minutos de trabajo real. Date 10 minutos de algo que te guste y anota qué tan difícil fue empezar.'
    }
  };

  const timerEl = $('.timer');
  const ringEl = $('.ring');
  const ringBar = $('#ringBar');
  const digits = $$('#time .d');
  const timeSr = $('#timeSr');
  const modeLabel = $('#modeLabel');
  const timerMsg = $('#timerMsg');
  const startBtn = $('#startBtn');
  const resetBtn = $('#resetBtn');
  const soundBtn = $('#soundBtn');
  const todayCount = $('#todayCount');
  const segBtns = $$('.seg-btn');

  const CIRC = 2 * Math.PI * 96;
  ringBar.style.strokeDasharray = CIRC.toFixed(2);
  const baseTitle = document.title;

  let minutes = 2;
  let totalMs = minutes * 60000;
  let remainingMs = totalMs;
  let endAt = 0;
  let running = false;
  let ticker = null;
  let soundOn = store.get('sound', true);

  function loadToday() {
    const key = new Date().toLocaleDateString('en-CA');
    const saved = store.get('today', null);
    return saved && saved.date === key ? saved : { date: key, n: 0 };
  }
  let today = loadToday();

  function formatTime(ms) {
    const secs = Math.ceil(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function paintTimer() {
    const text = formatTime(remainingMs);
    const chars = text.replace(':', '');
    digits.forEach((d, i) => { d.textContent = chars[i]; });
    timeSr.textContent = text;
    ringBar.style.strokeDashoffset = (CIRC * (1 - remainingMs / totalMs)).toFixed(2);
    document.title = running ? text + ' · ' + baseTitle : baseTitle;
  }

  function setRunningUi(on) {
    timerEl.classList.toggle('running', on);
    document.body.classList.toggle('running', on);
  }

  function paintSound() {
    soundBtn.textContent = soundOn ? 'Sonido activado' : 'Sonido apagado';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }

  function beep() {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(880, t + 0.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.05);
      osc.onended = () => ctx.close();
    } catch (_) { /* sin audio disponible */ }
  }

  function setMode(min) {
    clearInterval(ticker);
    running = false;
    minutes = min;
    totalMs = min * 60000;
    remainingMs = totalMs;
    segBtns.forEach((b) => {
      const active = Number(b.dataset.minutes) === min;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    modeLabel.textContent = MODES[min].label;
    timerMsg.textContent = MODES[min].hint;
    startBtn.textContent = 'Empezar';
    ringEl.classList.remove('done');
    setRunningUi(false);
    paintTimer();
  }

  function tick() {
    remainingMs = Math.max(0, endAt - Date.now());
    paintTimer();
    if (remainingMs <= 0) finish();
  }

  function start() {
    if (running) return;
    if (remainingMs <= 0) remainingMs = totalMs;
    ringEl.classList.remove('done');
    timerMsg.textContent = MODES[minutes].hint;
    running = true;
    endAt = Date.now() + remainingMs;
    ticker = setInterval(tick, 200);
    startBtn.textContent = 'Pausar';
    setRunningUi(true);
    paintTimer();
  }

  function pause() {
    if (!running) return;
    clearInterval(ticker);
    remainingMs = Math.max(0, endAt - Date.now());
    running = false;
    startBtn.textContent = 'Continuar';
    setRunningUi(false);
    paintTimer();
  }

  function finish() {
    clearInterval(ticker);
    running = false;
    remainingMs = 0;
    startBtn.textContent = 'Empezar de nuevo';
    timerMsg.textContent = MODES[minutes].done;
    ringEl.classList.add('done');
    setRunningUi(false);
    paintTimer();
    beep();
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    today = loadToday();
    today.n += 1;
    store.set('today', today);
    todayCount.textContent = today.n;
  }

  startBtn.addEventListener('click', () => (running ? pause() : start()));
  resetBtn.addEventListener('click', () => setMode(minutes));
  segBtns.forEach((b) => b.addEventListener('click', () => setMode(Number(b.dataset.minutes))));
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    paintSound();
  });

  function startTwoMinutes() {
    setMenu(false);
    setMode(2);
    timerEl.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
    start();
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action="start2"]');
    if (trigger) startTwoMinutes();
  });

  todayCount.textContent = today.n;
  paintSound();
  setMode(2);

  /* ---------- Micro-pasos ---------- */
  const PRESETS = {
    estudios: {
      task: 'Estudiar para el parcial',
      steps: ['Abrir el PDF del tema', 'Leer solo el primer subtítulo', 'Subrayar 3 ideas clave', 'Resolver el primer ejercicio', 'Escribir un resumen de 3 líneas']
    },
    programacion: {
      task: 'Programar la función',
      steps: ['Crear el archivo', 'Escribir la firma de la función', 'Escribir un caso de prueba', 'Implementar el caso más simple', 'Ejecutar y ver qué falla']
    },
    trabajos: {
      task: 'Trabajo universitario',
      steps: ['Abrir el documento', 'Escribir el título', 'Listar los apartados principales', 'Redactar el primer párrafo', 'Agendar el siguiente bloque']
    }
  };

  const taskName = $('#taskName');
  const stepForm = $('#stepForm');
  const stepInput = $('#stepInput');
  const stepList = $('#stepList');
  const stepEmpty = $('#stepEmpty');
  const stepProgress = $('#stepProgress');
  const stepBar = $('#stepBar');
  const stepCount = $('#stepCount');
  const mpHint = $('#mpHint');
  const clearSteps = $('#clearSteps');

  function normalizeSteps(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return { task: '', items: [] };
    return {
      task: typeof value.task === 'string' ? value.task.slice(0, 80) : '',
      items: value.items
        .filter((i) => i && typeof i.text === 'string')
        .map((i) => ({ id: String(i.id || uid()), text: i.text.slice(0, 90), done: Boolean(i.done) }))
    };
  }

  let steps = normalizeSteps(store.get('steps', null));
  const saveSteps = () => store.set('steps', steps);

  function updateStepMeta() {
    const n = steps.items.length;
    const done = steps.items.filter((i) => i.done).length;
    stepEmpty.hidden = n > 0;
    stepProgress.hidden = n === 0;
    clearSteps.hidden = n === 0;
    stepBar.style.width = n ? (done / n * 100) + '%' : '0%';
    stepCount.textContent = done + '/' + n + (n && done === n ? ' · Completado' : '');

    if (n === 0) {
      mpHint.textContent = 'Ideal: 4–6 pasos';
      mpHint.dataset.state = '';
    } else if (n < 4) {
      mpHint.textContent = 'Añade más: ideal 4–6 pasos';
      mpHint.dataset.state = 'low';
    } else if (n <= 6) {
      mpHint.textContent = 'Buen tamaño: 4–6 pasos';
      mpHint.dataset.state = 'ok';
    } else {
      mpHint.textContent = 'Son muchos: agrúpalos en 6 o menos';
      mpHint.dataset.state = 'high';
    }
  }

  function renderSteps() {
    stepList.textContent = '';
    steps.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'step' + (item.done ? ' done' : '');
      li.dataset.id = item.id;

      const label = document.createElement('label');
      label.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      const box = document.createElement('span');
      box.className = 'box';
      box.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'step-text';
      text.textContent = item.text;
      label.append(cb, box, text);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn';
      del.setAttribute('aria-label', 'Eliminar paso: ' + item.text);
      del.textContent = '×';

      li.append(label, del);
      stepList.append(li);
    });
    updateStepMeta();
  }

  taskName.value = steps.task;
  taskName.addEventListener('input', () => {
    steps.task = taskName.value.slice(0, 80);
    saveSteps();
  });

  stepForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = stepInput.value.trim();
    if (!text) {
      stepInput.focus();
      return;
    }
    steps.items.push({ id: uid(), text: text.slice(0, 90), done: false });
    stepInput.value = '';
    saveSteps();
    renderSteps();
    stepInput.focus();
  });

  stepList.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const li = e.target.closest('.step');
    const item = steps.items.find((i) => i.id === li.dataset.id);
    if (!item) return;
    item.done = e.target.checked;
    li.classList.toggle('done', item.done);
    saveSteps();
    updateStepMeta();
  });

  stepList.addEventListener('click', (e) => {
    const del = e.target.closest('.icon-btn');
    if (!del) return;
    const li = del.closest('.step');
    steps.items = steps.items.filter((i) => i.id !== li.dataset.id);
    saveSteps();
    renderSteps();
    stepInput.focus();
  });

  clearSteps.addEventListener('click', () => {
    steps.items = [];
    saveSteps();
    renderSteps();
    stepInput.focus();
  });

  function loadPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    if (steps.items.length && !window.confirm('Esto reemplazará tu lista actual de micro-pasos. ¿Continuar?')) return;
    steps = {
      task: preset.task,
      items: preset.steps.map((text) => ({ id: uid(), text, done: false }))
    };
    taskName.value = steps.task;
    saveSteps();
    renderSteps();
    $('#micropasos').scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-preset]');
    if (chip) loadPreset(chip.dataset.preset);
  });

  renderSteps();

  /* ---------- Registro de arranque ---------- */
  const DAYS = 5;
  const dayList = $('#dayList');
  const trackSummary = $('#trackSummary');
  const trendMsg = $('#trendMsg');
  const resetTracker = $('#resetTracker');

  const emptyDays = () => Array.from({ length: DAYS }, () => ({ on: false, diff: null }));

  function normalizeDays(value) {
    if (!Array.isArray(value) || value.length !== DAYS) return emptyDays();
    return value.map((d) => ({
      on: Boolean(d && d.on),
      diff: d && Number.isInteger(d.diff) && d.diff >= 1 && d.diff <= 10 ? d.diff : null
    }));
  }

  let days = normalizeDays(store.get('days', null));
  const saveDays = () => store.set('days', days);

  function buildDays() {
    dayList.textContent = '';
    days.forEach((_, i) => {
      const li = document.createElement('li');
      li.className = 'day';
      li.dataset.i = String(i);
      li.innerHTML =
        '<div class="day-top">' +
          '<span class="day-name">Día ' + (i + 1) + '</span>' +
          '<button type="button" class="check-btn" aria-pressed="false">Empecé a tiempo</button>' +
        '</div>' +
        '<div class="day-diff">' +
          '<label for="diff' + i + '">Dificultad de empezar</label>' +
          '<input type="range" id="diff' + i + '" min="1" max="10" step="1" value="5">' +
          '<output for="diff' + i + '">–</output>' +
        '</div>';
      dayList.append(li);
    });
  }

  function paintDay(i) {
    const li = dayList.children[i];
    const d = days[i];
    const value = d.diff === null ? 5 : d.diff;
    const range = $('input[type="range"]', li);
    li.classList.toggle('is-on', d.on);
    li.classList.toggle('unset', d.diff === null);
    $('.check-btn', li).setAttribute('aria-pressed', String(d.on));
    range.value = String(value);
    range.style.setProperty('--pct', ((value - 1) / 9 * 100) + '%');
    $('output', li).textContent = d.diff === null ? '–' : String(d.diff);
  }

  function paintSummary() {
    const on = days.filter((d) => d.on).length;
    const diffs = days.map((d) => d.diff).filter((v) => v !== null);
    let best = 0;
    let run = 0;
    days.forEach((d) => {
      run = d.on ? run + 1 : 0;
      best = Math.max(best, run);
    });
    const avg = diffs.length
      ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toLocaleString('es', { maximumFractionDigits: 1 })
      : null;

    trackSummary.textContent =
      on + ' de ' + DAYS + ' días a tiempo · ' +
      (avg ? 'dificultad media ' + avg : 'sin dificultad registrada') +
      ' · mejor racha ' + best;

    if (diffs.length < 2) {
      trendMsg.textContent = 'Anota la dificultad de al menos dos días para ver tu tendencia.';
      return;
    }
    const first = diffs[0];
    const last = diffs[diffs.length - 1];
    const gap = Math.abs(first - last);
    if (last < first) {
      trendMsg.textContent = 'Empezar te cuesta ' + gap + (gap === 1 ? ' punto' : ' puntos') + ' menos que en tu primer registro. Tu cerebro ya lo asocia con algo más manejable.';
    } else if (last > first) {
      trendMsg.textContent = 'Hoy empezar cuesta ' + gap + (gap === 1 ? ' punto' : ' puntos') + ' más que al principio. Prueba con un primer micro-paso todavía más pequeño.';
    } else {
      trendMsg.textContent = 'La dificultad se mantiene igual. Prueba a reducir el primer micro-paso.';
    }
  }

  function paintAllDays() {
    days.forEach((_, i) => paintDay(i));
    paintSummary();
  }

  dayList.addEventListener('click', (e) => {
    const btn = e.target.closest('.check-btn');
    if (!btn) return;
    const i = Number(btn.closest('.day').dataset.i);
    days[i].on = !days[i].on;
    saveDays();
    paintDay(i);
    paintSummary();
  });

  // Marca la dificultad como registrada en cuanto se toca el control, incluso si se deja en 5
  dayList.addEventListener('pointerdown', (e) => {
    if (e.target.type !== 'range') return;
    const i = Number(e.target.closest('.day').dataset.i);
    if (days[i].diff === null) {
      days[i].diff = Number(e.target.value);
      saveDays();
      paintDay(i);
      paintSummary();
    }
  });

  dayList.addEventListener('input', (e) => {
    if (e.target.type !== 'range') return;
    const i = Number(e.target.closest('.day').dataset.i);
    days[i].diff = Number(e.target.value);
    saveDays();
    paintDay(i);
    paintSummary();
  });

  resetTracker.addEventListener('click', () => {
    if (days.some((d) => d.on || d.diff !== null) && !window.confirm('Se borrarán los 5 días del registro. ¿Continuar?')) return;
    days = emptyDays();
    saveDays();
    paintAllDays();
  });

  buildDays();
  paintAllDays();

  /* ---------- Plan semanal ---------- */
  const planBoxes = $$('[data-plan]');
  const planBar = $('#planBar');
  const planCount = $('#planCount');

  const savedPlan = store.get('plan', null);
  const plan = Array.isArray(savedPlan) && savedPlan.length === planBoxes.length
    ? savedPlan.map(Boolean)
    : planBoxes.map(() => false);

  function paintPlan() {
    const done = plan.filter(Boolean).length;
    planBar.style.width = (done / plan.length * 100) + '%';
    planCount.textContent = done + ' de ' + plan.length;
  }

  planBoxes.forEach((box, i) => {
    box.checked = plan[i];
    box.addEventListener('change', () => {
      plan[i] = box.checked;
      store.set('plan', plan);
      paintPlan();
    });
  });
  paintPlan();
})();
