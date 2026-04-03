import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /password-requirements/requirements:
 *   get:
 *     tags: [Utility]
 *     summary: Get required password complexity rules
 *     responses:
 *       200:
 *         description: Password requirements object
 */
router.get('/requirements', (req, res) => {
    res.json({
        minLength: 8,
        requirements: [
            'At least 8 characters long',
            'At least one uppercase letter (A-Z)',
            'At least one lowercase letter (a-z)',
            'At least one number (0-9)',
            'At least one special character (@$!%*?&)'
        ],
        allowedSpecialChars: '@$!%*?&',
        examples: [
            'MyP@ssw0rd',
            'Secure123!',
            'Admin@2024'
        ]
    });
});

export default router;
