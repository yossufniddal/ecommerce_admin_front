"use client";
/* eslint-disable @next/next/no-img-element */

import { Category } from "@/components/categories/CategoriesPage";
import { ItemListResponse } from "@/components/items/ItemsPage";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ViewCategoryPageProps = {
  category: Category | null;
  items: ItemListResponse;
};

export default function ViewCategoryPage({
  category,
  items,
}: ViewCategoryPageProps) {
  if (!category) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Category not found
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This category could not be loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {category.imageUrl ? (
            <img
              src={category.imageUrl}
              alt={category.name}
              className="h-28 w-28 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              No image
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {category.name}
            </h1>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Parent Category
                </p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                  {category.parentName ?? "None"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Linked Products
                </p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                  {items.totalCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Products in this category
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Items directly linked to {category.name}.
          </p>
        </div>

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[960px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Image
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Product
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Price
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Status
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {items.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No products are linked to this category yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4 text-start">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-12 w-12 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            None
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white/90">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        EGP {item.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.isActive
                              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
