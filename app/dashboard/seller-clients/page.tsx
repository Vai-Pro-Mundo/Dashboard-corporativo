'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { SellerClientBreakdown } from '@/types';

export default function SellerClientsPage() {
  const [data, setData] = useState<SellerClientBreakdown[]>([]);
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
        const response = await fetch(`/api/seller-clients?${params}`);
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

  const summary = useMemo(() => {
    const totalRevenue = data.reduce((sum, seller) => sum + seller.totalRevenue, 0);
    const totalIncome = data.reduce((sum, seller) => sum + seller.totalIncome, 0);
    const totalSales = data.reduce((sum, seller) => sum + seller.totalSales, 0);
    const uniqueClients = new Set(data.flatMap((seller) => seller.clients.map((client) => client.clientName))).size;

    return {
      totalRevenue,
      totalIncome,
      totalSales,
      uniqueClients,
      topSeller: data[0] || null,
    };
  }, [data]);

  const chartData = useMemo(
    () =>
      data.slice(0, 8).map((seller) => ({
        name: seller.sellerName.length > 18 ? `${seller.sellerName.slice(0, 18)}...` : seller.sellerName,
        faturamento: seller.totalRevenue,
        receita: seller.totalIncome,
        clientes: seller.uniqueClients,
      })),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Relacao comercial</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Vendedor x Cliente</h1>
        <p className="mt-1 text-cyan-100/60">Veja quanto cada vendedor faturou e gerou de receita para cada cliente no periodo selecionado.</p>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <KpiCard title="Vendedores" value={data.length} subtitle="Com vendas no periodo" />
            <KpiCard title="Clientes" value={summary.uniqueClients} subtitle="Relacionamento ativo no periodo" />
            <KpiCard title="Vendas" value={summary.totalSales} subtitle="Operacoes somadas" />
            <KpiCard title="Faturamento" value={formatCurrency(summary.totalRevenue)} subtitle={summary.topSeller ? `Lider: ${summary.topSeller.sellerName}` : 'Sem dados no periodo'} />
            <KpiCard title="Receita" value={formatCurrency(summary.totalIncome)} subtitle="Receita total no periodo" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartComponent
              data={chartData}
              title="Top vendedores por faturamento e receita"
              bars={[
                { key: 'faturamento', label: 'Faturamento', color: '#10B981', yAxisId: 'left' },
                { key: 'receita', label: 'Receita', color: '#FBBF24', yAxisId: 'right' },
              ]}
              formatYAxis="currency"
              height={340}
            />
            <BarChartComponent data={chartData} title="Top vendedores por clientes atendidos" bars={[{ key: 'clientes', label: 'Clientes', color: '#38BDF8' }]} height={340} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {data.map((seller) => (
              <section key={seller.sellerId} className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col gap-4 border-b border-cyan-400/10 pb-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/60">Vendedor</p>
                    <h2 className="mt-1 text-2xl font-bold text-white">{seller.sellerName}</h2>
                    <p className="mt-2 text-sm text-cyan-100/65">
                      {seller.totalSales} vendas, {seller.uniqueClients} clientes, ultima venda em {formatDate(seller.lastSaleDate)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
                    <div className="rounded border border-cyan-400/10 bg-slate-950/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/55">Faturamento</p>
                      <p className="mt-1 text-lg font-bold text-white">{formatCurrency(seller.totalRevenue)}</p>
                    </div>
                    <div className="rounded border border-cyan-400/10 bg-slate-950/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/55">Receita</p>
                      <p className="mt-1 text-lg font-bold text-amber-200">{formatCurrency(seller.totalIncome)}</p>
                    </div>
                    <div className="rounded border border-cyan-400/10 bg-slate-950/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/55">Ticket medio</p>
                      <p className="mt-1 text-lg font-bold text-white">{formatCurrency(seller.avgTicket)}</p>
                    </div>
                    <div className="rounded border border-cyan-400/10 bg-slate-950/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/55">Melhor cliente</p>
                      <p className="mt-1 text-base font-bold text-emerald-300">{seller.topClientName}</p>
                      <p className="mt-1 text-sm text-cyan-100/70">
                        {formatCurrency(seller.topClientRevenue)} | {formatCurrency(seller.topClientIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {seller.clients.slice(0, 6).map((client) => (
                    <article key={`${seller.sellerId}-${client.clientName}`} className="rounded border border-cyan-400/10 bg-slate-950/20 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-white">{client.clientName}</h3>
                          <p className="mt-1 text-sm text-cyan-100/65">
                            {client.totalSales} vendas, {client.productsCount} produtos, ultima em {formatDate(client.lastSaleDate)}
                          </p>
                        </div>
                        <div className="md:text-right">
                          <p className="text-lg font-bold text-emerald-300">{formatCurrency(client.totalRevenue)}</p>
                          <p className="text-sm text-amber-200">Receita: {formatCurrency(client.totalIncome)}</p>
                          <p className="text-sm text-cyan-100/65">Ticket: {formatCurrency(client.avgTicket)}</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-cyan-100/55">
                          <span>Participacao no vendedor</span>
                          <span>{client.revenueShare.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400" style={{ width: `${Math.max(client.revenueShare, 3)}%` }} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {data.length === 0 && <div className="py-12 text-center text-cyan-100/70">Nenhum dado encontrado para o periodo selecionado.</div>}
        </>
      )}
    </div>
  );
}
