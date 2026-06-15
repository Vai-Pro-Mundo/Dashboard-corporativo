import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
    const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
    const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

    if (!spreadsheetId || !sheetGid || !apiKey) {
      return NextResponse.json(
        { error: 'Google Sheets configuration missing' },
        { status: 400 }
      );
    }

    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
    const allParsed = parseSalesData(data, headers);

    const startDateParam = req.nextUrl.searchParams.get('startDate');
    const endDateParam = req.nextUrl.searchParams.get('endDate');
    const periodSales = filterSalesByDateRange(allParsed, startDateParam, endDateParam);

    // Historical sales before the period start (to classify Novo vs Recorrente)
    const beforePeriodSales = startDateParam
      ? allParsed.filter((s) => new Date(s.date) < new Date(startDateParam))
      : [];
    const historicalCountByClient: Record<string, number> = {};
    for (const sale of beforePeriodSales) {
      historicalCountByClient[sale.client] = (historicalCountByClient[sale.client] || 0) + 1;
    }

    // Earliest purchase date ever for each client
    const firstPurchaseByClient: Record<string, Date> = {};
    for (const sale of allParsed) {
      const d = new Date(sale.date);
      if (!firstPurchaseByClient[sale.client] || d < firstPurchaseByClient[sale.client]) {
        firstPurchaseByClient[sale.client] = d;
      }
    }

    // Group by client within the period
    const clientMap = periodSales.reduce((acc: Record<string, any>, sale) => {
      if (!acc[sale.client]) {
        acc[sale.client] = {
          name: sale.client,
          totalPurchases: 0,
          totalSpent: 0,
          totalIncome: 0,
          lastPurchaseDate: new Date(0),
          products: new Set(),
          destinations: {} as Record<string, number>,
        };
      }
      const c = acc[sale.client];
      c.totalPurchases++;
      c.totalSpent += sale.value;
      c.totalIncome += sale.revenue;
      c.products.add(sale.product);
      const saleDate = new Date(sale.date);
      if (saleDate > c.lastPurchaseDate) c.lastPurchaseDate = saleDate;
      if (sale.destination) {
        c.destinations[sale.destination] = (c.destinations[sale.destination] || 0) + 1;
      }
      return acc;
    }, {});

    const clientsData = Object.values(clientMap)
      .map((c: any) => {
        const historicalCount = historicalCountByClient[c.name] || 0;
        const tipo = historicalCount > 0 ? `Recorrente (${historicalCount} antes)` : 'Novo';
        const destinoLider = Object.keys(c.destinations).length > 0
          ? Object.entries(c.destinations as Record<string, number>).sort((a, b) => b[1] - a[1])[0][0]
          : '-';
        const margemPercent = c.totalSpent > 0
          ? parseFloat(((c.totalIncome / c.totalSpent) * 100).toFixed(1))
          : 0;
        const firstPurchase = firstPurchaseByClient[c.name];

        return {
          id: c.name.replace(/\s+/g, '-').toLowerCase(),
          name: c.name,
          totalPurchases: c.totalPurchases,
          totalSpent: parseFloat(c.totalSpent.toFixed(2)),
          totalIncome: parseFloat(c.totalIncome.toFixed(2)),
          avgTicket: c.totalPurchases > 0 ? parseFloat((c.totalSpent / c.totalPurchases).toFixed(2)) : 0,
          margemPercent,
          firstPurchaseDate: firstPurchase ? firstPurchase.toISOString() : null,
          lastPurchaseDate: c.lastPurchaseDate.toISOString(),
          productsCount: c.products.size,
          destinoLider,
          tipo,
          status: 'ACTIVE',
        };
      })
      .sort((a: any, b: any) => b.totalSpent - a.totalSpent);

    return NextResponse.json(clientsData);
  } catch (error) {
    console.error('Clients API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
