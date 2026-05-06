export interface SalesRecord {
  saleNumber: string;
  date: string;
  seller: string;
  client: string;
  product: string;
  supplier: string;
  startDate: string;
  endDate: string;
  destination: string;
  personType: string;
  status: string;
  revenue: number;
  value: number;
  advanceDays: number;
}

export interface OverviewData {
  totalSales: number;
  totalRevenue: number;
  totalIncome: number;
  totalClients: number;
  totalProducts: number;
  avgTicket: number;
  growthRate: number;
  openRevenue: number;
  openSales: number;
  topSellerName: string;
  topSellerAmount: number;
  topClientName: string;
  topClientAmount: number;
  topProductName: string;
  topProductAmount: number;
  nationalSales: number;
  internationalSales: number;
  topSellers: Array<{ name: string; revenue: number; income: number; sales: number }>;
  topClients: Array<{ name: string; revenue: number; income: number; sales: number }>;
  topProducts: Array<{ name: string; revenue: number; income: number; sales: number }>;
  salesTrend: Array<{ date: string; sales: number; revenue: number; income: number }>;
}

type SheetPayload = { headers: any[]; data: any[][] };

const CACHE_TTL_MS = 5 * 60 * 1000;
const sheetCache = new Map<string, { expiresAt: number; payload: SheetPayload }>();
const pendingSheetRequests = new Map<string, Promise<SheetPayload>>();

export async function getGoogleSheetsData(spreadsheetId: string, sheetGid: string, apiKey: string) {
  const cacheKey = `${spreadsheetId}:${sheetGid}`;
  const cached = sheetCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const pending = pendingSheetRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = fetchGoogleSheetsData(spreadsheetId, sheetGid, apiKey).finally(() => {
    pendingSheetRequests.delete(cacheKey);
  });

  pendingSheetRequests.set(cacheKey, request);
  return request;
}

async function fetchGoogleSheetsData(spreadsheetId: string, sheetGid: string, apiKey: string): Promise<SheetPayload> {
  try {
    const payload = await getGoogleSheetsCsvData(spreadsheetId, sheetGid);
    sheetCache.set(`${spreadsheetId}:${sheetGid}`, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return payload;
  } catch (csvError) {
    console.warn('CSV Google Sheets fetch failed, falling back to Values API:', csvError);

    const payload = await getGoogleSheetsValuesApiData(spreadsheetId, sheetGid, apiKey);
    sheetCache.set(`${spreadsheetId}:${sheetGid}`, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return payload;
  }
}

async function getGoogleSheetsCsvData(spreadsheetId: string, sheetGid: string): Promise<SheetPayload> {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  url.searchParams.set('format', 'csv');
  url.searchParams.set('gid', sheetGid);

  const csv = await fetchText(url);
  const rows = parseCsv(csv);

  if (rows.length < 2) {
    return { headers: [], data: [] };
  }

  const [headers, ...data] = rows;
  return { headers, data };
}

async function getGoogleSheetsValuesApiData(
  spreadsheetId: string,
  sheetGid: string,
  apiKey: string
): Promise<SheetPayload> {
  const sheetTitle = await getSheetTitle(spreadsheetId, sheetGid, apiKey);
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A:Z`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  );
  url.searchParams.set('key', apiKey);

  const response = await fetchJson<{ values?: any[][] }>(url);
  const rows = response.values || [];

  if (rows.length < 2) {
    return { headers: [], data: [] };
  }

  const [headers, ...data] = rows;
  return { headers, data };
}

async function getSheetTitle(spreadsheetId: string, sheetGid: string, apiKey: string) {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
  url.searchParams.set('fields', 'sheets.properties(sheetId,title)');
  url.searchParams.set('key', apiKey);

  const metadata = await fetchJson<{ sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> }>(url);
  const sheetsList = metadata.sheets || [];
  const sheet = sheetsList.find((item) => String(item.properties?.sheetId) === String(sheetGid));
  const title = sheet?.properties?.title || sheetsList[0]?.properties?.title;

  if (!title) {
    throw new Error(`No sheet found for gid ${sheetGid}`);
  }

  return title;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetchWithTimeout(url, 10000);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Sheets request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: URL): Promise<string> {
  const response = await fetchWithTimeout(url, 10000);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Sheets CSV request failed (${response.status}): ${text}`);
  }

  return response.text();
}

async function fetchWithTimeout(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index++;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;

  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.includes(',')
      ? cleaned.replace(',', '.')
      : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInteger(value: unknown) {
  const parsed = parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();

  if (!/[ÃÂâ]/.test(text)) {
    return text;
  }

  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
}

export function parseSheetDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return new Date(0);

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const brDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (brDate) {
    const [, day, month, rawYear, hour = '0', minute = '0'] = brDate;
    const year = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear);
    return new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute));
  }

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function normalizeHeader(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function indexFor(headers: any[], candidates: string[], fallbackIndex: number) {
  const normalized = headers.map((header) => normalizeHeader(header));
  const candidateSet = candidates.map((candidate) => normalizeHeader(candidate));
  const index = normalized.findIndex((header) => candidateSet.includes(header));
  return index >= 0 ? index : fallbackIndex;
}

export function parseSalesData(rows: any[], headers: any[] = []): SalesRecord[] {
  const saleNumberIndex = indexFor(headers, ['venda nº', 'venda no', 'venda numero', 'numero venda', 'id'], 0);
  const dateIndex = indexFor(headers, ['data venda', 'data', 'date', 'datavenda', 'data da venda'], 1);
  const sellerIndex = indexFor(headers, ['vendedor', 'seller', 'consultor', 'responsavel', 'responsavel pela venda'], 1);
  const clientIndex = indexFor(headers, ['pagante', 'cliente', 'client', 'customer', 'empresa'], 3);
  const productIndex = indexFor(headers, ['produto', 'tipo de produto', 'product', 'plano', 'servico'], 4);
  const supplierIndex = indexFor(headers, ['fornecedor', 'supplier'], 5);
  const startDateIndex = indexFor(headers, ['data inicio', 'data início', 'inicio', 'início', 'start date'], 6);
  const endDateIndex = indexFor(headers, ['data fim', 'fim', 'end date'], 7);
  const destinationIndex = indexFor(headers, ['destino', 'destination'], 8);
  const personTypeIndex = indexFor(headers, ['tipo pessoa', 'tipo de pessoa'], 9);
  const statusIndex = indexFor(headers, ['situacao', 'situação', 'status'], 10);
  const revenueIndex = indexFor(headers, ['receitas', 'receita', 'revenue'], 11);
  const valueIndex = indexFor(headers, ['faturamento', 'valor', 'value', 'amount', 'total'], 12);
  const advanceIndex = indexFor(headers, ['antecedencia dias', 'antecedencia', 'advance days', 'dias antecedencia'], 5);

  return rows
    .filter((row) => row && row.length >= 5)
    .map((row) => {
      const saleDate = parseSheetDate(row[dateIndex]);
      const startDate = parseSheetDate(row[startDateIndex]);
      const explicitAdvanceDays = parseInteger(row[advanceIndex]);
      const calculatedAdvanceDays =
        saleDate.getTime() > 0 && startDate.getTime() > 0
          ? Math.max(0, Math.round((startDate.getTime() - saleDate.getTime()) / 86400000))
          : 0;

      return {
        saleNumber: normalizeText(row[saleNumberIndex]),
        date: saleDate.toISOString(),
        seller: normalizeText(row[sellerIndex]),
        client: normalizeText(row[clientIndex]),
        product: normalizeText(row[productIndex]),
        supplier: normalizeText(row[supplierIndex]),
        startDate: startDate.toISOString(),
        endDate: parseSheetDate(row[endDateIndex]).toISOString(),
        destination: normalizeText(row[destinationIndex]),
        personType: normalizeText(row[personTypeIndex]),
        status: normalizeText(row[statusIndex]),
        revenue: parseNumber(row[revenueIndex]),
        value: parseNumber(row[valueIndex]),
        advanceDays: explicitAdvanceDays || calculatedAdvanceDays,
      };
    })
    .filter((record) => record.value !== 0 && record.seller && record.client);
}

export function filterSalesByStatus(sales: SalesRecord[], status: 'fechada' | 'aberta'): SalesRecord[] {
  return sales.filter((s) => s.status.toLowerCase().trim() === status);
}

export function filterSalesByDateRange(sales: SalesRecord[], startDate?: string | null, endDate?: string | null) {
  const start = startDate ? parseSheetDate(startDate) : null;
  const end = endDate ? parseSheetDate(endDate) : null;

  if (end && end.getTime() > 0) {
    end.setHours(23, 59, 59, 999);
  }

  return sales.filter((sale) => {
    const saleDate = parseSheetDate(sale.date);

    if (start && start.getTime() > 0 && saleDate < start) return false;
    if (end && end.getTime() > 0 && saleDate > end) return false;
    return true;
  });
}

export function calculateMetrics(sales: SalesRecord[], openSalesData?: { revenue: number; count: number }): OverviewData {
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.value, 0);
  const totalIncome = sales.reduce((sum, sale) => sum + sale.revenue, 0);
  const uniqueClients = new Set(sales.map((sale) => sale.client)).size;
  const uniqueProducts = new Set(sales.map((sale) => sale.product)).size;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const nationalSales = sales.filter((s) => s.destination.toLowerCase().includes('nacional')).length;
  const internationalSales = sales.filter((s) => s.destination.toLowerCase().includes('inter')).length;

  const sellerSales = sales.reduce<Record<string, { revenue: number; income: number }>>((acc, sale) => {
    if (!acc[sale.seller]) {
      acc[sale.seller] = { revenue: 0, income: 0 };
    }
    acc[sale.seller].revenue += sale.value;
    acc[sale.seller].income += sale.revenue;
    return acc;
  }, {});
  const sellerCounts = sales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.seller] = (acc[sale.seller] || 0) + 1;
    return acc;
  }, {});

  const clientSales = sales.reduce<Record<string, { revenue: number; income: number }>>((acc, sale) => {
    if (!acc[sale.client]) {
      acc[sale.client] = { revenue: 0, income: 0 };
    }
    acc[sale.client].revenue += sale.value;
    acc[sale.client].income += sale.revenue;
    return acc;
  }, {});
  const clientCounts = sales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.client] = (acc[sale.client] || 0) + 1;
    return acc;
  }, {});

  const productSales = sales.reduce<Record<string, { revenue: number; income: number }>>((acc, sale) => {
    if (!acc[sale.product]) {
      acc[sale.product] = { revenue: 0, income: 0 };
    }
    acc[sale.product].revenue += sale.value;
    acc[sale.product].income += sale.revenue;
    return acc;
  }, {});
  const productCounts = sales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.product] = (acc[sale.product] || 0) + 1;
    return acc;
  }, {});

  const dateSales = sales.reduce<Record<string, { count: number; revenue: number; income: number }>>((acc, sale) => {
    const dateKey = sale.date.split('T')[0] || 'Unknown';
    if (!acc[dateKey]) {
      acc[dateKey] = { count: 0, revenue: 0, income: 0 };
    }
    acc[dateKey].count++;
    acc[dateKey].revenue += sale.value;
    acc[dateKey].income += sale.revenue;
    return acc;
  }, {});

  const topSellerEntry = Object.entries(sellerSales).sort((a, b) => b[1].revenue - a[1].revenue)[0];
  const topClientEntry = Object.entries(clientSales).sort((a, b) => b[1].revenue - a[1].revenue)[0];
  const topProductEntry = Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue)[0];

  const salesTrend = Object.entries(dateSales)
    .map(([date, data]) => ({
      date,
      sales: data.count,
      revenue: Number(data.revenue.toFixed(2)),
      income: Number(data.income.toFixed(2)),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalSales,
    totalRevenue,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalClients: uniqueClients,
    totalProducts: uniqueProducts,
    avgTicket,
    growthRate: 12.5,
    openRevenue: openSalesData ? Number(openSalesData.revenue.toFixed(2)) : 0,
    openSales: openSalesData ? openSalesData.count : 0,
    topSellerName: topSellerEntry ? topSellerEntry[0] : 'N/A',
    topSellerAmount: topSellerEntry ? Number(topSellerEntry[1].revenue.toFixed(2)) : 0,
    topClientName: topClientEntry ? topClientEntry[0] : 'N/A',
    topClientAmount: topClientEntry ? Number(topClientEntry[1].revenue.toFixed(2)) : 0,
    topProductName: topProductEntry ? topProductEntry[0] : 'N/A',
    topProductAmount: topProductEntry ? Number(topProductEntry[1].revenue.toFixed(2)) : 0,
    nationalSales,
    internationalSales,
    topSellers: toTopList(sellerSales, sellerCounts),
    topClients: toTopList(clientSales, clientCounts),
    topProducts: toTopList(productSales, productCounts),
    salesTrend,
  };
}

function toTopList(metricsByName: Record<string, { revenue: number; income: number }>, countByName: Record<string, number>) {
  return Object.entries(metricsByName)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)
    .map(([name, metrics]) => ({
      name,
      revenue: Number(metrics.revenue.toFixed(2)),
      income: Number(metrics.income.toFixed(2)),
      sales: countByName[name] || 0,
    }));
}
