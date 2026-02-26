import { Router } from 'express';

const router = Router();

// Endpoint to get password requirements (useful for frontend validation)
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
