import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import CheminformaticsPage from "./pages/CheminformaticsPage";
import CompoundRecordPage from "./pages/CompoundRecordPage";
import DatabaseListPage from "./pages/DatabaseListPage";
import FieldManagerPage from "./pages/FieldManagerPage";
import RecordListPage from "./pages/RecordListPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<CheminformaticsPage />} />
        <Route path="compounds/:moleculeId" element={<CompoundRecordPage />} />
        <Route path="databases" element={<DatabaseListPage />} />
        <Route path="databases/:id/fields" element={<FieldManagerPage />} />
        <Route path="databases/:id/records" element={<RecordListPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
