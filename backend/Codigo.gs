const SPREADSHEET_ID_DADOS = '1BoZLO0qi0IUYG0o4Lk6Pg1wLV97OQD9vX5TBxTScUwI';

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

const MESES = {
  Janeiro: 1, Fevereiro: 2, Março: 3, Abril: 4, Maio: 5, Junho: 6,
  Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11, Dezembro: 12
};

const NOMES_MESES = Object.keys(MESES);

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  template.bridgeSession = e && e.parameter ? String(e.parameter.bridgeSession || '') : '';
  return template.evaluate()
    .setTitle('SELIM - Conexão de dados')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isStatusValue(value) {
  const status = String(value || '').trim().toUpperCase();
  return status === '' || status === 'S' || status === 'N';
}

function formatDateToDDMM(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM');
  }
  const text = String(value || '').trim();
  if (/^\d{2}\/\d{2}$/.test(text)) return text;
  let match = text.match(/^(\d{2}\/\d{2})_/);
  if (match) return match[1];
  match = text.match(/^\d{4}_(\d{2}\/\d{2})/);
  return match ? match[1] : '';
}

function extractYearFromAny(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    if (year >= 2000 && year <= 2100) return String(year);
  }
  const text = String(value || '').trim();
  if (/^\d{4}$/.test(text)) return text;
  const match = text.match(/^(\d{4})_/);
  return match ? match[1] : '';
}

function extractDateFromId(id) {
  const text = String(id || '').trim();
  let match = text.match(/^\d{4}_(\d{2}\/\d{2})_/);
  if (match) return match[1];
  match = text.match(/^(\d{2}\/\d{2})_/);
  if (match) return match[1];
  match = text.match(/^\d{4}_(\d{2}\/\d{2})$/);
  return match ? match[1] : '';
}

function extractYearFromId(id) {
  const match = String(id || '').trim().match(/^(\d{4})_/);
  return match ? match[1] : '';
}

function buildStatusId(year, date, unit) {
  return `${year}_${date}_${normalizeText(unit)}`;
}

function buildObsId(year, date) {
  return `${year}_${date}`;
}

function statusKey(year, date, unit) {
  return `${year}|${date}|${normalizeText(unit)}`;
}

function obsKey(year, date) {
  return `${year}|${date}`;
}

function abrirBanco() {
  return SpreadsheetApp.openById(SPREADSHEET_ID_DADOS);
}

function garantirAbas() {
  const db = abrirBanco();
  let statusSheet = db.getSheetByName('Status_Coleta');
  let obsSheet = db.getSheetByName('Observacoes_Diarias');
  let logSheet = db.getSheetByName('Log_Debug');

  if (!statusSheet) statusSheet = db.insertSheet('Status_Coleta');
  if (!obsSheet) obsSheet = db.insertSheet('Observacoes_Diarias');
  if (!logSheet) logSheet = db.insertSheet('Log_Debug');

  if (statusSheet.getLastRow() === 0) {
    statusSheet.getRange(1, 1, 1, 5).setValues([['ID', 'Ano', 'Data', 'Unidade', 'Status']]);
    statusSheet.setFrozenRows(1);
    statusSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  if (obsSheet.getLastRow() === 0) {
    obsSheet.getRange(1, 1, 1, 4).setValues([['ID', 'Ano', 'Data', 'Observacao']]);
    obsSheet.setFrozenRows(1);
    obsSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  if (logSheet.getLastRow() === 0) {
    logSheet.getRange(1, 1, 1, 6).setValues([['Quando', 'Acao', 'Detalhe', 'Ano', 'Mes', 'Dia']]);
    logSheet.setFrozenRows(1);
    logSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  SpreadsheetApp.flush();
  return { db, statusSheet, obsSheet, logSheet };
}

function escreverLog(action, detail, year, month, day) {
  try {
    const context = garantirAbas();
    context.logSheet.appendRow([
      new Date(), String(action || ''), String(detail || ''),
      String(year || ''), String(month || ''), String(day || '')
    ]);
    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log(`Falha ao escrever log: ${error.message}`);
  }
}

function parseStatusRow(row) {
  const first = String(row[0] || '').trim().toUpperCase();
  if (first === 'ID' || first === 'DATA' || first === 'UNIDADE' || first === 'STATUS' || first === '') return null;

  const id = String(row[0] || '').trim();
  let year = extractYearFromId(id) || extractYearFromAny(row[1]) || extractYearFromAny(row[2]);
  let date = extractDateFromId(id) || formatDateToDDMM(row[1]) || formatDateToDDMM(row[2]);
  const third = String(row[2] || '').trim();
  const fourth = String(row[3] || '').trim();
  const fifth = String(row[4] || '').trim();
  let unit = '';
  let status = '';

  if (!isStatusValue(third) && isStatusValue(fourth)) {
    unit = third;
    status = fourth.toUpperCase();
  }
  if (!unit && !isStatusValue(fourth) && isStatusValue(fifth)) {
    unit = fourth;
    status = fifth.toUpperCase();
  }
  if (!unit && !isStatusValue(fourth)) unit = fourth;
  if (!unit && !isStatusValue(third)) unit = third;
  if (!status && (fifth.toUpperCase() === 'S' || fifth.toUpperCase() === 'N')) status = fifth.toUpperCase();
  if (!status && (fourth.toUpperCase() === 'S' || fourth.toUpperCase() === 'N')) status = fourth.toUpperCase();
  if (!year || !date || !unit) return null;
  return { ano: String(year), data: String(date), unidade: unit, status };
}

function parseObsRow(row) {
  const first = String(row[0] || '').trim().toUpperCase();
  if (first === 'ID' || first === 'DATA' || first === 'OBSERVACAO' || first === 'OBSERVAÇÃO' || first === '') return null;

  if (row[0] instanceof Date || /^\d{2}\/\d{2}$/.test(String(row[0] || '').trim())) {
    const date = formatDateToDDMM(row[0]);
    // A cópia contém observações antigas sem ano: out-dez/2025 e jan-fev/2026.
    // Os registros novos usam ID com ano, portanto esta regra vale só para o legado.
    const month = Number(date.slice(3, 5));
    const legacyYear = month >= 10 ? '2025' : month <= 2 ? '2026' : '';
    const year = extractYearFromAny(row[0]) || legacyYear;
    if (date && year) return { ano: year, data: date, obs: String(row[1] || '') };
  }

  const id = String(row[0] || '').trim();
  const year = extractYearFromId(id) || extractYearFromAny(row[1]) || extractYearFromAny(row[2]);
  const date = extractDateFromId(id) || formatDateToDDMM(row[2]) || formatDateToDDMM(row[0]);
  return year && date ? { ano: String(year), data: String(date), obs: String(row[3] || '') } : null;
}

function gerarDatasDoMes(monthName, dayName, yearInput) {
  const year = parseInt(yearInput, 10);
  if (!MESES[monthName]) throw new Error(`Mês inválido: ${monthName}`);
  if (!UNIDADES[dayName]) throw new Error(`Dia inválido: ${dayName}`);

  const month = MESES[monthName];
  const targetWeekday = { Segunda: 1, Quarta: 3, Sexta: 5 }[dayName];
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === targetWeekday) {
      dates.push(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
  }
  return dates;
}

function getDadosSalvos(monthName, dayName, yearInput) {
  try {
    const year = parseInt(yearInput, 10) || 2026;
    const dates = gerarDatasDoMes(monthName, dayName, year);
    const units = UNIDADES[dayName] || [];
    const context = garantirAbas();
    const statusData = context.statusSheet.getDataRange().getValues();
    const obsData = context.obsSheet.getDataRange().getValues();
    const statuses = {};
    const statusByKey = {};
    const obsByKey = {};

    units.forEach(unit => { statuses[unit] = Array(dates.length).fill(''); });

    for (let index = 1; index < statusData.length; index += 1) {
      const parsed = parseStatusRow(statusData[index]);
      if (!parsed || parsed.ano !== String(year)) continue;
      const key = statusKey(parsed.ano, parsed.data, parsed.unidade);
      if (parsed.status === 'S' || parsed.status === 'N') statusByKey[key] = parsed.status;
      else if (statusByKey[key] === undefined) statusByKey[key] = '';
    }

    units.forEach(unit => {
      dates.forEach((date, index) => {
        const value = statusByKey[statusKey(year, date, unit)];
        if (value === 'S' || value === 'N') statuses[unit][index] = value;
      });
    });

    for (let index = 1; index < obsData.length; index += 1) {
      const parsed = parseObsRow(obsData[index]);
      if (!parsed || parsed.ano !== String(year)) continue;
      const key = obsKey(parsed.ano, parsed.data);
      if (String(parsed.obs || '').trim()) obsByKey[key] = parsed.obs;
      else if (obsByKey[key] === undefined) obsByKey[key] = '';
    }

    const observations = {};
    dates.forEach(date => { observations[date] = obsByKey[obsKey(year, date)] || ''; });
    escreverLog('LEITURA', 'Leitura concluída', year, monthName, dayName);
    return { success: true, datas: dates, unidades: units, statuses, observacoes: observations, year };
  } catch (error) {
    escreverLog('LEITURA_ERRO', error.message, yearInput, monthName, dayName);
    return { error: `Erro ao ler dados: ${error.message}` };
  }
}

function salvarTudo(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!payload) throw new Error('Payload vazio.');

    const year = parseInt(payload.year, 10) || 2026;
    const dates = Array.isArray(payload.datas) ? payload.datas : [];
    const statuses = payload.statuses || {};
    const observations = payload.observacoes || {};
    if (!dates.length) throw new Error('Nenhuma data recebida para salvar.');

    const context = garantirAbas();
    const statusData = context.statusSheet.getDataRange().getValues();
    const obsData = context.obsSheet.getDataRange().getValues();
    const statusRowsByKey = new Map();
    const obsRowsByKey = new Map();

    for (let index = 1; index < statusData.length; index += 1) {
      const parsed = parseStatusRow(statusData[index]);
      if (!parsed) continue;
      const key = statusKey(parsed.ano, parsed.data, parsed.unidade);
      if (!statusRowsByKey.has(key)) statusRowsByKey.set(key, []);
      statusRowsByKey.get(key).push(index + 1);
    }

    for (let index = 1; index < obsData.length; index += 1) {
      const parsed = parseObsRow(obsData[index]);
      if (!parsed) continue;
      const key = obsKey(parsed.ano, parsed.data);
      if (!obsRowsByKey.has(key)) obsRowsByKey.set(key, []);
      obsRowsByKey.get(key).push(index + 1);
    }

    const statusAppends = [];
    const obsAppends = [];

    Object.keys(statuses).forEach(unit => {
      const values = Array.isArray(statuses[unit]) ? statuses[unit] : [];
      dates.forEach((date, index) => {
        const status = String(values[index] || '').trim().toUpperCase();
        const key = statusKey(year, date, unit);
        const row = [buildStatusId(year, date, unit), String(year), String(date), String(unit), status];
        const rows = statusRowsByKey.get(key) || [];
        if (rows.length) {
          rows.forEach(rowNumber => context.statusSheet.getRange(rowNumber, 1, 1, 5).setNumberFormat('@').setValues([row]));
        } else {
          statusAppends.push(row);
        }
      });
    });

    dates.forEach(date => {
      const observation = String(observations[date] || '');
      const key = obsKey(year, date);
      const row = [buildObsId(year, date), String(year), String(date), observation];
      const rows = obsRowsByKey.get(key) || [];
      if (rows.length) {
        rows.forEach(rowNumber => context.obsSheet.getRange(rowNumber, 1, 1, 4).setNumberFormat('@').setValues([row]));
      } else {
        obsAppends.push(row);
      }
    });

    if (statusAppends.length) {
      const start = context.statusSheet.getLastRow() + 1;
      context.statusSheet.getRange(start, 1, statusAppends.length, 5).setNumberFormat('@').setValues(statusAppends);
    }
    if (obsAppends.length) {
      const start = context.obsSheet.getLastRow() + 1;
      context.obsSheet.getRange(start, 1, obsAppends.length, 4).setNumberFormat('@').setValues(obsAppends);
    }

    SpreadsheetApp.flush();
    escreverLog('SALVAR', `Salvar concluído. statusNovos=${statusAppends.length}, obsNovas=${obsAppends.length}`, year, payload.monthName, payload.dayName);
    return { success: true, savedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss') };
  } catch (error) {
    escreverLog('SALVAR_ERRO', error.message, payload && payload.year, payload && payload.monthName, payload && payload.dayName);
    return { error: `Erro ao salvar: ${error.message}` };
  } finally {
    try { lock.releaseLock(); } catch (error) {}
  }
}

function calcularResumo(dates, statuses) {
  const units = Object.keys(statuses || {});
  const daily = dates.map((date, index) => {
    let coletado = 0;
    let naoColetado = 0;
    let semResposta = 0;
    units.forEach(unit => {
      const value = (statuses[unit] || [])[index] || '';
      if (value === 'S') coletado += 1;
      else if (value === 'N') naoColetado += 1;
      else semResposta += 1;
    });
    return { data: date, coletado, naoColetado, semResposta };
  });

  const coletado = daily.reduce((sum, item) => sum + item.coletado, 0);
  const naoColetado = daily.reduce((sum, item) => sum + item.naoColetado, 0);
  const semResposta = daily.reduce((sum, item) => sum + item.semResposta, 0);
  const respondidos = coletado + naoColetado;
  const taxa = respondidos ? Math.round((coletado / respondidos) * 1000) / 10 : 0;
  return { coletado, naoColetado, semResposta, respondidos, taxa, daily };
}

function interpretarNumeroPeso(token) {
  let number = String(token).replace(/[.,]+$/, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(number)) number = number.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(number)) number = number.replace(/,/g, '');
  else number = number.replace(',', '.');
  const value = Number(number);
  return isFinite(value) && value > 0 && value <= 50000 ? value : null;
}

function interpretarPesoKg(note) {
  const text = String(note || '').trim();
  if (!text) return { kg: null, leitura: 'Sem observação', conferir: false };
  const pattern = /(?:^|[^\da-z])([bB]?)(\d[\d.,]*)\s*(kg|gk|kh|ykg|yk|km|toneladas?|t)\b/gi;
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const number = interpretarNumeroPeso(match[2]);
    if (number !== null) matches.push({ prefix: match[1], number, unit: match[3].toLowerCase() });
  }
  if (matches.length > 1) return { kg: null, leitura: 'Mais de um peso: conferir', conferir: true };
  if (!matches.length) {
    const hasWeightWord = /pes[oe]/i.test(text);
    return { kg: null, leitura: hasWeightWord ? 'Peso sem unidade ou número claro: conferir' : 'Sem peso informado', conferir: hasWeightWord };
  }
  const found = matches[0];
  if (found.unit === 'km' && !/pes[oe]|l[ií]quido|liguido/i.test(text)) {
    return { kg: null, leitura: 'Unidade km sem indicação de peso: conferir', conferir: true };
  }
  const tonnes = found.unit === 't' || found.unit.indexOf('tonelada') === 0;
  const kg = tonnes ? found.number * 1000 : found.number;
  const conferir = Boolean(found.prefix) || (!tonnes && found.unit !== 'kg');
  const leitura = conferir ? `Conferir grafia ${found.prefix}${found.unit}; ${kg} kg interpretados` : tonnes ? 'Toneladas convertidas para kg' : 'Peso identificado';
  return { kg, leitura, conferir };
}

function resumirPeso(dates, observations) {
  const entries = dates.map(date => ({ data: date, peso: interpretarPesoKg(observations[date]) }));
  const measured = entries.filter(item => item.peso.kg !== null);
  return {
    entries,
    totalKg: measured.reduce((sum, item) => sum + item.peso.kg, 0),
    diasComPeso: measured.length,
    maxKg: measured.length ? Math.max.apply(null, measured.map(item => item.peso.kg)) : null,
    conferir: entries.filter(item => item.peso.conferir).length
  };
}

function formatarKg(value) {
  return value === null ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

function periodoAnterior(monthName, yearInput) {
  let monthIndex = MESES[monthName] - 1;
  let year = parseInt(yearInput, 10) || 2026;
  monthIndex -= 1;
  if (monthIndex < 0) {
    monthIndex = 11;
    year -= 1;
  }
  return { monthName: NOMES_MESES[monthIndex], year };
}

function getResumoComparativo(monthName, dayName, yearInput) {
  try {
    const currentData = getDadosSalvos(monthName, dayName, yearInput);
    if (currentData.error) return currentData;
    const previousPeriod = periodoAnterior(monthName, yearInput);
    const previousData = getDadosSalvos(previousPeriod.monthName, dayName, previousPeriod.year);
    if (previousData.error) return previousData;
    return {
      success: true,
      atual: calcularResumo(currentData.datas, currentData.statuses),
      anterior: calcularResumo(previousData.datas, previousData.statuses),
      periodoAnterior: previousPeriod
    };
  } catch (error) {
    return { error: `Erro ao calcular comparativo: ${error.message}` };
  }
}

function getReportFolder(monthName, year) {
  const rootName = `SELIM_${year}`;
  const rootFolders = DriveApp.getFoldersByName(rootName);
  const root = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootName);
  const monthFolders = root.getFoldersByName(monthName);
  return monthFolders.hasNext() ? monthFolders.next() : root.createFolder(monthName);
}

function appendReportCharts(body, summary, weightSummary) {
  if (weightSummary.diasComPeso) {
    let weightData = Charts.newDataTable()
      .addColumn(Charts.ColumnType.STRING, 'Data')
      .addColumn(Charts.ColumnType.NUMBER, 'Peso líquido (kg)');
    weightSummary.entries.filter(item => item.peso.kg !== null).forEach(item => {
      weightData = weightData.addRow([item.data, item.peso.kg]);
    });
    const weightChart = Charts.newColumnChart()
      .setDataTable(weightData.build())
      .setTitle('Peso líquido nos dias com registro (kg)')
      .setDimensions(650, 330)
      .setColors(['#0aa7c8'])
      .setOption('legend.position', 'none')
      .build();
    body.appendImage(weightChart.getBlob()).setWidth(480);
  } else {
    body.appendParagraph('Nenhum peso identificado nas observações deste período.');
  }

  if (summary.coletado) {
    let collectionData = Charts.newDataTable()
      .addColumn(Charts.ColumnType.STRING, 'Data')
      .addColumn(Charts.ColumnType.NUMBER, 'Coletas confirmadas');
    summary.daily.forEach(item => { collectionData = collectionData.addRow([item.data, item.coletado]); });
    const collectionChart = Charts.newColumnChart()
      .setDataTable(collectionData.build())
      .setTitle('Coletas confirmadas por data')
      .setDimensions(650, 330)
      .setColors(['#158354'])
      .setOption('legend.position', 'none')
      .build();
    body.appendImage(collectionChart.getBlob()).setWidth(480);
  } else {
    body.appendParagraph('Nenhuma coleta confirmada neste período para representar no segundo gráfico.');
  }
}

function buildReportDocument(payload, baseName) {
  const dates = payload.datas || [];
  const statuses = payload.statuses || {};
  const observations = payload.observacoes || {};
  const units = Object.keys(statuses);
  const summary = calcularResumo(dates, statuses);
  const weightSummary = resumirPeso(dates, observations);
  const previousPeriod = periodoAnterior(payload.monthName, payload.year);
  const previousData = getDadosSalvos(previousPeriod.monthName, payload.dayName, previousPeriod.year);
  const previousSummary = previousData.success ? calcularResumo(previousData.datas, previousData.statuses) : null;
  const previousWeight = previousData.success ? resumirPeso(previousData.datas, previousData.observacoes) : null;
  const document = DocumentApp.create(baseName);
  const body = document.getBody();

  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(32).setMarginRight(32);
  const cityTitle = body.appendParagraph('PREFEITURA DE PARNAMIRIM');
  cityTitle.setHeading(DocumentApp.ParagraphHeading.TITLE);
  cityTitle.editAsText().setForegroundColor('#071c4d');
  const departmentTitle = body.appendParagraph('SECRETARIA MUNICIPAL DE LIMPEZA URBANA • SELIM');
  departmentTitle.editAsText().setForegroundColor('#0aa7c8').setBold(true);
  const reportTitle = body.appendParagraph(`Relatório de Coleta Hospitalar — ${payload.dayName}, ${payload.monthName} de ${payload.year}`);
  reportTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  reportTitle.editAsText().setForegroundColor('#071c4d');
  const explanation = body.appendParagraph('O peso líquido é anotado por data nas observações e representa o caminhão inteiro. Ele não é dividido entre unidades. S confirma uma coleta; N significa apenas que não houve coleta naquela data.');
  explanation.editAsText().setForegroundColor('#071c4d');

  const weightTitle = body.appendParagraph('PESO LÍQUIDO INFORMADO');
  weightTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  weightTitle.editAsText().setForegroundColor('#071c4d');
  const averageWeight = weightSummary.diasComPeso ? weightSummary.totalKg / weightSummary.diasComPeso : null;
  const weightMetrics = body.appendTable([
    ['TOTAL', 'DIAS COM PESO', 'MÉDIA POR DIA COM PESO', 'MAIOR PESO DIÁRIO'],
    [weightSummary.diasComPeso ? formatarKg(weightSummary.totalKg) : '—', `${weightSummary.diasComPeso} de ${dates.length}`, formatarKg(averageWeight), formatarKg(weightSummary.maxKg)]
  ]);
  for (let column = 0; column < 4; column += 1) {
    weightMetrics.getCell(0, column).setBackgroundColor('#071c4d').editAsText().setForegroundColor('#ffffff').setBold(true);
    weightMetrics.getCell(1, column).setBackgroundColor('#fff8c0').editAsText().setForegroundColor('#071c4d').setBold(true);
  }
  if (weightSummary.conferir) {
    body.appendParagraph(`${weightSummary.conferir} anotação(ões) com grafia ou valor a conferir. Valores interpretados como kg estão incluídos no total; veja a tabela por data.`);
  }
  if (weightSummary.diasComPeso && previousWeight && previousWeight.diasComPeso) {
    const deltaKg = weightSummary.totalKg - previousWeight.totalKg;
    const sign = deltaKg > 0 ? '+' : '';
    body.appendParagraph(`Peso em relação a ${previousPeriod.monthName} de ${previousPeriod.year}: ${sign}${formatarKg(deltaKg)}. Mês anterior: ${formatarKg(previousWeight.totalKg)} em ${previousWeight.diasComPeso} dia(s) com peso; atual: ${weightSummary.diasComPeso} dia(s).`)
      .editAsText().setForegroundColor('#071c4d').setBold(true);
  } else {
    body.appendParagraph('Sem pesos suficientes no mês atual ou anterior para comparação.');
  }

  const chartsTitle = body.appendParagraph('Gráficos');
  chartsTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  chartsTitle.editAsText().setForegroundColor('#071c4d');
  appendReportCharts(body, summary, weightSummary);

  const collectionTitle = body.appendParagraph('ATIVIDADE DE COLETA');
  collectionTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  collectionTitle.editAsText().setForegroundColor('#071c4d');

  const unitsAttended = units.filter(unit => (statuses[unit] || []).some(value => value === 'S')).length;
  const daysWithCollection = summary.daily.filter(item => item.coletado > 0).length;
  const averagePerDay = dates.length ? Math.round(summary.coletado / dates.length * 10) / 10 : 0;

  const metrics = body.appendTable([
    ['COLETAS S', 'UNIDADES ATENDIDAS', 'N: SEM COLETA NO DIA', 'EM BRANCO'],
    [String(summary.coletado), String(unitsAttended), String(summary.naoColetado), String(summary.semResposta)]
  ]);
  for (let column = 0; column < 4; column += 1) {
    metrics.getCell(0, column).setBackgroundColor('#071c4d').editAsText().setForegroundColor('#ffffff').setBold(true);
    metrics.getCell(1, column).setBackgroundColor('#f1f6fa').editAsText().setForegroundColor('#071c4d').setBold(true);
  }
  body.appendParagraph(`Dias com coleta: ${daysWithCollection} de ${dates.length} datas do roteiro. Média de ${averagePerDay} coleta(s) por dia de roteiro.`);

  if (previousSummary && previousSummary.respondidos > 0) {
    const previousCount = previousSummary.coletado;
    const previousDays = previousSummary.daily.length;
    const previousAverage = previousDays ? Math.round(previousCount / previousDays * 10) / 10 : 0;
    const delta = summary.coletado - previousCount;
    const sign = delta > 0 ? '+' : '';
    const comparisonParagraph = body.appendParagraph(`Comparativo com o mês anterior: ${sign}${delta} coleta(s). Mês anterior: ${previousCount} coleta(s), média de ${previousAverage} por dia de roteiro.`);
    comparisonParagraph.editAsText().setForegroundColor('#071c4d').setBold(true);
  } else {
    body.appendParagraph('Sem registros no mês anterior para comparação.');
  }

  const weightDataTitle = body.appendParagraph('Peso por data');
  weightDataTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  weightDataTitle.editAsText().setForegroundColor('#071c4d');
  const weightTable = body.appendTable([['DATA', 'PESO LÍQUIDO', 'LEITURA']]);
  weightSummary.entries.forEach(item => {
    const row = weightTable.appendTableRow();
    row.appendTableCell(item.data);
    row.appendTableCell(formatarKg(item.peso.kg));
    row.appendTableCell(item.peso.leitura);
  });
  for (let column = 0; column < 3; column += 1) {
    weightTable.getCell(0, column).setBackgroundColor('#071c4d').editAsText().setForegroundColor('#ffffff').setBold(true);
  }

  const dataTitle = body.appendParagraph('Dados completos');
  dataTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  dataTitle.editAsText().setForegroundColor('#071c4d');
  const table = body.appendTable();
  const header = table.appendTableRow();
  header.appendTableCell('UNIDADE DE SAÚDE');
  dates.forEach(date => header.appendTableCell(date));
  for (let column = 0; column < header.getNumCells(); column += 1) {
    header.getCell(column).setBackgroundColor('#071c4d').editAsText().setForegroundColor('#ffffff').setBold(true);
  }

  units.forEach(unit => {
    const row = table.appendTableRow();
    row.appendTableCell(unit);
    const values = statuses[unit] || Array(dates.length).fill('');
    values.forEach(value => {
      const label = value === 'S' ? 'Coletado' : value === 'N' ? 'Sem coleta no dia' : '—';
      const cell = row.appendTableCell(label);
      if (value === 'S') cell.setBackgroundColor('#e6f5ed');
      if (value === 'N') cell.setBackgroundColor('#e4f8fc');
    });
  });

  const observationsTitle = body.appendParagraph('Observações registradas');
  observationsTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  observationsTitle.editAsText().setForegroundColor('#071c4d');
  let observationCount = 0;
  dates.forEach(date => {
    if (String(observations[date] || '').trim()) {
      body.appendListItem(`${date}: ${observations[date]}`);
      observationCount += 1;
    }
  });
  if (!observationCount) {
    body.appendParagraph('Nenhuma observação registrada neste período.').editAsText().setItalic(true);
  }
  const footer = body.appendParagraph(`Gerado em ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')}`);
  footer.editAsText().setForegroundColor('#61708a').setFontSize(8);

  document.saveAndClose();
  return document;
}

function gerarRelatorioPDF(payload) {
  try {
    const year = parseInt(payload.year, 10) || 2026;
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const baseName = `Relatorio_Hospitalar_${payload.dayName}_${MESES[payload.monthName]}_${year}_${timestamp}`;
    const folder = getReportFolder(payload.monthName, year);
    const document = buildReportDocument(payload, baseName);
    const documentFile = DriveApp.getFileById(document.getId());
    const pdfFile = folder.createFile(documentFile.getAs(MimeType.PDF).setName(`${baseName}.pdf`));
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    documentFile.setTrashed(true);
    return { success: true, pdfUrl: pdfFile.getUrl() };
  } catch (error) {
    return { error: `Erro ao gerar PDF: ${error.message}` };
  }
}

function gerarRelatorioDoc(payload) {
  try {
    const year = parseInt(payload.year, 10) || 2026;
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const baseName = `Relatorio_Hospitalar_${payload.dayName}_${MESES[payload.monthName]}_${year}_${timestamp}`;
    const folder = getReportFolder(payload.monthName, year);
    const document = buildReportDocument(payload, baseName);
    const documentFile = DriveApp.getFileById(document.getId());
    folder.addFile(documentFile);
    DriveApp.getRootFolder().removeFile(documentFile);
    documentFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, docUrl: document.getUrl() };
  } catch (error) {
    return { error: `Erro ao gerar DOC: ${error.message}` };
  }
}

function salvarEGerarRelatorios(payload) {
  const saveResult = salvarTudo(payload);
  if (saveResult.error) return saveResult;
  return gerarRelatorioDoc(payload);
}

function testeConexao() {
  const result = getDadosSalvos('Janeiro', 'Segunda', 2026);
  if (result.error) throw new Error(result.error);
  return {
    success: true,
    planilha: abrirBanco().getName(),
    datas: result.datas.length,
    unidades: result.unidades.length
  };
}
