'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { ClientsData } from '@/types';

export default function ClientsPage() {
  const [data, setData] = useState<ClientsData[]>([]);
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
      const response = await fetch(`/api/clients?${params}`);
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
    const totalSpent = data.reduce((sum, client) => sum + client.totalSpent, 0);
    const totalIncome = data.reduce((sum, client) => sum + client.totalIncome, 0);
    const totalPurchases = data.reduce((sum, client) => sum + client.totalPurchases, 0);
    const topClient = data[0];
    const mostRecurringClient = [...data].sort((a, b) => b.totalPurchases - a.totalPurchases)[0];

    return {
      totalSpent,
      totalIncome,
      totalPurchases,
      avgTicket: totalPurchases > 0 ? totalSpent / totalPurchases : 0,
      topClient,
      mostRecurringClient,
    };
  }, [data]);

  const chartData = data.slice(0, 10).map((client) => ({
    name: client.name.length > 24 ? `${client.name.slice(0, 24)}...` : client.name,
    faturamento: client.totalSpent,
    receita: client.totalIncome,
    compras: client.totalPurchases,
  }));

  const recurrenceRanking = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.totalPurchases - a.totalPurchases || b.totalSpent - a.totalSpent)
        .slice(0, 10),
    [data]
  );

  const columns = [
    { key: 'name' as const, label: 'Nome do Cliente', width: '20%' },
    { key: 'totalPurchases' as const, label: 'Total de Compras', render: (value: number) => value },
    { key: 'tipo' as const, label: 'Tipo', render: (value: string) => value },
    { key: 'totalSpent' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'totalIncome' as const, label: 'Receita', render: (value: number) => formatCurrency(value) },
    { key: 'margemPercent' as const, label: 'Margem %', render: (value: number) => `${value}%` },
    { key: 'avgTicket' as const, label: 'Ticket Medio', render: (value: number) => formatCurrency(value) },
    { key: 'productsCount' as const, label: 'Produtos Diferentes', render: (value: number) => value },
    { key: 'firstPurchaseDate' as const, label: 'Primeira Compra', render: (value: string | null) => value ? formatDate(value) : '-' },
    { key: 'lastPurchaseDate' as const, label: 'Ultima Compra', render: (value: string) => formatDate(value) },
    { key: 'destinoLider' as const, label: 'Destino Lider', render: (value: string) => value },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Analise comercial</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Clientes</h1>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <KpiCard title="Clientes" value={data.length} subtitle="Pagantes unicos no periodo" />
            <KpiCard title="Compras" value={summary.totalPurchases} subtitle="Quantidade de vendas" />
            <KpiCard title="Faturamento" value={formatCurrency(summary.totalSpent)} subtitle={`Ticket: ${formatCurrency(summary.avgTicket)}`} />
            <KpiCard title="Receita" value={formatCurrency(summary.totalIncome)} subtitle="Receita total no periodo" />
            <KpiCard
              title="Mais Recorrente"
              value={summary.mostRecurringClient?.name || '-'}
              subtitle={
                summary.mostRecurringClient
                  ? `${summary.mostRecurringClient.totalPurchases} compras | ${formatCurrency(summary.mostRecurringClient.totalSpent)}`
                  : 'Sem dados'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <BarChartComponent
              data={chartData}
              title="Top clientes por faturamento e receita"
              bars={[
                { key: 'faturamento', label: 'Faturamento', color: '#10B981', yAxisId: 'left' },
                { key: 'receita', label: 'Receita', color: '#FBBF24', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={350}
            />
            <BarChartComponent data={chartData} title="Top clientes por quantidade de compras" bars={[{ key: 'compras', label: 'Compras', color: '#38BDF8' }]} height={350} />
            <DataTable
              data={recurrenceRanking}
              title="Ranking de recorrencia"
              maxHeight="350px"
              columns={[
                { key: 'name' as const, label: 'Cliente', width: '36%' },
                { key: 'totalPurchases' as const, label: 'Compras', render: (value: number) => value },
                { key: 'totalSpent' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
                { key: 'totalIncome' as const, label: 'Receita', render: (value: number) => formatCurrency(value) },
              ]}
            />
          </div>

          <DataTable data={data} columns={columns} title={`Ranking geral de clientes: ${data.length}`} />
        </>
      )}
    </div>
  );
}
