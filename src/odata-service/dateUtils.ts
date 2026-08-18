import { formatDateAsODataDatetime, formatDateAsODataTime } from "../formatters/date/formatDate";

/**
 * Форматирование дат в литералы OData, совместимые с SAP UI5 DateFormat.
 *
 * Примеры:
 * * datetime'2025-11-11T12:00:00'
 * * datetimeoffset'2025-11-11T12:00:00Z'
 * * time'PT12H30M00S'
 */
export const ODataDateFormat = {
	datetime(date: Date): string {
		return `datetime'${formatDateAsODataDatetime(date)}'`;
	},
	datetimeOffset(date: Date): string {
		return `datetimeoffset'${date.toISOString()}'`;
	},
	time(date: Date): string {
		return `time'${formatDateAsODataTime(date)}'`;
	}
};
