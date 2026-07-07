import { load as loadFingerprint } from "@fingerprintjs/fingerprintjs";

let fingerprintPromise: Promise<string | null> | null = null;

export async function getClientFingerprint(): Promise<string | null> {
	if (typeof window === "undefined") {
		return null;
	}

	if (!fingerprintPromise) {
		fingerprintPromise = loadFingerprint()
			.then((fp) => fp.get())
			.then((result) => {
				const visitorId = result.visitorId?.trim();
				return visitorId && visitorId.length > 0 ? visitorId : null;
			})
			.catch(() => null);
	}

	return fingerprintPromise;
}
