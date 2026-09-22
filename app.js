'use strict';

const SCRIPT_BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbxEW2S4suAd_LTKgpkjlCYVDRHzDHTV3TDJhGZ0ND3g6ddmtZBNHqnssibTWogBCIwv/exec';
const GITHUB_ORIGIN = 'https://marxb50.github.io';

const UNIDADES = {
  Segunda: [
    'UBS VALE DO SOL', 'UBS NOVA ESPERANÇA', 'UPA NOVA ESPERANÇA', 'CENTRO DE ZOONOZES',
    'UBS CAJUPIRANGA', 'UBS PIUM', 'UBS PIRANGI', 'HOSPITAL DE PIRANGI',
    'UBS EMAÚS', 'UBS PARQUE DAS ORQUÍDEAS', 'UBS PARQUE INDUSTRIAL', 'MATERNIDADE DIVINO AMOR',
    'CEMITÉRIO PARQUE', 'CEMITÉRIO SANTA TEREZINHA', 'CEMITÉRIO MONTE CASTELO', 'CEMITÉRIO PIRANGI'
  ],
  Quarta: [
    'UPA NOVA ESPERANÇA', 'UBS SANTA JÚLIA', 'UBS SANTA TEREZA', 'UBS BELA PARNAMIRIM',
    'UBS PASSAGEM DE AREIA II', 'UBS PASSAGEM DE AREIA I', 'UBS MONTE CASTELO I E II',
    'UBS JOCKEY CLUB', 'UBS VIDA NOVA', 'BER', 'UBS PARQUE DE EXPOSIÇÕES', 'MATERNIDADE DIVINO AMOR',
    'CCPAR', 'CEPETUC', 'UBS CENTRO', 'UBS BOA ESPERANÇA', 'UBS JARDIM PLANALTO', 'UBS PRIMAVERA',
    'UBS LIBERDADE', 'UBS COOPHAB', 'UBS JOÃO DIAS',
    'CEMITÉRIO PARQUE', 'CEMITÉRIO SANTA TEREZINHA', 'CEMITÉRIO MONTE CASTELO', 'CEMITÉRIO PIRANGI'
  ],
  Sexta: [
    'UPA NOVA ESPERANÇA', 'UBS ROSA DOS VENTOS', 'UBS SANTOS REIS', 'CEO',
    'UBS SAE', 'UBS COHABINAL', 'CCPAR', 'CEPETUC', 'UBS CIDADE VERDE', 'UBS SUZETE CAVALCANTE',
    'MATERNIDADE DIVINO AMOR', 'HOSPITAL DE PIRANGI',
    'CEMITÉRIO PARQUE', 'CEMITÉRIO SANTA TEREZINHA', 'CEMITÉRIO MONTE CASTELO', 'CEMITÉRIO PIRANGI'
  ]
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const state = {
  selectedYear: 2026,
  selectedMonth: 'Janeiro',
  selectedDay: null,
  datas: [],
  statuses: {},
  observacoes: {},
  activeDateIndex: 0,
  autoSaveTimer: null,
  autoSaveInFlight: false,
  pendingSaveAfterFlight: false,
  demoMode: new URLSearchParams(window.location.search).get('demo') === '1'
};

const bridge = {
  frame: null,
  ready: false,
  origin: null,
  remoteWindow: null,
  session: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  nextId: 1,
  pending: new Map(),
  waiters: [],

  init() {
    if (state.demoMode) {
      this.ready = true;
      setSystemNote('Modo de demonstração: os dados exibidos são fictícios.');
      return;
    }

    if (!SCRIPT_BRIDGE_URL.startsWith('https://script.google.com/')) {
      setSystemNote('A conexão com o banco ainda está sendo finalizada.');
      return;
    }

    this.frame = document.getElementById('bridgeFrame');
    window.addEventListener('message', event => this.handleMessage(event));
    const bridgeUrl = new URL(SCRIPT_BRIDGE_URL);
    bridgeUrl.searchParams.set('bridge', '1');
    bridgeUrl.searchParams.set('bridgeSession', this.session);
    this.frame.src = bridgeUrl.toString();
    setSystemNote('Conectando ao banco de dados...');
  },

  handleMessage(event) {
    if (!this.frame) return;
    let sender;
    try { sender = new URL(event.origin); } catch (error) { return; }
    const trustedGoogleHost = sender.hostname === 'script.google.com' || sender.hostname.endsWith('.googleusercontent.com');
    if (sender.protocol !== 'https:' || !trustedGoogleHost) return;
    if (!event.data || event.data.selimHospitalarBridge !== true) return;
    if (event.data.session !== this.session) return;

    this.origin = event.origin;
    this.remoteWindow = event.source;

    if (event.data.type === 'ready') {
      this.ready = true;
      setSystemNote('Conectado ao banco de dados do SELIM.');
      this.waiters.splice(0).forEach(resolve => resolve());
      return;
    }

    const pending = this.pending.get(event.data.id);
    if (!pending) return;

    this.pending.delete(event.data.id);
    clearTimeout(pending.timer);

    if (event.data.error) {
      pending.reject(new Error(event.data.error));
    } else {
      pending.resolve(event.data.result);
    }
  },

  async waitUntilReady() {
    if (this.ready) return;
    if (!this.frame) throw new Error('A conexão com o banco ainda não foi configurada.');

    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('O banco demorou para responder. Tente novamente.')), 45000);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  },

  async call(method, args = []) {
    if (state.demoMode) return demoCall(method, args);
    await this.waitUntilReady();

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('A operação demorou para responder. Tente novamente.'));
      }, 90000);

      this.pending.set(id, { resolve, reject, timer });
      this.remoteWindow.postMessage({
        selimHospitalarBridge: true,
        session: this.session,
        id,
        method,
        args
      }, this.origin);
    });
  }
};

function init() {
  renderYears();
  renderMonths();
  bindHomeEvents();
  bindEditorEvents();
  bindReportEvents();
  bridge.init();
}

function renderYears() {
  const container = document.getElementById('yearSelector');
  container.innerHTML = '';
  [2026, 2025].forEach(year => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `year-btn${year === state.selectedYear ? ' active' : ''}`;
    button.textContent = String(year);
    button.setAttribute('aria-pressed', String(year === state.selectedYear));
    button.addEventListener('click', () => setYear(year));
    container.appendChild(button);
  });
}

function renderMonths() {
  const grid = document.getElementById('monthsGrid');
  grid.innerHTML = '';
  MONTHS.forEach(month => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `month-btn${month === state.selectedMonth ? ' active' : ''}`;
    button.textContent = month;
    button.setAttribute('aria-pressed', String(month === state.selectedMonth));
    button.addEventListener('click', () => {
      state.selectedMonth = month;
      renderMonths();
    });
    grid.appendChild(button);
  });
}

function bindHomeEvents() {
  document.querySelectorAll('.day-btn').forEach(button => {
    button.addEventListener('click', async () => {
      document.querySelectorAll('.day-btn').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      state.selectedDay = button.dataset.day;
      await loadDataAndOpenEditor();
    });
  });

  document.getElementById('btnViewReport').addEventListener('click', () => runHomeAction('report'));
  document.getElementById('btnGeneralReport').addEventListener('click', openGeneralReport);
  document.getElementById('btnPdfHome').addEventListener('click', () => runHomeAction('pdf'));
  document.getElementById('btnDocHome').addEventListener('click', () => runHomeAction('doc'));
}

function bindEditorEvents() {
  document.getElementById('btnCloseEditor').addEventListener('click', closeEditor);
  document.getElementById('btnSalvarEditor').addEventListener('click', saveManually);
  document.getElementById('obsTextarea').addEventListener('input', event => {
    const currentDate = getActiveDate();
    if (!currentDate) return;
    state.observacoes[currentDate] = event.target.value;
    queueAutoSave('Salvando observação...');
  });
}

function bindReportEvents() {
  document.getElementById('btnCloseReport').addEventListener('click', closeReport);
  document.getElementById('btnPdfReport').addEventListener('click', () => generateFile('pdf'));
  document.getElementById('btnDocReport').addEventListener('click', () => generateFile('doc'));
  document.getElementById('btnCloseGeneral').addEventListener('click', () => setOverlay('generalOverlay', false));
  document.getElementById('btnPrintGeneral').addEventListener('click', () => window.print());
}

function setYear(year) {
  state.selectedYear = year;
  renderYears();
}

function validateSelection() {
  if (state.selectedDay) return true;
  showToast('Selecione primeiro o dia da coleta.');
  document.querySelector('.days-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

function setLoading(show, text = 'Carregando dados...') {
  const box = document.getElementById('loadingBox');
  box.classList.toggle('visible', show);
  document.getElementById('loadingText').textContent = text;
  document.querySelectorAll('.action-btn, .year-btn, .month-btn, .day-btn').forEach(button => {
    button.disabled = show;
  });
}

async function fetchCurrentData() {
  const result = await bridge.call('getDadosSalvos', [state.selectedMonth, state.selectedDay, state.selectedYear]);
  if (!result || result.error) throw new Error(result && result.error ? result.error : 'Erro ao carregar dados.');
  applyLoadedData(result);
  return result;
}

function applyLoadedData(result) {
  state.datas = Array.isArray(result.datas) ? result.datas : [];
  state.statuses = result.statuses || {};
  state.observacoes = result.observacoes || {};
  state.activeDateIndex = 0;
}

async function loadDataAndOpenEditor() {
  if (!validateSelection()) return;
  try {
    setLoading(true, 'Carregando dados do banco central...');
    await fetchCurrentData();
    openEditor();
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar os dados.');
  } finally {
    setLoading(false);
  }
}

async function runHomeAction(action) {
  if (!validateSelection()) return;
  try {
    setLoading(true, action === 'report' ? 'Montando o relatório...' : 'Preparando o arquivo...');
    await fetchCurrentData();
    if (action === 'report') {
      await openReport();
    } else {
      await generateFile(action);
    }
  } catch (error) {
    showToast(error.message || 'Não foi possível concluir a operação.');
  } finally {
    setLoading(false);
  }
}

function openEditor() {
  document.getElementById('editorTitle').textContent = `${state.selectedDay} • ${state.selectedMonth}`;
  document.getElementById('editorSubtitle').textContent = `Ano ${state.selectedYear}`;
  setAutosaveStatus('Dados carregados do banco central');
  setOverlay('editorOverlay', true);
  renderDatesStrip();
  renderUnitList();
  renderObservation();
}

function closeEditor() {
  setOverlay('editorOverlay', false);
}

function setOverlay(id, open) {
  const overlay = document.getElementById(id);
  overlay.classList.toggle('open', open);
  overlay.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) overlay.querySelector('.icon-btn').focus();
}

function renderDatesStrip() {
  const strip = document.getElementById('datesStrip');
  strip.innerHTML = '';

  state.datas.forEach((date, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `date-chip${index === state.activeDateIndex ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(index === state.activeDateIndex));
    button.setAttribute('aria-label', `Dia ${date}`);
    button.innerHTML = `<span class="day-num">${escapeHtml(date.split('/')[0])}</span><span class="day-label">${escapeHtml(date)}</span>`;
    button.addEventListener('click', () => {
      state.activeDateIndex = index;
      renderDatesStrip();
      renderUnitList();
      renderObservation();
    });
    strip.appendChild(button);
  });
}

function getActiveDate() {
  return state.datas[state.activeDateIndex] || state.datas[0] || null;
}

function renderUnitList() {
  const container = document.getElementById('unitList');
  container.innerHTML = '';
  const date = getActiveDate();
  if (!date) return;

  (UNIDADES[state.selectedDay] || []).forEach(unit => {
    if (!state.statuses[unit]) state.statuses[unit] = Array(state.datas.length).fill('');
    const currentStatus = state.statuses[unit][state.activeDateIndex] || '';

    const card = document.createElement('div');
    card.className = 'unit-card';

    const name = document.createElement('div');
    name.className = 'unit-name';
    name.textContent = unit;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'status-main-btn';
    button.textContent = currentStatus || '—';
    button.setAttribute('aria-label', `${unit}: ${statusLabel(currentStatus)}. Toque para alterar.`);
    if (currentStatus === 'S') button.classList.add('st-s');
    if (currentStatus === 'N') button.classList.add('st-n');
    button.addEventListener('click', () => toggleStatus(unit, state.activeDateIndex));

    card.append(name, button);
    container.appendChild(card);
  });
}

function toggleStatus(unit, index) {
  if (!state.statuses[unit]) state.statuses[unit] = Array(state.datas.length).fill('');
  const current = state.statuses[unit][index] || '';
  state.statuses[unit][index] = current === '' ? 'S' : current === 'S' ? 'N' : '';
  renderUnitList();
  queueAutoSave('Salvando alteração...');
}

function renderObservation() {
  const date = getActiveDate();
  document.getElementById('obsDateTag').textContent = date ? `Dia ${date}` : 'Dia';
  document.getElementById('obsTextarea').value = date ? (state.observacoes[date] || '') : '';
}

function getPayload() {
  return {
    monthName: state.selectedMonth,
    dayName: state.selectedDay,
    year: state.selectedYear,
    datas: state.datas,
    statuses: state.statuses,
    observacoes: state.observacoes
  };
}

function setAutosaveStatus(text) {
  document.getElementById('autosaveStatus').textContent = text;
}

function queueAutoSave(text) {
  setAutosaveStatus(text || 'Alteração pendente');
  window.clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = window.setTimeout(runAutoSave, 900);
}

async function runAutoSave() {
  if (state.demoMode) {
    setAutosaveStatus('Demonstração: alteração mantida apenas nesta tela');
    return;
  }
  if (state.autoSaveInFlight) {
    state.pendingSaveAfterFlight = true;
    return;
  }

  state.autoSaveInFlight = true;
  const button = document.getElementById('btnSalvarEditor');
  button.disabled = true;
  setAutosaveStatus('Salvando no banco central...');

  try {
    const result = await bridge.call('salvarTudo', [getPayload()]);
    if (!result || result.error) throw new Error(result && result.error ? result.error : 'Erro ao salvar.');
    setAutosaveStatus(`Salvo no banco às ${result.savedAt || 'agora'}`);
  } catch (error) {
    setAutosaveStatus('Erro ao salvar');
    showToast(error.message || 'Falha no salvamento automático.');
  } finally {
    state.autoSaveInFlight = false;
    button.disabled = false;
    if (state.pendingSaveAfterFlight) {
      state.pendingSaveAfterFlight = false;
      runAutoSave();
    }
  }
}

async function saveManually() {
  window.clearTimeout(state.autoSaveTimer);
  if (state.demoMode) {
    setAutosaveStatus('Demonstração: alteração mantida apenas nesta tela');
    showToast('No modo de demonstração os dados não são enviados.');
    return;
  }

  const button = document.getElementById('btnSalvarEditor');
  button.disabled = true;
  setAutosaveStatus('Salvando manualmente...');
  try {
    const result = await bridge.call('salvarTudo', [getPayload()]);
    if (!result || result.error) throw new Error(result && result.error ? result.error : 'Erro ao salvar.');
    setAutosaveStatus(`Salvo no banco às ${result.savedAt || 'agora'}`);
    showToast('Dados salvos no banco central.');
  } catch (error) {
    setAutosaveStatus('Erro ao salvar');
    showToast(error.message || 'Falha ao salvar.');
  } finally {
    button.disabled = false;
  }
}

async function openReport() {
  renderReport();
  setOverlay('reportOverlay', true);
  await loadComparison();
}

function closeReport() {
  setOverlay('reportOverlay', false);
}

function calculateSummary(datas, statuses) {
  const units = Object.keys(statuses || {});
  const daily = datas.map((date, index) => {
    let collected = 0;
    let missed = 0;
    let blank = 0;
    units.forEach(unit => {
      const value = (statuses[unit] || [])[index] || '';
      if (value === 'S') collected += 1;
      else if (value === 'N') missed += 1;
      else blank += 1;
    });
    return { date, collected, missed, blank };
  });

  const collected = daily.reduce((sum, item) => sum + item.collected, 0);
  const missed = daily.reduce((sum, item) => sum + item.missed, 0);
  const blank = daily.reduce((sum, item) => sum + item.blank, 0);
  const answered = collected + missed;
  const total = answered + blank;
  const rate = answered ? Math.round((collected / answered) * 1000) / 10 : 0;
  return { collected, missed, blank, answered, total, rate, daily };
}

function emptySummary() {
  return { collected: 0, missed: 0, blank: 0, answered: 0, total: 0, rate: 0 };
}

function mergeSummary(target, summary) {
  target.collected += summary.collected;
  target.missed += summary.missed;
  target.blank += summary.blank;
  target.answered += summary.answered;
  target.total += summary.total;
  target.rate = target.answered ? Math.round(target.collected / target.answered * 1000) / 10 : 0;
  return target;
}

function previousMonth(monthName, year) {
  const index = MONTHS.indexOf(monthName);
  return index === 0
    ? { monthName: MONTHS[11], year: Number(year) - 1 }
    : { monthName: MONTHS[index - 1], year: Number(year) };
}

async function fetchMonthlyGroups(monthName, year) {
  const days = ['Segunda', 'Quarta', 'Sexta'];
  const results = await Promise.all(days.map(day => bridge.call('getDadosSalvos', [monthName, day, year])));
  return results.map((data, index) => {
    if (!data || data.error) throw new Error(data && data.error ? data.error : 'Erro ao carregar o relatório geral.');
    return { day: days[index], data, summary: calculateSummary(data.datas || [], data.statuses || {}) };
  });
}

async function openGeneralReport() {
  const monthName = state.selectedMonth;
  const year = state.selectedYear;
  try {
    setLoading(true, 'Reunindo as coletas do mês...');
    const groups = await fetchMonthlyGroups(monthName, year);
    const previous = previousMonth(monthName, year);
    let previousGroups = null;
    try {
      previousGroups = await fetchMonthlyGroups(previous.monthName, previous.year);
    } catch (error) {
      // O relatório do mês atual continua disponível se o comparativo falhar.
    }
    renderGeneralReport(groups, previousGroups, monthName, year, previous);
    setOverlay('generalOverlay', true);
  } catch (error) {
    showToast(error.message || 'Não foi possível gerar o relatório geral.');
  } finally {
    setLoading(false);
  }
}

function reportRate(summary) {
  return summary.answered ? `${formatNumber(summary.rate)}%` : '—';
}

function renderGeneralReport(groups, previousGroups, monthName, year, previous) {
  const total = groups.reduce((sum, group) => mergeSummary(sum, group.summary), emptySummary());
  const previousTotal = previousGroups
    ? previousGroups.reduce((sum, group) => mergeSummary(sum, group.summary), emptySummary())
    : null;
  document.getElementById('generalTitle').textContent = `Relatório geral • ${monthName}`;
  document.getElementById('generalSubtitle').textContent = `Ano ${year} • todos os dias de coleta`;
  document.getElementById('generalPrintTitle').textContent = `Relatório geral — ${monthName} de ${year}`;

  const metrics = [
    ['Coletados', total.collected, 'metric-good'],
    ['Não coletados', total.missed, 'metric-bad'],
    ['Sem resposta', total.blank, 'metric-neutral'],
    ['Taxa de coleta', reportRate(total), 'metric-rate'],
    ['Coletas previstas', total.total, 'metric-neutral'],
    ['Registros respondidos', total.answered, 'metric-good'],
    ['Datas de coleta', groups.reduce((sum, group) => sum + group.data.datas.length, 0), 'metric-rate']
  ];
  document.getElementById('generalMetrics').innerHTML = metrics.map(([label, value, className]) => `
    <article class="metric-card ${className}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(String(value))}</strong></article>
  `).join('');

  const comparison = document.getElementById('generalComparison');
  if (!previousTotal || !previousTotal.answered || !total.answered) {
    comparison.textContent = `Sem dados suficientes para comparar com ${previous.monthName} de ${previous.year}.`;
  } else {
    const delta = Math.round((total.rate - previousTotal.rate) * 10) / 10;
    const sign = delta > 0 ? '+' : '';
    comparison.innerHTML = `
      <span class="comparison-number">${sign}${formatNumber(delta)} p.p.</span>
      <span>${previous.monthName} de ${previous.year}: ${formatNumber(previousTotal.rate)}% • ${previousTotal.collected} coletados • ${previousTotal.missed} não coletados</span>
    `;
  }

  const denominator = total.total || 1;
  const collectedEnd = total.collected / denominator * 100;
  const missedEnd = collectedEnd + total.missed / denominator * 100;
  document.getElementById('generalDonut').innerHTML = `
    <div class="donut" style="background:conic-gradient(var(--green) 0 ${collectedEnd}%, var(--red) ${collectedEnd}% ${missedEnd}%, #dbe5ef ${missedEnd}% 100%)" role="img" aria-label="${total.collected} coletados, ${total.missed} não coletados e ${total.blank} sem resposta">
      <div class="donut-center"><strong>${reportRate(total)}</strong><span>taxa de coleta</span></div>
    </div>`;
  document.getElementById('generalDonutLegend').innerHTML = `
    <span><i class="legend-dot legend-yes"></i>Coletado: ${total.collected}</span>
    <span><i class="legend-dot legend-no"></i>Não coletado: ${total.missed}</span>
    <span><i class="legend-dot" style="background:#dbe5ef"></i>Sem resposta: ${total.blank}</span>`;

  const maxValue = Math.max(1, ...groups.flatMap(group => [group.summary.collected, group.summary.missed]));
  document.getElementById('generalWeekdayChart').innerHTML = groups.map(group => {
    const yesHeight = Math.max(2, Math.round(group.summary.collected / maxValue * 180));
    const noHeight = Math.max(2, Math.round(group.summary.missed / maxValue * 180));
    return `<div class="bar-group" aria-label="${group.day}: ${group.summary.collected} coletados e ${group.summary.missed} não coletados">
      <div class="bar bar-yes" style="height:${yesHeight}px"><span class="bar-value">${group.summary.collected}</span></div>
      <div class="bar bar-no" style="height:${noHeight}px"><span class="bar-value">${group.summary.missed}</span></div>
      <span class="bar-label">${group.day}</span>
    </div>`;
  }).join('');

  const cells = summary => `<td>${summary.total}</td><td>${summary.collected}</td><td>${summary.missed}</td><td>${summary.blank}</td><td>${reportRate(summary)}</td>`;
  document.getElementById('generalWeekdayRows').innerHTML = groups.map(group => `
    <tr><th scope="row">${group.day}</th><td>${group.data.datas.length}</td>${cells(group.summary)}</tr>
  `).join('') + `<tr class="total-row"><th scope="row">Total</th><td>${groups.reduce((sum, group) => sum + group.data.datas.length, 0)}</td>${cells(total)}</tr>`;

  const daily = groups.flatMap(group => group.summary.daily.map(item => ({ day: group.day, ...item })));
  daily.sort((a, b) => Number(a.date.slice(0, 2)) - Number(b.date.slice(0, 2)));
  document.getElementById('generalDailyRows').innerHTML = daily.map(item => {
    const summary = mergeSummary(emptySummary(), { collected: item.collected, missed: item.missed, blank: item.blank, answered: item.collected + item.missed, total: item.collected + item.missed + item.blank });
    return `<tr><th scope="row">${item.day} ${escapeHtml(item.date)}</th>${cells(summary)}</tr>`;
  }).join('');

  const units = new Map();
  groups.forEach(group => {
    (group.data.unidades || UNIDADES[group.day]).forEach(unit => {
      if (!units.has(unit)) units.set(unit, emptySummary());
      const unitSummary = units.get(unit);
      (group.data.statuses[unit] || Array(group.data.datas.length).fill('')).forEach(value => {
        if (value === 'S') unitSummary.collected += 1;
        else if (value === 'N') unitSummary.missed += 1;
        else unitSummary.blank += 1;
      });
      unitSummary.answered = unitSummary.collected + unitSummary.missed;
      unitSummary.total = unitSummary.answered + unitSummary.blank;
      unitSummary.rate = unitSummary.answered ? Math.round(unitSummary.collected / unitSummary.answered * 1000) / 10 : 0;
    });
  });
  document.getElementById('generalUnitRows').innerHTML = [...units.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([unit, summary]) => `<tr><th scope="row">${escapeHtml(unit)}</th>${cells(summary)}</tr>`).join('');

  const observations = groups.flatMap(group => group.data.datas
    .filter(date => String(group.data.observacoes[date] || '').trim())
    .map(date => ({ day: group.day, date, text: group.data.observacoes[date] })));
  observations.sort((a, b) => Number(a.date.slice(0, 2)) - Number(b.date.slice(0, 2)));
  document.getElementById('generalObservations').innerHTML = observations.length
    ? observations.map(item => `<div class="observation-item"><strong>${item.day} ${escapeHtml(item.date)}</strong><span>${escapeHtml(item.text)}</span></div>`).join('')
    : '<div class="empty-state">Nenhuma observação registrada neste mês.</div>';
}

function renderReport() {
  const summary = calculateSummary(state.datas, state.statuses);
  document.getElementById('reportTitle').textContent = `${state.selectedDay} • ${state.selectedMonth}`;
  document.getElementById('reportSubtitle').textContent = `Ano ${state.selectedYear}`;
  renderMetrics(summary);
  renderDonut(summary);
  renderDailyBars(summary);
  renderReportTable();
  renderReportObservations();
  document.getElementById('comparisonResult').textContent = 'Calculando...';
}

function renderMetrics(summary) {
  const metrics = [
    { label: 'Coletado', value: summary.collected, className: 'metric-good' },
    { label: 'Não coletado', value: summary.missed, className: 'metric-bad' },
    { label: 'Sem resposta', value: summary.blank, className: 'metric-neutral' },
    { label: 'Taxa de coleta', value: `${formatNumber(summary.rate)}%`, className: 'metric-rate' }
  ];

  document.getElementById('metricsGrid').innerHTML = metrics.map(metric => `
    <article class="metric-card ${metric.className}">
      <span class="metric-label">${escapeHtml(metric.label)}</span>
      <strong class="metric-value">${escapeHtml(String(metric.value))}</strong>
    </article>
  `).join('');
}

function renderDonut(summary) {
  const denominator = summary.total || 1;
  const collectedEnd = (summary.collected / denominator) * 100;
  const missedEnd = collectedEnd + (summary.missed / denominator) * 100;
  const background = `conic-gradient(var(--green) 0 ${collectedEnd}%, var(--red) ${collectedEnd}% ${missedEnd}%, #dbe5ef ${missedEnd}% 100%)`;

  document.getElementById('donutChart').innerHTML = `
    <div class="donut" style="background:${background}" role="img" aria-label="${summary.collected} coletados, ${summary.missed} não coletados e ${summary.blank} sem resposta">
      <div class="donut-center"><strong>${formatNumber(summary.rate)}%</strong><span>taxa de coleta</span></div>
    </div>
  `;
  document.getElementById('donutLegend').innerHTML = `
    <span><i class="legend-dot legend-yes"></i>Coletado: ${summary.collected}</span>
    <span><i class="legend-dot legend-no"></i>Não coletado: ${summary.missed}</span>
    <span><i class="legend-dot" style="background:#dbe5ef"></i>Sem resposta: ${summary.blank}</span>
  `;
}

function renderDailyBars(summary) {
  const chart = document.getElementById('dailyChart');
  const maxValue = Math.max(1, ...summary.daily.flatMap(item => [item.collected, item.missed]));
  chart.innerHTML = summary.daily.map(item => {
    const collectedHeight = Math.max(2, Math.round((item.collected / maxValue) * 180));
    const missedHeight = Math.max(2, Math.round((item.missed / maxValue) * 180));
    return `
      <div class="bar-group" aria-label="${escapeHtml(item.date)}: ${item.collected} coletados e ${item.missed} não coletados">
        <div class="bar bar-yes" style="height:${collectedHeight}px"><span class="bar-value">${item.collected}</span></div>
        <div class="bar bar-no" style="height:${missedHeight}px"><span class="bar-value">${item.missed}</span></div>
        <span class="bar-label">${escapeHtml(item.date)}</span>
      </div>
    `;
  }).join('');
}

function renderReportTable() {
  document.getElementById('reportTableHead').innerHTML = `<tr><th>Unidade de saúde</th>${state.datas.map(date => `<th>${escapeHtml(date)}</th>`).join('')}</tr>`;
  document.getElementById('reportTableBody').innerHTML = (UNIDADES[state.selectedDay] || []).map(unit => {
    const values = state.statuses[unit] || Array(state.datas.length).fill('');
    const cells = state.datas.map((_, index) => {
      const value = values[index] || '';
      const className = value === 'S' ? 'status-cell-s' : value === 'N' ? 'status-cell-n' : '';
      return `<td class="${className}">${escapeHtml(statusShortLabel(value))}</td>`;
    }).join('');
    return `<tr><td>${escapeHtml(unit)}</td>${cells}</tr>`;
  }).join('');
}

function renderReportObservations() {
  const items = state.datas
    .filter(date => String(state.observacoes[date] || '').trim())
    .map(date => `<div class="observation-item"><strong>${escapeHtml(date)}</strong><span>${escapeHtml(state.observacoes[date])}</span></div>`);
  document.getElementById('reportObservations').innerHTML = items.length
    ? items.join('')
    : '<div class="empty-state">Nenhuma observação registrada neste período.</div>';
}

async function loadComparison() {
  try {
    const result = await bridge.call('getResumoComparativo', [state.selectedMonth, state.selectedDay, state.selectedYear]);
    if (!result || result.error) throw new Error(result && result.error ? result.error : 'Comparativo indisponível.');
    renderComparison(result);
  } catch (error) {
    document.getElementById('comparisonResult').textContent = 'Comparativo indisponível no momento.';
  }
}

function renderComparison(result) {
  const current = Number(result.atual && result.atual.taxa || 0);
  const previous = Number(result.anterior && result.anterior.taxa || 0);
  const delta = Math.round((current - previous) * 10) / 10;
  const sign = delta > 0 ? '+' : '';
  const direction = delta > 0 ? 'melhora' : delta < 0 ? 'queda' : 'estável';
  document.getElementById('comparisonResult').innerHTML = `
    <span class="comparison-number">${sign}${formatNumber(delta)} p.p.</span>
    <span>${direction} • mês anterior: ${formatNumber(previous)}%</span>
  `;
}

async function generateFile(type) {
  if (state.demoMode) {
    showToast('A geração de arquivos fica disponível depois da publicação.');
    return;
  }
  const method = type === 'pdf' ? 'gerarRelatorioPDF' : 'gerarRelatorioDoc';
  const buttons = type === 'pdf'
    ? document.querySelectorAll('#btnPdfHome, #btnPdfReport')
    : document.querySelectorAll('#btnDocHome, #btnDocReport');
  buttons.forEach(button => { button.disabled = true; });

  try {
    showToast(type === 'pdf' ? 'Gerando PDF...' : 'Gerando DOC...');
    const result = await bridge.call(method, [getPayload()]);
    if (!result || result.error) throw new Error(result && result.error ? result.error : 'Erro ao gerar arquivo.');
    const url = type === 'pdf' ? result.pdfUrl : result.docUrl;
    showToast(type === 'pdf' ? 'PDF gerado com sucesso.' : 'DOC gerado com sucesso.');
    if (url) window.open(url, '_blank', 'noopener');
  } catch (error) {
    showToast(error.message || 'Não foi possível gerar o arquivo.');
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function statusLabel(value) {
  if (value === 'S') return 'coletado';
  if (value === 'N') return 'não coletado';
  return 'sem resposta';
}

function statusShortLabel(value) {
  if (value === 'S') return 'Coletado';
  if (value === 'N') return 'Não coletado';
  return '—';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(window.__toastTimer);
  window.__toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setSystemNote(message) {
  document.getElementById('systemNote').textContent = message;
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function demoCall(method, args) {
  if (method === 'getDadosSalvos') return Promise.resolve(buildDemoData(args[0], args[1], args[2]));
  if (method === 'getResumoComparativo') {
    const current = buildDemoData(args[0], args[1], args[2]);
    const currentSummary = calculateSummary(current.datas, current.statuses);
    return Promise.resolve({
      success: true,
      atual: { taxa: currentSummary.rate },
      anterior: { taxa: Math.max(0, currentSummary.rate - 6.4) }
    });
  }
  if (method === 'salvarTudo') return Promise.resolve({ success: true, savedAt: 'agora' });
  return Promise.resolve({ error: 'Recurso indisponível na demonstração.' });
}

function buildDemoData(monthName, dayName, year) {
  const month = MONTHS.indexOf(monthName);
  const weekday = { Segunda: 1, Quarta: 3, Sexta: 5 }[dayName];
  const dates = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    if (date.getDay() === weekday) dates.push(`${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`);
  }

  const statuses = {};
  (UNIDADES[dayName] || []).forEach((unit, unitIndex) => {
    statuses[unit] = dates.map((_, dateIndex) => {
      const seed = (unitIndex * 7 + dateIndex * 3 + month) % 13;
      if (seed === 0 || seed === 8) return 'N';
      if (seed === 4) return '';
      return 'S';
    });
  });

  const observations = {};
  dates.forEach((date, index) => {
    observations[date] = index === 1 ? 'Acesso à unidade normalizado após contato com a equipe.' : '';
  });
  return { success: true, datas: dates, unidades: UNIDADES[dayName] || [], statuses, observacoes: observations, year };
}

init();
