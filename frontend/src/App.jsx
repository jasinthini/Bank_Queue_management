import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Board from "./pages/Board.jsx";
import Counter from "./pages/Counter.jsx";
import Admin from "./pages/Admin.jsx";
import Reports from "./pages/Reports.jsx";
import Ticket from "./pages/Ticket.jsx";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-token text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/board" element={<Board />} />
      <Route path="/counter" element={<Counter />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/ticket" element={<Ticket />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
