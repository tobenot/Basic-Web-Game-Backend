import { publicProcedure, router } from '../trpc';
import * as fs from 'fs';
import * as path from 'path';

export const announcementRouter = router({
  getAnnouncement: publicProcedure.query(async () => {
    const announcementPath = path.join(__dirname, '../../announcement.txt');
    try {
      const content = fs.readFileSync(announcementPath, 'utf-8');
      return { announcement: content };
    } catch (error) {
      console.error('Error reading announcement file:', error);
      return { announcement: '暂无公告' };
    }
  }),
}); 