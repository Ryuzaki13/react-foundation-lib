export type SeoContentType = "WebSite" | "WebPage" | "Article" | "NewsArticle";

export type SeoImage = {
	url: string;
	alt?: string | null;
	width?: number | null;
	height?: number | null;
};

export type SeoHeadOptions = {
	pathname: string;
	caption: string;
	description: string;
	type: SeoContentType;
	baseUrl?: string;
	keywords?: string[];
	image?: SeoImage;
	publishedAt?: string;
	modifiedAt?: string;
	noIndex?: boolean;
};

export type SeoHeadParams = {
	caption: string;
	description: string;
	previewImage: string | null;
	previewImageAlt: string | null;
	created: string;
	updated: string;
};
