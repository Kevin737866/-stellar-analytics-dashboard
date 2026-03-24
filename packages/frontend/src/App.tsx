import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Network } from '@/pages/Network';
import { Accounts } from '@/pages/Accounts';
import { Transactions } from '@/pages/Transactions';
import { Assets } from '@/pages/Assets';
import { AccountDetail } from '@/pages/AccountDetail';
import { TransactionDetail } from '@/pages/TransactionDetail';
import { NotFound } from '@/pages/NotFound';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/network" element={<Network />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:accountId" element={<AccountDetail />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/:hash" element={<TransactionDetail />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
