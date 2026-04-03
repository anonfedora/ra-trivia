import { Router } from 'express';
import { prisma } from 'database';
import os from 'os';

const router = Router();

/**
 * @openapi
 * /health/detailed:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get detailed system health information
 *     responses:
 *       200:
 *         description: Detailed health status object
 */
router.get('/detailed', async (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        system: {
            uptime: os.uptime(),
            platform: os.platform(),
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                usage: (1 - os.freemem() / os.totalmem()) * 100
            }
        },
        database: {
            status: 'UNKNOWN',
            responseTime: 0
        }
    };

    // Test Database
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        health.database.status = 'UP';
        health.database.responseTime = Date.now() - dbStart;
    } catch (error) {
        health.database.status = 'DOWN';
        health.status = 'DEGRADED';
    }

    res.json(health);
});

export default router;
