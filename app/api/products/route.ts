import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

// Skip validation during build
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
    // Group by product
    const productMap = allSales.reduce((acc: Record<string, any>, sale) => {
      if (!acc[sale.product]) {
        acc[sale.product] = {
          name: sale.product,
          totalSales: 0,
          totalRevenue: 0,
          totalIncome: 0,
          unitsSold: 0,
          lastSaleDate: new Date(0),
        };
      }
      acc[sale.product].totalSales++;
      acc[sale.product].totalRevenue += sale.value;
      acc[sale.product].totalIncome += sale.revenue;
      acc[sale.product].unitsSold++;
      const saleDate = new Date(sale.date);
      if (saleDate > acc[sale.product].lastSaleDate) {
        acc[sale.product].lastSaleDate = saleDate;
      }
      return acc;
    }, {});

    // Convert to array and sort by revenue
    const productsData = Object.values(productMap)
      .map((p: any) => ({
        id: p.name,
        name: p.name,
        totalSales: p.totalSales,
        totalRevenue: parseFloat(p.totalRevenue.toFixed(2)),
        totalIncome: parseFloat(p.totalIncome.toFixed(2)),
        avgPrice: p.totalSales > 0 ? parseFloat((p.totalRevenue / p.totalSales).toFixed(2)) : 0,
        lastSaleDate: p.lastSaleDate.toISOString(),
        unitsSold: p.unitsSold,
        status: 'ACTIVE',
      }))
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json(productsData);
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
