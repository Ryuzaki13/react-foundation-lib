import { createZipBlob, type CreateZipBlobOptions, type ZipFile } from "../src/zip";

const files: readonly ZipFile[] = [{ blob: new Blob([]), filename: "a.txt" }];
const options: CreateZipBlobOptions = { compression: "deflate", signal: new AbortController().signal };
const create: (files: readonly ZipFile[], options?: CreateZipBlobOptions) => Promise<Blob> = createZipBlob;
const result: Promise<Blob> = create(files, options);

// @ts-expect-error Имя записи обязательно, даже если Blob является File.
const withoutFilename: ZipFile = { blob: new File([], "a.txt") };
// @ts-expect-error Транспорт и чтение URL остаются у вызывающего сценария.
const withUrl: ZipFile = { blob: "https://example.com/a.txt", filename: "a.txt" };
// @ts-expect-error Публичный контракт скрывает уровни и внутренние опции fflate.
const unsupported: CreateZipBlobOptions = { compression: "gzip" };
// @ts-expect-error Контракт не допускает изменения имени записи.
files[0].filename = "b.txt";

void [result, withoutFilename, withUrl, unsupported];
