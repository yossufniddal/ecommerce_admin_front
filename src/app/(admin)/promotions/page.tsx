import PromotionsPage, { PromotionListResponse } from "@/components/promotions/PromotionsPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Promotions | MCS Ecommerce Admin",
  description: "Manage discounts and promotions",
};

const emptyData: PromotionListResponse = {
  items: [],
  page: 1,
  pageSize: 5,
  totalCount: 0,
  totalPages: 1,
};

export default async function Page() {
  const token = (await cookies()).get("auth_token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  let initialData = emptyData;

  if (token) {
    try {
      const response = await fetch(`${apiUrl}/promotions?page=1&pageSize=5`, {
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

  return <PromotionsPage initialData={initialData} />;
}
