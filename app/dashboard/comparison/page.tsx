'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { PieChartComponent } from '@/components/PieChartComponent';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { ComparisonClientItem, ComparisonData, ComparisonRankingItem } from '@/types';

export default function ComparisonPage() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { startDate, endDate, setDateRange } = useSharedDateRange();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });
        const response = await fetch(`/api/comparison?${params}`);
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

    fetchData();
  }, [startDate, endDate]);

  const comparisonCharts = useMemo(() => {
    if (!data) return null;

    return {
      revenue: [
        { name: 'Anterior', total: data.previousPeriod.totalRevenue },
        { name: 'Atual', total: data.currentPeriod.totalRevenue },
      ],
      sales: [
        { name: 'Anterior', total: data.previousPeriod.totalSales },
        { name: 'Atual', total: data.currentPeriod.totalSales },
      ],
      ticket: [
        { name: 'Anterior', total: data.previousPeriod.avgTicket },
        { name: 'Atual', total: data.currentPeriod.avgTicket },
      ],
      sellers: (data.sellerRanking || []).slice(0, 8).map((item) => ({
        name: truncate(item.name, 16),
        faturamento: item.revenue,
        vendas: item.sales,
      })),
      products: (data.productRanking || []).slice(0, 8).map((item) => ({
        name: truncate(item.name, 18),
        faturamento: item.revenue,
        vendas: item.sales,
      })),
    };
  }, [data]);

  const sellerColumns = [
    { key: 'name' as const, label: 'Vendedor', width: '26%' },
    { key: 'sales' as const, label: 'Vendas', render: (value: number) => value },
    { key: 'revenue' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'share' as const, label: 'Participacao', render: (value: number) => formatPercentage(value) },
    { key: 'revenueGrowth' as const, label: 'Vs periodo anterior', render: (value: number) => renderGrowth(value) },
  ];

  const productColumns = [
    { key: 'name' as const, label: 'Produto', width: '28%' },
    { key: 'sales' as const, label: 'Vendas', render: (value: number) => value },
    { key: 'revenue' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'share' as const, label: 'Participacao', render: (value: number) => formatPercentage(value) },
    { key: 'revenueGrowth' as const, label: 'Vs periodo anterior', render: (value: number) => renderGrowth(value) },
  ];

  const newClientColumns = [
    { key: 'name' as const, label: 'Cliente novo', width: '28%' },
    { key: 'firstPurchaseDate' as const, label: 'Primeira compra', render: (value: string) => formatDate(value) },
    { key: 'sales' as const, label: 'Compras no periodo', render: (value: number) => value },
    { key: 'revenue' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'share' as const, label: 'Participacao', render: (value: number) => formatPercentage(value) },
  ];

  const recurringClientColumns = [
    { key: 'name' as const, label: 'Cliente recorrente', width: '28%' },
    { key: 'lastPurchaseDate' as const, label: 'Ultima compra', render: (value: string) => formatDate(value) },
    { key: 'sales' as const, label: 'Compras no periodo', render: (value: number) => value },
    { key: 'revenue' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'revenueGrowth' as const, label: 'Vs periodo anterior', render: (value: number) => renderGrowth(value) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Analise por periodo</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Comparacao</h1>
        <p className="mt-1 text-cyan-100/60">
          Escolha o periodo que deseja analisar para entender melhor produto, melhor vendedor, novos clientes e recorrencia.
        </p>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {data && comparisonCharts && !loading && !error && (
        <>
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border border-slate-500/30 bg-slate-950/25 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Periodo anterior</p>
                <p className="mt-2 text-2xl font-bold text-white">{data.previousPeriodRange?.label || 'Nao informado'}</p>
              </div>
              <div className="rounded border border-emerald-300/30 bg-emerald-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Periodo selecionado</p>
                <p className="mt-2 text-2xl font-bold text-white">{data.currentPeriodRange?.label || data.period}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-cyan-100/60">
              Toda a leitura abaixo usa o intervalo que voce escolheu acima, e tambem mostra a variacao contra o periodo imediatamente anterior.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <KpiCard title="Clientes novos" value={data.summary.newClients} subtitle={`Faturamento: ${formatCurrency(data.summary.newClientsRevenue)}`} />
            <KpiCard title="Clientes recorrentes" value={data.summary.recurringClients} subtitle={`Faturamento: ${formatCurrency(data.summary.recurringRevenue)}`} />
            <KpiCard title="Clientes com recompra" value={data.summary.repeatClients} subtitle={`Taxa: ${formatPercentage(data.summary.repeatRate)}`} />
            <KpiCard title="Clientes totais" value={data.summary.totalClients} subtitle="Clientes ativos no periodo" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <KpiCard
              title="Faturamento"
              value={formatPercentage(data.growth.revenueGrowth)}
              subtitle={`${formatCurrency(data.previousPeriod.totalRevenue)} anterior | ${formatCurrency(data.currentPeriod.totalRevenue)} atual`}
              trend={{ value: Math.abs(data.growth.revenueGrowth), direction: data.growth.revenueGrowth >= 0 ? 'up' : 'down' }}
            />
            <KpiCard
              title="Vendas"
              value={formatPercentage(data.growth.salesGrowth)}
              subtitle={`${data.previousPeriod.totalSales} anterior | ${data.currentPeriod.totalSales} atual`}
              trend={{ value: Math.abs(data.growth.salesGrowth), direction: data.growth.salesGrowth >= 0 ? 'up' : 'down' }}
            />
            <KpiCard
              title="Ticket medio"
              value={formatPercentage(data.growth.avgTicketGrowth)}
              subtitle={`${formatCurrency(data.previousPeriod.avgTicket)} anterior | ${formatCurrency(data.currentPeriod.avgTicket)} atual`}
              trend={{ value: Math.abs(data.growth.avgTicketGrowth), direction: data.growth.avgTicketGrowth >= 0 ? 'up' : 'down' }}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <InsightCard
              title="Melhor vendedor do periodo"
              item={data.topSeller}
              accent="text-emerald-300"
              subtitleLabel="Participacao"
            />
            <InsightCard
              title="Melhor produto do periodo"
              item={data.topProduct}
              accent="text-amber-300"
              subtitleLabel="Participacao"
            />
            <InsightCard
              title="Cliente destaque"
              item={data.topClient}
              accent="text-cyan-300"
              subtitleLabel="Participacao"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <BarChartComponent
              data={comparisonCharts.revenue}
              title="Faturamento: atual x anterior"
              bars={[{ key: 'total', label: 'Faturamento', color: '#10B981' }]}
              formatYAxis="currency"
              height={300}
            />
            <BarChartComponent
              data={comparisonCharts.sales}
              title="Vendas: atual x anterior"
              bars={[{ key: 'total', label: 'Vendas', color: '#38BDF8' }]}
              height={300}
            />
            <BarChartComponent
              data={comparisonCharts.ticket}
              title="Ticket medio: atual x anterior"
              bars={[{ key: 'total', label: 'Ticket medio', color: '#FBBF24' }]}
              formatYAxis="currency"
              height={300}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartComponent
              data={comparisonCharts.sellers}
              title="Top vendedores no periodo"
              bars={[
                { key: 'faturamento', label: 'Faturamento', color: '#10B981', yAxisId: 'left' },
                { key: 'vendas', label: 'Vendas', color: '#38BDF8', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={360}
            />
            <BarChartComponent
              data={comparisonCharts.products}
              title="Top produtos no periodo"
              bars={[
                { key: 'faturamento', label: 'Faturamento', color: '#FBBF24', yAxisId: 'left' },
                { key: 'vendas', label: 'Vendas', color: '#A78BFA', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={360}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <PieChartComponent data={data.clientMix} title="Mix de clientes no periodo" valueLabel="Clientes" height={320} />
            <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)] xl:col-span-2">
              <h3 className="text-lg font-bold text-white">Leitura do periodo selecionado</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <MiniMetric label="Faturamento do melhor vendedor" value={formatCurrency(data.topSeller?.revenue || 0)} />
                <MiniMetric label="Faturamento do melhor produto" value={formatCurrency(data.topProduct?.revenue || 0)} />
                <MiniMetric label="Participacao de clientes novos" value={formatPercentage(data.summary.totalClients > 0 ? (data.summary.newClients / data.summary.totalClients) * 100 : 0)} />
                <MiniMetric label="Participacao de clientes recorrentes" value={formatPercentage(data.summary.totalClients > 0 ? (data.summary.recurringClients / data.summary.totalClients) * 100 : 0)} />
              </div>
            </div>
          </div>

          <DataTable<ComparisonRankingItem> data={data.sellerRanking} columns={sellerColumns} title="Ranking de vendedores no periodo" />
          <DataTable<ComparisonRankingItem> data={data.productRanking} columns={productColumns} title="Ranking de produtos no periodo" />
          <DataTable<ComparisonClientItem> data={data.newClientsList} columns={newClientColumns} title="Clientes novos e primeira compra no periodo" />
          <DataTable<ComparisonClientItem> data={data.recurringClientsList} columns={recurringClientColumns} title="Clientes recorrentes no periodo" />
        </>
      )}
    </div>
  );
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function renderGrowth(value: number) {
  const color = value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-cyan-100';
  const signal = value > 0 ? '+' : '';
  return <span className={color}>{`${signal}${formatPercentage(value)}`}</span>;
}

function InsightCard({
  title,
  item,
  accent,
  subtitleLabel,
}: {
  title: string;
  item: ComparisonRankingItem | null;
  accent: string;
  subtitleLabel: string;
}) {
  return (
    <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/60">{title}</p>
      <p className={`mt-3 text-2xl font-bold ${accent}`}>{item?.name || 'Sem dados'}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric label="Faturamento" value={formatCurrency(item?.revenue || 0)} />
        <MiniMetric label="Vendas" value={String(item?.sales || 0)} />
        <MiniMetric label={subtitleLabel} value={formatPercentage(item?.share || 0)} />
        <MiniMetric label="Vs anterior" value={formatPercentage(item?.revenueGrowth || 0)} highlight={item?.revenueGrowth || 0} />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: number;
}) {
  const color = highlight === undefined ? 'text-white' : highlight > 0 ? 'text-emerald-300' : highlight < 0 ? 'text-rose-300' : 'text-white';

  return (
    <div className="rounded border border-cyan-400/10 bg-slate-950/25 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/55">{label}</p>
      <p className={`mt-1 text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}
