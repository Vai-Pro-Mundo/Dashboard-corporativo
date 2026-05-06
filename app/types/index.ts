export interface CorporateSale {
  id: string;
  date: Date;
  sellerId: string;
  client: string;
  product: string;
  amount: number;
  commission: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  sheetId: string | null;
  sheetRowId: number | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporateSalesSnapshot {
  id: string;
  date: Date;
  totalSales: number;
  totalClients: number;
  totalProducts: number;
  avgTicket: number;
  topSeller?: string;
  topClient?: string;
  topProduct?: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OverviewData {
  totalSales: number;
  totalRevenue: number;
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
  nationalSales?: number;
  internationalSales?: number;
  topSellers?: Array<{ name: string; revenue: number; sales: number }>;
  topClients?: Array<{ name: string; revenue: number; sales: number }>;
  topProducts?: Array<{ name: string; revenue: number; sales: number }>;
  salesTrend: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
}

export interface SellersData {
  id: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  commission: number;
  avgTicket: number;
  status: string;
  lastSaleDate: Date;
  salesCount: number;
}

export interface ClientsData {
  id: string;
  name: string;
  totalPurchases: number;
  totalSpent: number;
  avgTicket: number;
  lastPurchaseDate: Date;
  productsCount: number;
  status: string;
}

export interface ProductsData {
  id: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  avgPrice: number;
  lastSaleDate: Date;
  unitsSold: number;
  status: string;
}

export interface BehavioralData {
  totalSales: number;
  avgAdvanceDays: number;
  bookingPatterns: Array<{ name: string; sales: number }>;
  customerProfiles: Array<{ name: string; clients: number }>;
  salesByDate: Array<{ date: string; sales: number; revenue: number }>;
}

export interface ComparisonData {
  period: string;
  currentPeriodRange?: {
    startDate: string;
    endDate: string;
    label: string;
  };
  previousPeriodRange?: {
    startDate: string;
    endDate: string;
    label: string;
  };
  previousPeriod: {
    totalSales: number;
    totalRevenue: number;
    avgTicket: number;
  };
  currentPeriod: {
    totalSales: number;
    totalRevenue: number;
    avgTicket: number;
  };
  growth: {
    salesGrowth: number;
    revenueGrowth: number;
    avgTicketGrowth: number;
  };
  chartData: Array<{ name: string; anterior: number; atual: number }>;
  summary: {
    totalClients: number;
    newClients: number;
    recurringClients: number;
    repeatClients: number;
    repeatRate: number;
    newClientsRevenue: number;
    recurringRevenue: number;
  };
  topSeller: ComparisonRankingItem | null;
  topProduct: ComparisonRankingItem | null;
  topClient: ComparisonRankingItem | null;
  sellerRanking: ComparisonRankingItem[];
  productRanking: ComparisonRankingItem[];
  newClientsList: ComparisonClientItem[];
  recurringClientsList: ComparisonClientItem[];
  clientMix: Array<{ name: string; value: number; revenue: number }>;
}

export interface ComparisonRankingItem {
  name: string;
  sales: number;
  revenue: number;
  share: number;
  previousSales: number;
  previousRevenue: number;
  salesGrowth: number;
  revenueGrowth: number;
}

export interface ComparisonClientItem extends ComparisonRankingItem {
  firstPurchaseDate: string;
  lastPurchaseDate: string;
}

export interface RawSaleData extends CorporateSale {
  sellerName: string;
}

export interface SellerClientBreakdownItem {
  clientName: string;
  totalSales: number;
  totalRevenue: number;
  avgTicket: number;
  lastSaleDate: string;
  productsCount: number;
  revenueShare: number;
}

export interface SellerClientBreakdown {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  totalRevenue: number;
  avgTicket: number;
  uniqueClients: number;
  lastSaleDate: string;
  topClientName: string;
  topClientRevenue: number;
  clients: SellerClientBreakdownItem[];
}
