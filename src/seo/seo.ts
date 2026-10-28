import { SEO_CONTENT_TYPE_ARTICLE, SEO_CONTENT_TYPE_NEWS_ARTICLE, SEO_CONTENT_TYPE_WEB_PAGE } from "./seoContentTypeConstants";
import { type SeoContentType, type SeoHeadOptions, type SeoHeadParams } from "./types";

// Типы OpenGraph и MIME JSON-LD повторяются в contract и формируемом head.
const OPEN_GRAPH_TYPE_WEBSITE = "website";
const OPEN_GRAPH_TYPE_ARTICLE = "article";
const JSON_LD_SCRIPT_MIME = "application/ld+json";

type MetaTag = Record<string, string>;
type LinkTag = Record<string, string>;
type ScriptTag = {
	type: typeof JSON_LD_SCRIPT_MIME;
	children: string;
};

type SeoHeadResult = {
	meta: MetaTag[];
	links: LinkTag[];
	scripts: ScriptTag[];
};

function toOpenGraphType(type: SeoHeadOptions["type"]): typeof OPEN_GRAPH_TYPE_WEBSITE | typeof OPEN_GRAPH_TYPE_ARTICLE {
	if (type === SEO_CONTENT_TYPE_ARTICLE || type === SEO_CONTENT_TYPE_NEWS_ARTICLE) {
		return OPEN_GRAPH_TYPE_ARTICLE;
	}

	return OPEN_GRAPH_TYPE_WEBSITE;
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
			"@type": SEO_CONTENT_TYPE_WEB_PAGE,
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
		type: JSON_LD_SCRIPT_MIME,
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
