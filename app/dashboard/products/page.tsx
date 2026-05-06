'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { ProductsData } from '@/types';

export default function ProductsPage() {
  const [data, setData] = useState<ProductsData[]>([]);
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
      const response = await fetch(`/api/products?${params}`);
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

  const summary = useMemo(() => {
    const totalRevenue = data.reduce((sum, product) => sum + product.totalRevenue, 0);
    const totalIncome = data.reduce((sum, product) => sum + product.totalIncome, 0);
    const totalSales = data.reduce((sum, product) => sum + product.totalSales, 0);
    const unitsSold = data.reduce((sum, product) => sum + product.unitsSold, 0);
    const topProduct = data[0];

    return {
      totalRevenue,
      totalIncome,
      totalSales,
      unitsSold,
      avgPrice: totalSales > 0 ? totalRevenue / totalSales : 0,
      topProduct,
    };
  }, [data]);

  const chartData = data.slice(0, 10).map((product) => ({
    name: product.name.length > 22 ? `${product.name.slice(0, 22)}...` : product.name,
    faturamento: product.totalRevenue,
    receita: product.totalIncome,
    vendas: product.totalSales,
  }));

  const columns = [
    { key: 'name' as const, label: 'Nome do Produto', width: '26%' },
    { key: 'totalSales' as const, label: 'Total de Vendas', render: (value: number) => value },
    { key: 'totalRevenue' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'totalIncome' as const, label: 'Receita', render: (value: number) => formatCurrency(value) },
    { key: 'avgPrice' as const, label: 'Preco Medio', render: (value: number) => formatCurrency(value) },
    { key: 'unitsSold' as const, label: 'Unidades Vendidas', render: (value: number) => value },
    { key: 'lastSaleDate' as const, label: 'Ultima Venda', render: (value: Date) => formatDate(value) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Mix de vendas</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Produtos</h1>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <KpiCard title="Produtos" value={data.length} subtitle="Itens vendidos" />
            <KpiCard title="Vendas" value={summary.totalSales} subtitle={`${summary.unitsSold} unidades`} />
            <KpiCard title="Faturamento" value={formatCurrency(summary.totalRevenue)} subtitle={`Media: ${formatCurrency(summary.avgPrice)}`} />
            <KpiCard title="Receita" value={formatCurrency(summary.totalIncome)} subtitle="Receita total no periodo" />
            <KpiCard
              title="Produto Lider"
              value={summary.topProduct?.name || '-'}
              subtitle={summary.topProduct ? formatCurrency(summary.topProduct.totalRevenue) : 'Sem dados'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartComponent
              data={chartData}
              title="Top produtos por faturamento e receita"
              bars={[
                { key: 'faturamento', label: 'Faturamento', color: '#10B981', yAxisId: 'left' },
                { key: 'receita', label: 'Receita', color: '#FBBF24', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={350}
            />
            <BarChartComponent data={chartData} title="Top produtos por volume" bars={[{ key: 'vendas', label: 'Vendas', color: '#38BDF8' }]} height={350} />
          </div>

          <DataTable data={data} columns={columns} title={`Total: ${data.length} produtos`} />
        </>
      )}
    </div>
  );
}
