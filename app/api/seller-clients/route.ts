import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';
import { SellerClientBreakdown } from '@/types';

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
    const filteredSales = filterSalesByDateRange(
      parseSalesData(data, headers),
      req.nextUrl.searchParams.get('startDate'),
      req.nextUrl.searchParams.get('endDate')
    );

    const sellerMap = new Map<string, SellerClientBreakdown>();

    for (const sale of filteredSales) {
      const sellerId = sale.seller.replace(/\s+/g, '-').toLowerCase();
      const saleDate = sale.date;

      let seller = sellerMap.get(sellerId);
      if (!seller) {
        seller = {
          sellerId,
          sellerName: sale.seller,
          totalSales: 0,
          totalRevenue: 0,
          totalIncome: 0,
          avgTicket: 0,
          uniqueClients: 0,
          lastSaleDate: saleDate,
          topClientName: 'N/A',
          topClientRevenue: 0,
          topClientIncome: 0,
          clients: [],
        };
        sellerMap.set(sellerId, seller);
      }

      seller.totalSales += 1;
      seller.totalRevenue += sale.value;
      seller.totalIncome += sale.revenue;
      if (new Date(saleDate).getTime() > new Date(seller.lastSaleDate).getTime()) {
        seller.lastSaleDate = saleDate;
      }

      let client = seller.clients.find((item) => item.clientName === sale.client);
      if (!client) {
        client = {
          clientName: sale.client,
          totalSales: 0,
          totalRevenue: 0,
          totalIncome: 0,
          avgTicket: 0,
          lastSaleDate: saleDate,
          productsCount: 0,
          revenueShare: 0,
        };
        seller.clients.push(client);
      }

      client.totalSales += 1;
      client.totalRevenue += sale.value;
      client.totalIncome += sale.revenue;
      if (new Date(saleDate).getTime() > new Date(client.lastSaleDate).getTime()) {
        client.lastSaleDate = saleDate;
      }
    }

    const response = Array.from(sellerMap.values())
      .map((seller) => {
        seller.clients = seller.clients
          .map((client) => {
            const matchingSales = filteredSales.filter(
              (sale) => sale.seller === seller.sellerName && sale.client === client.clientName
            );

            const productsCount = new Set(matchingSales.map((sale) => sale.product)).size;
            const avgTicket = client.totalSales > 0 ? client.totalRevenue / client.totalSales : 0;
            const revenueShare = seller.totalRevenue > 0 ? (client.totalRevenue / seller.totalRevenue) * 100 : 0;

            return {
              ...client,
              productsCount,
              avgTicket: Number(avgTicket.toFixed(2)),
              revenueShare: Number(revenueShare.toFixed(2)),
              totalRevenue: Number(client.totalRevenue.toFixed(2)),
              totalIncome: Number(client.totalIncome.toFixed(2)),
            };
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue);

        seller.avgTicket = seller.totalSales > 0 ? Number((seller.totalRevenue / seller.totalSales).toFixed(2)) : 0;
        seller.totalRevenue = Number(seller.totalRevenue.toFixed(2));
        seller.totalIncome = Number(seller.totalIncome.toFixed(2));
        seller.uniqueClients = seller.clients.length;
        seller.topClientName = seller.clients[0]?.clientName || 'N/A';
        seller.topClientRevenue = seller.clients[0]?.totalRevenue || 0;
        seller.topClientIncome = seller.clients[0]?.totalIncome || 0;

        return seller;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Seller clients API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seller x client data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
