export function formatPhone(number: string): string {
	const match = clearPhone(number).match(/^(\+7)(\d{3})(\d{3})(\d{2})(\d{2})$/);
	if (!match) return number;
	return `+7 (${match[2]}) ${match[3]}-${match[4]}-${match[5]}`;
}

export function clearPhone(number: string): string {
	return `+7${number
		.replace(/\D/g, "")
		.slice(0, 11)
		.replace(/^(7|8)/, "")}`;
}
