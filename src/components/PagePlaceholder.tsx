export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-2">{title}</h1>
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="bg-white rounded-card shadow-card border border-gray-200 p-8 text-gray-400 text-sm">
        Not built yet — scaffolding only.
      </div>
    </div>
  );
}
