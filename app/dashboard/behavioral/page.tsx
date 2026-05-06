'use client';

import React, { useEffect, useState } from 'react';
import { BarChartComponent } from '@/components/BarChartComponent';
import { DateRangePicker } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { LineChartComponent } from '@/components/LineChartComponent';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { BehavioralData } from '@/types';

export default function BehavioralPage() {
  const [data, setData] = useState<BehavioralData | null>(null);
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
      const response = await fetch(`/api/behavioral?${params}`);
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Padroes de compra</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Comportamento</h1>
      </div>

      <DateRangePicker onDateChange={setDateRange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {data && !loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <KpiCard title="Vendas no Periodo" value={data.totalSales} subtitle="Registros filtrados por data de venda" />
            <KpiCard title="Faturamento" value={formatCurrency(data.totalRevenue)} subtitle="Faturamento do periodo" />
            <KpiCard title="Receita" value={formatCurrency(data.totalIncome)} subtitle="Receita do periodo" />
            <KpiCard title="Antecedencia Media" value={`${formatNumber(data.avgAdvanceDays, 1)} dias`} subtitle="Da venda ate o inicio da viagem" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartComponent data={data.bookingPatterns} title="Vendas por antecedencia" bars={[{ key: 'sales', label: 'Vendas', color: '#38BDF8' }]} height={340} />
            <BarChartComponent data={data.customerProfiles} title="Perfil de recorrencia dos clientes" bars={[{ key: 'clients', label: 'Clientes', color: '#10B981' }]} height={340} />
          </div>

          <LineChartComponent
            data={data.salesByDate}
            title="Evolucao de vendas, faturamento e receita no periodo"
            lines={[
              { key: 'sales', label: 'Vendas', color: '#38BDF8' },
              { key: 'revenue', label: 'Faturamento', color: '#10B981' },
              { key: 'income', label: 'Receita', color: '#FBBF24' },
            ]}
            formatYAxis="number"
            height={360}
          />
        </>
      )}
    </div>
  );
}
