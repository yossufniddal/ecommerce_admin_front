"use client";

import { CustomerDetail } from "@/components/customers/CustomersPage";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Area, AreaListResponse, Section, SectionListResponse } from "@/components/locations/LocationsPage";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";

type ViewCustomerPageProps = {
  customer: CustomerDetail | null;
};

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

function formatAddress(address: CustomerDetail["addresses"][number]) {
  const parts = [
    address.street,
    address.building ? `Building ${address.building}` : null,
    address.flat ? `Flat ${address.flat}` : null,
    address.row ? `Row ${address.row}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "No address details";
}

export default function ViewCustomerPage({ customer }: ViewCustomerPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [flat, setFlat] = useState("");
  const [row, setRow] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const loadLocationOptions = useCallback(async () => {
    if ((sections.length > 0 && areas.length > 0) || isLoadingLocations) {
      return;
    }

    setIsLoadingLocations(true);
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
      setIsLoadingLocations(false);
    }
  }, [areas.length, isLoadingLocations, request, sections.length]);

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: String(section.id),
        label: section.name,
      })),
    [sections]
  );

  const areaOptions = useMemo(
    () =>
      areas
        .filter((area) => String(area.sectionId) === sectionId)
        .map((area) => ({
          value: String(area.id),
          label: area.name,
        })),
    [areas, sectionId]
  );

  if (!customer) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Customer not found
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This customer could not be loaded.
        </p>
      </div>
    );
  }

  function openPhoneModal() {
    setPhoneNumber("");
    setErrorMessage("");
    setIsPhoneModalOpen(true);
  }

  function openAddressModal() {
    setSectionId("");
    setAreaId("");
    setStreet("");
    setBuilding("");
    setFlat("");
    setRow("");
    setErrorMessage("");
    setIsAddressModalOpen(true);
    void loadLocationOptions();
  }

  async function handleAddPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      setErrorMessage("Phone number is required.");
      return;
    }

    setIsSavingPhone(true);
    setErrorMessage("");

    try {
      const response = await request(`/customers/${customer.id}/phones`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber: trimmedPhone }),
      });

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not add phone number.");
        return;
      }

      setIsPhoneModalOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not add phone number.");
    } finally {
      setIsSavingPhone(false);
    }
  }

  async function handleAddAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sectionId || !areaId || !street.trim()) {
      setErrorMessage("Section, area, and street are required.");
      return;
    }

    setIsSavingAddress(true);
    setErrorMessage("");

    try {
      const response = await request(`/customers/${customer.id}/addresses`, {
        method: "POST",
        body: JSON.stringify({
          sectionId: Number(sectionId),
          areaId: Number(areaId),
          street: street.trim(),
          building: building ? Number(building) : null,
          flat: flat ? Number(flat) : null,
          row: row ? Number(row) : null,
        }),
      });

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not add address.");
        return;
      }

      setIsAddressModalOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not add address.");
    } finally {
      setIsSavingAddress(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Customer Name
            </p>
            <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
              {customer.name}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Added At
            </p>
            <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
              {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Last Order Date
            </p>
            <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
              {customer.lastOrderDate
                ? new Date(customer.lastOrderDate).toLocaleDateString()
                : "No orders yet"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Saved Addresses
            </p>
            <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
              {customer.addresses.length}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Last Order
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Most recent order activity for this customer.
          </p>
        </div>

        {customer.orders.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No orders yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Order Number
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {customer.orders[0].orderNumber}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Date
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {new Date(customer.orders[0].orderDate).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Number Of Items
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {customer.orders[0].numberOfItems}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Order Total
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                EGP {customer.orders[0].orderTotal.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Status
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800 capitalize dark:text-white/90">
                {customer.orders[0].status}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Phone Numbers
            </h2>
            <button
              type="button"
              onClick={openPhoneModal}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Add phone number
            </button>
          </div>
          <div className="p-6">
            {customer.phones.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No phone numbers saved.
              </p>
            ) : (
              <div className="space-y-3">
                {customer.phones.map((phone, index) => (
                  <div
                    key={phone.id ?? `phone-${index}`}
                    className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 dark:bg-white/[0.04] dark:text-white/90"
                  >
                    {phone.phoneNumber}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Addresses
            </h2>
            <button
              type="button"
              onClick={openAddressModal}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Add address
            </button>
          </div>
          <div className="p-6">
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No addresses saved.
              </p>
            ) : (
              <div className="space-y-4">
                {customer.addresses.map((address, index) => (
                  <div
                    key={address.id ?? `address-${index}`}
                    className="rounded-xl bg-gray-50 px-4 py-4 dark:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {address.areaName}
                      </div>
                      {address.isMain && (
                        <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                          Main
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {address.sectionName}
                    </p>
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatAddress(address)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Orders Head
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Order number, date, item count, total, and current status.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[860px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Order Number
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Date
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Number Of Items
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Order Total
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
                {customer.orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No orders found for this customer.
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="px-5 py-4 text-start font-medium text-gray-800 dark:text-white/90">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {order.numberOfItems}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        EGP {order.orderTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {order.status}
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

      <Modal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        className="max-w-[520px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Add Phone Number
          </h2>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleAddPhone}>
          {errorMessage && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          )}

          <div>
            <Label>
              Phone Number <span className="text-error-500">*</span>
            </Label>
            <Input
              placeholder="010..."
              defaultValue={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={isSavingPhone}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsPhoneModalOpen(false)}
              disabled={isSavingPhone}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingPhone}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isSavingPhone ? "Saving..." : "Add Phone Number"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        className="max-w-[640px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Add Address
          </h2>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleAddAddress}>
          {errorMessage && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>
                Section <span className="text-error-500">*</span>
              </Label>
              <Select
                key={`section-${sectionId}`}
                options={sectionOptions}
                placeholder={
                  isLoadingLocations ? "Loading sections..." : "Select section"
                }
                defaultValue={sectionId}
                onChange={(value) => {
                  setSectionId(value);
                  setAreaId("");
                }}
              />
            </div>

            <div>
              <Label>
                Area <span className="text-error-500">*</span>
              </Label>
              <Select
                key={`area-${areaId}-${sectionId}`}
                options={areaOptions}
                placeholder={sectionId ? "Select area" : "Select section first"}
                defaultValue={areaId}
                onChange={setAreaId}
              />
            </div>

            <div className="sm:col-span-2">
              <Label>
                Street <span className="text-error-500">*</span>
              </Label>
              <Input
                placeholder="Street"
                defaultValue={street}
                onChange={(event) => setStreet(event.target.value)}
                disabled={isSavingAddress}
              />
            </div>

            <div>
              <Label>Building</Label>
              <Input
                type="number"
                placeholder="Building"
                defaultValue={building}
                onChange={(event) => setBuilding(event.target.value)}
                disabled={isSavingAddress}
              />
            </div>

            <div>
              <Label>Flat</Label>
              <Input
                type="number"
                placeholder="Flat"
                defaultValue={flat}
                onChange={(event) => setFlat(event.target.value)}
                disabled={isSavingAddress}
              />
            </div>

            <div>
              <Label>Row</Label>
              <Input
                type="number"
                placeholder="Row"
                defaultValue={row}
                onChange={(event) => setRow(event.target.value)}
                disabled={isSavingAddress}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(false)}
              disabled={isSavingAddress}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingAddress}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isSavingAddress ? "Saving..." : "Add Address"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
