import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFlashMessage } from "@/lib/flash";
import { getRemainingBadgeClass, getRemainingLabel } from "@/lib/status";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    type?: string;
    q?: string;
  }>;
};

async function createClient(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  if (!name) redirect("/clients?type=error&message=client_name_required");
  try {
    await prisma.client.create({ data: { name, country: country || null } });
  } catch {
    redirect("/clients?type=error&message=client_create_failed");
  }
  revalidatePath("/clients");
  redirect("/clients?type=success&message=client_created");
}

async function deleteClient(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/clients?type=error&message=client_delete_failed");
  try {
    await prisma.client.delete({ where: { id } });
  } catch {
    redirect("/clients?type=error&message=client_delete_failed");
  }
  revalidatePath("/clients");
  redirect("/clients?type=success&message=client_deleted");
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const [clients, agreements, bookings] = await Promise.all([
    prisma.client.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { country: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    }),
    prisma.agreement.findMany(),
    prisma.booking.findMany({
      where: { state: { not: "CANCELLED" } },
    }),
  ]);

  const clientStats = new Map(
    clients.map((client) => {
      const clientAgreements = agreements.filter((agreement) => agreement.clientId === client.id);
      const allocation = clientAgreements.reduce((sum, agreement) => sum + agreement.totalRooms, 0);
      const booked = bookings
        .filter((booking) => booking.clientId === client.id)
        .reduce((sum, booking) => sum + booking.rooms, 0);
      const remaining = allocation - booked;
      const utilization = allocation > 0 ? Math.round((booked / allocation) * 100) : 0;

      return [
        client.id,
        {
          allocation,
          booked,
          remaining,
          utilization,
          agreements: clientAgreements.length,
        },
      ];
    }),
  );

  return (
    <div className="space-y-4">
      <h2 className="page-title">العملاء</h2>
      {params?.message ? (
        <div className={params.type === "error" ? "alert-error" : "alert-success"}>
          {getFlashMessage(params.message)}
        </div>
      ) : null}
      <form className="card grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="بحث باسم العميل أو الدولة"
          className="field md:col-span-2"
        />
        <button className="btn-secondary">بحث</button>
      </form>
      <form action={createClient} className="card grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          name="name"
          placeholder="اسم العميل"
          className="field"
          required
        />
        <input name="country" placeholder="الدولة (اختياري)" className="field" />
        <button className="btn-primary">
          إضافة عميل جديد
        </button>
      </form>
      <div className="card overflow-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th>اسم العميل</th>
            <th>الدولة</th>
            <th>عدد الاتفاقيات</th>
            <th>إجمالي تخصيص الفترات</th>
            <th>المحجوز من الفترات</th>
            <th>المتبقي من الفترات</th>
            <th>نسبة الاستهلاك</th>
            <th>الحالة</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td>{client.country ?? "-"}</td>
              <td>{clientStats.get(client.id)?.agreements ?? 0}</td>
              <td>{clientStats.get(client.id)?.allocation ?? 0}</td>
              <td>{clientStats.get(client.id)?.booked ?? 0}</td>
              <td>{clientStats.get(client.id)?.remaining ?? 0}</td>
              <td>{clientStats.get(client.id)?.utilization ?? 0}%</td>
              <td>
                <span className={getRemainingBadgeClass(clientStats.get(client.id)?.remaining ?? 0)}>
                  {getRemainingLabel(clientStats.get(client.id)?.remaining ?? 0)}
                </span>
              </td>
              <td>{client.createdAt.toISOString().slice(0, 10)}</td>
              <td>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={`/clients/${client.id}`} className="btn-secondary">
                    التفاصيل
                  </Link>
                  <form action={deleteClient}>
                    <input type="hidden" name="id" value={client.id} />
                    <button className="btn-danger">حذف</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
