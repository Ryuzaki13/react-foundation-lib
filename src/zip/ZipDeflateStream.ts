import { ZipPassThrough } from "fflate";

const ZIP_DEFLATE_METHOD = 8;

/**
 * ZipPassThrough владеет CRC/размером, нативный поток выдаёт raw DEFLATE для ZIP.
 * WritableStream обеспечивает backpressure без Blob Workers: их отказ загрузки
 * из-за CSP не передаётся асинхронным API fflate и может оставить его ожидающим.
 */
export class ZipDeflateStream extends ZipPassThrough {
	private readonly writer: WritableStreamDefaultWriter<BufferSource>;
	private readonly output: Promise<void>;
	private readonly cancellation = new AbortController();
	private pendingWrite: Promise<void> = Promise.resolve();

	constructor(filename: string, onError: (error: unknown) => void) {
		super(filename);
		if (typeof CompressionStream !== "function") {
			throw new TypeError("Сжатие ZIP требует CompressionStream с поддержкой deflate-raw");
		}

		const compressor = new CompressionStream("deflate-raw");
		this.compression = ZIP_DEFLATE_METHOD;
		this.writer = compressor.writable.getWriter();
		this.output = compressor.readable.pipeTo(
			new WritableStream<Uint8Array<ArrayBuffer>>({
				write: (chunk) => this.ondata(null, chunk, false),
				close: () => this.ondata(null, new Uint8Array(), true)
			}),
			{ signal: this.cancellation.signal }
		);

		// Чтение выхода может отказать между входными write; отказ сразу завершает
		// весь архив. Сам Promise остаётся доступен для ожидания финального output.
		void this.output.catch(onError);
	}

	protected override process(chunk: Uint8Array<ArrayBuffer>, final: boolean): void {
		this.pendingWrite = this.writer.write(chunk);
		if (final) this.pendingWrite = this.pendingWrite.then(() => this.writer.close());
	}

	/** Вход не накапливается: владелец ожидает write перед чтением следующей части. */
	async write(chunk: Uint8Array<ArrayBuffer>, final: boolean): Promise<void> {
		this.push(chunk, final);
		await this.pendingWrite;

		if (final) {
			await this.output;
			this.writer.releaseLock();
		}
	}

	/** Отмена readable через pipeTo завершает и writable компрессора; callback вызывается без receiver. */
	terminate = (): void => {
		if (this.cancellation.signal.aborted) return;

		this.cancellation.abort();
		this.writer.releaseLock();
	};
}
