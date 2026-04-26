import { Category } from "@/components/categories/CategoriesPage";
import ViewCategoryPage from "@/components/categories/ViewCategoryPage";
import { ItemListResponse } from "@/components/items/ItemsPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "View Category | MCS Ecommerce Admin",
  description: "View category details and linked products",
};

const emptyItems: ItemListResponse = {
  items: [],
  page: 1,
  pageSize: 100,
  totalCount: 0,
  totalPages: 1,
};

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const categoryId = Number(id);
  const token = (await cookies()).get("auth_token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  let category: Category | null = null;
  let items = emptyItems;

  if (token && Number.isFinite(categoryId) && categoryId > 0) {
    try {
      const [categoryResponse, itemsResponse] = await Promise.all([
        fetch(`${apiUrl}/categories/${categoryId}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${apiUrl}/items?page=1&pageSize=100&categoryId=${categoryId}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (categoryResponse.ok) {
        category = await categoryResponse.json();
      }

      if (itemsResponse.ok) {
        items = await itemsResponse.json();
      }
    } catch {
      category = null;
      items = emptyItems;
    }
  }

  return <ViewCategoryPage category={category} items={items} />;
}
