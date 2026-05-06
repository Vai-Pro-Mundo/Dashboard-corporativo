import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

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
    const allSales = filterSalesByDateRange(
      parseSalesData(data, headers),
      req.nextUrl.searchParams.get('startDate'),
      req.nextUrl.searchParams.get('endDate')
    );
    const customerProfiles = allSales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.client] = (acc[sale.client] || 0) + 1;
      return acc;
    }, {});

    const salesByDateMap = allSales.reduce<Record<string, { sales: number; revenue: number; income: number }>>((acc, sale) => {
      const dateKey = sale.date.split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { sales: 0, revenue: 0, income: 0 };
      }
      acc[dateKey].sales++;
      acc[dateKey].revenue += sale.value;
      acc[dateKey].income += sale.revenue;
      return acc;
    }, {});

    return NextResponse.json({
      totalSales: allSales.length,
      totalRevenue: Number(allSales.reduce((sum, sale) => sum + sale.value, 0).toFixed(2)),
      totalIncome: Number(allSales.reduce((sum, sale) => sum + sale.revenue, 0).toFixed(2)),
      avgAdvanceDays:
        allSales.length > 0 ? Number((allSales.reduce((sum, sale) => sum + sale.advanceDays, 0) / allSales.length).toFixed(1)) : 0,
      bookingPatterns: [
        { name: '0-7 dias', sales: allSales.filter((sale) => sale.advanceDays >= 0 && sale.advanceDays <= 7).length },
        { name: '8-14 dias', sales: allSales.filter((sale) => sale.advanceDays >= 8 && sale.advanceDays <= 14).length },
        { name: '15-30 dias', sales: allSales.filter((sale) => sale.advanceDays >= 15 && sale.advanceDays <= 30).length },
        { name: '30+ dias', sales: allSales.filter((sale) => sale.advanceDays > 30).length },
      ],
      customerProfiles: [
        { name: 'Alta recorrência (10+)', clients: Object.values(customerProfiles).filter((count) => count >= 10).length },
        { name: 'Média (5-9)', clients: Object.values(customerProfiles).filter((count) => count >= 5 && count < 10).length },
        { name: 'Baixa (1-4)', clients: Object.values(customerProfiles).filter((count) => count < 5).length },
      ],
      salesByDate: Object.entries(salesByDateMap)
        .map(([date, value]) => ({
          date,
          sales: value.sales,
          revenue: Number(value.revenue.toFixed(2)),
          income: Number(value.income.toFixed(2)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error('Behavioral API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch behavioral data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
