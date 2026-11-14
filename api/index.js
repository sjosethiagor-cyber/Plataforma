import { createApp } from '../server/app.js';

const app = await createApp({ isVercel: true });

export default app;
