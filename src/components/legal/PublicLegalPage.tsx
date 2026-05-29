import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LegalDocument } from "@/services/legalService";
import { sanitizeLegalHtml } from "@/lib/sanitizeLegalHtml";

type FallbackSection = {
  title: string;
  text: string;
};

type PublicLegalPageProps = {
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  contactTitle: string;
  contactText: string;
  contactLabel: string;
  icon: LucideIcon;
  document: LegalDocument | null;
  fallbackSections: FallbackSection[];
};

export function PublicLegalPage({
  eyebrow,
  heroTitle,
  heroDescription,
  contactTitle,
  contactText,
  contactLabel,
  icon: Icon,
  document,
  fallbackSections,
}: PublicLegalPageProps) {
  const content = document?.content ? sanitizeLegalHtml(document.content) : "";

  return (
    <div className="overflow-x-hidden bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="mb-4 font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957]">
              {eyebrow}
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">
              {document?.title || heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              {document?.subtitle || heroDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto w-full max-w-5xl min-w-0">
            {document ? (
              <article className="public-legal-content min-w-0 bg-white text-gray-700">
                <div className="min-w-0" dangerouslySetInnerHTML={{ __html: content }} />
              </article>
            ) : (
              <div className="space-y-4">
                {fallbackSections.map((section) => (
                  <article key={section.title} className="rounded-lg border border-gray-100 p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f2f3f4] text-primary">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                        <p className="mt-3 text-sm leading-7 text-gray-500">{section.text}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f4] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-lg bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary">{contactTitle}</h2>
                <p className="mt-2 text-sm leading-7 text-gray-500">{contactText}</p>
              </div>
            </div>
            <Link
              href="/contacto"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary"
            >
              {contactLabel}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
