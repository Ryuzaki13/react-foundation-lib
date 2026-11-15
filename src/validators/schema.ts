import { z } from "zod";

const invalidHttpUrlMessage = "Укажите полный адрес, начинающийся с http:// или https://.";
const httpUrlStart = /^https?:\/\/[^/?#]/iu;
const invalidHttpUrlCharacter = /[\\\s\p{Cc}]/u;

/** Проверяет явно записанный HTTP(S)-адрес и сохраняет исходную строку. */
export const httpUrlSchema = z
	.string()
	.refine((value) => httpUrlStart.test(value) && !invalidHttpUrlCharacter.test(value), invalidHttpUrlMessage)
	.pipe(z.url({ protocol: /^https?$/, error: invalidHttpUrlMessage }));
