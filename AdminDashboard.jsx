// AdminDashboard.jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AdminDashboard({ user }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data } = await supabase.from("members").select("*");
    setMembers(data);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl mb-4">مرحباً {user.full_name} ({user.membership_code})</h1>
      <button className="bg-green-600 px-4 py-2 rounded mb-4">➕ تسجيل عضو جديد</button>
      <table className="table-auto w-full text-center">
        <thead>
          <tr>
            <th>رمز العضوية</th>
            <th>الاسم</th>
            <th>الهاتف</th>
            <th>الحالة</th>
            <th>تاريخ التسجيل</th>
            <th>تاريخ انتهاء العضوية</th>
            <th>خيارات</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.membership_code}</td>
              <td>{m.full_name}</td>
              <td>{m.phone}</td>
              <td>{m.status}</td>
              <td>{m.registration_date}</td>
              <td>{m.expiry_date}</td>
              <td>
                <button className="bg-blue-600 px-2 py-1 rounded">تعديل</button>
                <button className="bg-yellow-600 px-2 py-1 rounded">ترقية</button>
                <button className="bg-red-600 px-2 py-1 rounded">حظر</button>
                <button className="bg-purple-600 px-2 py-1 rounded">شهادة</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}