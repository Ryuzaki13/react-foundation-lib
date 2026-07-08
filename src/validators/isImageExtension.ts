export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

export function isImageExtension(ext: string): boolean {
	return IMAGE_EXTENSIONS.includes((ext || "").toLowerCase());
}
