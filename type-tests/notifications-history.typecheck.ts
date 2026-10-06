import {
	createNotificationsStore,
	notify,
	type Notification,
	type NotificationPushInput,
	type NotificationUpdatePatch
} from "../src/notifications";

const defaultInput = { type: "info", message: "Прежний контракт", ttlMs: 0 } satisfies NotificationPushInput;
const ephemeralInput = { type: "info", message: "Эфемерный текст", ttlMs: 0, retainInHistory: false } satisfies NotificationPushInput;
const explicitInput = { ...ephemeralInput, retainInHistory: true } satisfies NotificationPushInput;
const preservePatch = { message: "Обновление", retainInHistory: undefined } satisfies NotificationUpdatePatch;
const optOutPatch = { retainInHistory: false } satisfies NotificationUpdatePatch;
const optInPatch = { retainInHistory: true } satisfies NotificationUpdatePatch;
const existingNotification = { id: "existing", type: "info", message: "Прежняя модель", createdAt: 0 } satisfies Notification;
const ephemeralNotification = { ...existingNotification, retainInHistory: false } satisfies Notification;

const store = createNotificationsStore();
const defaultId: string = store.getState().actions.push(defaultInput);
const ephemeralId: string = store.getState().actions.push(ephemeralInput);
const updated: boolean = store.getState().actions.update(ephemeralId, preservePatch);
const upserted: string = store.getState().actions.upsert({ ...explicitInput, id: ephemeralId });
const facadeId: string = notify.info(ephemeralInput.message, { retainInHistory: false });
const facadeUpdated: boolean = notify.update(facadeId, optOutPatch);
const facadeUpserted: string = notify.upsert({ ...ephemeralInput, id: facadeId });
void [defaultId, updated, upserted, facadeUpdated, facadeUpserted, optInPatch, ephemeralNotification];
