import { publicProcedure, router } from '../../trpc';
import * as fs from 'fs';
import * as path from 'path';

export const announcementRouter = router({
	getAnnouncement: publicProcedure.query(async () => {
		const announcementPath = path.join(process.cwd(), 'announcement.txt');
		try {
			const content = fs.readFileSync(announcementPath, 'utf-8');
			return { announcement: content };
		} catch (_error) {
			return { announcement: '暂无公告' };
		}
	}),
});


