import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewLead from './pages/NewLead';
import LeadDetail from './pages/LeadDetail';
import GeneratedSites from './pages/GeneratedSites';
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads/new" element={<NewLead />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="websites" element={<GeneratedSites />} />
      </Route>
    </Routes>
  );
}

export default App;
