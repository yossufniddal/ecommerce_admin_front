"use client";
/* eslint-disable @next/next/no-img-element */

import { Category, CategoryListResponse } from "@/components/categories/CategoriesPage";
import Checkbox from "@/components/form/input/Checkbox";
import FileInput from "@/components/form/input/FileInput";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Pagination from "@/components/tables/Pagination";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreDotIcon, PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/icons";

export type Item = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  description: string | null;
  price: number;
  mcsSerial: number | null;
  mcsItemCode: number | null;
  minorPerMajor: number | null;
  isActive: boolean;
  imageUrl: string | null;
};

export type ItemListResponse = {
  items: Item[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type ItemsPageProps = {
  initialData: ItemListResponse;
};

const pageSize = 5;

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

export default function ItemsPage({ initialData }: ItemsPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  const [items, setItems] = useState<Item[]>(initialData.items);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [totalCount, setTotalCount] = useState(initialData.totalCount);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasHydratedInitialPage = useRef(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/signin?next=/items");
        throw new Error("Missing auth token.");
      }

      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });

      if (response.status === 401) {
        router.replace("/signin?next=/items");
        throw new Error("Session expired.");
      }

      return response;
    },
    [apiUrl, router]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (hasHydratedInitialPage.current) {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadItems = useCallback(
    async (page: number, search: string) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const query = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
        });
        if (search) {
          query.append("search", search);
        }

        const response = await request(`/items?${query.toString()}`);
        if (!response.ok) {
          throw new Error("Could not load items.");
        }

        const paged: ItemListResponse = await response.json();
        setItems(paged.items);
        setCurrentPage(paged.page);
        setTotalPages(paged.totalPages);
        setTotalCount(paged.totalCount);
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load items.");
      } finally {
        setIsLoading(false);
      }
    },
    [request]
  );

  const loadCategories = useCallback(async () => {
    if (categories.length > 0 || isLoadingCategories) {
      return;
    }

    setIsLoadingCategories(true);

    try {
      const response = await request("/categories?page=1&pageSize=1000");
      if (!response.ok) {
        throw new Error("Could not load categories.");
      }

      const data: CategoryListResponse = await response.json();
      setCategories(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }
    } finally {
      setIsLoadingCategories(false);
    }
  }, [categories.length, isLoadingCategories, request]);

  useEffect(() => {
    if (!hasHydratedInitialPage.current) {
      hasHydratedInitialPage.current = true;
      return;
    }

    void loadItems(currentPage, debouncedSearchTerm);
  }, [currentPage, debouncedSearchTerm, loadItems]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [categories]
  );

  function openAddModal() {
    setEditingItem(null);
    setName("");
    setCategoryId("");
    setDescription("");
    setPrice("");
    setImageFileName("");
    setIsActive(true);
    setErrorMessage("");
    setIsModalOpen(true);
    void loadCategories();
  }

  function openEditModal(item: Item) {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(String(item.categoryId));
    setDescription(item.description ?? "");
    setPrice(item.price.toString());
    setImageFileName("");
    setIsActive(item.isActive);
    setErrorMessage("");
    setOpenMenuId(null);
    setIsModalOpen(true);
    void loadCategories();
  }

  async function handleDelete(itemId: number) {
    setOpenMenuId(null);
    if (!window.confirm("Delete this item?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/items/${itemId}`, { method: "DELETE" });
      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Item is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadItems(currentPage, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete item.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const parsedPrice = Number(price);

    if (!trimmedName) {
      setErrorMessage("Name is required.");
      return;
    }

    if (!categoryId) {
      setErrorMessage("Category is required.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage("Price must be a valid non-negative number.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      categoryId: Number(categoryId),
      description: description.trim() || null,
      price: parsedPrice,
      isActive,
      imageUrl: editingItem?.imageUrl ?? null,
    };

    try {
      const response = await request(
        editingItem ? `/items/${editingItem.id}` : "/items",
        {
          method: editingItem ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save item.");
        return;
      }

      setIsModalOpen(false);
      await loadItems(editingItem ? currentPage : 1, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save item.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Items
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage item details, category assignment, pricing, and preview image.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400 block" />
              ) : (
                <SearchIcon className="h-5 w-5" />
              )}
            </span>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-10 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
          >
            <PlusIcon />
            Add New
          </button>
        </div>
      </div>

      {errorMessage && !isModalOpen && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="relative z-10 max-w-full overflow-x-auto">
          <div className="min-w-[980px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Image
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Item
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Category
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Price
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    Options
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={`divide-y divide-gray-100 dark:divide-white/[0.05] transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
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
                      <TableCell className="px-5 py-4 sm:px-6 text-start">
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
                      <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                        {item.categoryName}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400">
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
                      <TableCell className="px-5 py-4">
                        <div className="relative flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === item.id ? null : item.id
                              )
                            }
                            className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                            aria-label={`Open options for ${item.name}`}
                          >
                            <MoreDotIcon />
                          </button>
                          <Dropdown
                            isOpen={openMenuId === item.id}
                            onClose={() => setOpenMenuId(null)}
                            className="w-40"
                            usePortal={true}
                          >
                            <DropdownItem
                              onItemClick={() => openEditModal(item)}
                              className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                            >
                              <PencilIcon />
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              onItemClick={() => void handleDelete(item.id)}
                              className="flex items-center gap-2 text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:bg-white/[0.05]"
                            >
                              <TrashBinIcon />
                              Delete
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="relative z-0 flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {items.length} of {totalCount} items
          </p>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) =>
              setCurrentPage(Math.min(Math.max(page, 1), totalPages))
            }
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[640px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingItem ? "Edit Item" : "Add New Item"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            CDN upload will be connected after the storage details are ready.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>
                Name <span className="text-error-500">*</span>
              </Label>
              <Input
                placeholder="Item name"
                defaultValue={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label>
                Category <span className="text-error-500">*</span>
              </Label>
              <Select
                key={`${editingItem?.id ?? "new"}-${categoryId}`}
                options={categoryOptions}
                placeholder={
                  isLoadingCategories ? "Loading categories..." : "Select category"
                }
                defaultValue={categoryId}
                onChange={setCategoryId}
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <TextArea
              placeholder="Item description"
              rows={4}
              value={description}
              onChange={setDescription}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>
                Price <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                defaultValue={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={isSaving}
                step={0.01}
                min="0"
              />
            </div>

            <div>
              <Label>Image</Label>
              <FileInput
                accept="image/*"
                onChange={(event) =>
                  setImageFileName(event.target.files?.[0]?.name ?? "")
                }
              />
              {imageFileName && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Selected: {imageFileName}. Upload will be sent after CDN details are connected.
                </p>
              )}
            </div>
          </div>

          <div>
            <Checkbox
              checked={isActive}
              onChange={setIsActive}
              disabled={isSaving}
              label="Active item"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : editingItem
                ? "Save Changes"
                : "Add Item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
