"use client";

import FileInput from "@/components/form/input/FileInput";
import Input from "@/components/form/input/InputField";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/icons";

export type Category = {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  imageUrl: string | null;
};

export type CategoryListResponse = {
  items: Category[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const pageSize = 5;

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

type CategoriesPageProps = {
  initialData: CategoryListResponse;
};

export default function CategoriesPage({ initialData }: CategoriesPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  const [categories, setCategories] = useState<Category[]>(initialData.items);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [totalCount, setTotalCount] = useState(initialData.totalCount);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasHydratedInitialPage = useRef(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/signin?next=/categories");
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
        router.replace("/signin?next=/categories");
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

  const loadCategories = useCallback(
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

        const pagedResponse = await request(`/categories?${query.toString()}`);

        if (!pagedResponse.ok) {
          throw new Error("Could not load categories.");
        }

        const paged: CategoryListResponse = await pagedResponse.json();

        setCategories(paged.items);
        setAllCategories((current) => {
          const next = new Map(current.map((category) => [category.id, category]));
          paged.items.forEach((category) => next.set(category.id, category));
          return Array.from(next.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });
        setCurrentPage(paged.page);
        setTotalPages(paged.totalPages);
        setTotalCount(paged.totalCount);
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load categories.");
      } finally {
        setIsLoading(false);
      }
    },
    [request]
  );

  const loadParentOptions = useCallback(async () => {
    if (allCategories.length > 0 || isLoadingParents) {
      return;
    }

    setIsLoadingParents(true);

    try {
      const response = await request("/categories?page=1&pageSize=1000");
      if (!response.ok) {
        throw new Error("Could not load parent categories.");
      }

      const data: CategoryListResponse = await response.json();
      setAllCategories(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }
    } finally {
      setIsLoadingParents(false);
    }
  }, [allCategories.length, isLoadingParents, request]);

  useEffect(() => {
    if (!hasHydratedInitialPage.current) {
      hasHydratedInitialPage.current = true;
      return;
    }

    void loadCategories(currentPage, debouncedSearchTerm);
  }, [currentPage, debouncedSearchTerm, loadCategories]);

  const parentOptions = useMemo(
    () =>
      allCategories
        .filter((category) => category.id !== editingCategory?.id)
        .map((category) => ({
          value: String(category.id),
          label: category.name,
        })),
    [allCategories, editingCategory?.id]
  );

  function openAddModal() {
    setEditingCategory(null);
    setName("");
    setParentId("");
    setImageFileName("");
    setErrorMessage("");
    setIsModalOpen(true);
    void loadParentOptions();
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setName(category.name);
    setParentId(category.parentId ? String(category.parentId) : "");
    setImageFileName("");
    setErrorMessage("");
    setOpenMenuId(null);
    setIsModalOpen(true);
    void loadParentOptions();
  }

  async function handleDelete(categoryId: number) {
    setOpenMenuId(null);
    if (!window.confirm("Delete this category?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Category is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadCategories(currentPage, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete category.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Name is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      parentId: parentId ? Number(parentId) : null,
      imageUrl: editingCategory?.imageUrl ?? null,
    };

    try {
      const response = await request(
        editingCategory ? `/categories/${editingCategory.id}` : "/categories",
        {
          method: editingCategory ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save category.");
        return;
      }

      setIsModalOpen(false);
      await loadCategories(editingCategory ? currentPage : 1, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save category.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Categories
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage category hierarchy and images.
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
              placeholder="Search categories..."
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
          <div className="min-w-[820px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
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
                    Parent Category
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Image
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
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No categories found.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="px-5 py-4 sm:px-6 text-start">
                        <Link
                          href={`/view_category?id=${category.id}`}
                          className="font-medium text-gray-800 transition-colors hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                        >
                          {category.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                        {category.parentName ?? "None"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                        {category.imageUrl || "No image"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="relative flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === category.id ? null : category.id
                              )
                            }
                            className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                            aria-label={`Open options for ${category.name}`}
                          >
                            <MoreDotIcon />
                          </button>
                          <Dropdown
                            isOpen={openMenuId === category.id}
                            onClose={() => setOpenMenuId(null)}
                            className="w-40"
                            usePortal={true}
                          >
                            <DropdownItem
                              onItemClick={() => openEditModal(category)}
                              className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                            >
                              <PencilIcon />
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              onItemClick={() => void handleDelete(category.id)}
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
            Showing {categories.length} of {totalCount} categories
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
        className="max-w-[560px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingCategory ? "Edit Category" : "Add New Category"}
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

          <div>
            <Label>
              Name <span className="text-error-500">*</span>
            </Label>
            <Input
              placeholder="Category name"
              defaultValue={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <div>
            <Label>Parent Category</Label>
            <Select
              key={`${editingCategory?.id ?? "new"}-${parentId}`}
              options={parentOptions}
              placeholder={
                isLoadingParents ? "Loading parent categories..." : "No parent category"
              }
              defaultValue={parentId}
              onChange={setParentId}
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
                Selected: {imageFileName}. Upload will be sent after CDN details
                are connected.
              </p>
            )}
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
                : editingCategory
                ? "Save Changes"
                : "Add Category"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
