import { filterSalesByDateRange, filterSalesByStatus, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

export interface SellerRow {
  id: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  totalIncome: number;
  openRevenue: number;
  openSales: number;
  commission: number;
  avgTicket: number;
  status: string;
  lastSaleDate: string;
  salesCount: number;
}

export async function getSellersData(startDate?: string | null, endDate?: string | null): Promise<SellerRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
  const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
  const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

  if (!spreadsheetId || !sheetGid || !apiKey) {
    throw new Error('Google Sheets configuration missing');
  }

  const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
  const allSales = filterSalesByDateRange(parseSalesData(data, headers), startDate, endDate);

  const openSalesList = filterSalesByStatus(allSales, 'aberta');

  // Build open revenue map (for display in seller rows)
  const openMap = openSalesList.reduce((acc: Record<string, { revenue: number; count: number }>, sale) => {
    if (!acc[sale.seller]) acc[sale.seller] = { revenue: 0, count: 0 };
    acc[sale.seller].revenue += sale.value;
    acc[sale.seller].count++;
    return acc;
  }, {});

  // Use all sales (closed + open) for total revenue
  const sellerMap = allSales.reduce((acc: Record<string, any>, sale) => {
    if (!acc[sale.seller]) {
      acc[sale.seller] = {
        name: sale.seller,
        totalSales: 0,
        totalRevenue: 0,
        totalIncome: 0,
        lastSaleDate: new Date(0),
        salesCount: 0,
      };
    }

    acc[sale.seller].totalSales++;
    acc[sale.seller].totalRevenue += sale.value;
    acc[sale.seller].totalIncome += sale.revenue;
    acc[sale.seller].salesCount++;

    const saleDate = new Date(sale.date);
    if (saleDate > acc[sale.seller].lastSaleDate) {
      acc[sale.seller].lastSaleDate = saleDate;
    }

    return acc;
  }, {});

  return Object.values(sellerMap)
    .map((seller: any) => ({
      id: seller.name.replace(/\s+/g, '-').toLowerCase(),
      name: seller.name,
      totalSales: seller.totalSales,
      totalRevenue: Number(seller.totalRevenue.toFixed(2)),
      totalIncome: Number(seller.totalIncome.toFixed(2)),
      openRevenue: Number((openMap[seller.name]?.revenue ?? 0).toFixed(2)),
      openSales: openMap[seller.name]?.count ?? 0,
      commission: Number(seller.totalIncome.toFixed(2)),
      avgTicket: seller.salesCount > 0 ? Number((seller.totalRevenue / seller.salesCount).toFixed(2)) : 0,
      status: 'ACTIVE',
      lastSaleDate: seller.lastSaleDate.toISOString(),
      salesCount: seller.salesCount,
    }))
    .sort((a: SellerRow, b: SellerRow) => b.totalRevenue - a.totalRevenue);
}
