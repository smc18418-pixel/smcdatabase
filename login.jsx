// src/Login.jsx
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ setRole, setUser }) {
  const [membershipCode, setMembershipCode] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("membership_code", membershipCode)
      .eq("password", password)
      .single();

    if (error || !data) {
      alert("❌ رمز العضوية أو كلمة السر غير صحيحة");
      return;
    }

    if (data.status !== "نشط") {
      alert("⚠️ عضويتك غير نشطة أو محظورة");
      return;
    }

    setRole(data.rank);
    setUser(data);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-96 text-white">
        <div className="flex flex-col items-center mb-6">
          <img src="/smc-logo.png" alt="SMC Logo" className="w-20 mb-4" />
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
        </div>
        <input
          type="text"
          placeholder="رمز العضوية"
          value={membershipCode}
          onChange={(e) => setMembershipCode(e.target.value)}
          className="w-full mb-4 p-2 rounded text-black"
        />
        <input
          type="password"
          placeholder="كلمة السر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-2 rounded text-black"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold"
        >
          دخول
        </button>
      </div>
    </div>
  );
}