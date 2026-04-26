"use client";

import { Item, ItemListResponse } from "@/components/items/ItemsPage";
import Checkbox from "@/components/form/input/Checkbox";
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
import { MoreDotIcon, PencilIcon, PlusIcon, SearchIcon, TrashBinIcon } from "@/icons";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PromotionType = "flat" | "percent" | "buy_x_get_y" | "buy_x_for_egp";
type PromotionStatusFilter = "" | "active" | "inactive";

export type Promotion = {
  id: number;
  name: string;
  description: string | null;
  itemId: number;
  itemName: string;
  discountType: PromotionType;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  getItemId: number | null;
  getItemName: string | null;
  fixedPrice: number | null;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromotionListResponse = {
  items: Promotion[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type PromotionsPageProps = {
  initialData: PromotionListResponse;
};

const pageSize = 5;
const promotionTypeOptions: { value: PromotionType; label: string }[] = [
  { value: "percent", label: "Discount %" },
  { value: "flat", label: "Discount EGP" },
  { value: "buy_x_get_y", label: "Buy X Get Y" },
  { value: "buy_x_for_egp", label: "Buy X For EGP" },
];

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

function formatDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => part.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPromotionRule(promotion: Promotion) {
  switch (promotion.discountType) {
    case "flat":
      return `Buy ${promotion.itemName} with EGP ${(promotion.discountValue ?? 0).toFixed(2)} off`;
    case "percent":
      return `Buy ${promotion.itemName} with ${(promotion.discountValue ?? 0).toFixed(2)}% off`;
    case "buy_x_for_egp":
      return `Buy ${promotion.buyQuantity ?? 0} ${promotion.itemName} for EGP ${(promotion.fixedPrice ?? 0).toFixed(2)}`;
    case "buy_x_get_y":
      return `Buy ${promotion.buyQuantity ?? 0} ${promotion.itemName}, get ${promotion.getQuantity ?? 0} ${promotion.getItemName ?? promotion.itemName}`;
    default:
      return promotion.discountType;
  }
}

export default function PromotionsPage({ initialData }: PromotionsPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  const [promotions, setPromotions] = useState(initialData.items);
  const [items, setItems] = useState<Item[]>([]);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [totalCount, setTotalCount] = useState(initialData.totalCount);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterItemId, setFilterItemId] = useState("");
  const [filterDiscountType, setFilterDiscountType] = useState("");
  const [filterStatus, setFilterStatus] = useState<PromotionStatusFilter>("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [draftFilterItemId, setDraftFilterItemId] = useState("");
  const [draftFilterDiscountType, setDraftFilterDiscountType] = useState("");
  const [draftFilterStatus, setDraftFilterStatus] = useState<PromotionStatusFilter>("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemId, setItemId] = useState("");
  const [discountType, setDiscountType] = useState<PromotionType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [getQuantity, setGetQuantity] = useState("");
  const [getItemId, setGetItemId] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasHydratedInitialPage = useRef(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/signin?next=/promotions");
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
        router.replace("/signin?next=/promotions");
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

  const loadPromotions = useCallback(
    async (
      page: number,
      search: string,
      itemId: string,
      currentDiscountType: string,
      status: string
    ) => {
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
        if (itemId) {
          query.append("itemId", itemId);
        }
        if (currentDiscountType) {
          query.append("discountType", currentDiscountType);
        }
        if (status) {
          query.append("isActive", status === "active" ? "true" : "false");
        }

        const response = await request(`/promotions?${query.toString()}`);
        if (!response.ok) {
          throw new Error("Could not load promotions.");
        }

        const paged: PromotionListResponse = await response.json();
        setPromotions(paged.items);
        setCurrentPage(paged.page);
        setTotalPages(paged.totalPages);
        setTotalCount(paged.totalCount);
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load promotions.");
      } finally {
        setIsLoading(false);
      }
    },
    [request]
  );

  const loadItemOptions = useCallback(async () => {
    if (items.length > 0 || isLoadingItems) {
      return;
    }

    setIsLoadingItems(true);
    try {
      const response = await request("/items?page=1&pageSize=1000");
      if (!response.ok) {
        throw new Error("Could not load items.");
      }

      const data: ItemListResponse = await response.json();
      setItems(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }
    } finally {
      setIsLoadingItems(false);
    }
  }, [isLoadingItems, items.length, request]);

  useEffect(() => {
    void loadItemOptions();
  }, [loadItemOptions]);

  useEffect(() => {
    if (!hasHydratedInitialPage.current) {
      hasHydratedInitialPage.current = true;
      return;
    }

    void loadPromotions(
      currentPage,
      debouncedSearchTerm,
      filterItemId,
      filterDiscountType,
      filterStatus
    );
  }, [
    currentPage,
    debouncedSearchTerm,
    filterDiscountType,
    filterItemId,
    filterStatus,
    loadPromotions,
  ]);

  useEffect(() => {
    if (!hasHydratedInitialPage.current) {
      return;
    }

    setCurrentPage(1);
  }, [filterItemId, filterDiscountType, filterStatus]);

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [items]
  );

  const getItemOptions = useMemo(
    () => [
      { value: "same", label: "Same as trigger item" },
      ...items.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ],
    [items]
  );

  const filterItemOptions = useMemo(
    () => [
      { value: "", label: "All items" },
      ...items.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ],
    [items]
  );

  const activeFilterChips = useMemo(() => {
    const chips: { key: "item" | "type" | "status"; label: string }[] = [];

    if (filterItemId) {
      const item = items.find((entry) => String(entry.id) === filterItemId);
      chips.push({
        key: "item",
        label: `Item: ${item?.name ?? filterItemId}`,
      });
    }

    if (filterDiscountType) {
      const type = promotionTypeOptions.find((option) => option.value === filterDiscountType);
      chips.push({
        key: "type",
        label: `Type: ${type?.label ?? filterDiscountType}`,
      });
    }

    if (filterStatus) {
      chips.push({
        key: "status",
        label: `Status: ${filterStatus === "active" ? "Active" : "Inactive"}`,
      });
    }

    return chips;
  }, [filterDiscountType, filterItemId, filterStatus, items]);

  function openFilterModal() {
    setDraftFilterItemId(filterItemId);
    setDraftFilterDiscountType(filterDiscountType);
    setDraftFilterStatus(filterStatus);
    setIsFilterModalOpen(true);
  }

  function applyFilters() {
    setFilterItemId(draftFilterItemId);
    setFilterDiscountType(draftFilterDiscountType);
    setFilterStatus(draftFilterStatus);
    setIsFilterModalOpen(false);
  }

  function clearAllFilters() {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setFilterItemId("");
    setFilterDiscountType("");
    setFilterStatus("");
    setDraftFilterItemId("");
    setDraftFilterDiscountType("");
    setDraftFilterStatus("");
    setCurrentPage(1);
  }

  function clearSingleFilter(filterKey: "item" | "type" | "status") {
    if (filterKey === "item") {
      setFilterItemId("");
      setDraftFilterItemId("");
      return;
    }

    if (filterKey === "type") {
      setFilterDiscountType("");
      setDraftFilterDiscountType("");
      return;
    }

    setFilterStatus("");
    setDraftFilterStatus("");
  }

  function resetForm() {
    setName("");
    setDescription("");
    setItemId("");
    setDiscountType("percent");
    setDiscountValue("");
    setBuyQuantity("");
    setGetQuantity("");
    setGetItemId("same");
    setFixedPrice("");
    setValidFrom("");
    setValidTo("");
    setIsActive(true);
    setErrorMessage("");
  }

  function openAddModal() {
    setEditingPromotion(null);
    resetForm();
    setIsModalOpen(true);
    void loadItemOptions();
  }

  function openEditModal(promotion: Promotion) {
    setEditingPromotion(promotion);
    setName(promotion.name);
    setDescription(promotion.description ?? "");
    setItemId(String(promotion.itemId));
    setDiscountType(promotion.discountType);
    setDiscountValue(promotion.discountValue?.toString() ?? "");
    setBuyQuantity(promotion.buyQuantity?.toString() ?? "");
    setGetQuantity(promotion.getQuantity?.toString() ?? "");
    setGetItemId(promotion.getItemId ? String(promotion.getItemId) : "same");
    setFixedPrice(promotion.fixedPrice?.toString() ?? "");
    setValidFrom(formatDateTimeInput(promotion.validFrom));
    setValidTo(formatDateTimeInput(promotion.validTo));
    setIsActive(promotion.isActive);
    setErrorMessage("");
    setOpenMenuId(null);
    setIsModalOpen(true);
    void loadItemOptions();
  }

  async function handleDelete(id: number) {
    setOpenMenuId(null);
    if (!window.confirm("Delete this promotion?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/promotions/${id}`, { method: "DELETE" });
      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Promotion is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadPromotions(
        currentPage,
        debouncedSearchTerm,
        filterItemId,
        filterDiscountType,
        filterStatus
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete promotion.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const parsedDiscountValue = discountValue === "" ? null : Number(discountValue);
    const parsedBuyQuantity = buyQuantity === "" ? null : Number(buyQuantity);
    const parsedGetQuantity = getQuantity === "" ? null : Number(getQuantity);
    const parsedFixedPrice = fixedPrice === "" ? null : Number(fixedPrice);

    if (!trimmedName) {
      setErrorMessage("Name is required.");
      return;
    }

    if (!itemId) {
      setErrorMessage("Trigger item is required.");
      return;
    }

    if (!validFrom || !validTo) {
      setErrorMessage("Valid from and valid to are required.");
      return;
    }

    if (new Date(validTo) <= new Date(validFrom)) {
      setErrorMessage("Valid to must be later than valid from.");
      return;
    }

    if ((discountType === "flat" || discountType === "percent") && (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue === null)) {
      setErrorMessage(discountType === "percent" ? "Discount percent is required." : "Discount amount is required.");
      return;
    }

    if (discountType === "buy_x_get_y" && (!Number.isFinite(parsedBuyQuantity) || parsedBuyQuantity === null || !Number.isFinite(parsedGetQuantity) || parsedGetQuantity === null)) {
      setErrorMessage("Buy quantity and get quantity are required.");
      return;
    }

    if (discountType === "buy_x_for_egp" && (!Number.isFinite(parsedBuyQuantity) || parsedBuyQuantity === null || !Number.isFinite(parsedFixedPrice) || parsedFixedPrice === null)) {
      setErrorMessage("Buy quantity and fixed price are required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      itemId: Number(itemId),
      discountType,
      discountValue:
        discountType === "flat" || discountType === "percent"
          ? parsedDiscountValue
          : null,
      buyQuantity:
        discountType === "buy_x_get_y" || discountType === "buy_x_for_egp"
          ? parsedBuyQuantity
          : null,
      getQuantity: discountType === "buy_x_get_y" ? parsedGetQuantity : null,
      getItemId:
        discountType === "buy_x_get_y"
          ? getItemId === "same" || getItemId === ""
            ? null
            : Number(getItemId)
          : null,
      fixedPrice: discountType === "buy_x_for_egp" ? parsedFixedPrice : null,
      validFrom: new Date(validFrom).toISOString(),
      validTo: new Date(validTo).toISOString(),
      isActive,
    };

    try {
      const response = await request(
        editingPromotion ? `/promotions/${editingPromotion.id}` : "/promotions",
        {
          method: editingPromotion ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save promotion.");
        return;
      }

      setIsModalOpen(false);
      await loadPromotions(
        editingPromotion ? currentPage : 1,
        debouncedSearchTerm,
        filterItemId,
        filterDiscountType,
        filterStatus
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save promotion.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Discounts & Promotions
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage bundle pricing, free-item offers, and direct item discounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {isLoading ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
              ) : (
                <SearchIcon className="h-5 w-5" />
              )}
            </span>
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-10 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
          <button
            type="button"
            onClick={openFilterModal}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Filters
          </button>
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

      {(activeFilterChips.length > 0 || searchTerm) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchTerm && (
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700 dark:bg-white/[0.06] dark:text-gray-300">
              Search: {searchTerm}
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setDebouncedSearchTerm("");
                  setCurrentPage(1);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                aria-label="Clear search filter"
              >
                ×
              </button>
            </span>
          )}
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => clearSingleFilter(chip.key)}
                className="text-brand-500 hover:text-brand-700 dark:text-brand-300 dark:hover:text-white"
                aria-label={`Clear ${chip.label}`}
              >
                ×
              </button>
            </span>
          ))}
          {(activeFilterChips.length > 0 || searchTerm) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {errorMessage && !isModalOpen && !isFilterModalOpen && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="relative z-10 max-w-full overflow-x-auto">
          <div className="min-w-[1120px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Promotion
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Trigger Item
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Rule
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Validity
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Options
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={`divide-y divide-gray-100 dark:divide-white/[0.05] transition-opacity ${isLoading ? "pointer-events-none opacity-50" : ""}`}>
                {promotions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No promotions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  promotions.map((promotion) => (
                    <TableRow key={promotion.id}>
                      <TableCell className="px-5 py-4 text-start">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white/90">
                            {promotion.name}
                          </div>
                          {promotion.description && (
                            <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                              {promotion.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {promotion.itemName}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatPromotionRule(promotion)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        <div>{new Date(promotion.validFrom).toLocaleString()}</div>
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          to {new Date(promotion.validTo).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            promotion.isActive
                              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {promotion.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="relative flex justify-end">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId((current) => current === promotion.id ? null : promotion.id)}
                            className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                            aria-label={`Open options for ${promotion.name}`}
                          >
                            <MoreDotIcon />
                          </button>
                          <Dropdown
                            isOpen={openMenuId === promotion.id}
                            onClose={() => setOpenMenuId(null)}
                            className="w-40"
                            usePortal={true}
                          >
                            <DropdownItem
                              onItemClick={() => openEditModal(promotion)}
                              className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                            >
                              <PencilIcon />
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              onItemClick={() => void handleDelete(promotion.id)}
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
            Showing {promotions.length} of {totalCount} promotions
          </p>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(Math.min(Math.max(page, 1), totalPages))}
          />
        </div>
      </div>

      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        className="max-w-[560px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Filter Promotions
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Narrow the promotions list without crowding the page.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <Label>Item</Label>
            <Select
              key={`promotion-filter-item-draft-${draftFilterItemId}-${items.length}`}
              options={filterItemOptions}
              placeholder={isLoadingItems ? "Loading items..." : "All items"}
              defaultValue={draftFilterItemId}
              onChange={setDraftFilterItemId}
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select
              key={`promotion-filter-type-draft-${draftFilterDiscountType}`}
              options={[
                { value: "", label: "All types" },
                ...promotionTypeOptions,
              ]}
              placeholder="All types"
              defaultValue={draftFilterDiscountType}
              onChange={setDraftFilterDiscountType}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select
              key={`promotion-filter-status-draft-${draftFilterStatus}`}
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              placeholder="All statuses"
              defaultValue={draftFilterStatus}
              onChange={(value) => setDraftFilterStatus(value as PromotionStatusFilter)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setDraftFilterItemId("");
                setDraftFilterDiscountType("");
                setDraftFilterStatus("");
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[760px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingPromotion ? "Edit Promotion" : "Add New Promotion"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Choose the promotion type and we&apos;ll show only the fields that matter.
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
                key={`promotion-name-${editingPromotion?.id ?? "new"}`}
                placeholder="Promotion name"
                defaultValue={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label>
                Trigger Item <span className="text-error-500">*</span>
              </Label>
              <Select
                key={`trigger-item-${editingPromotion?.id ?? "new"}-${itemId}`}
                options={itemOptions}
                placeholder={isLoadingItems ? "Loading items..." : "Select trigger item"}
                defaultValue={itemId}
                onChange={setItemId}
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <TextArea
              placeholder="Optional promotion notes"
              rows={3}
              value={description}
              onChange={setDescription}
            />
          </div>

          <div className="space-y-3">
            <Label>
              Promotion Type <span className="text-error-500">*</span>
            </Label>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                {promotionTypeOptions.map((option) => {
                  const isSelected = discountType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDiscountType(option.value)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isSelected
                          ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                          : "text-gray-500 hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-white/90"
                      }`}
                      disabled={isSaving}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-end pb-2">
              <Checkbox
                checked={isActive}
                onChange={setIsActive}
                label="Promotion is active"
                disabled={isSaving}
              />
          </div>

          {(discountType === "flat" || discountType === "percent") && (
            <div>
              <Label>
                {discountType === "percent" ? "Discount Percent" : "Discount Amount (EGP)"}{" "}
                <span className="text-error-500">*</span>
              </Label>
              <Input
                key={`discount-value-${editingPromotion?.id ?? "new"}-${discountType}`}
                type="number"
                placeholder={discountType === "percent" ? "15" : "20"}
                defaultValue={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                min="0"
                max={discountType === "percent" ? "100" : undefined}
                step={0.01}
                disabled={isSaving}
              />
            </div>
          )}

          {discountType === "buy_x_get_y" && (
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label>
                  Buy Quantity <span className="text-error-500">*</span>
                </Label>
                <Input
                  key={`buy-quantity-${editingPromotion?.id ?? "new"}`}
                  type="number"
                  placeholder="2"
                  defaultValue={buyQuantity}
                  onChange={(event) => setBuyQuantity(event.target.value)}
                  min="1"
                  step={1}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label>
                  Get Item <span className="text-error-500">*</span>
                </Label>
                <Select
                  key={`get-item-${editingPromotion?.id ?? "new"}-${getItemId}`}
                  options={getItemOptions}
                  placeholder={isLoadingItems ? "Loading items..." : "Select free item"}
                  defaultValue={getItemId}
                  onChange={setGetItemId}
                />
              </div>
              <div>
                <Label>
                  Get Quantity <span className="text-error-500">*</span>
                </Label>
                <Input
                  key={`get-quantity-${editingPromotion?.id ?? "new"}`}
                  type="number"
                  placeholder="1"
                  defaultValue={getQuantity}
                  onChange={(event) => setGetQuantity(event.target.value)}
                  min="1"
                  step={1}
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          {discountType === "buy_x_for_egp" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>
                  Buy Quantity <span className="text-error-500">*</span>
                </Label>
                <Input
                  key={`bundle-buy-quantity-${editingPromotion?.id ?? "new"}`}
                  type="number"
                  placeholder="3"
                  defaultValue={buyQuantity}
                  onChange={(event) => setBuyQuantity(event.target.value)}
                  min="1"
                  step={1}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label>
                  Fixed Price (EGP) <span className="text-error-500">*</span>
                </Label>
                <Input
                  key={`fixed-price-${editingPromotion?.id ?? "new"}`}
                  type="number"
                  placeholder="100"
                  defaultValue={fixedPrice}
                  onChange={(event) => setFixedPrice(event.target.value)}
                  min="0"
                  step={0.01}
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>
                Valid From <span className="text-error-500">*</span>
              </Label>
              <Input
                key={`valid-from-${editingPromotion?.id ?? "new"}`}
                type="datetime-local"
                defaultValue={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label>
                Valid To <span className="text-error-500">*</span>
              </Label>
              <Input
                key={`valid-to-${editingPromotion?.id ?? "new"}`}
                type="datetime-local"
                defaultValue={validTo}
                onChange={(event) => setValidTo(event.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : editingPromotion ? "Save Changes" : "Create Promotion"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
