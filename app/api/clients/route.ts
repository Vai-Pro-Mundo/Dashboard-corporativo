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

    // Fetch data from Google Sheets
    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
    const allSales = filterSalesByDateRange(
      parseSalesData(data, headers),
      req.nextUrl.searchParams.get('startDate'),
      req.nextUrl.searchParams.get('endDate')
    );
    // Group by client
    const clientMap = allSales.reduce((acc: Record<string, any>, sale) => {
      if (!acc[sale.client]) {
        acc[sale.client] = {
          name: sale.client,
          totalPurchases: 0,
          totalSpent: 0,
          totalIncome: 0,
          lastPurchaseDate: new Date(0),
          products: new Set(),
        };
      }
      acc[sale.client].totalPurchases++;
      acc[sale.client].totalSpent += sale.value;
      acc[sale.client].totalIncome += sale.revenue;
      acc[sale.client].products.add(sale.product);
      const saleDate = new Date(sale.date);
      if (saleDate > acc[sale.client].lastPurchaseDate) {
        acc[sale.client].lastPurchaseDate = saleDate;
      }
      return acc;
    }, {});

    // Convert to array and sort by spending
    const clientsData = Object.values(clientMap)
      .map((c: any) => ({
        id: c.name.replace(/\s+/g, '-').toLowerCase(),
        name: c.name,
        totalPurchases: c.totalPurchases,
        totalSpent: parseFloat(c.totalSpent.toFixed(2)),
        totalIncome: parseFloat(c.totalIncome.toFixed(2)),
        avgTicket: c.totalPurchases > 0 ? parseFloat((c.totalSpent / c.totalPurchases).toFixed(2)) : 0,
        lastPurchaseDate: c.lastPurchaseDate.toISOString(),
        productsCount: c.products.size,
        status: 'ACTIVE',
      }))
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
