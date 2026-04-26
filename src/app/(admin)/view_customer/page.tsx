import { CustomerDetail } from "@/components/customers/CustomersPage";
import ViewCustomerPage from "@/components/customers/ViewCustomerPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "View Customer | MCS Ecommerce Admin",
  description: "View customer details",
};

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const customerId = Number(id);
  const token = (await cookies()).get("auth_token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  let customer: CustomerDetail | null = null;

  if (token && Number.isFinite(customerId) && customerId > 0) {
    try {
      const response = await fetch(`${apiUrl}/customers/${customerId}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        customer = await response.json();
      }
    } catch {
      customer = null;
    }
  }

  return <ViewCustomerPage customer={customer} />;
}
