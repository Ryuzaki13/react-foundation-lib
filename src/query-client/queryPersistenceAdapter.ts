export type QueryPersistenceProjectAdapter = {
	persistenceBuster?: string;
	resolveSystemIdentifier?: () => string | null | undefined;
};

let queryPersistenceProjectAdapter: QueryPersistenceProjectAdapter = {};

export function configureQueryPersistenceProjectAdapter(adapter: QueryPersistenceProjectAdapter) {
	queryPersistenceProjectAdapter = adapter;
}

export function getQueryPersistenceProjectAdapter() {
	return queryPersistenceProjectAdapter;
}
