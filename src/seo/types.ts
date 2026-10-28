import {
	type SEO_CONTENT_TYPE_WEBSITE,
	type SEO_CONTENT_TYPE_WEB_PAGE,
	type SEO_CONTENT_TYPE_ARTICLE,
	type SEO_CONTENT_TYPE_NEWS_ARTICLE
} from "./seoContentTypeConstants";

export type SeoContentType =
	| typeof SEO_CONTENT_TYPE_WEBSITE
	| typeof SEO_CONTENT_TYPE_WEB_PAGE
	| typeof SEO_CONTENT_TYPE_ARTICLE
	| typeof SEO_CONTENT_TYPE_NEWS_ARTICLE;

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
