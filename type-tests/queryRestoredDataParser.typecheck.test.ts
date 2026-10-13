import { QUERY_RESTORED_DATA_PARSER, type AppQueryMeta, type QueryRestoredDataParser } from "../src/query-client";

/** Consumer начинает restored data как unknown и самостоятельно проверяет свою форму. */
const parseRestoredData: QueryRestoredDataParser = (data) => {
	if (typeof data !== "string") throw new Error("Ожидалась строка.");
	return data;
};
const meta: AppQueryMeta = { sessionScoped: true, [QUERY_RESTORED_DATA_PARSER]: parseRestoredData };
const spreadMeta: AppQueryMeta = { ...meta };
const optionalParser: QueryRestoredDataParser | undefined = spreadMeta[QUERY_RESTORED_DATA_PARSER];
const symbolKey: symbol = QUERY_RESTORED_DATA_PARSER;
void [optionalParser, symbolKey];
