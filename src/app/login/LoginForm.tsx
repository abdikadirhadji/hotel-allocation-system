"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      setLoading(false);

      if (result?.error) {
        setError("بيانات الدخول غير صحيحة أو أن الحساب غير مفعل");
        return;
      }

      if (!result?.url) {
        setError("تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
        return;
      }

      window.location.href = result.url;
    } catch {
      setLoading(false);
      setError("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    }
  }

  return (
    <form action={handleSubmit} className="card mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h1 className="page-title">تسجيل دخول المشرف</h1>
        <p className="mt-2 text-sm text-slate-500">ادخل بحساب الإدارة للوصول إلى النظام</p>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <input
        type="email"
        name="email"
        placeholder="البريد الإلكتروني"
        className="field"
        required
      />
      <input
        type="password"
        name="password"
        placeholder="كلمة المرور"
        className="field"
        required
      />
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "جاري تسجيل الدخول..." : "دخول"}
      </button>
    </form>
  );
}
