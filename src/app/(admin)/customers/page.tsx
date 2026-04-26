import CustomersPage, { CustomerListResponse } from "@/components/customers/CustomersPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Customers | MCS Ecommerce Admin",
  description: "Manage ecommerce customers",
};

const emptyData: CustomerListResponse = {
  items: [],
  page: 1,
  pageSize: 5,
  totalCount: 0,
  totalPages: 1,
};

type PageProps = {
  searchParams: Promise<{
    edit?: string;
    focus?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const { edit, focus } = await searchParams;
  const token = (await cookies()).get("auth_token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";
  const initialEditCustomerId = Number(edit);
  const initialEditTarget =
    focus === "phone" || focus === "address" ? focus : null;

  let initialData = emptyData;

  if (token) {
    try {
      const response = await fetch(`${apiUrl}/customers?page=1&pageSize=5`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        initialData = await response.json();
      }
    } catch {
      initialData = emptyData;
    }
  }

  return (
    <CustomersPage
      initialData={initialData}
      initialEditCustomerId={
        Number.isFinite(initialEditCustomerId) && initialEditCustomerId > 0
          ? initialEditCustomerId
          : null
      }
      initialEditTarget={initialEditTarget}
    />
  );
}
