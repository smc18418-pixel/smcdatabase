// App.jsx
import { useState } from "react";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import SupervisorDashboard from "./SupervisorDashboard";
import SamuraiDashboard from "./SamuraiDashboard";

export default function App() {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  if (!role) {
    return <Login setRole={setRole} setUser={setUser} />;
  }

  if (role.includes("مسؤول")) {
    return <AdminDashboard user={user} />;
  }
  if (role.includes("مشرف")) {
    return <SupervisorDashboard user={user} />;
  }
  if (role.includes("ساموراي")) {
    return <SamuraiDashboard user={user} />;
  }

  return <div>❌ لا تملك صلاحيات دخول</div>;
}
// src/App.jsx
export default function App() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <h1 className="text-4xl font-bold text-red-600">
        SMC شغال مع TailwindCSS ✅
      </h1>
    </div>
  );
}