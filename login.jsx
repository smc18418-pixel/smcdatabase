// Login.jsx
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ setRole }) {
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

    setRole(data.rank); // يحدد نوع الدخول (مسؤول / مشرف / ساموراي)
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <img src="/smc-logo.png" alt="SMC Logo" className="mb-6 w-32" />
      <h1 className="text-2xl mb-4">تسجيل الدخول</h1>
      <input
        type="text"
        placeholder="رمز العضوية"
        value={membershipCode}
        onChange={(e) => setMembershipCode(e.target.value)}
        className="mb-2 p-2 rounded text-black"
      />
      <input
        type="password"
        placeholder="كلمة السر"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2 p-2 rounded text-black"
      />
      <button onClick={handleLogin} className="bg-red-600 px-4 py-2 rounded">
        دخول
      </button>
    </div>
  );
}