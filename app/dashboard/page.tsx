'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { PieChartComponent } from '@/components/PieChartComponent';
import { formatCurrency } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { OverviewData } from '@/types';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { startDate, endDate, setDateRange } = useSharedDateRange();

  const fetchData = async (start: Date, end: Date) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      const response = await fetch(`/api/overview?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.details || result?.error || 'Falha ao carregar dados');
      }

      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate]);

  const rankingData = useMemo(
    () => ({
      sellers: (data?.topSellers || []).map((item) => ({
        name: item.name.split(' ')[0],
        revenue: item.revenue,
        income: item.income,
        sales: item.sales,
      })),
      clients: (data?.topClients || []).map((item) => ({
        name: item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name,
        revenue: item.revenue,
        income: item.income,
        sales: item.sales,
      })),
      products: (data?.topProducts || []).map((item) => ({
        name: item.name,
        revenue: item.revenue,
        income: item.income,
        sales: item.sales,
      })),
    }),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Visao Geral</h1>
        <p className="mt-1 text-cyan-100/60">Leitura executiva de faturamento, receita, clientes e mix de produtos.</p>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-red-400/40 bg-red-950/70 p-4 text-red-100">{error}</div>}

      {data && !loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
            <KpiCard
              title="Vendas"
              value={data.totalSales}
              subtitle="Total do periodo"
              trend={{ value: Math.abs(data.growthRate), direction: data.growthRate >= 0 ? 'up' : 'down' }}
            />
            <KpiCard title="Faturamento" value={formatCurrency(data.totalRevenue)} subtitle={`Ticket medio: ${formatCurrency(data.avgTicket)}`} />
            <KpiCard title="Receita" value={formatCurrency(data.totalIncome)} subtitle="Receita somada no periodo" />
            <KpiCard title="Melhor Vendedor" value={data.topSellerName} subtitle={formatCurrency(data.topSellerAmount)} />
            <KpiCard title="Melhor Cliente" value={data.topClientName} subtitle={formatCurrency(data.topClientAmount)} />
            <KpiCard title="Melhor Produto" value={data.topProductName} subtitle={formatCurrency(data.topProductAmount)} />
            <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
              <p className="text-sm text-cyan-100/60">Destino</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold text-white">{data.nationalSales ?? 0}</p>
                  <p className="mt-0.5 text-xs text-cyan-100/50">Nacional</p>
                </div>
                <div className="h-8 w-px bg-cyan-400/20" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-sky-300">{data.internationalSales ?? 0}</p>
                  <p className="mt-0.5 text-xs text-cyan-100/50">Internacional</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <BarChartComponent
              data={rankingData.sellers}
              title="Top vendedores: faturamento e vendas"
              bars={[
                { key: 'revenue', label: 'Faturamento', color: '#34D399', yAxisId: 'left' },
                { key: 'sales', label: 'Qtd. vendas', color: '#38BDF8', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={320}
            />
            <BarChartComponent
              data={rankingData.clients}
              title="Top clientes: faturamento e compras"
              bars={[
                { key: 'revenue', label: 'Faturamento', color: '#22D3EE', yAxisId: 'left' },
                { key: 'sales', label: 'Qtd. compras', color: '#FBBF24', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={320}
            />
            <BarChartComponent
              data={rankingData.products}
              title="Mix por produto: faturamento e vendas"
              bars={[
                { key: 'revenue', label: 'Faturamento', color: '#FBBF24', yAxisId: 'left' },
                { key: 'sales', label: 'Qtd. vendas', color: '#A78BFA', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={320}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PieChartComponent
              data={rankingData.products.map((item) => ({
                name: item.name,
                value: item.sales,
                revenue: item.revenue,
              }))}
              title="Produtos: participacao em quantidade"
              valueLabel="Vendas"
              height={340}
            />
            <PieChartComponent
              data={rankingData.clients.slice(0, 8).map((item) => ({
                name: item.name,
                value: item.sales,
                revenue: item.revenue,
              }))}
              title="Clientes: participacao em compras"
              valueLabel="Compras"
              height={340}
            />
          </div>
        </>
      )}
    </div>
  );
}
