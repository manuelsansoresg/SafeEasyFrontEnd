type JsonLdObject = Record<string, unknown> & {
  "@context"?: string;
  "@type"?: string;
};

const serializeJsonLd = (data: JsonLdObject) => JSON.stringify(data).replace(/</g, "\\u003c");

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const items = (Array.isArray(data) ? data : [data]).filter(
    (item) => typeof item?.["@context"] === "string" && typeof item?.["@type"] === "string",
  );

  return (
    <>
      {items.map((item, index) => (
        <script
          key={`${item["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(item),
          }}
        />
      ))}
    </>
  );
}
