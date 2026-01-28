export class Utils {
	static compareVersions(v1: string, v2: string): number {
		// -1 if v1 < v2
		// 0 if v1 == v2
		// 1 if v1 > v2
		const v1Parts = v1.split(".").map(Number);
		const v2Parts = v2.split(".").map(Number);

		for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
			const part1 = v1Parts[i] || 0;
			const part2 = v2Parts[i] || 0;

			if (part1 > part2) return 1;
			if (part1 < part2) return -1;
		}
		return 0;
	}
}
