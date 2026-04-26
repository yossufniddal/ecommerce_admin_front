import LocationsPage, {
  AreaListResponse,
  SectionListResponse,
} from "@/components/locations/LocationsPage";
import { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Locations | MCS Ecommerce Admin",
  description: "Manage sections and areas",
};

const emptySections: SectionListResponse = {
  items: [],
  page: 1,
  pageSize: 5,
  totalCount: 0,
  totalPages: 1,
};

const emptyAreas: AreaListResponse = {
  items: [],
  page: 1,
  pageSize: 5,
  totalCount: 0,
  totalPages: 1,
};

export default async function Page() {
  const token = (await cookies()).get("auth_token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5010";

  let initialSections = emptySections;
  let initialAreas = emptyAreas;

  if (token) {
    try {
      const [sectionsResponse, areasResponse] = await Promise.all([
        fetch(`${apiUrl}/sections?page=1&pageSize=5`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/areas?page=1&pageSize=5`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (sectionsResponse.ok) {
        initialSections = await sectionsResponse.json();
      }

      if (areasResponse.ok) {
        initialAreas = await areasResponse.json();
      }
    } catch {
      initialSections = emptySections;
      initialAreas = emptyAreas;
    }
  }

  return (
    <LocationsPage
      initialSections={initialSections}
      initialAreas={initialAreas}
    />
  );
}
