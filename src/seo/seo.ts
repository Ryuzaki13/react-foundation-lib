import type { SeoContentType, SeoHeadOptions, SeoHeadParams } from "./types";

type MetaTag = Record<string, string>;
type LinkTag = Record<string, string>;
type ScriptTag = {
	type: "application/ld+json";
	children: string;
};

type SeoHeadResult = {
	meta: MetaTag[];
	links: LinkTag[];
	scripts: ScriptTag[];
};

function toOpenGraphType(type: SeoHeadOptions["type"]): "website" | "article" {
	if (type === "Article" || type === "NewsArticle") {
		return "article";
	}

	return "website";
}

function toAbsoluteUrl(pathOrUrl: string, baseUrl: string | undefined): string {
	try {
		return new URL(pathOrUrl).toString();
	} catch {
		if (baseUrl === undefined) {
			return pathOrUrl;
		}

		return new URL(pathOrUrl, baseUrl).toString();
	}
}

function toIsoDate(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return undefined;
	}

	return date.toISOString();
}

function buildJsonLd(options: SeoHeadOptions, canonicalUrl: string): ScriptTag {
	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": options.type,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": canonicalUrl
		},
		headline: options.caption,
		description: options.description,
		url: canonicalUrl,
		inLanguage: "ru-RU"
	};

	const publishedAt = toIsoDate(options.publishedAt);
	if (publishedAt) {
		jsonLd.datePublished = publishedAt;
	}

	const modifiedAt = toIsoDate(options.modifiedAt);
	if (modifiedAt) {
		jsonLd.dateModified = modifiedAt;
	}

	if (options.keywords?.length) {
		jsonLd.keywords = options.keywords.join(", ");
	}

	if (options.image?.url) {
		jsonLd.image = {
			"@type": "ImageObject",
			url: toAbsoluteUrl(options.image.url, options.baseUrl),
			width: options.image.width,
			height: options.image.height,
			name: options.image.alt
		};
	}

	return {
		type: "application/ld+json",
		children: JSON.stringify(jsonLd)
	};
}

export function createSeoHead(options: SeoHeadOptions): SeoHeadResult {
	const canonicalUrl = toAbsoluteUrl(options.pathname, options.baseUrl);
	const robots = options.noIndex ? "noindex, nofollow" : "index, follow";
	const absoluteImageUrl = options.image?.url ? toAbsoluteUrl(options.image.url, options.baseUrl) : undefined;

	const meta: MetaTag[] = [
		{ title: options.caption },
		{ name: "description", content: options.description },
		{ name: "robots", content: robots },
		{ property: "og:type", content: toOpenGraphType(options.type) },
		{ property: "og:title", content: options.caption },
		{ property: "og:description", content: options.description },
		{ property: "og:url", content: canonicalUrl },
		{ property: "og:locale", content: "ru_RU" },
		{ name: "twitter:card", content: absoluteImageUrl ? "summary_large_image" : "summary" },
		{ name: "twitter:title", content: options.caption },
		{ name: "twitter:description", content: options.description }
	];

	if (options.keywords?.length) {
		meta.push({ name: "keywords", content: options.keywords.join(", ") });
	}

	if (absoluteImageUrl) {
		meta.push({ property: "og:image", content: absoluteImageUrl });
		meta.push({ name: "twitter:image", content: absoluteImageUrl });

		if (options.image?.alt) {
			meta.push({ property: "og:image:alt", content: options.image.alt });
		}
	}

	const links: LinkTag[] = [{ rel: "canonical", href: canonicalUrl }];
	const scripts: ScriptTag[] = [buildJsonLd(options, canonicalUrl)];

	return { meta, links, scripts };
}

export function createRouteHead(type: SeoContentType, path: string, params: SeoHeadParams | undefined | null): SeoHeadResult {
	const caption = params?.caption ?? "";
	const description = params?.description ?? "";

	return createSeoHead({
		pathname: path,
		caption,
		description,
		type,
		image: params?.previewImage
			? {
					url: params.previewImage,
					alt: params.previewImageAlt
				}
			: undefined,
		publishedAt: params?.created,
		modifiedAt: params?.updated
	});
}
