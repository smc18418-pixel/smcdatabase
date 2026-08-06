// SamuraiDashboard.jsx
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function SamuraiDashboard() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    const { data } = await supabase
      .from("members")
      .select("membership_code, full_name, phone, status, registration_date")
      .ilike("full_name", `%${search}%`);
    setResult(data);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl mb-4">لوحة الساموراي</h1>
      <input
        type="text"
        placeholder="ابحث بالاسم أو رمز العضوية"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 p-2 rounded text-black"
      />
      <button onClick={handleSearch} className="bg-red-600 px-4 py-2 rounded">
        بحث
      </button>
      {result && result.map((m) => (
        <div key={m.membership_code} className="mt-4 p-4 border border-white rounded
// SamuraiDashboard.jsx
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function SamuraiDashboard() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    const { data } = await supabase
      .from("members")
      .select("membership_code, full_name, phone, status, registration_date")
      .ilike("full_name", `%${search}%`);
    setResult(data);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl mb-4">لوحة الساموراي</h1>
      <input
        type="text"
        placeholder="ابحث بالاسم أو رمز العضوية"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 p-2 rounded text-black"
      />
      <button onClick={handleSearch} className="bg-red-600 px-4 py-2 rounded">
        بحث
      </button>
      {result && result.map((m) => (
        <div key={m.membership_code} className="mt-4 p-4 border border-white rounded">
          <p>رمز العضوية: {m.membership_code}</p>
          <p>الاسم: {m.full_name}</p>
          <p>الهاتف: {m.phone}</p>
          <p>الحالة: {m.status}</p>
          <p>تاريخ التسجيل: {m.registration_date}</p>
        </div>
      ))}
    </div>
  );
}