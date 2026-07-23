import { PagePlaceholder } from "@/components/PagePlaceholder";

export default async function DiverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Diver ${id}`}
      description="Registration detail, charges, and payments for one diver."
    />
  );
}
