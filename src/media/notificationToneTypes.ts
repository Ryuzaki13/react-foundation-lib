/** Ноты синтезированного сигнала; временные значения заданы в секундах. */
export type NotificationToneNote = Readonly<{
	frequency: number;
	offset: number;
	duration: number;
	volume: number;
}>;

export type NotificationTonePlayer = Readonly<{
	activate: () => Promise<boolean>;
	play: () => boolean;
	dispose: () => void;
}>;
