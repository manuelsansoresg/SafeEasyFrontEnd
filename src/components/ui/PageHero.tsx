type PageHeroProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  actions?: React.ReactNode;
};

export function PageHero({ title, subtitle, eyebrow, actions }: PageHeroProps) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#168e00] font-[family-name:var(--font-poppins)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
          {title}
        </h1>
        <p className="mt-1 text-gray-500 font-[family-name:var(--font-poppins)]">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
