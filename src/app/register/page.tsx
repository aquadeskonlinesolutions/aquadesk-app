import { RegistrationWizard } from "./RegistrationWizard";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ dc?: string; group?: string }>;
}) {
  const { dc, group } = await searchParams;

  if (!dc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl text-navy mb-2">
            Registration link required
          </h1>
          <p className="text-gray-600 text-sm">
            This page needs a dive center registration link (e.g. shared by
            your dive center as a QR code or URL). Please use the link they
            gave you.
          </p>
        </div>
      </div>
    );
  }

  return <RegistrationWizard diveCenterId={dc} groupId={group ?? null} />;
}
