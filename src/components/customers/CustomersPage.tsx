"use client";

import { Area, AreaListResponse, Section, SectionListResponse } from "@/components/locations/LocationsPage";
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

export type CustomerListItem = {
  id: number;
  name: string;
  createdAt: string;
  addressCount: number;
  phoneNumber: string | null;
  ordersCount: number;
  totalSpent: number;
};

export type CustomerAddress = {
  id: number | null;
  sectionId: string;
  areaId: string;
  street: string;
  building: string;
  flat: string;
  row: string;
};

export type CustomerDetail = {
  id: number;
  name: string;
  createdAt: string;
  lastOrderDate: string | null;
  phones: Array<{
    id: number | null;
    phoneNumber: string;
  }>;
  addresses: Array<{
    id: number | null;
    sectionId: number;
    sectionName: string;
    areaId: number;
    areaName: string;
    row: number | null;
    flat: number | null;
    building: number | null;
    street: string | null;
    isMain: boolean;
  }>;
  orders: Array<{
    id: number;
    orderNumber: string;
    orderDate: string;
    numberOfItems: number;
    orderTotal: number;
    status: string;
  }>;
};

export type CustomerListResponse = {
  items: CustomerListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type CustomersPageProps = {
  initialData: CustomerListResponse;
  initialEditCustomerId?: number | null;
  initialEditTarget?: "phone" | "address" | null;
};

const pageSize = 5;

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

function createEmptyAddress(): CustomerAddress {
  return {
    id: null,
    sectionId: "",
    areaId: "",
    street: "",
    building: "",
    flat: "",
    row: "",
  };
}

export default function CustomersPage({
  initialData,
  initialEditCustomerId = null,
  initialEditTarget = null,
}: CustomersPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  const [customers, setCustomers] = useState<CustomerListItem[]>(initialData.items);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [totalCount, setTotalCount] = useState(initialData.totalCount);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingLocationOptions, setIsLoadingLocationOptions] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const hasHydratedInitialPage = useRef(false);
  const didHandleInitialEdit = useRef(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/signin?next=/customers");
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
        router.replace("/signin?next=/customers");
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

  const loadCustomers = useCallback(
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

        const response = await request(`/customers?${query.toString()}`);
        if (!response.ok) {
          throw new Error("Could not load customers.");
        }

        const data: CustomerListResponse = await response.json();
        setCustomers(data.items);
        setCurrentPage(data.page);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load customers.");
      } finally {
        setIsLoading(false);
      }
    },
    [request]
  );

  const loadLocationOptions = useCallback(async () => {
    if ((sections.length > 0 && areas.length > 0) || isLoadingLocationOptions) {
      return;
    }

    setIsLoadingLocationOptions(true);

    try {
      const [sectionsResponse, areasResponse] = await Promise.all([
        request("/sections?page=1&pageSize=1000"),
        request("/areas?page=1&pageSize=1000"),
      ]);

      if (!sectionsResponse.ok || !areasResponse.ok) {
        throw new Error("Could not load location options.");
      }

      const sectionsData: SectionListResponse = await sectionsResponse.json();
      const areasData: AreaListResponse = await areasResponse.json();
      setSections(sectionsData.items);
      setAreas(areasData.items);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not load location options.");
    } finally {
      setIsLoadingLocationOptions(false);
    }
  }, [areas.length, isLoadingLocationOptions, request, sections.length]);

  useEffect(() => {
    if (!hasHydratedInitialPage.current) {
      hasHydratedInitialPage.current = true;
      return;
    }

    void loadCustomers(currentPage, debouncedSearchTerm);
  }, [currentPage, debouncedSearchTerm, loadCustomers]);

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: String(section.id),
        label: section.name,
      })),
    [sections]
  );

  function updateAddress(index: number, field: keyof CustomerAddress, value: string) {
    setAddresses((current) =>
      current.map((address, currentIndex) =>
        currentIndex === index
          ? {
              ...address,
              [field]: value,
              ...(field === "sectionId" ? { areaId: "" } : {}),
            }
          : address
      )
    );
  }

  function addAddress() {
    setAddresses((current) => [...current, createEmptyAddress()]);
  }

  function removeAddress(index: number) {
    setAddresses((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function openAddModal() {
    setEditingCustomerId(null);
    setName("");
    setPhoneNumber("");
    setAddresses([]);
    setErrorMessage("");
    setIsModalOpen(true);
  }

  const openEditModal = useCallback(
    async (customerId: number, target?: "phone" | "address" | null) => {
      setOpenMenuId(null);
      setErrorMessage("");
      setEditingCustomerId(customerId);
      void loadLocationOptions();

      try {
        const response = await request(`/customers/${customerId}`);
        if (!response.ok) {
          throw new Error("Could not load customer details.");
        }

        const customer: CustomerDetail = await response.json();
        setName(customer.name);
        setPhoneNumber(customer.phones[0]?.phoneNumber ?? "");
        setAddresses(
          customer.addresses.length > 0
            ? customer.addresses.map((address) => ({
                id: address.id,
                sectionId: String(address.sectionId),
                areaId: String(address.areaId),
                street: address.street ?? "",
                building: address.building?.toString() ?? "",
                flat: address.flat?.toString() ?? "",
                row: address.row?.toString() ?? "",
              }))
            : []
        );

        if (target === "address" && customer.addresses.length === 0) {
          setAddresses([createEmptyAddress()]);
        }

        setIsModalOpen(true);
      } catch (error) {
        if (error instanceof Error && error.message === "Session expired.") {
          return;
        }

        setEditingCustomerId(null);
        setErrorMessage("Could not load customer details.");
      }
    },
    [loadLocationOptions, request]
  );

  useEffect(() => {
    if (didHandleInitialEdit.current) {
      return;
    }

    if (!initialEditCustomerId) {
      didHandleInitialEdit.current = true;
      return;
    }

    didHandleInitialEdit.current = true;
    void openEditModal(initialEditCustomerId, initialEditTarget);
  }, [initialEditCustomerId, initialEditTarget, openEditModal]);

  async function handleDelete(customerId: number) {
    setOpenMenuId(null);
    if (!window.confirm("Delete this customer?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/customers/${customerId}`, { method: "DELETE" });
      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Customer is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadCustomers(currentPage, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete customer.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedName) {
      setErrorMessage("Name is required.");
      return;
    }

    if (
      addresses.some(
        (address) =>
          !address.sectionId ||
          !address.areaId ||
          !address.street.trim()
      )
    ) {
      setErrorMessage("Each address needs a section, area, and street.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      phoneNumber: trimmedPhone,
      addresses: addresses.map((address) => ({
        id: address.id,
        sectionId: Number(address.sectionId),
        areaId: Number(address.areaId),
        street: address.street.trim(),
        building: address.building ? Number(address.building) : null,
        flat: address.flat ? Number(address.flat) : null,
        row: address.row ? Number(address.row) : null,
      })),
    };

    try {
      const response = await request(
        editingCustomerId ? `/customers/${editingCustomerId}` : "/customers",
        {
          method: editingCustomerId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save customer.");
        return;
      }

      setIsModalOpen(false);
      await loadCustomers(editingCustomerId ? currentPage : 1, debouncedSearchTerm);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save customer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Customers
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track customer activity, orders, and saved addresses.
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
              placeholder="Search customers..."
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
          <div className="min-w-[1120px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Name
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Added At
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Addresses
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Phone Number
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Orders Count
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Total Spent
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Options
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={`divide-y divide-gray-100 dark:divide-white/[0.05] transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="px-5 py-4 text-start">
                        <Link
                          href={`/view_customer?id=${customer.id}`}
                          className="font-medium text-gray-800 transition-colors hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                        >
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {customer.addressCount}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {customer.phoneNumber ?? "None"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {customer.ordersCount}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        EGP {customer.totalSpent.toFixed(2)}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="relative flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === customer.id ? null : customer.id
                              )
                            }
                            className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                            aria-label={`Open options for ${customer.name}`}
                          >
                            <MoreDotIcon />
                          </button>
                          <Dropdown
                            isOpen={openMenuId === customer.id}
                            onClose={() => setOpenMenuId(null)}
                            className="w-40"
                            usePortal={true}
                          >
                            <DropdownItem
                              onItemClick={() => void openEditModal(customer.id)}
                              className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                            >
                              <PencilIcon />
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              onItemClick={() => void handleDelete(customer.id)}
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
            Showing {customers.length} of {totalCount} customers
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
        className="max-w-[880px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingCustomerId ? "Edit Customer" : "Add New Customer"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Save one phone number and one or more customer addresses.
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
                placeholder="Customer name"
                defaultValue={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div>
              <Label>Phone Number</Label>
              <Input
                placeholder="010..."
                defaultValue={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  Addresses
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Optional. The first address is treated as the main address.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadLocationOptions();
                addAddress();
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.05]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-400 text-gray-500 dark:border-gray-500 dark:text-gray-300">
                  <PlusIcon />
                </span>
                <span className="text-base font-medium">Add address</span>
              </span>
              <span className="text-2xl leading-none text-gray-400 dark:text-gray-500">
                ›
              </span>
            </button>

            {addresses.map((address, index) => {
              const filteredAreas = areas.filter(
                (area) => String(area.sectionId) === address.sectionId
              );

              return (
                <div
                  key={address.id ?? `new-${index}`}
                  className="rounded-2xl border border-gray-200 p-4 dark:border-white/[0.08]"
                >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                        Address {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAddress(index)}
                        className="text-sm font-medium text-error-600 hover:text-error-700 dark:text-error-400"
                      >
                        Remove
                      </button>
                    </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>
                        Section <span className="text-error-500">*</span>
                      </Label>
                      <Select
                        key={`section-${index}-${address.sectionId}`}
                        options={sectionOptions}
                        placeholder={
                          isLoadingLocationOptions ? "Loading sections..." : "Select section"
                        }
                        defaultValue={address.sectionId}
                        onChange={(value) => updateAddress(index, "sectionId", value)}
                      />
                    </div>

                    <div>
                      <Label>
                        Area <span className="text-error-500">*</span>
                      </Label>
                      <Select
                        key={`area-${index}-${address.areaId}-${address.sectionId}`}
                        options={filteredAreas.map((area) => ({
                          value: String(area.id),
                          label: area.name,
                        }))}
                        placeholder={
                          address.sectionId ? "Select area" : "Select section first"
                        }
                        defaultValue={address.areaId}
                        onChange={(value) => updateAddress(index, "areaId", value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label>
                        Street <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        placeholder="Street"
                        defaultValue={address.street}
                        onChange={(event) =>
                          updateAddress(index, "street", event.target.value)
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <div>
                      <Label>Building</Label>
                      <Input
                        type="number"
                        placeholder="Building"
                        defaultValue={address.building}
                        onChange={(event) =>
                          updateAddress(index, "building", event.target.value)
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <div>
                      <Label>Flat</Label>
                      <Input
                        type="number"
                        placeholder="Flat"
                        defaultValue={address.flat}
                        onChange={(event) =>
                          updateAddress(index, "flat", event.target.value)
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <div>
                      <Label>Row</Label>
                      <Input
                        type="number"
                        placeholder="Row"
                        defaultValue={address.row}
                        onChange={(event) =>
                          updateAddress(index, "row", event.target.value)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
                : editingCustomerId
                ? "Save Changes"
                : "Add Customer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
