import { checkFileSignature, type FileSignatureCheckOptions, type FileSignatureCheckResult } from "../src/file";

const options = { extension: "png", bytes: new Uint8Array() } satisfies FileSignatureCheckOptions;
const check: (options: FileSignatureCheckOptions) => FileSignatureCheckResult = checkFileSignature;
const result: "match" | "mismatch" | "unsupported" = check(options);
void [options, check, result];
