import { checkFileSignature, type FileSignatureCheckOptions, type FileSignatureCheckResult } from "../src/file";

const options = { extension: "png", bytes: new Uint8Array() } satisfies FileSignatureCheckOptions;
const check: (options: FileSignatureCheckOptions) => FileSignatureCheckResult = checkFileSignature;
const result: "match" | "mismatch" | "unsupported" = check(options);
// Независимые значения вместе с присваиванием выше проверяют union в обе стороны.
const allResultVariants = ["match", "mismatch", "unsupported"] as const satisfies readonly FileSignatureCheckResult[];
void [options, check, result, allResultVariants];
