import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData, SalesRecord } from '@/lib/google-sheets';
import { ComparisonClientItem, ComparisonData, ComparisonRankingItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
    const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
    const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

    if (!spreadsheetId || !sheetGid || !apiKey) {
      return NextResponse.json({ error: 'Google Sheets configuration missing' }, { status: 400 });
    }

    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
    const allSales = parseSalesData(data, headers);

    const requestedStartDate = req.nextUrl.searchParams.get('startDate');
    const requestedEndDate = req.nextUrl.searchParams.get('endDate');
    const requestedCompareStartDate = req.nextUrl.searchParams.get('compareStartDate');
    const requestedCompareEndDate = req.nextUrl.searchParams.get('compareEndDate');
    const { startDate, endDate, previousStartDate, previousEndDate } = resolvePeriods(
      requestedStartDate,
      requestedEndDate,
      requestedCompareStartDate,
      requestedCompareEndDate
    );

    const currentSales = filterSalesByDateRange(allSales, toDateKey(startDate), toDateKey(endDate));
    const previousSales = filterSalesByDateRange(allSales, toDateKey(previousStartDate), toDateKey(previousEndDate));

    const previousPeriod = buildPeriodMetrics(previousSales);
    const currentPeriod = buildPeriodMetrics(currentSales);
    const sellerRanking = buildRanking(currentSales, previousSales, (sale) => sale.seller);
    const productRanking = buildRanking(currentSales, previousSales, (sale) => sale.product);
    const clientRanking = buildRanking(currentSales, previousSales, (sale) => sale.client);

    const firstPurchaseByClient = buildFirstPurchaseMap(allSales);
    const currentClientDetails = buildCurrentClientDetails(currentSales, previousSales, firstPurchaseByClient, startDate);
    const newClientsList = currentClientDetails.filter((client) => isDateInsideRange(client.firstPurchaseDate, startDate, endDate));
    const recurringClientsList = currentClientDetails.filter(
      (client) => parseLocalDate(client.firstPurchaseDate).getTime() < startDate.getTime()
    );

    const totalClients = currentClientDetails.length;
    const repeatClients = countRepeatClients(currentSales);
    const newClientsRevenue = sumRevenue(newClientsList);
    const recurringRevenue = sumRevenue(recurringClientsList);

    const response: ComparisonData = {
      period: `${toDateKey(startDate)} a ${toDateKey(endDate)}`,
      currentPeriodRange: {
        startDate: toDateKey(startDate),
        endDate: toDateKey(endDate),
        label: formatDateRange(startDate, endDate),
      },
      previousPeriodRange: {
        startDate: toDateKey(previousStartDate),
        endDate: toDateKey(previousEndDate),
        label: formatDateRange(previousStartDate, previousEndDate),
      },
      previousPeriod,
      currentPeriod,
      growth: {
        salesGrowth: growth(currentPeriod.totalSales, previousPeriod.totalSales),
        revenueGrowth: growth(currentPeriod.totalRevenue, previousPeriod.totalRevenue),
        avgTicketGrowth: growth(currentPeriod.avgTicket, previousPeriod.avgTicket),
      },
      chartData: [
        { name: 'Vendas', anterior: previousPeriod.totalSales, atual: currentPeriod.totalSales },
        { name: 'Faturamento', anterior: previousPeriod.totalRevenue, atual: currentPeriod.totalRevenue },
        { name: 'Ticket medio', anterior: previousPeriod.avgTicket, atual: currentPeriod.avgTicket },
      ],
      summary: {
        totalClients,
        newClients: newClientsList.length,
        recurringClients: recurringClientsList.length,
        repeatClients,
        repeatRate: totalClients > 0 ? Number(((repeatClients / totalClients) * 100).toFixed(2)) : 0,
        newClientsRevenue: Number(newClientsRevenue.toFixed(2)),
        recurringRevenue: Number(recurringRevenue.toFixed(2)),
      },
      topSeller: sellerRanking[0] || null,
      topProduct: productRanking[0] || null,
      topClient: clientRanking[0] || null,
      sellerRanking,
      productRanking,
      newClientsList,
      recurringClientsList,
      clientMix: [
        { name: 'Novos', value: newClientsList.length, revenue: Number(newClientsRevenue.toFixed(2)) },
        { name: 'Recorrentes', value: recurringClientsList.length, revenue: Number(recurringRevenue.toFixed(2)) },
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Comparison API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparison data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function resolvePeriods(
  startValue: string | null,
  endValue: string | null,
  compareStartValue?: string | null,
  compareEndValue?: string | null
) {
  const endDate = endValue ? parseLocalDate(endValue) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = startValue
    ? parseLocalDate(startValue)
    : new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate());
  startDate.setHours(0, 0, 0, 0);

  let previousStartDate: Date;
  let previousEndDate: Date;

  if (compareStartValue && compareEndValue) {
    previousStartDate = parseLocalDate(compareStartValue);
    previousStartDate.setHours(0, 0, 0, 0);
    previousEndDate = parseLocalDate(compareEndValue);
    previousEndDate.setHours(23, 59, 59, 999);
  } else {
    const inclusiveDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    previousEndDate = new Date(startDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    previousEndDate.setHours(23, 59, 59, 999);

    previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - inclusiveDays + 1);
    previousStartDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
}

function buildPeriodMetrics(items: SalesRecord[]) {
  const totalSales = items.length;
  const totalRevenue = items.reduce((sum, sale) => sum + sale.value, 0);
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  return {
    totalSales,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    avgTicket: Number(avgTicket.toFixed(2)),
  };
}

function buildRanking(
  currentSales: SalesRecord[],
  previousSales: SalesRecord[],
  getKey: (sale: SalesRecord) => string
): ComparisonRankingItem[] {
  const currentTotals = buildAggregationMap(currentSales, getKey);
  const previousTotals = buildAggregationMap(previousSales, getKey);
  const totalRevenue = currentSales.reduce((sum, sale) => sum + sale.value, 0);

  return Array.from(currentTotals.entries())
    .map(([name, current]) => {
      const previous = previousTotals.get(name) || { sales: 0, revenue: 0 };
      return {
        name,
        sales: current.sales,
        revenue: Number(current.revenue.toFixed(2)),
        share: totalRevenue > 0 ? Number(((current.revenue / totalRevenue) * 100).toFixed(2)) : 0,
        previousSales: previous.sales,
        previousRevenue: Number(previous.revenue.toFixed(2)),
        salesGrowth: growth(current.sales, previous.sales),
        revenueGrowth: growth(current.revenue, previous.revenue),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function buildCurrentClientDetails(
  currentSales: SalesRecord[],
  previousSales: SalesRecord[],
  firstPurchaseByClient: Map<string, string>,
  startDate: Date
): ComparisonClientItem[] {
  const currentMap = buildAggregationMap(currentSales, (sale) => sale.client);
  const previousMap = buildAggregationMap(previousSales, (sale) => sale.client);
  const totalRevenue = currentSales.reduce((sum, sale) => sum + sale.value, 0);
  const lastPurchaseByClient = new Map<string, string>();

  for (const sale of currentSales) {
    const previousDate = lastPurchaseByClient.get(sale.client);
    if (!previousDate || new Date(sale.date).getTime() > new Date(previousDate).getTime()) {
      lastPurchaseByClient.set(sale.client, sale.date);
    }
  }

  return Array.from(currentMap.entries())
    .map(([name, current]) => {
      const previous = previousMap.get(name) || { sales: 0, revenue: 0 };
      const firstPurchaseDate = firstPurchaseByClient.get(name) || toDateKey(startDate);
      const lastPurchaseDate = lastPurchaseByClient.get(name) || toDateKey(startDate);

      return {
        name,
        sales: current.sales,
        revenue: Number(current.revenue.toFixed(2)),
        share: totalRevenue > 0 ? Number(((current.revenue / totalRevenue) * 100).toFixed(2)) : 0,
        previousSales: previous.sales,
        previousRevenue: Number(previous.revenue.toFixed(2)),
        salesGrowth: growth(current.sales, previous.sales),
        revenueGrowth: growth(current.revenue, previous.revenue),
        firstPurchaseDate: toDateKey(parseSheetLikeDate(firstPurchaseDate)),
        lastPurchaseDate: toDateKey(parseSheetLikeDate(lastPurchaseDate)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function buildAggregationMap(items: SalesRecord[], getKey: (sale: SalesRecord) => string) {
  const map = new Map<string, { sales: number; revenue: number }>();

  for (const sale of items) {
    const key = getKey(sale);
    const current = map.get(key) || { sales: 0, revenue: 0 };
    current.sales += 1;
    current.revenue += sale.value;
    map.set(key, current);
  }

  return map;
}

function buildFirstPurchaseMap(items: SalesRecord[]) {
  const map = new Map<string, string>();

  for (const sale of items) {
    const current = map.get(sale.client);
    if (!current || new Date(sale.date).getTime() < new Date(current).getTime()) {
      map.set(sale.client, sale.date);
    }
  }

  return map;
}

function countRepeatClients(items: SalesRecord[]) {
  const counts = new Map<string, number>();

  for (const sale of items) {
    counts.set(sale.client, (counts.get(sale.client) || 0) + 1);
  }

  return Array.from(counts.values()).filter((count) => count > 1).length;
}

function sumRevenue(items: Array<{ revenue: number }>) {
  return items.reduce((sum, item) => sum + item.revenue, 0);
}

function growth(current: number, previous: number) {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : current > 0 ? 100 : 0;
}

function isDateInsideRange(value: string, startDate: Date, endDate: Date) {
  const date = parseLocalDate(value);
  return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
}

function parseSheetLikeDate(value: string) {
  return value.includes('T') ? new Date(value) : parseLocalDate(value);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateRange(startDate: Date, endDate: Date) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${formatter.format(startDate)} a ${formatter.format(endDate)}`;
}
