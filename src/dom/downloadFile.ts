export function downloadFileFromObjectURL(filename: string, objectUrl: string) {
	const link = document.createElement("a");

	link.href = objectUrl;
	link.download = filename;
	link.click();

	window.setTimeout(() => {
		window.URL.revokeObjectURL(objectUrl);
	}, 0);
}

export function downloadFileFromBlob(filename: string, blob: Blob) {
	const objectUrl = window.URL.createObjectURL(blob);
	downloadFileFromObjectURL(filename, objectUrl);
}

export function downloadFileFromJson(filename: string, payload: unknown) {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
	downloadFileFromBlob(filename, blob);
}
