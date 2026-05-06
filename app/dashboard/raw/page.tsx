'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSharedDateRange } from '@/lib/use-shared-date-range';
import { RawSaleData } from '@/types';

export default function RawPage() {
  const [data, setData] = useState<RawSaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, pages: 0 });
  const { startDate, endDate, setDateRange } = useSharedDateRange();

  const fetchData = async (start: Date, end: Date, page: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        page: page.toString(),
        pageSize: '50',
      });
      const response = await fetch(`/api/raw?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.details || result?.error || 'Falha ao carregar dados');
      }

      setData(result.data);
      setPagination(result.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(startDate, endDate, pagination.page);
  }, [startDate, endDate]);

  const handleDateChange = (newStart: Date, newEnd: Date) => {
    setDateRange(newStart, newEnd);
    setPagination({ ...pagination, page: 1 });
  };

  const columns = [
    { key: 'date' as const, label: 'Data', render: (value: Date) => formatDate(value) },
    { key: 'sellerName' as const, label: 'Vendedor', width: '18%' },
    { key: 'client' as const, label: 'Cliente', width: '18%' },
    { key: 'product' as const, label: 'Produto', width: '18%' },
    { key: 'amount' as const, label: 'Faturamento', render: (value: number) => formatCurrency(value) },
    { key: 'commission' as const, label: 'Receita', render: (value: number) => formatCurrency(value) },
    {
      key: 'status' as const,
      label: 'Status',
      render: (value: string) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            value === 'Fechada'
              ? 'bg-emerald-400/15 text-emerald-200'
              : value === 'Cancelada'
              ? 'bg-rose-400/15 text-rose-200'
              : 'bg-amber-400/15 text-amber-200'
          }`}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Auditoria</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Dados Brutos de Vendas</h1>
      </div>

      <DateRangePicker onDateChange={handleDateChange} defaultStartDate={startDate} defaultEndDate={endDate} />

      {loading && <div className="py-8 text-center text-cyan-100/70">Carregando dados...</div>}
      {error && <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">{error}</div>}

      {!loading && !error && (
        <>
          <DataTable data={data} columns={columns} title={`Total: ${pagination.total} vendas (Pagina ${pagination.page} de ${pagination.pages})`} />

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  if (pagination.page > 1) {
                    fetchData(startDate, endDate, pagination.page - 1);
                    setPagination({ ...pagination, page: pagination.page - 1 });
                  }
                }}
                disabled={pagination.page === 1}
                className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-cyan-100/40"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-cyan-50">{pagination.page}</span>
              <button
                onClick={() => {
                  if (pagination.page < pagination.pages) {
                    fetchData(startDate, endDate, pagination.page + 1);
                    setPagination({ ...pagination, page: pagination.page + 1 });
                  }
                }}
                disabled={pagination.page === pagination.pages}
                className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-cyan-100/40"
              >
                Proxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
