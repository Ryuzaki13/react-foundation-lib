import { type NotificationToneNote, type NotificationTonePlayer } from "./notificationToneTypes";

// Пределы короткого сигнала и параметры его огибающей отделены от состояния AudioContext.
const AUDIO_CONTEXT_RUNNING_STATE = "running";
const NOTIFICATION_TONE_MAX_NOTES = 8;
const NOTIFICATION_TONE_MIN_FREQUENCY = 20;
const NOTIFICATION_TONE_MAX_FREQUENCY = 20_000;
const NOTIFICATION_TONE_MIN_DURATION_SECONDS = 0.04;
const NOTIFICATION_TONE_MAX_DURATION_SECONDS = 1.5;
const NOTIFICATION_TONE_MAX_VOLUME = 0.3;
const NOTIFICATION_TONE_ATTACK_SECONDS = 0.025;
const NOTIFICATION_TONE_SILENCE_GAIN = 0.0001;

/**
 * Один AudioContext и ограниченный набор осцилляторов. activate вызывается из
 * жеста пользователя; доставка сама не пытается обойти autoplay policy.
 */
export function createNotificationTonePlayer(notes: readonly NotificationToneNote[]): NotificationTonePlayer {
	if (
		notes.length === 0 ||
		notes.length > NOTIFICATION_TONE_MAX_NOTES ||
		notes.some(
			(note) =>
				![note.frequency, note.offset, note.duration, note.volume].every(Number.isFinite) ||
				note.frequency < NOTIFICATION_TONE_MIN_FREQUENCY ||
				note.frequency > NOTIFICATION_TONE_MAX_FREQUENCY ||
				note.offset < 0 ||
				note.duration < NOTIFICATION_TONE_MIN_DURATION_SECONDS ||
				note.offset + note.duration > NOTIFICATION_TONE_MAX_DURATION_SECONDS ||
				note.volume < 0 ||
				note.volume > NOTIFICATION_TONE_MAX_VOLUME
		)
	)
		throw new Error("Параметры короткого звукового сигнала не прошли проверку.");
	let context: AudioContext | null = null;
	let disposed = false;
	let playingUntil = 0;
	const oscillators = new Set<OscillatorNode>();
	return {
		async activate() {
			if (disposed || typeof AudioContext === "undefined") return false;
			try {
				context ??= new AudioContext();
				await context.resume();
				return !disposed && context.state === AUDIO_CONTEXT_RUNNING_STATE;
			} catch {
				// Отказ autoplay является ожидаемым результатом команды, а не ошибкой чата.
				return false;
			}
		},
		play() {
			if (disposed || !context || context.state !== AUDIO_CONTEXT_RUNNING_STATE || context.currentTime < playingUntil) return false;
			const audio = context;
			playingUntil = audio.currentTime + Math.max(...notes.map((note) => note.offset + note.duration));
			for (const note of notes) {
				const oscillator = audio.createOscillator();
				const gain = audio.createGain();
				const start = audio.currentTime + note.offset;
				oscillator.type = "sine";
				oscillator.frequency.value = note.frequency;
				gain.gain.setValueAtTime(0, start);
				gain.gain.linearRampToValueAtTime(note.volume, start + NOTIFICATION_TONE_ATTACK_SECONDS);
				gain.gain.exponentialRampToValueAtTime(NOTIFICATION_TONE_SILENCE_GAIN, start + note.duration);
				oscillator.connect(gain);
				gain.connect(audio.destination);
				oscillators.add(oscillator);
				oscillator.onended = () => {
					oscillators.delete(oscillator);
					oscillator.disconnect();
					gain.disconnect();
				};
				oscillator.start(start);
				oscillator.stop(start + note.duration);
			}
			return true;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const oscillator of oscillators) oscillator.stop();
			oscillators.clear();
			if (context) void context.close().catch(() => undefined); // Уже закрытый аппаратный audio backend больше не используется.
		}
	};
}
