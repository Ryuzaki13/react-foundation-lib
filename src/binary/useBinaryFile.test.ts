// @vitest-environment jsdom

import { act, createElement, useLayoutEffect } from "react";

import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useBinaryFile, type UseBinaryFileResult } from "./index";

function Harness({ bin, onResult }: { bin?: string; onResult: (result: UseBinaryFileResult) => void }) {
	const result = useBinaryFile(bin);

	useLayoutEffect(() => {
		onResult(result);
	}, [onResult, result]);

	return null;
}

it("отличает нераспознанные байты от известного MIME и ошибки декодирования", async () => {
	const root = createRoot(document.createElement("div"));
	const onResult = vi.fn<(result: UseBinaryFileResult) => void>();
	const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

	const render = async (bin?: string) => {
		onResult.mockClear();
		await act(async () => root.render(createElement(Harness, { bin, onResult })));

		// Результат должен соответствовать текущему bin уже при первом commit.
		return onResult.mock.calls[0]?.[0];
	};

	try {
		const unknownBase64 = btoa("bytes without a known signature");
		const unknown = await render(unknownBase64);

		expect(unknown).toMatchObject({
			data: { mime: "application/octet-stream", blob: { type: "application/octet-stream" }, isMimeDetected: false },
			error: null
		});
		expect(await unknown?.data?.blob.text()).toBe("bytes without a known signature");
		expect((await render(unknownBase64))?.data?.blob).toBe(unknown?.data?.blob);

		const wrappedPdf = ` \r\n${btoa("%PDF-1.7" + "A".repeat(128))}`;

		expect(await render(wrappedPdf)).toMatchObject({
			data: { mime: "application/pdf", blob: { type: "application/pdf" }, isMimeDetected: true },
			error: null
		});
		expect(await render("data:application/octet-stream;base64,AQID")).toMatchObject({
			data: { mime: "application/octet-stream", isMimeDetected: true },
			error: null
		});
		expect(await render("not valid *")).toEqual({ data: null, error: expect.stringContaining("Некорректный формат base64") });
		expect(logError).toHaveBeenCalledWith(expect.any(Error));
		expect(await render()).toEqual({ data: null, error: null });
	} finally {
		await act(async () => root.unmount());
		logError.mockRestore();
		vi.unstubAllGlobals();
	}
});
