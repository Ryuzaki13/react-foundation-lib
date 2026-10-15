import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNotificationTonePlayer } from "./createNotificationTonePlayer";

const notes = [{ frequency: 523.25, offset: 0, duration: 0.5, volume: 0.05 }];
const start = vi.fn();
const stop = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
const resume = vi.fn();
const close = vi.fn();
const linearRampToValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();
let state: AudioContextState;
let currentTime: number;
class TestAudioContext {
	get state() {
		return state;
	}
	get currentTime() {
		return currentTime;
	}
	resume = resume;
	close = close;
	destination = {};
	createOscillator = () => ({ type: "", frequency: { value: 0 }, connect, disconnect, start, stop, onended: null });
	createGain = () => ({ connect, disconnect, gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime, exponentialRampToValueAtTime } });
}
beforeEach(() => {
	vi.clearAllMocks();
	state = "suspended";
	currentTime = 0;
	resume.mockImplementation(async () => {
		state = "running";
	});
	close.mockResolvedValue(undefined);
	vi.stubGlobal("AudioContext", TestAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

describe("короткий синтезированный сигнал", () => {
	it("не создаёт звук до активации; плавная огибающая и заданная длительность", async () => {
		const player = createNotificationTonePlayer(notes);
		expect(player.play()).toBe(false);
		expect(resume).not.toHaveBeenCalled();
		expect(await player.activate()).toBe(true);
		expect(player.play()).toBe(true);
		expect(linearRampToValueAtTime).toHaveBeenCalledWith(0.05, 0.025);
		expect(exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.5);
		expect(stop).toHaveBeenCalledWith(0.5);
		player.dispose();
	});
	it("не накладывает burst и не возобновляет контекст из доставки", async () => {
		const player = createNotificationTonePlayer(notes);
		await player.activate();
		player.play();
		expect(player.play()).toBe(false);
		currentTime = 2;
		expect(player.play()).toBe(true);
		state = "suspended";
		expect(player.play()).toBe(false);
		expect(resume).toHaveBeenCalledOnce();
		player.dispose();
	});
	it("unsupported/autoplay отказ и late activation не дают звук после dispose", async () => {
		vi.stubGlobal("AudioContext", undefined);
		const absent = createNotificationTonePlayer(notes);
		expect(await absent.activate()).toBe(false);
		vi.stubGlobal("AudioContext", TestAudioContext);
		const player = createNotificationTonePlayer(notes);
		const pending = Promise.withResolvers<void>();
		resume.mockReturnValue(pending.promise);
		const activation = player.activate();
		player.dispose();
		pending.resolve();
		expect(await activation).toBe(false);
		expect(player.play()).toBe(false);
		player.dispose();
		expect(close).toHaveBeenCalledOnce();
	});
	it.each([NaN, Infinity, -1, 2])("отклоняет недопустимую длительность %s", (duration) => {
		expect(() => createNotificationTonePlayer([{ ...notes[0], duration }])).toThrow();
	});
});
