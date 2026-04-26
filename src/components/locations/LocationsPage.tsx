"use client";

import Checkbox from "@/components/form/input/Checkbox";
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
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Section = {
  id: number;
  name: string;
  mcsSectionNumber: number | null;
};

export type Area = {
  id: number;
  name: string;
  sectionId: number;
  sectionName: string;
  deliveryServiceForStore: number;
  deliveryServiceForDist: number;
  deliveryServiceTotal: number;
  isApplied: boolean;
  mcsAreaCode: number | null;
};

export type SectionListResponse = {
  items: Section[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AreaListResponse = {
  items: Area[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type LocationsPageProps = {
  initialSections: SectionListResponse;
  initialAreas: AreaListResponse;
};

type ActiveTab = "sections" | "areas";

const pageSize = 5;

function getAuthToken() {
  return (
    window.localStorage.getItem("auth_token") ??
    window.sessionStorage.getItem("auth_token")
  );
}

export default function LocationsPage({
  initialSections,
  initialAreas,
}: LocationsPageProps) {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  const [activeTab, setActiveTab] = useState<ActiveTab>("sections");
  const [errorMessage, setErrorMessage] = useState("");

  const [sections, setSections] = useState<Section[]>(initialSections.items);
  const [sectionOptionsData, setSectionOptionsData] = useState<Section[]>(
    initialSections.items
  );
  const [sectionsPage, setSectionsPage] = useState(initialSections.page);
  const [sectionsTotalPages, setSectionsTotalPages] = useState(
    initialSections.totalPages
  );
  const [sectionsTotalCount, setSectionsTotalCount] = useState(
    initialSections.totalCount
  );
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsSaving, setSectionsSaving] = useState(false);
  const [sectionMenuId, setSectionMenuId] = useState<number | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionName, setSectionName] = useState("");
  const didHydrateSections = useRef(false);

  const [areas, setAreas] = useState<Area[]>(initialAreas.items);
  const [areasPage, setAreasPage] = useState(initialAreas.page);
  const [areasTotalPages, setAreasTotalPages] = useState(initialAreas.totalPages);
  const [areasTotalCount, setAreasTotalCount] = useState(initialAreas.totalCount);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasSaving, setAreasSaving] = useState(false);
  const [areasLoadingSections, setAreasLoadingSections] = useState(false);
  const [areaMenuId, setAreaMenuId] = useState<number | null>(null);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaSectionId, setAreaSectionId] = useState("");
  const [areaStoreDelivery, setAreaStoreDelivery] = useState("0");
  const [areaDistDelivery, setAreaDistDelivery] = useState("0");
  const [areaIsApplied, setAreaIsApplied] = useState(true);
  const didHydrateAreas = useRef(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/signin?next=/locations");
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
        router.replace("/signin?next=/locations");
        throw new Error("Session expired.");
      }

      return response;
    },
    [apiUrl, router]
  );

  const loadSections = useCallback(
    async (page: number) => {
      setSectionsLoading(true);
      setErrorMessage("");

      try {
        const response = await request(`/sections?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) {
          throw new Error("Could not load sections.");
        }

        const data: SectionListResponse = await response.json();
        setSections(data.items);
        setSectionsPage(data.page);
        setSectionsTotalPages(data.totalPages);
        setSectionsTotalCount(data.totalCount);
        setSectionOptionsData((current) => {
          const next = new Map(current.map((section) => [section.id, section]));
          data.items.forEach((section) => next.set(section.id, section));
          return Array.from(next.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load sections.");
      } finally {
        setSectionsLoading(false);
      }
    },
    [request]
  );

  const loadAreas = useCallback(
    async (page: number) => {
      setAreasLoading(true);
      setErrorMessage("");

      try {
        const response = await request(`/areas?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) {
          throw new Error("Could not load areas.");
        }

        const data: AreaListResponse = await response.json();
        setAreas(data.items);
        setAreasPage(data.page);
        setAreasTotalPages(data.totalPages);
        setAreasTotalCount(data.totalCount);
      } catch (error) {
        if (error instanceof Error && error.message === "Missing auth token.") {
          return;
        }

        setErrorMessage("Could not load areas.");
      } finally {
        setAreasLoading(false);
      }
    },
    [request]
  );

  const loadSectionOptions = useCallback(async () => {
    if (sectionOptionsData.length > 0 || areasLoadingSections) {
      return;
    }

    setAreasLoadingSections(true);

    try {
      const response = await request("/sections?page=1&pageSize=1000");
      if (!response.ok) {
        throw new Error("Could not load sections.");
      }

      const data: SectionListResponse = await response.json();
      setSectionOptionsData(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }
    } finally {
      setAreasLoadingSections(false);
    }
  }, [areasLoadingSections, request, sectionOptionsData.length]);

  useEffect(() => {
    if (!didHydrateSections.current) {
      didHydrateSections.current = true;
      return;
    }

    void loadSections(sectionsPage);
  }, [loadSections, sectionsPage]);

  useEffect(() => {
    if (!didHydrateAreas.current) {
      didHydrateAreas.current = true;
      return;
    }

    void loadAreas(areasPage);
  }, [areasPage, loadAreas]);

  const sectionOptions = useMemo(
    () =>
      sectionOptionsData.map((section) => ({
        value: String(section.id),
        label: section.name,
      })),
    [sectionOptionsData]
  );

  const areaTotalDelivery = useMemo(() => {
    const parsedStore = Number(areaStoreDelivery);
    const parsedDist = Number(areaDistDelivery);

    if (!Number.isFinite(parsedStore) || !Number.isFinite(parsedDist)) {
      return "";
    }

    return (parsedStore + parsedDist).toFixed(2);
  }, [areaDistDelivery, areaStoreDelivery]);

  function openAddSectionModal() {
    setEditingSection(null);
    setSectionName("");
    setErrorMessage("");
    setSectionModalOpen(true);
  }

  function openEditSectionModal(section: Section) {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionMenuId(null);
    setErrorMessage("");
    setSectionModalOpen(true);
  }

  function openAddAreaModal() {
    setEditingArea(null);
    setAreaName("");
    setAreaSectionId("");
    setAreaStoreDelivery("0");
    setAreaDistDelivery("0");
    setAreaIsApplied(true);
    setAreaMenuId(null);
    setErrorMessage("");
    setAreaModalOpen(true);
    void loadSectionOptions();
  }

  function openEditAreaModal(area: Area) {
    setEditingArea(area);
    setAreaName(area.name);
    setAreaSectionId(String(area.sectionId));
    setAreaStoreDelivery(area.deliveryServiceForStore.toString());
    setAreaDistDelivery(area.deliveryServiceForDist.toString());
    setAreaIsApplied(area.isApplied);
    setAreaMenuId(null);
    setErrorMessage("");
    setAreaModalOpen(true);
    void loadSectionOptions();
  }

  async function handleSectionDelete(id: number) {
    setSectionMenuId(null);
    if (!window.confirm("Delete this section?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/sections/${id}`, { method: "DELETE" });
      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Section is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadSections(sectionsPage);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete section.");
    }
  }

  async function handleAreaDelete(id: number) {
    setAreaMenuId(null);
    if (!window.confirm("Delete this area?")) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await request(`/areas/${id}`, { method: "DELETE" });
      if (response.status === 409) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Area is still referenced.");
        return;
      }

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      await loadAreas(areasPage);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not delete area.");
    }
  }

  async function handleSectionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = sectionName.trim();
    if (!trimmedName) {
      setErrorMessage("Section name is required.");
      return;
    }

    setSectionsSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      mcsSectionNumber: editingSection?.mcsSectionNumber ?? null,
    };

    try {
      const response = await request(
        editingSection ? `/sections/${editingSection.id}` : "/sections",
        {
          method: editingSection ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save section.");
        return;
      }

      setSectionModalOpen(false);
      await loadSections(editingSection ? sectionsPage : 1);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save section.");
    } finally {
      setSectionsSaving(false);
    }
  }

  async function handleAreaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = areaName.trim();
    const parsedStore = Number(areaStoreDelivery);
    const parsedDist = Number(areaDistDelivery);
    const parsedTotal = Number(areaTotalDelivery);

    if (!trimmedName) {
      setErrorMessage("Area name is required.");
      return;
    }

    if (!areaSectionId) {
      setErrorMessage("Section is required.");
      return;
    }

    if (
      !Number.isFinite(parsedStore) ||
      !Number.isFinite(parsedDist) ||
      !Number.isFinite(parsedTotal) ||
      parsedStore < 0 ||
      parsedDist < 0 ||
      parsedTotal < 0
    ) {
      setErrorMessage("Delivery values must be valid non-negative numbers.");
      return;
    }

    setAreasSaving(true);
    setErrorMessage("");

    const payload = {
      name: trimmedName,
      sectionId: Number(areaSectionId),
      deliveryServiceForStore: parsedStore,
      deliveryServiceForDist: parsedDist,
      deliveryServiceTotal: parsedTotal,
      isApplied: areaIsApplied,
      mcsAreaCode: editingArea?.mcsAreaCode ?? null,
    };

    try {
      const response = await request(
        editingArea ? `/areas/${editingArea.id}` : "/areas",
        {
          method: editingArea ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body: { message?: string } = await response.json();
        setErrorMessage(body.message ?? "Could not save area.");
        return;
      }

      setAreaModalOpen(false);
      await loadAreas(editingArea ? areasPage : 1);
    } catch (error) {
      if (error instanceof Error && error.message === "Session expired.") {
        return;
      }

      setErrorMessage("Could not save area.");
    } finally {
      setAreasSaving(false);
    }
  }

  if ((activeTab === "sections" && sectionsLoading) || (activeTab === "areas" && areasLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          {activeTab === "sections" ? "Loading sections" : "Loading areas"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Locations
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage delivery sections and areas from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={activeTab === "sections" ? openAddSectionModal : openAddAreaModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
        >
          <PlusIcon />
          Add New
        </button>
      </div>

      <div className="border-b border-gray-200 dark:border-white/[0.08]">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("sections")}
            className={`border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "sections"
                ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
            }`}
          >
            Sections
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("areas")}
            className={`border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ${
              activeTab === "areas"
                ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
            }`}
          >
            Areas
          </button>
        </div>
      </div>

      {errorMessage && !sectionModalOpen && !areaModalOpen && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          {errorMessage}
        </div>
      )}

      {activeTab === "sections" ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="relative z-10 max-w-full overflow-x-auto">
            <div className="min-w-[760px]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Section
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Options
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {sections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No sections found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sections.map((section) => (
                      <TableRow key={section.id}>
                        <TableCell className="px-5 py-4 text-start font-medium text-gray-800 dark:text-white/90">
                          {section.name}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="relative flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setSectionMenuId((current) =>
                                  current === section.id ? null : section.id
                                )
                              }
                              className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                              aria-label={`Open options for ${section.name}`}
                            >
                              <MoreDotIcon />
                            </button>
                            <Dropdown
                              isOpen={sectionMenuId === section.id}
                              onClose={() => setSectionMenuId(null)}
                              className="w-40"
                              usePortal={true}
                            >
                              <DropdownItem
                                onItemClick={() => openEditSectionModal(section)}
                                className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                              >
                                <PencilIcon />
                                Edit
                              </DropdownItem>
                              <DropdownItem
                                onItemClick={() => void handleSectionDelete(section.id)}
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
              Showing {sections.length} of {sectionsTotalCount} sections
            </p>
            <Pagination
              currentPage={sectionsPage}
              totalPages={sectionsTotalPages}
              onPageChange={(page) =>
                setSectionsPage(Math.min(Math.max(page, 1), sectionsTotalPages))
              }
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="relative z-10 max-w-full overflow-x-auto">
            <div className="min-w-[1200px]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Area
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Section
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Store Delivery
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Dist Delivery
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Total Delivery
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Applied
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      Options
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {areas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No areas found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    areas.map((area) => (
                      <TableRow key={area.id}>
                        <TableCell className="px-5 py-4 text-start font-medium text-gray-800 dark:text-white/90">
                          {area.name}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                          {area.sectionName}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                          EGP {area.deliveryServiceForStore.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                          EGP {area.deliveryServiceForDist.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                          EGP {area.deliveryServiceTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-theme-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              area.isApplied
                                ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {area.isApplied ? "Applied" : "Disabled"}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="relative flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setAreaMenuId((current) =>
                                  current === area.id ? null : area.id
                                )
                              }
                              className="dropdown-toggle flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-300"
                              aria-label={`Open options for ${area.name}`}
                            >
                              <MoreDotIcon />
                            </button>
                            <Dropdown
                              isOpen={areaMenuId === area.id}
                              onClose={() => setAreaMenuId(null)}
                              className="w-40"
                              usePortal={true}
                            >
                              <DropdownItem
                                onItemClick={() => openEditAreaModal(area)}
                                className="flex items-center gap-2 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                              >
                                <PencilIcon />
                                Edit
                              </DropdownItem>
                              <DropdownItem
                                onItemClick={() => void handleAreaDelete(area.id)}
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
              Showing {areas.length} of {areasTotalCount} areas
            </p>
            <Pagination
              currentPage={areasPage}
              totalPages={areasTotalPages}
              onPageChange={(page) =>
                setAreasPage(Math.min(Math.max(page, 1), areasTotalPages))
              }
            />
          </div>
        </div>
      )}

      <Modal
        isOpen={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        className="max-w-[560px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingSection ? "Edit Section" : "Add New Section"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use sections to group delivery areas.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSectionSubmit}>
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
              placeholder="Section name"
              defaultValue={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              disabled={sectionsSaving}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSectionModalOpen(false)}
              disabled={sectionsSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sectionsSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {sectionsSaving
                ? "Saving..."
                : editingSection
                ? "Save Changes"
                : "Add Section"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        className="max-w-[640px] p-6 lg:p-8"
      >
        <div className="pr-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {editingArea ? "Edit Area" : "Add New Area"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure section mapping and delivery charges.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleAreaSubmit}>
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
                placeholder="Area name"
                defaultValue={areaName}
                onChange={(event) => setAreaName(event.target.value)}
                disabled={areasSaving}
              />
            </div>

            <div>
              <Label>
                Section <span className="text-error-500">*</span>
              </Label>
              <Select
                key={`${editingArea?.id ?? "new"}-${areaSectionId}`}
                options={sectionOptions}
                placeholder={
                  areasLoadingSections ? "Loading sections..." : "Select section"
                }
                defaultValue={areaSectionId}
                onChange={setAreaSectionId}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label>Store Delivery</Label>
              <Input
                type="number"
                placeholder="0.00"
                defaultValue={areaStoreDelivery}
                onChange={(event) => setAreaStoreDelivery(event.target.value)}
                disabled={areasSaving}
                step={0.01}
                min="0"
              />
            </div>

            <div>
              <Label>Dist Delivery</Label>
              <Input
                type="number"
                placeholder="0.00"
                defaultValue={areaDistDelivery}
                onChange={(event) => setAreaDistDelivery(event.target.value)}
                disabled={areasSaving}
                step={0.01}
                min="0"
              />
            </div>

            <div>
              <Label>Total Delivery</Label>
              <Input
                type="text"
                value={areaTotalDelivery}
                disabled
              />
            </div>
          </div>

          <div className="flex items-end">
              <Checkbox
                checked={areaIsApplied}
                onChange={setAreaIsApplied}
                disabled={areasSaving}
                label="Applied to delivery"
              />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAreaModalOpen(false)}
              disabled={areasSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={areasSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {areasSaving
                ? "Saving..."
                : editingArea
                ? "Save Changes"
                : "Add Area"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
