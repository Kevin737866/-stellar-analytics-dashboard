import { TransactionsChart } from "../components/TransactionsChart";
import { useDashboardData } from "../hooks/useDashboardData";

export function DashboardPage() {
  const data = useDashboardData();

  return (
    <main className="app">
      <h1>Stellar Analytics Dashboard</h1>
      <p>Network: {data.network}</p>
      <div className="grid">
        <article className="card">
          <h3>Total Ledgers</h3>
          <p>{data.totalLedgers}</p>
        </article>
        <article className="card">
          <h3>Total Transactions</h3>
          <p>{data.totalTransactions}</p>
        </article>
      </div>
      <div className="grid">
        <TransactionsChart />
      </div>
    </main>
  );
}
