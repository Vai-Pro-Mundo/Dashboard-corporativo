import { formatCurrency, formatDate } from '@/lib/format';
import { getSellersData } from '@/lib/sellers-data';

export const dynamic = 'force-dynamic';

interface SellersPageProps {
  searchParams?: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
}

function defaultDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function SellersPage({ searchParams }: SellersPageProps) {
  const params = (await searchParams) || {};
  const defaults = defaultDateRange();
  const startDate = params.startDate || defaults.startDate;
  const endDate = params.endDate || defaults.endDate;

  try {
    const data = await getSellersData(startDate, endDate);
    const topSellers = data.slice(0, 10);
    const maxRevenue = Math.max(...topSellers.map((seller) => seller.totalRevenue), 1);
    const totalRevenue = data.reduce((sum, seller) => sum + seller.totalRevenue, 0);
    const totalIncome = data.reduce((sum, seller) => sum + seller.totalIncome, 0);
    const totalSales = data.reduce((sum, seller) => sum + seller.totalSales, 0);
    const topSeller = data[0];

    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Performance comercial</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Vendedores</h1>
        </div>

        <form
          className="grid grid-cols-1 gap-4 rounded border border-cyan-400/15 bg-[#0B2440] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.24)] md:grid-cols-[1fr_1fr_auto]"
          method="get"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data inicial</span>
            <input
              className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
              type="date"
              name="startDate"
              defaultValue={startDate}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data final</span>
            <input
              className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
              type="date"
              name="endDate"
              defaultValue={endDate}
            />
          </label>
          <button className="self-end rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300">
            Aplicar
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <p className="text-sm text-cyan-100/60">Vendedores</p>
            <p className="mt-2 text-3xl font-bold text-white">{data.length}</p>
          </div>
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <p className="text-sm text-cyan-100/60">Vendas</p>
            <p className="mt-2 text-3xl font-bold text-white">{totalSales}</p>
          </div>
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <p className="text-sm text-cyan-100/60">Faturamento</p>
            <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <p className="text-sm text-cyan-100/60">Receita</p>
            <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
            <p className="text-sm text-cyan-100/60">Lider</p>
            <p className="mt-2 truncate text-2xl font-bold text-white">{topSeller?.name || '-'}</p>
            <p className="mt-1 text-sm text-emerald-200">{topSeller ? formatCurrency(topSeller.totalRevenue) : 'Sem dados'}</p>
          </div>
        </div>

        <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          <h2 className="mb-5 text-lg font-semibold text-white">Top vendedores por faturamento</h2>
          <div className="space-y-4">
            {topSellers.map((seller) => (
              <div key={seller.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr_160px_160px]">
                <div className="truncate text-sm font-medium text-cyan-50">{seller.name}</div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-950/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-300"
                    style={{ width: `${Math.max(4, (seller.totalRevenue / maxRevenue) * 100)}%` }}
                  />
                </div>
                <div className="text-sm font-semibold text-cyan-50 md:text-right">{formatCurrency(seller.totalRevenue)}</div>
                <div className="text-sm font-semibold text-amber-200 md:text-right">{formatCurrency(seller.totalIncome)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded border border-cyan-400/15 bg-[#0B2440] shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          <h3 className="border-b border-cyan-400/15 p-6 text-lg font-semibold text-white">Total: {data.length} vendedores</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-cyan-400/15 bg-slate-950/25">
                <tr>
                  {['Nome do Vendedor', 'Vendas', 'Faturamento', 'Receita', 'Em Aberto', 'Ticket Medio', 'Ultima Venda'].map((heading) => (
                    <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/60">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-400/10">
                {data.map((seller) => (
                  <tr key={seller.id} className="transition-colors hover:bg-white/[0.04]">
                    <td className="px-6 py-4 text-sm text-cyan-50">{seller.name}</td>
                    <td className="px-6 py-4 text-sm text-cyan-50">{seller.totalSales}</td>
                    <td className="px-6 py-4 text-sm text-cyan-50">{formatCurrency(seller.totalRevenue)}</td>
                    <td className="px-6 py-4 text-sm text-amber-200">{formatCurrency(seller.totalIncome)}</td>
                    <td className="px-6 py-4 text-sm text-amber-300">{seller.openSales > 0 ? formatCurrency(seller.openRevenue) : '-'}</td>
                    <td className="px-6 py-4 text-sm text-cyan-50">{formatCurrency(seller.avgTicket)}</td>
                    <td className="px-6 py-4 text-sm text-cyan-50">{formatDate(seller.lastSaleDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <div className="py-8 text-center text-cyan-100/70">Nenhum dado disponivel</div>}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Vendedores</h1>
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">Falha ao carregar dados: {message}</div>
      </div>
    );
  }
}
