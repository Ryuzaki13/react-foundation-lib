import { type NotificationToneNote, type NotificationTonePlayer } from "./notificationToneTypes";

/**
 * Один AudioContext и ограниченный набор осцилляторов. activate вызывается из
 * жеста пользователя; доставка сама не пытается обойти autoplay policy.
 */
export function createNotificationTonePlayer(notes: readonly NotificationToneNote[]): NotificationTonePlayer {
	if (
		notes.length === 0 ||
		notes.length > 8 ||
		notes.some(
			(note) =>
				![note.frequency, note.offset, note.duration, note.volume].every(Number.isFinite) ||
				note.frequency < 20 ||
				note.frequency > 20000 ||
				note.offset < 0 ||
				note.duration < 0.04 ||
				note.offset + note.duration > 1.5 ||
				note.volume < 0 ||
				note.volume > 0.3
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
				return !disposed && context.state === "running";
			} catch {
				// Отказ autoplay является ожидаемым результатом команды, а не ошибкой чата.
				return false;
			}
		},
		play() {
			if (disposed || !context || context.state !== "running" || context.currentTime < playingUntil) return false;
			const audio = context;
			playingUntil = audio.currentTime + Math.max(...notes.map((note) => note.offset + note.duration));
			for (const note of notes) {
				const oscillator = audio.createOscillator();
				const gain = audio.createGain();
				const start = audio.currentTime + note.offset;
				oscillator.type = "sine";
				oscillator.frequency.value = note.frequency;
				gain.gain.setValueAtTime(0, start);
				gain.gain.linearRampToValueAtTime(note.volume, start + 0.025);
				gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
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
