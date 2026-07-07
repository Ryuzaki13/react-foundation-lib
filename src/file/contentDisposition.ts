export type ContentDispositionKind = "inline" | "attachment";

export type ContentDispositionOptions = {
	readonly disposition: ContentDispositionKind;
	readonly filename: string;
	readonly asciiFallback?: string;
};

export function sanitizeFileName(value: string, fallback = "file"): string {
	const normalized = value
		.replace(/[\r\n]/g, " ")
		.replace(/"/g, "'")
		.trim();

	return normalized.length > 0 ? normalized : fallback;
}

export function encodeFilenameRFC5987(value: string): string {
	return encodeURIComponent(value)
		.replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
		.replace(/\*/g, "%2A");
}

export function createAsciiFilenameFallback(value: string, fallback = "file.bin"): string {
	const asciiValue = value
		.replace(/[\r\n]/g, " ")
		.replace(/["\\]/g, "_")
		.replace(/[^\x20-\x7E]/g, "_")
		.replace(/\s+/g, " ")
		.trim();

	return asciiValue.length > 0 ? asciiValue : fallback;
}

export function createContentDispositionHeader({ disposition, filename, asciiFallback = "file.bin" }: ContentDispositionOptions): string {
	const sanitizedFilename = sanitizeFileName(filename, asciiFallback);
	const asciiFilename = createAsciiFilenameFallback(sanitizedFilename, asciiFallback);
	const encodedFilename = encodeFilenameRFC5987(sanitizedFilename);

	return `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}
